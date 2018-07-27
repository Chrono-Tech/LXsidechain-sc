/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;

import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";


contract RewardsEmitter is MultiEventsHistoryAdapter {
    event WithdrawnSuccess(address addr, uint amount, uint total);
    event WithdrawnRewardSuccess(address addr, uint amountReward);
    event DepositStored(uint _part);
    event PeriodClosed();

    function emitWithdrawnReward(address addr, uint amount)
    public
    {
        emit WithdrawnRewardSuccess(addr, amount);
    }

    function emitPeriodClosed()
    public
    {
        emit PeriodClosed();
    }
}
