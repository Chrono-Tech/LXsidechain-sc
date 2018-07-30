/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import "solidity-eventshistory-lib/contracts/MultiEventsHistoryAdapter.sol";


/// @title TimeHolder emitter.
///
/// Contains all the original event emitting function definitions and events.
/// In case of new events needed later, additional emitters can be developed.
/// All the functions is meant to be called using delegatecall.
contract TimeHolderEmitter is MultiEventsHistoryAdapter {

    /// @dev Miner address were given a deposit from a user who make a deposit to TimeHolder
    event MinerDeposited(address token, uint amount, address miner, address sender);

    /// @dev Changed an address of primary miner
    event PrimaryMinerChanged(address from, address to);

    /// @dev Changed minimum amount of shares that should be locked to become a miner
    event MiningDepositLimitsChanged(address token, uint from, uint to);

    /// @dev Shares were locked for a purpose (usualy when a miner adds to a stack)
    event DepositLocked(address token, uint amount, address user);

    /// @dev Miner role is assigned
    event BecomeMiner(address token, address miner, uint totalDepositLocked);

    /// @dev Miner role is resigned
    event ResignMiner(address token, address miner, uint depositUnlocked);

    /// @dev User deposited into current period
    event Deposit(address token, address who, uint amount);

    /// @dev Shares withdrawn by a shareholder
    event WithdrawShares(address token, address who, uint amount, address receiver);

    /// @dev Shares is added to whitelist and start be available to use
    event SharesWhiteListAdded(address token);

    /// @dev Shares is removed from whitelist and stop being available to use
    event SharesWhiteListChanged(address token, uint limit, bool indexed isAdded);

    /* Emitting events */

    function emitPrimaryMinerChanged(address from, address to)
    public
    {
        emit PrimaryMinerChanged(from, to);
    }

    function emitMiningDepositLimitsChanged(address _token, uint _from, uint _to)
    public
    {
        emit MiningDepositLimitsChanged(_token, _from, _to);
    }

    function emitMinerDeposited(address token, uint amount, address miner, address sender)
    public
    {
        emit MinerDeposited(token, amount, miner, sender);
    }

    function emitDepositLocked(address _token, uint _amount, address _user)
    public
    {
        emit DepositLocked(_token, _amount, _user);
    }

    function emitBecomeMiner(address _token, address _miner, uint _totalDepositLocked)
    public
    {
        emit BecomeMiner(_token, _miner, _totalDepositLocked);
    }

    function emitResignMiner(address _token, address _miner, uint _depositUnlocked)
    public
    {
        emit ResignMiner(_token, _miner, _depositUnlocked);
    }

    function emitDeposit(address token, address who, uint amount)
    public
    {
        emit Deposit(token, who, amount);
    }

    function emitWithdrawShares(address token, address who, uint amount, address receiver) 
    public
    {
        emit WithdrawShares(token, who, amount, receiver);
    }

    function emitSharesWhiteListChanged(address token, uint limit, bool isAdded)
    public
    {
        emit SharesWhiteListChanged(token, limit, isAdded);
    }
}
