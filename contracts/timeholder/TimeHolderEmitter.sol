/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "../event/MultiEventsHistoryAdapter.sol";


/// @title TimeHolder emitter.
///
/// Contains all the original event emitting function definitions and events.
/// In case of new events needed later, additional emitters can be developed.
/// All the functions is meant to be called using delegatecall.
contract TimeHolderEmitter is MultiEventsHistoryAdapter {

    /// @dev User deposited into current period
    event Deposit(address token, address who, uint amount);

    /// @dev Shares withdrawn by a shareholder
    event WithdrawShares(address token, address who, uint amount, address receiver);

    /// @dev Shares withdrawn by a shareholder
    event ListenerAdded(address listener, address token);

    /// @dev Shares listener is removed
    event ListenerRemoved(address listener, address token);

    /// @dev Shares is added to whitelist and start be available to use
    event SharesWhiteListAdded(address token);

    /// @dev Shares is removed from whitelist and stop being available to use
    event SharesWhiteListChanged(address token, uint limit, bool indexed isAdded);

    /// @dev Something went wrong
    event Error(address indexed self, uint errorCode);

    /* Emitting events */

    function emitDeposit(address token, address who, uint amount) public {
        emit Deposit(token, who, amount);
    }

    function emitWithdrawShares(address token, address who, uint amount, address receiver) public {
        emit WithdrawShares(token, who, amount, receiver);
    }

    function emitListenerAdded(address listener, address token) public {
        emit ListenerAdded(listener, token);
    }

    function emitListenerRemoved(address listener, address token) public {
        emit ListenerRemoved(listener, token);
    }

    function emitSharesWhiteListChanged(address token, uint limit, bool isAdded) public {
        emit SharesWhiteListChanged(token, limit, isAdded);
    }

    function emitError(uint error) public {
        emit Error(_self(), error);
    }
}
