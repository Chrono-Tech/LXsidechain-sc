//! Copyright 2017 Peter Czaban, Parity Technologies Ltd.
//!
//! Licensed under the Apache License, Version 2.0 (the "License");
//! you may not use this file except in compliance with the License.
//! You may obtain a copy of the License at
//!
//!     http://www.apache.org/licenses/LICENSE-2.0
//!
//! Unless required by applicable law or agreed to in writing, software
//! distributed under the License is distributed on an "AS IS" BASIS,
//! WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//! See the License for the specific language governing permissions and
//! limitations under the License.

pragma solidity ^0.4.23;

import "../../common/Owned.sol";
import "../../common/BaseRouter.sol";
import "./LXValidatorSetDelegateInterface.sol";
import "./RelaySet.sol";

// Owner can add or remove validators.

contract LXValidatorSet is Owned, ValidatorSet, BaseRouter {
    // EVENTS
    event Report(address indexed reporter, address indexed reported, bool indexed malicious);
    event ChangeFinalized(address[] current_set);

    // System address, used by the block sealer.
    address constant SYSTEM_ADDRESS = 0xfffffffffffffffffffffffffffffffffffffffe;
    uint public recentBlocks = 20;

    address public backendAddress;

    modifier only_system_and_not_finalized() {
        require(msg.sender != SYSTEM_ADDRESS || finalized);
        _;
    }

    modifier when_finalized() {
        require(!finalized);
        _;
    }

    modifier is_validator(address _someone) {
        if (pendingStatus[_someone].isIn) { _; }
    }

    modifier is_pending(address _someone) {
        require(pendingStatus[_someone].isIn);
        _;
    }

    modifier is_not_pending(address _someone) {
        require(!pendingStatus[_someone].isIn);
        _;
    }

    modifier is_recent(uint _blockNumber) {
        require(block.number <= _blockNumber + recentBlocks);
        _;
    }

    struct AddressStatus {
        bool isIn;
        uint index;
    }

    // Current list of addresses entitled to participate in the consensus.
    address[] validators;
    address[] pending;
    mapping(address => AddressStatus) pendingStatus;
    // Was the last validator change finalized. Implies validators == pending
    bool public finalized;

    function LXValidatorSet(address[] _initial) public {
        pending = _initial;
        for (uint i = 0; i < _initial.length - 1; i++) {
            pendingStatus[_initial[i]].isIn = true;
            pendingStatus[_initial[i]].index = i;
        }
        validators = pending;
    }

    // Called to determine the current set of validators.
    function getValidators() view public returns (address[]) {
        return validators;
    }

    function getPending() view public returns (address[]) {
        return pending;
    }

    // Log desire to change the current list.
    function initiateChange() private when_finalized {
        finalized = false;
        InitiateChange(block.blockhash(block.number - 1), getPending());
    }

    function finalizeChange()
    public
    only_system_and_not_finalized
    {
        validators = pending;
        finalized = true;
        ChangeFinalized(getValidators());
    }

    // OWNER FUNCTIONS

    // Add a validator.
    function addValidator(address _validator)
    public
    onlyContractOwner
    is_not_pending(_validator)
    {
        pendingStatus[_validator].isIn = true;
        pendingStatus[_validator].index = pending.length;
        pending.push(_validator);
        initiateChange();
    }

    // Remove a validator.
    function removeValidator(address _validator)
    public
    onlyContractOwner
    is_pending(_validator)
    {
        pending[pendingStatus[_validator].index] = pending[pending.length - 1];
        delete pending[pending.length - 1];
        pending.length--;
        // Reset address status.
        delete pendingStatus[_validator].index;
        pendingStatus[_validator].isIn = false;
        initiateChange();
    }

    // MISBEHAVIOUR HANDLING

    // Called when a validator should be removed.
    function reportMalicious(address _validator, uint _blockNumber, bytes _proof)
    public
    onlyContractOwner
    is_recent(_blockNumber)
    {
        Report(msg.sender, _validator, true);
    }

    // Report that a validator has misbehaved in a benign way.
    function reportBenign(address _validator, uint _blockNumber)
    public
    onlyContractOwner
    is_validator(_validator)
    is_recent(_blockNumber)
    {
        Report(msg.sender, _validator, false);
    }

    // EXTEND DEFAULT FUNCTIONALITY

    function setRecentBlocks(uint _recentBlocks)
    public
    onlyContractOwner
    {
        recentBlocks = _recentBlocks;
    }

    function setBackend(address _backend)
    public
    onlyContractOwner
    {
        backendAddress = _backend;
    }

    function backend()
    internal
    view
    returns (address)
    {
        return backendAddress;
    }
}
