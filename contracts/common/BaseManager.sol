/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "./Owned.sol";
import "../storage/StorageAdapter.sol";


contract BaseManager is Owned, StorageAdapter {
    
    address eventsEmmiter;

    uint constant OK = 1;
    uint constant REINITIALIZED = 6;

    constructor(Storage _store, bytes32 _crate) StorageAdapter(_store, _crate) public {
        eventsEmmiter = this;
    }

    function setEventsHistory(address _eventsHistory) onlyContractOwner external {
        eventsEmmiter = _eventsHistory;
    }

    function getEventsHistory() public view returns (address) {
        return eventsEmmiter;
    }
}
