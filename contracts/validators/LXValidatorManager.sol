pragma solidity ^0.4.23;

import "../common/Owned.sol";
import "../genesis/validatorset/ILXValidatorSet.sol";
import "../platform/LXAssetTransferListener.sol";
import "../common/ERC20.sol";
import "../platform/ChronoBankPlatform.sol";

contract LXValidatorManager is Owned, LXAssetTransferListener {
    struct AddressStatus {
        bool isIn;
        uint index;
        //address delegate;
    }

    // address => (type => value)
    mapping (address => mapping (uint => uint)) public rewards;
    mapping (bytes32 => bool) rewardAssets;
    mapping (address => bool) rewardBlacklist;

    mapping (address => bool) public authorised;
    address public validatorSet;
    ChronoBankPlatform platform;
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

    constructor(address _validatorSet)
    public
    {
        require(_validatorSet != 0x0);
        validatorSet = _validatorSet;
    }

    function setupEventsHistory(address _eventsHistory)
    public
    onlyContractOwner
    {
        eventsHistory = _eventsHistory;
    }

    function addValidator(address _validator)
    public
    onlyAuthorised
    onlyNotPending(_validator)
    {
        pendingStatus[_validator].isIn = true;
        pendingStatus[_validator].index = pending.length;

        //address delegate = pendingStatus[_validator].delegate != 0x0 ? pendingStatus[_validator].delegate : _validator;
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
        update(_from, _symbol);
        update(_to, _symbol);
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
        // TODO
        return rewards[_benefactor][_kind];
    }

    function update(address _someone, bytes32 _symbol)
    private
    {
        if (!rewardAssets[_symbol]) {
            return;
        }

        if (rewardBlacklist[_someone]) {
            return;
        }

        address proxy = platform.proxies(_symbol);
        uint balance = ERC20(proxy).balanceOf(_someone);

        if (balance > 0 && !isValidator(_someone)) {
            addValidator(_someone);
        } else if (balance == 0 && isValidator(_someone)) {
            removeValidator(_someone);
        }
    }
}
