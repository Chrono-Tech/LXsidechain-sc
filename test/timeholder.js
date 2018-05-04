const Rewards = artifacts.require("Rewards")
const RewardsWallet = artifacts.require("RewardsWallet")
const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const Storage = artifacts.require("Storage")
const MultiEventsHistory = artifacts.require('MultiEventsHistory')
const FakeCoin = artifacts.require("FakeCoin")
const FakeCoin2 = artifacts.require("FakeCoin2")
const FakeCoin3 = artifacts.require("FakeCoin3")
const ManagerMock = artifacts.require('ManagerMock')

const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const utils = require("./helpers/utils")
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")

contract('New version of TimeHolder', (accounts) => {
    let reverter = new Reverter(web3);
    afterEach('revert', reverter.revert);

    let reward;
    let rewardsWallet;
    let timeHolder;
    let erc20DepositStorage;
    let timeHolderWallet
    let storage;
    let multiEventsHistory;
    let shares;
    let asset1;
    let asset2;
    let storageManager

    const fakeArgs = [0,0,0,0,0,0,0,0];
    const ZERO_INTERVAL = 0;
    const SHARES_BALANCE = 100000000;
    const CHRONOBANK_PLATFORM_ID = 1;
    const STUB_PLATFORM_ADDRESS = 0x0

    before('Setup', async() => {
        storage = await Storage.new();
        rewardsWallet = await RewardsWallet.new(storage.address, "RewardsWallet");
        reward = await Rewards.new(storage.address, "Deposits");
        timeHolderWallet = await TimeHolderWallet.new(storage.address, 'TimeHolderWallet');
        timeHolder = await TimeHolder.new(storage.address, 'Deposits');
        erc20DepositStorage = await ERC20DepositStorage.new(storage.address, 'Deposits');
        multiEventsHistory = await MultiEventsHistory.deployed();
        shares = await FakeCoin.new();
        asset1 = await FakeCoin2.new();
        asset2 = await FakeCoin3.new();
        storageManager = await ManagerMock.new()

        await shares.mint(accounts[0], SHARES_BALANCE);
        await shares.mint(accounts[1], SHARES_BALANCE);
        await shares.mint(accounts[2], SHARES_BALANCE);

        await asset1.mint(accounts[0], SHARES_BALANCE);
        await asset1.mint(accounts[1], SHARES_BALANCE);

        await asset2.mint(accounts[0], SHARES_BALANCE);
        await asset2.mint(accounts[1], SHARES_BALANCE);

        await storage.setManager(storageManager.address);
        await rewardsWallet.init(reward.address);
        await reward.init(rewardsWallet.address, asset1.address, ZERO_INTERVAL);
        await timeHolderWallet.init(timeHolder.address);
        await timeHolder.init(shares.address, timeHolderWallet.address, erc20DepositStorage.address);
        
        await multiEventsHistory.authorize(reward.address);
        await multiEventsHistory.authorize(timeHolder.address);

        await reverter.promisifySnapshot();
    });

    context("deposit", function () {
        it('should correct handle default shares', async () => {
            const DEPOSIT_AMOUNT = 200;

            assert.equal(await timeHolder.deposit.call(shares.address, DEPOSIT_AMOUNT), ErrorsEnum.OK);
            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT);

            assert.equal(await timeHolder.getDepositBalance(shares.address, accounts[0]), DEPOSIT_AMOUNT);
            assert.equal(await timeHolder.depositBalance(accounts[0]), DEPOSIT_AMOUNT);
        });

        it('shouldn\'t allow blacklisted assest', async () => {
            const DEPOSIT_AMOUNT1 = 200;
            const DEPOSIT_AMOUNT2 = 201;

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0);
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0);

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.UNAUTHORIZED);
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.UNAUTHORIZED);

            await timeHolder.deposit(asset1.address, DEPOSIT_AMOUNT1);
            await timeHolder.deposit(asset2.address, DEPOSIT_AMOUNT2);

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0);
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0);
        });

        it('should permit whitelisted assests', async () => {
            const DEPOSIT_AMOUNT1 = 200;
            const DEPOSIT_AMOUNT2 = 201;

            await timeHolder.allowShares([asset1.address, asset2.address], [SHARES_BALANCE, SHARES_BALANCE]);

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0);
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0);

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.OK);
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.OK);

            await timeHolder.deposit(asset1.address, DEPOSIT_AMOUNT1);
            await timeHolder.deposit(asset2.address, DEPOSIT_AMOUNT2);

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), DEPOSIT_AMOUNT1);
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), DEPOSIT_AMOUNT2);

            await timeHolder.denyShares([asset1.address, asset2.address]);

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.UNAUTHORIZED);
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.UNAUTHORIZED);
        });
    })

    context("withdraw", function () {
        it('shouls allow to withdraw nondefault assets', async () => {
            const DEPOSIT_AMOUNT1 = 200;
            const DEPOSIT_AMOUNT2 = 201;

            const initialBalance1 = await asset1.balanceOf(accounts[0]);
            const initialBalance2 = await asset2.balanceOf(accounts[0]);

            await timeHolder.allowShares([asset1.address, asset2.address], [SHARES_BALANCE, SHARES_BALANCE]);

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0);
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0);

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.OK);
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.OK);

            await timeHolder.deposit(asset1.address, DEPOSIT_AMOUNT1);
            await timeHolder.deposit(asset2.address, DEPOSIT_AMOUNT2);

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), DEPOSIT_AMOUNT1);
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), DEPOSIT_AMOUNT2);

            await timeHolder.withdrawShares(asset1.address, DEPOSIT_AMOUNT1);
            await timeHolder.withdrawShares(asset2.address, DEPOSIT_AMOUNT2);

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0);
            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0);

            assert.equal(initialBalance1.cmp(await asset1.balanceOf(accounts[0])), 0);
            assert.equal(initialBalance2.cmp(await asset2.balanceOf(accounts[0])), 0);
        });

        it('should have right deposit balance after several deposits and single withdrawal', async () => {
            let user = accounts[0]
            const DEPOSIT_AMOUNT = 100
            let initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
            let initialAccountBalance = await shares.balanceOf(user)

            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })
            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })

            let accountBalanceAfterDeposit = await shares.balanceOf.call(user)
            assert.equal(accountBalanceAfterDeposit.toNumber(), initialAccountBalance.toNumber() - DEPOSIT_AMOUNT * 2)

            let balanceAfterDeposit = await timeHolder.getDepositBalance.call(shares.address, user)
            assert.equal(balanceAfterDeposit.toNumber(), DEPOSIT_AMOUNT * 2)

            await timeHolder.withdrawShares(shares.address, DEPOSIT_AMOUNT, { from: user })

            let accountBalanceAfterWithdrawal = await shares.balanceOf.call(user)
            assert.equal(accountBalanceAfterWithdrawal.toNumber(), accountBalanceAfterDeposit.toNumber() + DEPOSIT_AMOUNT)

            let balanceAfterWithdrawal = await timeHolder.getDepositBalance.call(shares.address, user)
            assert.equal(balanceAfterWithdrawal.toNumber(), balanceAfterDeposit.toNumber() - DEPOSIT_AMOUNT)
        })

        it('should allow to withdraw deposits in case of emergency for contract owner', async () => {
            const DEPOSIT_AMOUNT = 200;
            let user = accounts[1];
            let owner = accounts[0];

            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, {from: user});
            assert.equal(await timeHolder.depositBalance(user), DEPOSIT_AMOUNT);

            let walletBalance = await shares.balanceOf(await timeHolder.wallet());
            let ownerBalance = await shares.balanceOf(owner);

            assert.equal(await timeHolder.forceWithdrawShares.call(user, shares.address, DEPOSIT_AMOUNT), ErrorsEnum.OK);
            await timeHolder.forceWithdrawShares(user, shares.address, DEPOSIT_AMOUNT);

            assert.equal(await shares.balanceOf(await timeHolder.wallet()), walletBalance - DEPOSIT_AMOUNT);
            assert.equal(await timeHolder.depositBalance(user), 0);
            assert.equal(ownerBalance.add(DEPOSIT_AMOUNT).cmp(await shares.balanceOf(owner)), 0);
        });

        it('shouldn\'t allow and THROW when withdrawing deposits in case of emergency for non-owner', async () => {
            const DEPOSIT_AMOUNT = 200;
            let user = accounts[1];

            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, {from: user});
            assert.equal(await timeHolder.depositBalance(user), DEPOSIT_AMOUNT);
            let walletBalance = await shares.balanceOf(await timeHolder.wallet());

            try {
                assert.equal(await timeHolder.forceWithdrawShares.call(user, shares.address, DEPOSIT_AMOUNT, {from: accounts[2]}), ErrorsEnum.UNAUTHORIZED);
            }
            catch (e) {
                utils.ensureException(e)
            }

            try {
                await timeHolder.forceWithdrawShares(user, shares.address, DEPOSIT_AMOUNT, {from: accounts[2]});
            }
            catch (e) {
                utils.ensureException(e)
            }

            assert.equal(await timeHolder.depositBalance(user), DEPOSIT_AMOUNT);
            assert.equal(walletBalance.cmp(await shares.balanceOf(await timeHolder.wallet())), 0);
        });
    })
});
