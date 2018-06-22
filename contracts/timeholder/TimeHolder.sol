/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "../common/BaseManager.sol";
import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";
import "../lib/SafeMath.sol";
import "./TimeHolderWallet.sol";
import "./ERC20DepositStorage.sol";
import "./TimeHolderEmitter.sol";


/// @title TimeHolder
/// @notice Contract allows to block some amount of shares" balance to unlock
/// functionality inside a system.
contract TimeHolder is BaseManager, TimeHolderEmitter {

    using SafeMath for uint;

    /** Error codes */

    uint constant ERROR_TIMEHOLDER_ALREADY_ADDED = 12000;
    uint constant ERROR_TIMEHOLDER_TRANSFER_FAILED = 12003;
    uint constant ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE = 12006;
    uint constant ERROR_TIMEHOLDER_LIMIT_EXCEEDED = 12007;
    uint constant ERROR_TIMEHOLDER_MINER_REQUIRED = 12008;
    uint constant ERROR_TIMEHOLDER_WITHDRAW_LIMIT_EXCEEDED = 12009;
    uint constant ERROR_TIMEHOLDER_REGISTRATION_ID_EXISTS = 12010;
    uint constant ERROR_TIMEHOLDER_NO_REGISTERED_WITHDRAWAL_FOUND = 12011;

    /** Storage keys */

    /// @dev Contains addresses of tokens that are used as shares
    StorageInterface.AddressesSet sharesTokenStorage;
    /// @dev Mapping of (token address => limit value) for storing deposit limits
    StorageInterface.AddressUIntMapping limitsStorage;
    /// @dev Mapping of (token address => list of listeners) for holding list of listeners for each share token
    StorageInterface.AddressOrderedSetMapping listeners;
    /// @dev Address of TimeHolder wallet
    StorageInterface.Address walletStorage;
    /// @dev Address of ERC20DepositStorage contract
    StorageInterface.Address erc20DepositStorage;

    StorageInterface.Address primaryMiner;

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

    /// @dev Guards from accessing with registered ID key
    modifier onlyNotRegisteredWithdrawal(bytes32 _registrationId) {
        if (getDepositStorage().isWithdrawRequestRegistered(_registrationId)) {
            assembly {
                mstore(0, 12010) // ERROR_TIMEHOLDER_REGISTRATION_ID_EXISTS
                return(0, 32)
            }
        }
        _;
    }

    /// @dev Guards from accessing with not registered ID key
    modifier onlyRegisteredWithdrawal(bytes32 _registrationId) {
        if (!getDepositStorage().isWithdrawRequestRegistered(_registrationId)) {
            assembly {
                mstore(0, 12011) // ERROR_TIMEHOLDER_NO_REGISTERED_WITHDRAWAL_FOUND
                return(0, 32)
            }
        }
        _;
    }

    /// @notice Constructor
    constructor(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        sharesTokenStorage.init("sharesContractsStorage_v2");
        limitsStorage.init("limitAmountsStorage_v2");
        listeners.init("listeners_v2");
        walletStorage.init("timeHolderWalletStorage");
        erc20DepositStorage.init("erc20DepositStorage");

        primaryMiner.init("primaryMiner");
    }

    /// @notice Init TimeHolder contract.
    /// @return result code of an operation
    function init(
        address _defaultToken,
        address _wallet,
        address _erc20DepositStorage
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

        ERC20DepositStorage(_erc20DepositStorage).setSharesContract(_defaultToken);

        return OK;
    }

     /// @notice Gets shares amount deposited by a particular shareholder.
     ///
     /// @param _depositor shareholder address.
     ///
     /// @return shares amount.
    function depositBalance(address _depositor) public view returns (uint) {
        return getDepositBalance(getDefaultShares(), _depositor);
    }

    /// @dev Gets balance of tokens deposited to TimeHolder
    ///
    /// @param _token token to check
    /// @param _depositor shareholder address
    /// @return _balance shares amount.
    function getDepositBalance(
        address _token,
        address _depositor
    )
    public
    view
    returns (uint _balance)
    {
        return getDepositStorage().depositBalance(_token, _depositor);
    }

    function getRequestedWithdrawAmount(
        address _token,
        address _depositor
    )
    public
    view
    returns (uint)
    {
        return getDepositStorage().requestedWithdrawAmount(_token, _depositor);
    }

    /// @notice Checks state for registered withdraw request
    /// @param _registrationId unique identifier; was created on 'requestWithdrawShares' step
    /// @return {
    ///     "_token": "token address",
    ///     "_amount": "amount of tokens that were registered to be withdrawn",
    ///     "_target": "holder address"
    ///     "_receiver": "receiver address"
    /// }
    function checkRegisteredWithdrawRequest(bytes32 _registrationId) public view returns (
        address _token,
        uint _amount,
        address _target,
        address _receiver
    ) {
        return getDepositStorage().getRegisteredWithdrawRequest(_registrationId);
    }

    function getPrimaryMiner() public view returns (address) {
        return store.get(primaryMiner);
    }

    function setPrimaryMiner(address _miner) onlyContractOwner external returns (uint) {
        address _oldMiner = getPrimaryMiner();
        store.set(primaryMiner, _miner);

        _emitPrimaryMinerChanged(_oldMiner, _miner);
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
    onlyContractOwner
    external
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
    onlyContractOwner
    external
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
    function deposit(address _token, uint _amount) public returns (uint) {
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
    onlyAllowedToken(_token)
    onlyWithMiner
    public
    returns (uint)
    {
        require(_token != 0x0, "No token is specified");
        address _primaryMiner = store.get(primaryMiner);
        require(_target != _primaryMiner, "Miner coundn't have deposits");

        if (_amount > getLimitForToken(_token)) {
            return _emitError(ERROR_TIMEHOLDER_LIMIT_EXCEEDED);
        }

        if (!wallet().deposit(_token, msg.sender, _amount)) {
            return _emitError(ERROR_TIMEHOLDER_TRANSFER_FAILED);
        }

        require(wallet().withdraw(_token, _primaryMiner, _amount), "Cannot withdraw from wallet");

        getDepositStorage().depositFor(_token, _target, _amount);

        _emitDeposit(_token, _target, _amount);
        _emitMinerDeposited(_token, _amount, _primaryMiner, _target);

        return OK;
    }

    /// @notice Withdraw shares from the contract, updating the possesion proof in active period.
    /// @param _token token symbol to withdraw from.
    /// @param _amount amount of shares to withdraw.
    /// @return resultCode result code of an operation.
    function requestWithdrawShares(bytes32 _registrationId, address _token, uint _amount)
    onlyNotRegisteredWithdrawal(_registrationId)
    public
    returns (uint resultCode)
    {
        resultCode = _registerWithdrawSharesRequest(_registrationId, _token, _amount, msg.sender, msg.sender);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        _emitWithdrawalRequested(_registrationId, _token, _amount, msg.sender, msg.sender);
    }

    /// @notice Force Withdraw Shares
    /// Only CBE members are permited to call this function.
    /// Multisig concensus is required to withdraw shares from shareholder "_from"
    /// and send it to "_to".
    function forceRequestWithdrawShares(bytes32 _registrationId, address _from, address _token, uint _amount)
    onlyContractOwner
    onlyNotRegisteredWithdrawal(_registrationId)
    public
    returns (uint resultCode)
    {
        resultCode = _registerWithdrawSharesRequest(_registrationId, _token, _amount, _from, contractOwner);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        _emitWithdrawalRequested(_registrationId, _token, _amount, _from, contractOwner);
    }

    /// @notice Registers receiver to allow to unlock locked tokens.
    /// First of two-steps operation of unlocking tokens.
    /// Should be called only by specific role (middleware actor or root user).
    /// Function execution protected by a multisignature.
    /// @param _registrationId unique identifier to associate this unlock operation
    /// @param _token token address which was previously locked for some amount
    /// @param _amount amount of tokens that is supposed to be unlocked
    /// @param _from user whose deposites will be withdrawn
    /// @param _to user who are going to receive locked tokens
    /// @return _resultCode. result code of an operation
    function _registerWithdrawSharesRequest(
        bytes32 _registrationId,
        address _token,
        uint _amount,
        address _from,
        address _to
    )
    private
    returns (uint _resultCode)
    {
        require(_token != 0x0);
        require(_from != 0x0);
        require(_to != 0x0);
        require(_amount != 0);

        uint _depositBalance = getDepositBalance(_token, _from);
        uint _requestedBalance = getRequestedWithdrawAmount(_token, _from);
        if (_amount > _depositBalance.sub(_requestedBalance)) {
            return _emitError(ERROR_TIMEHOLDER_WITHDRAW_LIMIT_EXCEEDED);
        }

        getDepositStorage().registerWithdrawRequest(_registrationId, _token, _amount, _from, _to);

        return OK;
    }

    /// @notice Unlocks shares in TimeHolder and deposit them back to user's account.
    /// Second of two-steps operation of unlocking locked tokens.
    /// Could be called by anyone: tokens will be transferred only to an actual receiver.
    /// To perform 'unlock' an amount of locked tokens on this very moment should be greater
    /// or equal to registered amount of tokens to unlock.
    /// @param _registrationId unique identifier; was created on 'registerUnlockShares' step
    /// @return result code of an operation
    function resolveWithdrawSharesRequest(bytes32 _registrationId)
    onlyRegisteredWithdrawal(_registrationId)
    public
    returns (uint)
    {
        address _token;
        uint _amount;
        address _target;
        address _receiver;
        (_token, _amount, _target, _receiver) = getDepositStorage().getRegisteredWithdrawRequest(_registrationId);

        if (ERC20(_token).allowance(msg.sender, address(this)) < _amount) {
            return _emitError(ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE);
        }

        uint _depositBalance = getDepositBalance(_token, _target);

        if (!ERC20(_token).transferFrom(msg.sender, _receiver, _amount)) {
            return _emitError(ERROR_TIMEHOLDER_TRANSFER_FAILED);
        }

        getDepositStorage().withdrawShares(_token, _target, _amount, _depositBalance);
        getDepositStorage().disposeWithdrawRequest(_registrationId);

        _emitWithdrawalRequestResolved(_registrationId, _token, _amount, _target, _receiver);
        return OK;
    }

    /// @notice Unregisters (declines) previously registered unlock operation.
    /// After unregistration no one could perform 'unlockShares'.
    /// Registration identifier will be released and will be available to 'registerUnlockshares'.
    /// Should be called only by specific role (middleware actor or root user).
    /// @param _registrationId unique identifier; was created on 'registerUnlockShares' step
    /// @return result code of an operation
    function cancelWithdrawSharesRequest(bytes32 _registrationId)
    onlyRegisteredWithdrawal(_registrationId)
    public
    returns (uint)
    {
        address _token;
        uint _amount;
        address _target;
        address _receiver;
        (_token, _amount, _target, _receiver) = getDepositStorage().getRegisteredWithdrawRequest(_registrationId);

        require(msg.sender == _target, "Only the user who requested this withdrawal");

        getDepositStorage().disposeWithdrawRequest(_registrationId);

        _emitWithdrawalRequestCancelled(_registrationId);
        return OK;
    }

    /// @notice Gets an associated wallet for the time holder
    function wallet() public view returns (TimeHolderWallet) {
        return TimeHolderWallet(store.get(walletStorage));
    }

    /// @notice Total amount of shares for provided symbol
    /// @param _token token address to check total shares amout
    /// @return total amount of shares
    function totalShares(address _token) public view returns (uint) {
        return getDepositStorage().totalShares(_token);
    }

    /// @notice Number of shareholders
    /// @return number of shareholders
    function defaultShareholdersCount() public view returns (uint) {
        return getDepositStorage().shareholdersCount(getDefaultShares());
    }

    /// @notice Number of shareholders
    /// @return number of shareholders
    function shareholdersCount(address _token) public view returns (uint) {
        return getDepositStorage().shareholdersCount(_token);
    }

    /// @notice Returns deposit/withdraw limit for shares with provided symbol
    /// @param _token token address to get limit
    /// @return limit number for specified shares
    function getLimitForToken(address _token) public view returns (uint) {
        return store.get(limitsStorage, _token);
    }

    /// @notice Gets shares contract that is set up as default (usually TIMEs)
    function getDefaultShares() public view returns (address) {
        return getDepositStorage().getSharesContract();
    }

    /// @dev Gets pair of depositStorage and default token set up for a deposits
    ///
    /// @return {
    ///     "_depositStorage": "deposit storage contract",
    ///     "_token": "default shares contract",
    /// }
    function getDepositStorage() private view returns (ERC20DepositStorage _depositStorage) {
        _depositStorage = ERC20DepositStorage(store.get(erc20DepositStorage));
    }

    /** Event emitting */

    function _emitWithdrawalRequested(bytes32 requestId, address token, uint amount, address requester, address recepient) private {
        TimeHolderEmitter(getEventsHistory()).emitWithdrawalRequested(requestId, token, amount, requester, recepient);
    }

    function _emitWithdrawalRequestResolved(bytes32 requestId, address token, uint amount, address requester, address recepient) private {
        TimeHolderEmitter(getEventsHistory()).emitWithdrawalRequestResolved(requestId, token, amount, requester, recepient);
    }

    function _emitWithdrawalRequestCancelled(bytes32 requestId) private {
        TimeHolderEmitter(getEventsHistory()).emitWithdrawalRequestCancelled(requestId);
    }

    function _emitPrimaryMinerChanged(address from, address to) private {
        TimeHolderEmitter(getEventsHistory()).emitPrimaryMinerChanged(from, to);
    }

    function _emitMinerDeposited(address token, uint amount, address miner, address sender) private {
        TimeHolderEmitter(getEventsHistory()).emitMinerDeposited(token, amount, miner, sender);
    }

    function _emitDeposit(address _token, address _who, uint _amount) private {
        TimeHolderEmitter(getEventsHistory()).emitDeposit(_token, _who, _amount);
    }

    function _emitSharesWhiteListAdded(address _token, uint _limit) private {
        TimeHolderEmitter(getEventsHistory()).emitSharesWhiteListChanged(_token, _limit, true);
    }

    function _emitSharesWhiteListRemoved(address _token) private {
        TimeHolderEmitter(getEventsHistory()).emitSharesWhiteListChanged(_token, 0, false);
    }

    function _emitError(uint e) private returns (uint) {
        TimeHolderEmitter(getEventsHistory()).emitError(e);
        return e;
    }
}
