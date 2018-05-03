/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "../common/Object.sol";
import "../event/MultiEventsHistoryAdapter.sol";


contract StorageManager is MultiEventsHistoryAdapter, Object {

    uint constant ERROR_STORAGE_INVALID_INVOCATION = 5000;

    event AccessGiven(address indexed self, address actor, bytes32 role);
    event AccessBlocked(address indexed self, address actor, bytes32 role);
    event Error(address indexed self, uint errorCode);

    mapping (address => uint) public authorised;
    mapping (bytes32 => bool) public accessRights;

    function giveAccess(address _actor, bytes32 _role) onlyContractOwner external returns (uint) {
        if (!accessRights[keccak256(_actor, _role)]) {
            accessRights[keccak256(_actor, _role)] = true;
            authorised[_actor] += 1;
            emitAccessGiven(_actor, _role);
        }

        return OK;
    }

    function blockAccess(address _actor, bytes32 _role) onlyContractOwner external returns (uint) {
        if (accessRights[keccak256(_actor, _role)]) {
            delete accessRights[keccak256(_actor, _role)];
            authorised[_actor] -= 1;
            if (authorised[_actor] == 0) {
                delete authorised[_actor];
            }
            emitAccessBlocked(_actor, _role);
        }

        return OK;
    }

    function isAllowed(address _actor, bytes32 _role) public view returns (bool) {
        return accessRights[keccak256(_actor, _role)] || (this == _actor);
    }

    function hasAccess(address _actor) public view returns(bool) {
        return (authorised[_actor] > 0) || (this == _actor);
    }

    function emitAccessGiven(address _user, bytes32 _role) public {
        emit AccessGiven(this, _user, _role);
    }

    function emitAccessBlocked(address _user, bytes32 _role) public {
        emit AccessBlocked(this, _user, _role);
    }
}
