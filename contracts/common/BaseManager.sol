/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "solidity-storage-lib/contracts/StorageAdapter.sol";
import "./Object.sol";


contract BaseManager is Object, StorageAdapter {
    
    uint constant REINITIALIZED = 6;

    address eventsEmmiter;    

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
