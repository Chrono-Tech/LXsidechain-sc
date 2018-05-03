/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


/// @title Declares contract interface to observe changes in TimeHolder.
/// @notice version 2
interface HolderListenerInterface {
    function tokenDeposit(address token, address who, uint amount, uint total) external;
    function tokenWithdrawn(address token, address who, uint amount, uint total) external;
}
