/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "../event/MultiEventsHistoryAdapter.sol";


contract RewardsEmitter is MultiEventsHistoryAdapter {

    event WithdrawnSuccess(address addr, uint amount, uint total);
    event WithdrawnRewardSuccess(address asset, address addr, uint amountReward);
    event DepositStored(uint _part);
    event AssetRegistered(address assetAddress);
    event PeriodClosed();
    event Error(address indexed self, uint errorCode);

    function emitWithdrawnReward(address asset, address addr, uint amount) public {
        emit WithdrawnRewardSuccess(asset, addr, amount);
    }

    function emitWithdrawn(address addr, uint amount, uint total) public {
        emit WithdrawnSuccess(addr, amount, total);
    }

    function emitPeriodClosed() public {
        emit PeriodClosed();
    }

    function emitDepositStored(uint _part) public {
        emit DepositStored(_part);
    }

    function emitAssetRegistered(address assetAddress) public {
        emit AssetRegistered(assetAddress);
    }

    function emitError(uint error) public {
        emit Error(_self(), error);
    }
}
