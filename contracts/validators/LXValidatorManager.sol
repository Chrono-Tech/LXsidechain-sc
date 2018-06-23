/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.23;

import "solidity-shared-lib/contracts/Owned.sol";
import "../genesis/validatorset/ILXValidatorSet.sol";
import "../platform/LXAssetListener.sol";
import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";
import "../lib/SafeMath.sol";


contract LXValidatorManager is Owned, LXAssetListener {
    using SafeMath for uint;

    struct AddressStatus {
        bool isIn;
        uint index;
    }

    enum RewardKind {
        Author, /// Reward attributed to the block author.
        DUMMY1,
        DUMMY2,
        EmptyStep /// Reward attributed to the author(s) of empty step(s) included in the block (AuthorityRound engine).
    }

    // 10 LTH / 100 TIME
    uint constant public DEFAULT_REWARD_COEFFICIENT = (10 * (10**18)) / (100 * (10**8));
    uint public k = DEFAULT_REWARD_COEFFICIENT;

    // address => (type => value)
    mapping (address => bool) public rewardBlacklist;
    mapping (address => bool) public authorised;

    address public validatorSet;
    address public platform;
    ERC20 public shares;
    address public eventsHistory;

    // Current list of addresses entitled to participate in the consensus.
    address[] public validators;
    address[] public pending;
    mapping(address => AddressStatus) private pendingStatus;

    modifier onlyAuthorised {
        require(msg.sender == contractOwner || authorised[msg.sender]);
        _;
    }

    modifier onlyPlatform() {
        require(platform == msg.sender);
        _;
    }

    modifier onlyValidatorSet {
        require(msg.sender == validatorSet || msg.sender == contractOwner);
        _;
    }

    modifier onlyPending(address _someone) {
        if (pendingStatus[_someone].isIn) {
            _;
        }
    }

    modifier onlyNotPending(address _someone) {
        if (!pendingStatus[_someone].isIn) {
            _;
        }
    }

    constructor(address _validatorSet, address _platform, address _shares)
    public
    {
        require(_validatorSet != address(0x0));
        require(_platform != address(0x0));
        require(_shares != address(0x0));

        validatorSet = _validatorSet;
        platform = _platform;
        shares = ERC20(_shares);
    }

    function setupEventsHistory(address _eventsHistory)
    public
    onlyContractOwner
    {
        require(_eventsHistory != address(0x0));
        eventsHistory = _eventsHistory;
    }

    function setupRewardCoefficient(uint _k)
    public
    onlyContractOwner
    {
        k = _k;
    }

    function addValidator(address _validator)
    public
    onlyAuthorised
    {
        require(_validator != address(0x0));

        _addValidator(_validator);
        initiateChange();
    }

    // Remove a validator.
    function removeValidator(address _validator)
    public
    onlyAuthorised
    {
        _removeValidator(_validator);
        initiateChange();
    }

    // callback from validatorSet
    function finalizeChange()
    public
    onlyValidatorSet
    {
        validators = pending;
    }

    function onTransfer(address _from, address _to, uint /*_value*/, bytes32 /*_symbol*/)
    public
    onlyPlatform()
    {
        bool updatedFrom = _updateValidator(_from);
        bool updatedTo = _updateValidator(_to);

        if (updatedFrom || updatedTo) {
            initiateChange();
        }
    }

    function isPending(address _someone)
    public
    view
    returns (bool)
    {
        return pendingStatus[_someone].isIn;
    }

    function isValidator(address _someone)
    public
    view
    returns (bool)
    {
        return pendingStatus[_someone].isIn && ILXValidatorSet(validatorSet).finalized();
    }

    function reward(address _benefactor, uint _kind)
    public
    view
    returns (uint)
    {
        if (_kind != uint(RewardKind.Author)) {
            return 0;
        }

        uint balance = shares.balanceOf(_benefactor);
        return balance.mul(k);
    }

    function getValidators()
    public
    view
    returns (address[])
    {
        return validators;
    }

    function getPending()
    public
    view
    returns (address[])
    {
        return pending;
    }

    function initiateChange()
    private
    {
        ILXValidatorSet(validatorSet).initiateChange();
    }

    function _updateValidator(address _someone)
    private
    returns (bool updated)
    {
        if (_someone == address(0x0)) {
            return false;
        }

        if (rewardBlacklist[_someone]) {
            return false;
        }

        uint balance = shares.balanceOf(_someone);

        if (balance > 0 && !isPending(_someone)) {
            _addValidator(_someone);
            updated = true;
        } else if (balance == 0 && isPending(_someone)) {
            _removeValidator(_someone);
            updated = true;
        }
    }

    function _addValidator(address _validator)
    private
    onlyNotPending(_validator)
    {
        pendingStatus[_validator].isIn = true;
        pendingStatus[_validator].index = pending.length;
        pending.push(_validator);
    }

    // Remove a validator.
    function _removeValidator(address _validator)
    private
    onlyPending(_validator)
    {
        pending[pendingStatus[_validator].index] = pending[pending.length - 1];
        pendingStatus[pending[pendingStatus[_validator].index]].index = pendingStatus[_validator].index;
        delete pending[pending.length - 1];
        pending.length--;

        delete pendingStatus[_validator].index;
        pendingStatus[_validator].isIn = false;
    }
}
