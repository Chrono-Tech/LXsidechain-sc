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

    event WithdrawalRequested(bytes32 requestId, address token, uint amount, address requester, address recepient);

    event WithdrawalRequestResolved(bytes32 requestId, address token, uint amount, address requester, address recepient);

    event WithdrawalRequestCancelled(bytes32 requestId);

    event MinerDeposited(address token, uint amount, address miner, address sender);

    event PrimaryMinerChanged(address from, address to);

    /// @dev User deposited into current period
    event Deposit(address token, address who, uint amount);

    /// @dev Shares withdrawn by a shareholder
    event WithdrawShares(address token, address who, uint amount, address receiver);

    /// @dev Shares is added to whitelist and start be available to use
    event SharesWhiteListAdded(address token);

    /// @dev Shares is removed from whitelist and stop being available to use
    event SharesWhiteListChanged(address token, uint limit, bool indexed isAdded);

    /// @dev Something went wrong
    event Error(address indexed self, uint errorCode);

    /* Emitting events */

    function emitWithdrawalRequested(bytes32 requestId, address token, uint amount, address requester, address recepient)
    public
    {
        emit WithdrawalRequested(requestId, token, amount, requester, recepient);
    }

    function emitWithdrawalRequestResolved(bytes32 requestId, address token, uint amount, address requester, address recepient)
    public
    {
        emit WithdrawalRequestResolved(requestId, token, amount, requester, recepient);
    }

    function emitWithdrawalRequestCancelled(bytes32 requestId)
    public
    {
        emit WithdrawalRequestCancelled(requestId);
    }

    function emitPrimaryMinerChanged(address from, address to)
    public
    {
        emit PrimaryMinerChanged(from, to);
    }

    function emitMinerDeposited(address token, uint amount, address miner, address sender)
    public
    {
        emit MinerDeposited(token, amount, miner, sender);
    }

    function emitDeposit(address token, address who, uint amount)
    public
    {
        emit Deposit(token, who, amount);
    }

    function emitSharesWhiteListChanged(address token, uint limit, bool isAdded)
    public
    {
        emit SharesWhiteListChanged(token, limit, isAdded);
    }

    function emitError(uint error)
    public
    {
        emit Error(_self(), error);
    }
}
