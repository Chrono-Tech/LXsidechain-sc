/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "../common/BaseManager.sol";
import "../common/ERC223ReceivingContract.sol";
import "../platform/ChronoBankAsset.sol";
import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";
import "../lib/SafeMath.sol";
import "./TimeHolderWallet.sol";
import "./ERC20DepositStorage.sol";
import "./TimeHolderEmitter.sol";
import "../validators/LXValidatorManager.sol";


/// @title TimeHolder
/// @notice Contract allows to block some amount of shares" balance to unlock
/// functionality inside a system.
contract TimeHolder is BaseManager, TimeHolderEmitter, ERC223ReceivingContract {

    using SafeMath for uint;

    /** Error codes */

    uint public constant ERROR_TIMEHOLDER_ALREADY_ADDED = 12000;
    uint public constant ERROR_TIMEHOLDER_TRANSFER_FAILED = 12003;
    uint public constant ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE = 12006;
    uint public constant ERROR_TIMEHOLDER_LIMIT_EXCEEDED = 12007;
    uint public constant ERROR_TIMEHOLDER_MINER_REQUIRED = 12008;
    uint public constant ERROR_TIMEHOLDER_MINING_LIMIT_NOT_REACHED = 12009;
    uint public constant ERROR_TIMEHOLDER_INVALID_MINING_LIMIT = 12010;
    uint public constant ERROR_TIMEHOLDER_NOTHING_TO_UNLOCK = 12011;
    uint public constant ERROR_TIMEHOLDER_ALREADY_MINER = 12012;

    /** Storage keys */

    /// @dev Contains addresses of tokens that are used as shares
    StorageInterface.AddressesSet private sharesTokenStorage;
    /// @dev Mapping of (token address => limit value) for storing deposit limits
    StorageInterface.AddressUIntMapping private limitsStorage;
    /// @dev Mapping of (token address => list of listeners) for holding list of listeners for each share token
    StorageInterface.AddressOrderedSetMapping private listeners;
    /// @dev Address of TimeHolder wallet
    StorageInterface.Address private walletStorage;
    /// @dev Address of ERC20DepositStorage contract
    StorageInterface.Address private erc20DepositStorage;

    StorageInterface.Address private primaryMiner;

    StorageInterface.Address private validatorManager;

    /// depositor -> mining delegate
    StorageInterface.AddressAddressMapping private delegates;

    /// mining delegate -> delegate
    StorageInterface.AddressAddressMapping private miners;

    /// @dev Mapping of (token address => mining deposits limit amount) for storing lower border of deposits that a user should have to be a miner
    StorageInterface.AddressUIntMapping private miningDepositLimitsStorage;

    /// @dev only token registered in whitelist
    modifier onlyAllowedToken(address _token) {
        if (store.includes(sharesTokenStorage, _token)) {
            _;
        }
    }

    /// @dev TODO
    modifier onlyWithMiner {
        if (store.get(primaryMiner) == 0x0) {
            assembly {
                mstore(0, 12008) // ERROR_TIMEHOLDER_MINER_REQUIRED
                return(0, 32)
            }
        }
        _;
    }

    /// @notice Constructor
    constructor(Storage _store, bytes32 _crate)
    public
    BaseManager(_store, _crate)
    {
        sharesTokenStorage.init("sharesContractsStorage_v2");
        limitsStorage.init("limitAmountsStorage_v2");
        listeners.init("listeners_v2");
        walletStorage.init("timeHolderWalletStorage");
        erc20DepositStorage.init("erc20DepositStorage");
        validatorManager.init("validatorManager");
        delegates.init("delegates");
        miners.init("miners");

        primaryMiner.init("primaryMiner");
    }

    /// @notice Init TimeHolder contract.
    /// @return result code of an operation
    function init(
        address _defaultToken,
        address _wallet,
        address _erc20DepositStorage,
        address _validatorManager
    )
    public
    onlyContractOwner
    returns (uint)
    {
        require(_defaultToken != 0x0, "No default token specified");
        require(_wallet != 0x0, "No wallet specified");
        require(_erc20DepositStorage != 0x0, "No deposit storage specified");

        store.set(walletStorage, _wallet);
        store.set(erc20DepositStorage, _erc20DepositStorage);

        store.add(sharesTokenStorage, _defaultToken);
        store.set(limitsStorage, _defaultToken, 2**255);

        store.set(validatorManager, _validatorManager);

        ERC20DepositStorage(_erc20DepositStorage).setSharesContract(_defaultToken);

        return OK;
    }

    /// @notice Sets EventsHistory contract address.
    /// @dev Can be set only by owner.
    /// @param _eventsHistory MultiEventsHistory contract address.
    /// @return success.
    function setupEventsHistory(address _eventsHistory) 
    external 
    onlyContractOwner 
    returns (uint errorCode) 
    {
        require(_eventsHistory != 0x0);

        _setEventsHistory(_eventsHistory);
        return OK;
    }

    /* ERC223 Receiving */
    function tokenFallback(
        address _from, 
        uint _value, 
        bytes _data
    ) 
    external 
    {
        // try to check for non-platform based tokens
        address _token;
        if (!store.includes(sharesTokenStorage, msg.sender)) {
            // try to check for platform-based asset
            address _assetProxy = ChronoBankAsset(msg.sender).proxy();
            if (!store.includes(sharesTokenStorage, _assetProxy)) {
                revert();
            }
            
            _token = _assetProxy;
        }
        else {
            _token = msg.sender;
        }

        require(_token != 0x0, "Caller should be a ERC20 token");
        require(OK == _depositShares(_token, _from, _value, false), "Cannot deposit provided tokens");
    }

    /// @notice Gets shares amount deposited by a particular shareholder.
    /// @param _depositor shareholder address.
    /// @return shares amount.
    function depositBalance(address _depositor)
    public
    view
    returns (uint)
    {
        return getDepositBalance(getDefaultShares(), _depositor);
    }

    /// @notice Gets balance of tokens deposited to TimeHolder
    /// @param _token token to check
    /// @param _depositor shareholder address
    /// @return _balance shares amount.
    function getDepositBalance(address _token, address _depositor)
    public
    view
    returns (uint _balance)
    {
        return getDepositStorage().depositBalance(_token, _depositor);
    }

    /// @notice Gets locked amount of tokens for the depositor
    /// @param _token token address that is used for mining
    /// @param _depositor user address
    /// @return _balance total locked balance on a miner's account
    function getLockedDepositBalance(address _token, address _depositor)
    public
    view
    returns (uint _balance)
    {
        return getDepositStorage().lockedDepositBalance(_token, _depositor);
    }

    /// @notice Gets locked amount of tokens for delegated account
    /// @param _token token address that is used for mining
    /// @param _delegate delegate address
    /// @return _balance total locked balance on a miner's account
    function getLockedDepositBalanceForDelegate(address _token, address _delegate)
    public
    view
    returns (uint _balance)
    {
        address depositor = store.get(miners, _delegate);
        if (depositor == address(0)) {
            return 0;
        }

        return getDepositStorage().lockedDepositBalance(_token, depositor);
    }

    /// @notice Gets primary miner address
    function getPrimaryMiner()
    public
    view
    returns (address)
    {
        return store.get(primaryMiner);
    }

    /// @notice Sets an address as a primary miner
    /// @param _miner an address of the future miner
    /// @return result of an operation
    function setPrimaryMiner(address _miner)
    external
    onlyContractOwner
    returns (uint)
    {
        address _oldMiner = getPrimaryMiner();
        store.set(primaryMiner, _miner);

        _emitPrimaryMinerChanged(_oldMiner, _miner);
        return OK;
    }

    /// @notice Gets mining deposit limit for a token
    /// @return minimum amount for tokens that a user will be able to lock to be a miner
    function getMiningDepositLimits(address _token)
    public
    view
    returns (uint) {
        return store.get(miningDepositLimitsStorage, _token);
    }

    /// @notice Sets mining deposit limit for a token
    /// @param _token token address
    /// @param _limit minimum amount for tokens that a user will be able to lock to be a miner
    /// @return result of an operation
    function setMiningDepositLimits(address _token, uint _limit)
    onlyContractOwner
    external
    returns (uint) {
        _emitMiningDepositLimitsChanged(_token, getMiningDepositLimits(_token), _limit);

        store.set(miningDepositLimitsStorage, _token, _limit);

        return OK;
    }

    /// @notice Adds ERC20-compatible token symbols and put them in the whitelist to be used then as
    /// shares for other contracts and allow users to deposit for this share.
    ///
    /// @dev Allowed only for CBEs
    ///
    /// @param _whitelist list of token addresses that will be allowed to be deposited in TimeHolder
    /// @param _limits list of limits
    function allowShares(address[] _whitelist, uint[] _limits)
    external
    onlyContractOwner
    {
        require(_whitelist.length == _limits.length, "Lengths of arrays should be equal");

        for (uint _idx = 0; _idx < _whitelist.length; ++_idx) {
            store.add(sharesTokenStorage, _whitelist[_idx]);
            store.set(limitsStorage, _whitelist[_idx], _limits[_idx]);

            _emitSharesWhiteListAdded(_whitelist[_idx], _limits[_idx]);
        }
    }

    /// @notice Removes ERC20-compatible token symbols from TimeHolder so they will be removed
    /// from the whitelist and will not be accessible to be used as shares.
    /// All deposited amounts still will be available to withdraw.
    /// @dev Allowed only for CBEs
    ///
    /// @param _blacklist list of token addresses that will be removed from TimeHolder
    function denyShares(address[] _blacklist)
    external
    onlyContractOwner
    {
        for (uint _idx = 0; _idx < _blacklist.length; ++_idx) {
            store.remove(sharesTokenStorage, _blacklist[_idx]);
            store.set(limitsStorage, _blacklist[_idx], 0);

            _emitSharesWhiteListRemoved(_blacklist[_idx]);
        }
    }

    /// @notice Deposits shares with provided symbol and prove possesion.
    /// Amount should be less than or equal to current allowance value.
    ///
    /// Proof should be repeated for each active period. To prove possesion without
    /// depositing more shares, specify 0 amount.
    ///
    /// @param _token token address for shares
    /// @param _amount amount of shares to deposit, or 0 to just prove.
    ///
    /// @return result code of an operation.
    function deposit(address _token, uint _amount)
    public
    returns (uint)
    {
        return depositFor(_token, msg.sender, _amount);
    }

    /// @notice Deposit own shares and prove possession for arbitrary shareholder.
    /// Amount should be less than or equal to caller current allowance value.
    ///
    /// Proof should be repeated for each active period. To prove possesion without
    /// depositing more shares, specify 0 amount.
    ///
    /// This function meant to be used by some backend application to prove shares possesion
    /// of arbitrary shareholders.
    ///
    /// @param _token token address for shares
    /// @param _target to deposit and prove for.
    /// @param _amount amount of shares to deposit, or 0 to just prove.
    ///
    /// @return result code of an operation.
    function depositFor(address _token, address _target, uint _amount)
    public
    onlyAllowedToken(_token)
    returns (uint)
    {
        return _depositShares(_token, _target, _amount, true);
    }

    /// @notice Locks provided amount of tokens from user's TimeHolder deposit
    /// and use them to allow a user to be a miner. Could be called more than once
    /// for a single user, but the first call should provide _amount according to
    /// miningDepositLimits value.
    /// Emits two events: BecomeMiner event - when first lock is performed,
    /// and DepositLock - for every lock invocation.
    /// @param _token token address that is used for mining
    /// @param _amount amount of tokens to lock. Should be greater or equal to miningDepositLimits value
    /// @return result of an operation
    function lockDepositAndBecomeMiner(address _token, uint _amount, address _delegate)
    external
    returns (uint) {
        uint _balance = getDepositBalance(_token, msg.sender);
        if (_amount > _balance) {
            return _emitErrorCode(ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE);
        }

        if (store.get(miners, _delegate) != address(0x0) ||
            store.get(delegates, msg.sender) != address(0x0)) {
            return _emitErrorCode(ERROR_TIMEHOLDER_ALREADY_MINER);
        }

        uint _miningDepositLimits = store.get(miningDepositLimitsStorage, _token);
        if (_miningDepositLimits == 0) {
            return _emitErrorCode(ERROR_TIMEHOLDER_INVALID_MINING_LIMIT);
        }

        uint _lockedAmount = getDepositStorage().lockedDepositBalance(_token, msg.sender);
        if (_lockedAmount + _amount < _miningDepositLimits) {
            return _emitErrorCode(ERROR_TIMEHOLDER_MINING_LIMIT_NOT_REACHED);
        }

        getDepositStorage().lock(_token, msg.sender, _amount);

        _emitDepositLocked(_token, _amount, msg.sender);

        store.set(delegates, msg.sender, _delegate);
        store.set(miners, _delegate, msg.sender);

        LXValidatorManager manager = LXValidatorManager(store.get(validatorManager));
        assert(!manager.isPending(_delegate));

        manager.addValidator(_delegate);
        _emitBecomeMiner(_token, _delegate, _amount);

        return OK;
    }

    /// @notice Unlocks deposit and open it for other use cases. Transfers all locked amount to user's TimeHolder record
    /// Emits ResignMiner event.
    /// @param _token target token address that is used for mining
    /// @return result of an operation
    function unlockDepositAndResignMiner(address _token)
    external
    returns (uint) {
        uint _lockedAmount = getDepositStorage().lockedDepositBalance(_token, msg.sender);
        if (_lockedAmount == 0) {
            return _emitErrorCode(ERROR_TIMEHOLDER_NOTHING_TO_UNLOCK);
        }

        getDepositStorage().unlock(_token, msg.sender, _lockedAmount);

        address delegate = store.get(delegates, msg.sender);
        assert(delegate != address(0x0));

        LXValidatorManager manager = LXValidatorManager(store.get(validatorManager));
        if (manager.isPending(delegate)) {
            manager.removeValidator(delegate);
        }

        store.set(delegates, msg.sender, address(0x0));
        store.set(miners, delegate, address(0x0));

        _emitResignMiner(_token, msg.sender, _lockedAmount);
        return OK;
    }

    /// @notice Withdraw shares from the contract, updating the possesion proof in active period.
    /// @param _token token symbol to withdraw from.
    /// @param _amount amount of shares to withdraw.
    /// @return resultCode result code of an operation.
    function withdrawShares(address _token, uint _amount)
    public
    returns (uint resultCode)
    {
        resultCode = _withdrawShares(_token, msg.sender, msg.sender, _amount);
        if (resultCode != OK) {
            return _emitErrorCode(resultCode);
        }

        _emitWithdrawShares(_token, msg.sender, _amount, msg.sender);
    }

    /// @notice Force Withdraw Shares
    /// Only contract owner is permited to call this function.
    function forceWithdrawShares(address _from, address _token, uint _amount)
    onlyContractOwner
    public
    returns (uint resultCode) {
        resultCode = _withdrawShares(_token, _from, contractOwner, _amount);
        if (resultCode != OK) {
            return _emitErrorCode(resultCode);
        }

        _emitWithdrawShares(_token, _from, _amount, contractOwner);
    }

    /// @notice Gets an associated wallet for the time holder
    function wallet()
    public
    view
    returns (TimeHolderWallet)
    {
        return TimeHolderWallet(store.get(walletStorage));
    }

    /// @notice Total amount of shares for provided symbol
    /// @param _token token address to check total shares amout
    /// @return total amount of shares
    function totalShares(address _token)
    public
    view
    returns (uint)
    {
        return getDepositStorage().totalShares(_token);
    }

    /// @notice Number of shareholders
    /// @return number of shareholders
    function defaultShareholdersCount()
    public
    view
    returns (uint)
    {
        return getDepositStorage().shareholdersCount(getDefaultShares());
    }

    /// @notice Number of shareholders
    /// @return number of shareholders
    function shareholdersCount(address _token)
    public
    view
    returns (uint)
    {
        return getDepositStorage().shareholdersCount(_token);
    }

    /// @notice Returns deposit/withdraw limit for shares with provided symbol
    /// @param _token token address to get limit
    /// @return limit number for specified shares
    function getLimitForToken(address _token)
    public
    view
    returns (uint)
    {
        return store.get(limitsStorage, _token);
    }

    /// @notice Gets shares contract that is set up as default (usually TIMEs)
    function getDefaultShares()
    public
    view
    returns (address)
    {
        return getDepositStorage().getSharesContract();
    }

    function _depositShares(address _token, address _target, uint _amount, bool _depositFromWallet)
    internal
    onlyWithMiner
    returns (uint)
    {
        require(_token != 0x0, "No token is specified");
        address _primaryMiner = store.get(primaryMiner);
        require(_target != _primaryMiner, "Miner coundn't have deposits");

        if (_amount > getLimitForToken(_token)) {
            return _emitErrorCode(ERROR_TIMEHOLDER_LIMIT_EXCEEDED);
        }

        if (_depositFromWallet &&
            !wallet().deposit(_token, msg.sender, _amount)
        ) {
            return _emitErrorCode(ERROR_TIMEHOLDER_TRANSFER_FAILED);
        } 
        else if (!_depositFromWallet &&
                 ERC20(_token).balanceOf(address(this)) < _amount
        ) {
            return _emitErrorCode(ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE);
        }

        if (_depositFromWallet) {
            require(wallet().withdraw(_token, _primaryMiner, _amount), "Cannot withdraw from wallet");
        } 
        else {
            require(ERC20(_token).transfer(_primaryMiner, _amount), "Cannot transfer to primary miner");
        }

        getDepositStorage().depositFor(_token, _target, _amount);

        _emitDeposit(_token, _target, _amount);
        _emitMinerDeposited(_token, _amount, _primaryMiner, _target);

        return OK;
    }

    /// @notice Withdraws deposited amount of tokens from account to a receiver address.
    /// Emits its own errorCodes if some will be encountered.
    ///
    /// @param _account an address that have deposited tokens
    /// @param _receiver an address that will receive tokens from _account
    /// @param _amount amount of tokens to withdraw to the _receiver
    ///
    /// @return result code of the operation
    function _withdrawShares(
        address _token,
        address _account,
        address _receiver,
        uint _amount
    )
    onlyWithMiner
    internal
    returns (uint)
    {
        require(_token != 0x0, "No token is specified");

        uint _depositBalance = getDepositBalance(_token, _account);
        if (_amount > _depositBalance) {
            return _emitErrorCode(ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE);
        }

        if (!wallet().deposit(_token, store.get(primaryMiner), _amount)) {
            return _emitErrorCode(ERROR_TIMEHOLDER_TRANSFER_FAILED);
        }

        require(wallet().withdraw(_token, _receiver, _amount));

        getDepositStorage().withdrawShares(_token, _account, _amount, _depositBalance);

        return OK;
    }

    /// @dev Gets pair of depositStorage and default token set up for a deposits
    ///
    /// @return {
    ///     "_depositStorage": "deposit storage contract",
    ///     "_token": "default shares contract",
    /// }
    function getDepositStorage()
    private
    view
    returns (ERC20DepositStorage _depositStorage)
    {
        _depositStorage = ERC20DepositStorage(store.get(erc20DepositStorage));
    }

    /** Event emitting */

    function _emitPrimaryMinerChanged(address from, address to)
    private
    {
        emitter().emitPrimaryMinerChanged(from, to);
    }

    function _emitMiningDepositLimitsChanged(address _token, uint _from, uint _to)
    private
    {
        emitter().emitMiningDepositLimitsChanged(_token, _from, _to);
    }

    function _emitDepositLocked(address _token, uint _amount, address _user)
    private
    {
        emitter().emitDepositLocked(_token, _amount, _user);
    }

    function _emitBecomeMiner(address _token, address _miner, uint _totalDepositLocked)
    private
    {
        emitter().emitBecomeMiner(_token, _miner, _totalDepositLocked);
    }

    function _emitResignMiner(address _token, address _miner, uint _depositUnlocked)
    private
    {
        emitter().emitResignMiner(_token, _miner, _depositUnlocked);
    }

    function _emitMinerDeposited(address token, uint amount, address miner, address sender)
    private
    {
        emitter().emitMinerDeposited(token, amount, miner, sender);
    }

    function _emitDeposit(address _token, address _who, uint _amount)
    private
    {
        emitter().emitDeposit(_token, _who, _amount);
    }

    function _emitWithdrawShares(address _token, address _who, uint _amount, address _receiver)
    private
    {
        emitter().emitWithdrawShares(_token, _who, _amount, _receiver);
    }

    function _emitSharesWhiteListAdded(address _token, uint _limit)
    private
    {
        emitter().emitSharesWhiteListChanged(_token, _limit, true);
    }

    function _emitSharesWhiteListRemoved(address _token)
    private
    {
        emitter().emitSharesWhiteListChanged(_token, 0, false);
    }

    function emitter()
    private
    view
    returns(TimeHolderEmitter)
    {
        return TimeHolderEmitter(getEventsHistory());
    }
}
