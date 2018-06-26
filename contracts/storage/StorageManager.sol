/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "solidity-storage-lib/contracts/BaseStorageManager.sol";
import "../event/MultiEventsHistoryAdapter.sol";


contract StorageManager is BaseStorageManager, MultiEventsHistoryAdapter {

    address eventsHistory;

    function getEventsHistory() public view returns (address) {
        return eventsHistory != 0x0 ? eventsHistory : this;
    }

    function setupEventsHistory(address _eventsHistory) onlyContractOwner external returns (bool) {
        if (getEventsHistory() != 0x0) {
            return false;
        }
        eventsHistory = _eventsHistory;
        return true;
    }
}
