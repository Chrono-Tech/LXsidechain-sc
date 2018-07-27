/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.23;


import "solidity-shared-lib/contracts/Owned.sol";
import "solidity-storage-lib/contracts/StorageAdapter.sol";
import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";
import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";
import "../genesis/validatorset/ILXValidatorSet.sol";
import "../lib/SafeMath.sol";
import "../timeholder/TimeHolderInterface.sol";


contract LXValidatorManager is Owned, StorageAdapter, MultiEventsHistoryAdapter {
    using SafeMath for uint;

    event ValidatorAdded(address indexed self, address indexed validator);
    event ValidatorRemoved(address indexed self, address indexed validator);

    enum RewardKind {
        Author, /// Reward attributed to the block author.
        DUMMY1,
        DUMMY2,
        EmptyStep /// Reward attributed to the author(s) of empty step(s) included in the block (AuthorityRound engine).
    }

    // 10 LTH / 100 TIME
    uint constant public DEFAULT_REWARD_COEFFICIENT = (10 * (10**18)) / (100 * (10**8));

    StorageInterface.UInt private kStorage;
    StorageInterface.AddressBoolMapping private rewardBlacklistStorage;
    StorageInterface.AddressBoolMapping private authorisedStorage;

    StorageInterface.Address private validatorSetStorage;
    StorageInterface.Address private timeHolderStorage;
    StorageInterface.Address private sharesStorage;

    StorageInterface.AddressesSet private validatorsStorage;
    StorageInterface.AddressesSet private pendingStorage;

    string public version = "v0.0.1";

    modifier auth {
        require(msg.sender == contractOwner || authorized(msg.sender));
        _;
    }

    modifier onlyPending(address _someone) {
        if (isPending(_someone)) {
            _;
        }
    }

    modifier onlyNotPending(address _someone) {
        if (!isPending(_someone)) {
            _;
        }
    }

    constructor(Storage _storage, bytes32 _crate) StorageAdapter(_storage, _crate)
    public
    {
        kStorage.init("kStorage");
        rewardBlacklistStorage.init("rewardBlacklistStorage");
        authorisedStorage.init("authorisedStorage");
        validatorSetStorage.init("validatorSetStorage");
        timeHolderStorage.init("timeHolderStorage");
        sharesStorage.init("sharesStorage");
        validatorsStorage.init("validatorsStorage");
        pendingStorage.init("pendingStorage");
    }

    function init(address _validatorSet, address _timeHolder, address _shares)
    external
    onlyContractOwner
    returns (bool)
    {
        require(_validatorSet != address(0x0));
        require(_timeHolder != address(0x0));
        require(_shares != address(0x0));

        if (store.get(sharesStorage) != 0x0) {
            require(store.get(sharesStorage) == _shares);
        } else {
            store.set(sharesStorage, _shares);
        }

        if (store.get(kStorage) == 0) {
            store.set(kStorage, DEFAULT_REWARD_COEFFICIENT);
        }

        address _oldValidatorSet = store.get(validatorSetStorage);
        if (_oldValidatorSet != 0x0 && _oldValidatorSet != _validatorSet) {
            store.set(authorisedStorage, _oldValidatorSet, false);
        }

        address _oldTimeHolder = store.get(timeHolderStorage);
        if (_oldTimeHolder != 0x0 && _oldTimeHolder != _timeHolder) {
            store.set(authorisedStorage, _oldTimeHolder, false);
        }

        store.set(validatorSetStorage, _validatorSet);
        store.set(timeHolderStorage, _timeHolder);

        // TODO: rework auth
        store.set(authorisedStorage, _validatorSet, true);
        store.set(authorisedStorage, _timeHolder, true);

        return true;
    }

    function rewardsBlacklist(address _address) 
    public 
    view 
    returns (bool) 
    {
        return store.get(rewardBlacklistStorage, _address);
    }

    function authorized(address _address)
    public
    view
    returns (bool)
    {
        return store.get(authorisedStorage, _address);
    }

    function validatorSet()
    public
    view 
    returns (ILXValidatorSet)
    {
        return ILXValidatorSet(store.get(validatorSetStorage));
    }

    function timeHolder()
    public
    view 
    returns (TimeHolderInterface)
    {
        return TimeHolderInterface(store.get(timeHolderStorage));
    }

    function shares()
    public
    view 
    returns (ERC20)
    {
        return ERC20(store.get(sharesStorage));
    }

    function validators(uint _idx)
    public
    view
    returns (address)
    {
        return store.get(validatorsStorage, _idx);
    }

    function getValidators()
    public
    view
    returns (address[] _validators)
    {
        _validators = store.get(validatorsStorage);
    }

    function pending(uint _idx)
    public
    view
    returns (address)
    {
        return store.get(pendingStorage, _idx);
    }

    function getPending()
    public
    view
    returns (address[] _pending)
    {
        _pending = store.get(pendingStorage);
    }

    function setupEventsHistory(address _eventsHistory)
    public
    auth
    {
        require(_eventsHistory != address(0x0));
        _setEventsHistory(_eventsHistory);
    }

    function setupRewardCoefficient(uint _k)
    public
    auth
    {
        store.set(kStorage, _k);
    }

    function setTimeHolder(address _timeHolder)
    public
    auth
    {
        require(_timeHolder != 0x0);
        store.set(authorisedStorage, store.get(timeHolderStorage), false);
        store.set(timeHolderStorage, _timeHolder);
        store.set(authorisedStorage, _timeHolder, true);
    }

    function addValidator(address _validator)
    public
    auth
    {
        require(_validator != address(0x0));

        _addValidator(_validator);
        initiateChange();
    }

    // Remove a validator.
    function removeValidator(address _validator)
    public
    auth
    {
        _removeValidator(_validator);
        initiateChange();
    }

    // callback from validatorSet
    function finalizeChange()
    public
    auth
    {
        store.copy(pendingStorage, validatorsStorage);
    }

    function isPending(address _someone)
    public
    view
    returns (bool)
    {
        return store.includes(pendingStorage, _someone);
    }

    function isValidator(address _someone)
    public
    view
    returns (bool)
    {
        return isPending(_someone) && validatorSet().finalized();
    }

    function reward(address _benefactor, uint _kind)
    public
    view
    returns (uint)
    {
        if (_kind != uint(RewardKind.Author)) {
            return 0;
        }

        uint balance = timeHolder().getLockedDepositBalance(store.get(sharesStorage), _benefactor);
        return balance.mul(store.get(kStorage));
    }

    function initiateChange()
    private
    {
        validatorSet().initiateChange();
    }

    function _addValidator(address _validator)
    private
    onlyNotPending(_validator)
    {
        store.add(pendingStorage, _validator);

        _emitter().emitValidatorAdded(_validator);
    }

    // Remove a validator.
    function _removeValidator(address _validator)
    private
    onlyPending(_validator)
    {
        store.remove(pendingStorage, _validator);

        _emitter().emitValidatorRemoved(_validator);
    }

    function _emitter()
    private
    view
    returns (LXValidatorManager)
    {
        return LXValidatorManager(getEventsHistory());
    }

    function emitValidatorAdded(address _validator) public {
        emit ValidatorAdded(_self(), _validator);
    }

    function emitValidatorRemoved(address _validator) public {
        emit ValidatorRemoved(_self(), _validator);
    }
}
