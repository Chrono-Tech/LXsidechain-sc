/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;

import "../common/Owned.sol";
import "../genesis/validatorset/ILXValidatorSet.sol";
import "../platform/LXAssetTransferListener.sol";
import "../common/ERC20.sol";
import "../platform/ChronoBankPlatform.sol";
import "../lib/SafeMath.sol";

contract LXValidatorManager is Owned, LXAssetTransferListener {
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
    uint constant DEFAULT_REWARD_COEFFICIENT = (10 * (10**18)) / (100 * (10**8));
    uint public k = DEFAULT_REWARD_COEFFICIENT;

    // address => (type => value)
    mapping (address => bool) rewardBlacklist;
    mapping (address => bool) public authorised;

    address public validatorSet;
    ChronoBankPlatform public platform;
    ERC20 public shares;
    address public eventsHistory;

    // Current list of addresses entitled to participate in the consensus.
    address[] validators;
    address[] pending;
    mapping(address => AddressStatus) pendingStatus;

    modifier onlyAuthorised {
        require(msg.sender == contractOwner || authorised[msg.sender]);
        _;
    }

    modifier onlyPlatform {
        require(msg.sender == address(platform));
        _;
    }

    modifier onlyValidatorSet {
        require(msg.sender == validatorSet);
        _;
    }

    modifier onlyPending(address _someone) {
        require(pendingStatus[_someone].isIn);
        _;
    }

    modifier onlyNotPending(address _someone) {
        require(!pendingStatus[_someone].isIn);
        _;
    }

    constructor(address _validatorSet, address _platform, address _shares)
    public
    {
        require(_validatorSet != 0x0);
        require(_platform != 0x0);
        require(_shares != 0x0);

        validatorSet = _validatorSet;
        platform = ChronoBankPlatform(_platform);
        shares = ERC20(_shares);
    }

    function setupEventsHistory(address _eventsHistory)
    public
    onlyContractOwner
    {
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
    onlyNotPending(_validator)
    {
        pendingStatus[_validator].isIn = true;
        pendingStatus[_validator].index = pending.length;
        pending.push(_validator);

        ILXValidatorSet(validatorSet).initiateChange();
    }

    // Remove a validator.
    function removeValidator(address _validator)
    public
    onlyAuthorised
    onlyPending(_validator)
    {
        pending[pendingStatus[_validator].index] = pending[pending.length - 1];
        delete pending[pending.length - 1];
        pending.length--;
        // Reset address status.
        delete pendingStatus[_validator].index;
        pendingStatus[_validator].isIn = false;

        ILXValidatorSet(validatorSet).initiateChange();
    }

    // callback from validatorSet
    function finalizeChange()
    public
    onlyValidatorSet
    {
        validators = pending;
    }

    function onTransfer(address _from, address _to, uint _value, bytes32 _symbol)
    public
    onlyPlatform
    {
        if(platform.proxies(_symbol) != address(shares)) {
            return;
        }

        update(_from);
        update(_to);
    }

    function isValidator(address _someone)
    public
    view
    returns (bool)
    {
        return pendingStatus[_someone].isIn;
    }

    function getPending()
    public
    view
    returns (address [])
    {
        return pending;
    }

    function getValidators()
    public
    view
    returns (address [])
    {
        return validators;
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

    function update(address _someone)
    private
    {
        if (rewardBlacklist[_someone]) {
            return;
        }

        uint balance = shares.balanceOf(_someone);

        if (balance > 0 && !isValidator(_someone)) {
            addValidator(_someone);
        } else if (balance == 0 && isValidator(_someone)) {
            removeValidator(_someone);
        }
    }
}
