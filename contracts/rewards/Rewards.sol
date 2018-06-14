/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.23;


import { ERC20Interface as ERC20 } from "solidity-shared-lib/contracts/ERC20Interface.sol";
import "../timeholder/DepositWalletInterface.sol";
import "./RewardsEmitter.sol";
import "./Deposits.sol";


/**
* @title Defines interface for managers that can store any tokens and use for that purpose wallets
* instead of keeping tokens on their own address. Keeps this contracts updatable with ease.
*/
contract WalletBackedManagerInterface {
    function wallet() public view returns (address);
}


/**
 * @title Universal decentralized ERC20 tokens rewards contract.
 *
 * One ERC20 token serves as a shares, and any number of other ERC20 tokens serve as rewards(assets).
 * Rewards distribution are divided in periods, the only thing that shareholder needs to do in
 * order to take part in distribution is prove to rewards contract that he possess certain amount
 * of shares before period closes. Prove is made through allowing rewards contract to take shares
 * from the shareholder, and then depositing it through a call to rewards contract. Proof is needed
 * for every period.
 *
 * When calculating rewards distribution, resulting amount is always rounded down.
 *
 * In order to be able to deposit shares, user needs to create allowance for wallet contract, using
 * standard ERC20 approve() function, so that contract can take shares from the user, when user
 * makes a dpeosit.
 *
 * Users can withdraw their shares at any moment, but only remaining shares will be used for
 * rewards distribution.
 * Users can withdraw their accumulated rewards at any moment.
 *
 * State flow:
 *   1. Period closed, next period started;
 *   2. Reward assets registered for last closed preiod;
 *   3. Rewards distributed for closed period;
 *   4. Shares deposited into current period;
 *   5. Repeat.
 *
 * Note: all the non constant functions return false instead of throwing in case if state change
 * didn't happen yet.
 */
contract Rewards is Deposits, RewardsEmitter {

    uint constant ERROR_REWARD_NOT_FOUND = 9000;
    uint constant ERROR_REWARD_INVALID_PERIOD = 9004;
    uint constant ERROR_REWARD_NO_REWARDS_LEFT = 9005;
    uint constant ERROR_REWARD_TRANSFER_FAILED = 9006;
    uint constant ERROR_REWARD_ALREADY_CALCULATED = 9007;
    uint constant ERROR_REWARD_CALCULATION_FAILED = 9008;
    uint constant ERROR_REWARD_CANNOT_CLOSE_PERIOD = 9009;
    uint constant ERROR_REWARD_REWARDS_ALREADY_REGISTERED = 9010;

    StorageInterface.UInt closeInterval;
    StorageInterface.UInt maxSharesTransfer;
    StorageInterface.AddressUIntMapping rewards;
    StorageInterface.UInt rewardsLeft;
    StorageInterface.UInt periods;
    StorageInterface.UIntBoolMapping closed;
    StorageInterface.UIntUIntMapping startDate;
    StorageInterface.UIntUIntMapping totalShares;
    StorageInterface.UIntAddressUIntMapping shares;
    StorageInterface.UIntUIntMapping shareholdersCount;
    StorageInterface.UIntUIntMapping assetBalances;
    StorageInterface.UIntAddressBoolMapping calculated;

    StorageInterface.Address walletStorage;

    constructor(Storage _store, bytes32 _crate) Deposits(_store, _crate) public {
        closeInterval.init("closeInterval");
        maxSharesTransfer.init("maxSharesTransfer");
        rewards.init("rewards");
        rewardsLeft.init("rewardsLeft");
        periods.init("periods");
        totalShares.init("totalShares");
        shareholdersCount.init("shareholdersCount");
        closed.init("closed");
        startDate.init("startDate");
        assetBalances.init("assetBalances");
        calculated.init("calculated");
        shares.init("shares");
        walletStorage.init("rewardsWalletStorage");
    }

    /**
     * Sets ContractManager contract and period minimum length.
     * Starts the first period.
     *
     * @param _closeIntervalDays period minimum length, in days.
     *
     * @return result code, @see Errors
     */
    function init(
        address _wallet, 
        uint _closeIntervalDays
    ) 
    onlyContractOwner 
    external 
    returns (uint) 
    {
        uint result = store.get(walletStorage) != 0x0 ? REINITIALIZED : OK;

        store.set(closeInterval, _closeIntervalDays);
        store.set(walletStorage, _wallet);

        // do not update default values if reinitialization
        if (REINITIALIZED != result) {
            store.set(startDate, 0, now);
            store.set(maxSharesTransfer, 30);
        }

        return OK;
    }


    function() external payable {
        revert("Cannot receive Ether");
    }

    /**
    * @dev Gets wallet address used to store tokens
    *
    * @return wallet address
    */
    function wallet() public view returns (address) {
        return store.get(walletStorage);
    }

    function getCloseInterval() public view returns (uint) {
        return store.get(closeInterval);
    }

    function setCloseInterval(uint _closeInterval) onlyContractOwner public returns (uint) {
        store.set(closeInterval, _closeInterval);
        return OK;
    }

    function getMaxSharesTransfer() public view returns (uint) {
        return store.get(maxSharesTransfer);
    }

    function setMaxSharesTransfer(uint _maxSharesTransfer) onlyContractOwner public returns (uint) {
        store.set(maxSharesTransfer, _maxSharesTransfer);
        return OK;
    }

    function getRewardsLeft() public view returns (uint) {
        return store.get(rewardsLeft);
    }

    function periodsLength() public view returns (uint) {
        return store.get(periods);
    }

    function periodUnique(uint _period) public view returns (uint) {
        if (_period == lastPeriod()) {
            return store.count(shareholders);
        } else {
            return store.get(shareholdersCount, _period);
        }
    }

    /**
     * Close current active period and start the new period.
     *
     * Can only be done if period was active longer than minimum length.
     *
     * @return success.
     */
    function closePeriod() onlyContractOwner public returns (uint resultCode) {
        uint period = lastPeriod();
        if ((store.get(startDate, period) + (store.get(closeInterval) * 1 days)) > now) {
            return _emitError(ERROR_REWARD_CANNOT_CLOSE_PERIOD);
        }

        uint _totalSharesPeriod = store.get(totalSharesStorage);
        uint _shareholdersCount = store.count(shareholders);
        store.set(totalShares, period, _totalSharesPeriod);
        store.set(shareholdersCount, period, _shareholdersCount);

        resultCode = registerAsset(period);
        if (OK != resultCode) {
            // do not interrupt, just emit an Event
            emitError(resultCode);
            return resultCode;
        }

        store.set(periods, ++period);
        store.set(startDate, period, now);

        resultCode = storeDeposits();
        if (resultCode == OK) {
            _emitPeriodClosed();
        }
    }

    function getPeriodStartDate(uint _period) public view returns (uint) {
        return store.get(startDate, _period);
    }

    /**
    *  @return error code and still left shares. `sharesLeft` is actual only
    *  if `errorCode` == OK, otherwise `sharesLeft` must be ignored.
    */
    function storeDeposits() onlyContractOwner internal returns (uint result) {
        uint period = lastClosedPeriod();
        uint period_end = getPeriodStartDate(lastPeriod());
        StorageInterface.Iterator memory iterator = store.listIterator(shareholders);
        uint amount;
        uint j;
        for (uint i = 0; store.canGetNextWithIterator(shareholders, iterator); i++) {
            address shareholder = store.getNextWithIterator(shareholders, iterator);
            amount = 0;
            StorageInterface.Iterator memory iterator2 = store.listIterator(deposits, bytes32(shareholder));
            for (j = 0; store.canGetNextWithIterator(deposits, iterator2); j++) {
                uint id = store.getNextWithIterator(deposits, iterator2);
                uint timestamp = store.get(timestamps, shareholder, id);
                if (timestamp <= period_end) {
                    amount += store.get(amounts, shareholder, id);
                }
            }

            result = calculateRewardFor(shareholder, amount, period);
            if (OK != result) {
                _emitError(result);
            }

            store.set(shares, period, shareholder, amount);
        }

        store.set(closed, period, true);

        return OK;
    }

    function registerAsset(uint _period) internal returns (uint) {
        uint period_balance = store.get(assetBalances, _period);
        if (period_balance != 0) {
            return _emitError(ERROR_REWARD_REWARDS_ALREADY_REGISTERED);
        }

        uint balance = wallet().balance;
        uint left = store.get(rewardsLeft);
        store.set(assetBalances, _period, balance - left);
        store.set(rewardsLeft, balance);

        return OK;
    }

    function calculateRewardFor(address _address, uint _amount, uint _period) internal returns (uint e) {
        uint assetBalance = store.get(assetBalances, _period);
        if (assetBalance == 0) {
            return ERROR_REWARD_CALCULATION_FAILED;
        }

        if (store.get(calculated, _period, _address)) {
            return ERROR_REWARD_ALREADY_CALCULATED;
        }

        uint totalSharesPeriod = store.get(totalShares, _period);
        uint reward = assetBalance * _amount / totalSharesPeriod;
        uint cur_reward = store.get(rewards, _address);
        store.set(rewards, _address, cur_reward + reward);
        store.set(calculated, _period, _address, true);

        return OK;
    }

    /**
     * Withdraw accumulated reward of a specified rewards asset.
     *
     * Withdrawal is made for caller and total amount.
     *
     * @return success.
     */
    function withdrawRewardTotal() external returns (uint) {
        return withdrawRewardFor(msg.sender, rewardsFor(msg.sender));
    }

    /**
     * Withdraw accumulated reward of a specified rewards asset.
     *
     * Withdrawal is made for caller and specified amount.
     *
     * @param _amount amount to withdraw.
     *
     * @return success.
     */
    function withdrawReward(uint _amount) external returns (uint) {
        return withdrawRewardFor(msg.sender, _amount);
    }

    /**
     * Withdraw accumulated reward of a specified rewards asset.
     *
     * Withdrawal is made for specified shareholder and specified amount.
     *
     * @param _address shareholder address to withdraw for.
     * @param _amount amount to withdraw.
     *
     * @return success.
     */
    function withdrawRewardFor(address _address, uint _amount) internal returns (uint) {
        if (store.get(rewardsLeft) == 0) {
            return _emitError(ERROR_REWARD_NO_REWARDS_LEFT);
        }

        // Assuming that transfer(amount) of unknown asset may not result in exactly
        // amount being taken from rewards contract(i. e. fees taken) we check contracts
        // balance before and after transfer, and proceed with the difference.
        address _wallet = wallet();
        uint startBalance = _wallet.balance;
        if (!DepositWalletInterface(_wallet).withdrawEth(_address, _amount)) {
            return _emitError(ERROR_REWARD_TRANSFER_FAILED);
        }

        uint endBalance = _wallet.balance;
        uint diff = startBalance - endBalance;
        if (rewardsFor(_address) < diff) {
            revert();
        }

        store.set(rewards, _address, store.get(rewards, _address) - diff);
        store.set(rewardsLeft, store.get(rewardsLeft) - diff);

        _emitWithdrawnReward(_address, _amount);
        return OK;
    }

    /**
     * Returns proven amount of shares possessed by a shareholder in a period.
     *
     * @param _address shareholder address.
     * @param _period period.
     *
     * @return shares amount.
     */
    function depositBalanceInPeriod(address _address, uint _period) public view returns (uint) {
        if (_period == lastPeriod()) {
            return depositBalance(_address);
        }
        return store.get(shares, _period, _address);
    }

    /**
     * Returns total proven amount of shares possessed by shareholders in a period.
     *
     * @param _period period.
     *
     * @return shares amount.
     */
    function totalDepositInPeriod(uint _period) public view returns (uint) {
        if (_period == lastPeriod()) {
            return store.get(totalSharesStorage);
        }
        return store.get(totalShares,_period);
    }

    /**
     * Returns current active period.
     *
     * @return period.
     */
    function lastPeriod() public view returns (uint) {
        return store.get(periods);
    }

    /**
     * Returns last closed period.
     *
     * @dev throws in case if there is no closed periods yet.
     *
     * @return period.
     */
    function lastClosedPeriod() public view returns (uint) {
        if (store.get(periods) == 0) {
            return ERROR_REWARD_NOT_FOUND;
        }
        return store.get(periods) - 1;
    }

    /**
     * Check if period is closed or not.
     *
     * @param _period period.
     *
     * @return period closing state.
     */
    function isClosed(uint _period) public view returns (bool) {
        return store.get(closed,_period);
    }

    /**
     * Returns amount of accumulated rewards assets in a period.
     * Always 0 for active period.
     *
     * @param _period period.
     *
     * @return assets amount.
     */
    function assetBalanceInPeriod(uint _period) public view returns (uint) {
        return store.get(assetBalances, _period);
    }

    /**
     * Check if shareholder have calculated rewards in a period.
     *
     * @param _address shareholder address.
     * @param _period period.
     *
     * @return reward calculation state.
     */
    function isCalculatedFor(address _address, uint _period) public view returns (bool) {
        return store.get(calculated, _period, _address);
    }

    /**
     * Returns accumulated asset rewards available for withdrawal for shareholder.
     *
     * @param _address shareholder address.
     *
     * @return rewards amount.
     */
    function rewardsFor(address _address) public view returns (uint) {
        return store.get(rewards, _address);
    }

    // Even emitter util functions

    function _emitWithdrawnReward(address addr, uint amount) internal {
        Rewards(getEventsHistory()).emitWithdrawnReward(addr, amount);
    }

    function _emitWithdrawn(address addr, uint amount, uint total) internal {
        Rewards(getEventsHistory()).emitWithdrawn(addr, amount, total);
    }

    function _emitDepositStored(uint _part) internal {
        Rewards(getEventsHistory()).emitDepositStored(_part);
    }

    function _emitPeriodClosed() internal {
        Rewards(getEventsHistory()).emitPeriodClosed();
    }

    function _emitError(uint e) internal returns (uint) {
        Rewards(getEventsHistory()).emitError(e);
        return e;
    }
}
