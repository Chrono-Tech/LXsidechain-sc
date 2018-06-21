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
    let miner = accounts[6]

    const fakeArgs = [0,0,0,0,0,0,0,0];
    const ZERO_INTERVAL = 0;
    const SHARES_BALANCE = 100000000;
    const CHRONOBANK_PLATFORM_ID = 1;
    const STUB_PLATFORM_ADDRESS = 0x0

    let _withdrawShares = async (sender, amount) => {
        const registrationId = "0x1111"
        await timeHolder.requestWithdrawShares(registrationId, shares.address, amount, { from: sender, })
        // only for real ERC20
        // await shares.approve(timeHolder.address, amount, { from: miner, })
        await timeHolder.resolveWithdrawSharesRequest(registrationId, { from: miner, })
    }

    let _withdrawSharesCall = async (sender, amount) => {
        const registrationId = "0x1111"
        return await timeHolder.requestWithdrawShares.call(registrationId, shares.address, amount, { from: sender, })
    }

    before('Setup', async() => {
        storage = await Storage.new();
        rewardsWallet = await RewardsWallet.new();
        reward = await Rewards.new(storage.address, "Deposits");
        timeHolderWallet = await TimeHolderWallet.new();
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
        await reward.init(rewardsWallet.address, ZERO_INTERVAL);
        await timeHolderWallet.init(timeHolder.address);
        await timeHolder.init(shares.address, timeHolderWallet.address, erc20DepositStorage.address);
        await timeHolder.setEventsHistory(multiEventsHistory.address)

        await multiEventsHistory.authorize(reward.address);
        await multiEventsHistory.authorize(timeHolder.address);

        await reverter.promisifySnapshot();
    });

    context("initial state", () => {
        const DEPOSIT_AMOUNT = 100

        describe("without primary miner", () => {
            it("should NOT allow to make a deposit with TIMEHOLDER_MINER_REQUIRED code", async () => {
                assert.equal(
                    (await timeHolder.deposit.call(shares.address, DEPOSIT_AMOUNT, { from: accounts[0], })).toNumber(),
                    ErrorsEnum.TIMEHOLDER_MINER_REQUIRED
                )
            })
        })

        describe("with updating primary miner", () => {

            after('revert', reverter.revert);

            it("should NOT allow to set a primary miner by non contract owner with UNAUTHORIZED code", async () => {
                const stranger = accounts[5]
                assert.equal(
                    (await timeHolder.setPrimaryMiner.call(accounts[1], { from: stranger, })).toNumber(),
                    ErrorsEnum.UNAUTHORIZED
                )
            })

            it("should allow to set a primary miner by contract owner with OK code", async () => {
                assert.equal(
                    (await timeHolder.setPrimaryMiner.call(accounts[9], { from: accounts[0], })).toNumber(),
                    ErrorsEnum.OK
                )
            })

            it("should allow to set a primary miner by contract owner", async () => {
                const previousMiner = await timeHolder.getPrimaryMiner.call()
                const newMiner = accounts[9]
                await timeHolder.setPrimaryMiner(newMiner, { from: accounts[0], })
                assert.notEqual(await timeHolder.getPrimaryMiner.call(), previousMiner)
                assert.equal(await timeHolder.getPrimaryMiner.call(), newMiner)
            })

            it("should emit 'PrimaryMinerChanged' event when updating primary miner", async () => {
                const previousMiner = await timeHolder.getPrimaryMiner.call()
                const newMiner = accounts[7]
                const eventTx = await timeHolder.setPrimaryMiner(newMiner, { from: accounts[0], })
                const event = (await eventsHelper.findEvent([timeHolder,], eventTx, "PrimaryMinerChanged"))[0]
                assert.isDefined(event)
                assert.equal(event.address, multiEventsHistory.address)
                assert.equal(event.name, 'PrimaryMinerChanged');
                assert.equal(event.args.from, previousMiner)
                assert.equal(event.args.to, newMiner)
            })
        })

        describe("with presetup primary miner", () => {
            before(async () => {
                await timeHolder.setPrimaryMiner(miner)
            })

            after('revert', reverter.revert);

            it("should THROW and NOT allow to deposit to the address == primaryMiner", async () => {
                await timeHolder.depositFor.call(shares.address, miner, DEPOSIT_AMOUNT, { from: accounts[0], })
                .then(assert.fail, () => true)
            })

            it("should allow to deposit", async () => {
                assert.equal(
                    (await timeHolder.deposit.call(shares.address, DEPOSIT_AMOUNT, { from: accounts[0], })).toNumber(),
                    ErrorsEnum.OK
                )
            })
        })
    })

    context("main functionality as", () => {

        before(async () => {
            await timeHolder.setPrimaryMiner(miner)
            await reverter.promisifySnapshot();
        })

        context("deposit", function () {
            afterEach('revert', reverter.revert);

            it('should correct handle default shares', async () => {
                const DEPOSIT_AMOUNT = 200;

                assert.equal((await timeHolder.deposit.call(shares.address, DEPOSIT_AMOUNT, { from: accounts[0], })).toNumber(), ErrorsEnum.OK);
                await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: accounts[0], });

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

        context("withdrawal request with", () => {
            const user = accounts[0]
            const DEPOSIT_AMOUNT = 100

            it("and should have primary miner", async () => {
                assert.equal(await timeHolder.getPrimaryMiner.call(), miner)
            })

            context("success flow", () => {
                let initialBalance
                let initialMinerSharesBalance
                let initialWalletSharesBalance

                before(async () => {
                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    initialMinerSharesBalance = await shares.balanceOf(miner)
                    initialWalletSharesBalance = await shares.balanceOf(timeHolderWallet.address)
                })

                after('revert', reverter.revert);

                it("should allow to deposit", async () => {
                    const tx = await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user, })
                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        initialBalance.plus(DEPOSIT_AMOUNT).toString()
                    )
                    // TODO: add event check
                })

                it("miner should receive deposited amount of shares", async () => {
                    assert.equal(
                        (await shares.balanceOf(miner)).toString(),
                        initialMinerSharesBalance.add(DEPOSIT_AMOUNT)
                    )
                })

                it("reward wallet should have initial shares balance", async () => {
                    assert.equal(
                        (await shares.balanceOf(timeHolderWallet.address)).toString(),
                        initialWalletSharesBalance.toString()
                    )
                })

                it("should have no requested withdrawal value", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        '0'
                    )
                })

                const withdrawalRegistrationId = "0xff"

                it("should NOT be able to request withdrawal for more amount than user has with TIMEHOLDER_WITHDRAW_LIMIT_EXCEEDED code", async () => {
                    const currentBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    assert.equal(
                        (await timeHolder.requestWithdrawShares.call(withdrawalRegistrationId, shares.address, currentBalance.plus(1), { from: user, })).toString(),
                        ErrorsEnum.TIMEHOLDER_WITHDRAW_LIMIT_EXCEEDED
                    )
                })

                it("should be able to request withdrawal for less or equal amount as deposit balance with OK code", async () => {
                    const currentBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    assert.equal(
                        (await timeHolder.requestWithdrawShares.call(withdrawalRegistrationId, shares.address, currentBalance, { from: user, })).toString(),
                        ErrorsEnum.OK
                    )
                })

                let withdrawalBalance

                it("should be able to request withdrawal for less or equal amount as deposit balance", async () => {
                    withdrawalBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    const tx = await timeHolder.requestWithdrawShares(withdrawalRegistrationId, shares.address, withdrawalBalance, { from: user, })
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        withdrawalBalance.toString()
                    )
                    // TODO: add event check
                })

                it("shouldn't be able to request withdrawal with already existed registrationId with TIMEHOLDER_REGISTRATION_ID_EXISTS code", async () => {
                    assert.equal(
                        (await timeHolder.requestWithdrawShares.call(withdrawalRegistrationId, shares.address, withdrawalBalance, { from: user, })).toString(),
                        ErrorsEnum.TIMEHOLDER_REGISTRATION_ID_EXISTS
                    )
                })

                it("should be able to check withdrawal request by registration id with requested params", async () => {
                    const [ _tokenAddress, _amount, _target, _receiver, ] = await timeHolder.checkRegisteredWithdrawRequest.call(withdrawalRegistrationId)
                    assert.equal(_tokenAddress, shares.address)
                    assert.equal(_amount.toString(), withdrawalBalance.toString())
                    assert.equal(_target, user)
                    assert.equal(_receiver, user)
                })

                it("should have requested withdrawal value equal to withdrawal request", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        withdrawalBalance.toString()
                    )
                })

                it("should NOT allow anyone to resolve withdrawal request with insufficient shares balance with TIMEHOLDER_INSUFFICIENT_BALANCE code", async () => {
                    const resolver = accounts[7]
                    assert.equal(
                        (await timeHolder.resolveWithdrawSharesRequest.call(withdrawalRegistrationId, { from: resolver, })).toNumber(),
                        ErrorsEnum.TIMEHOLDER_INSUFFICIENT_BALANCE
                    )
                })

                it("should allow anyone to resolve withdrawal request with OK code", async () => {
                    // needs to approve requested amount of shares before resolving a request
                    const resolver = miner;
                    assert.isTrue((await shares.balanceOf(resolver)).gte(withdrawalBalance))
                    assert.equal(
                        (await timeHolder.resolveWithdrawSharesRequest.call(withdrawalRegistrationId, { from: resolver, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow anyone to resolve withdrawal request", async () => {
                    // needs to approve requested amount of shares before resolving a request
                    const resolver = miner
                    const minerSharesBalance = await shares.balanceOf(resolver)
                    const userSharesBalance = await shares.balanceOf(user)
                    const tx = await timeHolder.resolveWithdrawSharesRequest(withdrawalRegistrationId, { from: resolver, })
                    // TODO: add event check
                    assert.equal(
                        (await shares.balanceOf(resolver)).toString(),
                        minerSharesBalance.sub(withdrawalBalance).toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(user)).toString(),
                        userSharesBalance.add(withdrawalBalance).toString()
                    )

                    assert.equal(
                        (await shares.balanceOf(timeHolderWallet.address)).toString(),
                        initialWalletSharesBalance.toString()
                    )

                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        initialBalance.toString()
                    )
                })

                it("should have no requested withdrawal value", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        '0'
                    )
                })

                it("should NOT have resolved withdrawal request", async () => {
                    const [ _tokenAddress, _amount, _target, _receiver, ] = await timeHolder.checkRegisteredWithdrawRequest.call(withdrawalRegistrationId)
                    assert.equal(_tokenAddress, utils.zeroAddress)
                    assert.equal(_amount.toString(), '0')
                    assert.equal(_target, utils.zeroAddress)
                    assert.equal(_receiver, utils.zeroAddress)
                })

                it("shouldn't be able to resolve already resolved request with ", async () => {
                    const resolver = accounts[1]
                    assert.isTrue((await shares.balanceOf(resolver)).gte(withdrawalBalance))
                    assert.equal(
                        (await timeHolder.resolveWithdrawSharesRequest.call(withdrawalRegistrationId, { from: resolver, })).toNumber(),
                        ErrorsEnum.TIMEHOLDER_NO_REGISTERED_WITHDRAWAL_FOUND
                    )
                })
            })

            context("several deposits", () => {
                let initialBalance
                let initialAccountBalance

                before(async () => {
                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    initialAccountBalance = await shares.balanceOf(user)

                    await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })
                    await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })
                })

                after('revert', reverter.revert);

                let accountBalanceAfterDeposit
                let balanceAfterDeposit

                it("should transfer tokens from account's address", async () => {
                    accountBalanceAfterDeposit = await shares.balanceOf.call(user)
                    assert.equal(accountBalanceAfterDeposit.toString(), initialAccountBalance.sub(DEPOSIT_AMOUNT * 2).toString())
                })

                it("should have deposited tokens in TimeHolder", async () => {
                    balanceAfterDeposit = await timeHolder.getDepositBalance.call(shares.address, user)
                    assert.equal(balanceAfterDeposit.toString(), initialBalance.add(DEPOSIT_AMOUNT * 2).toString())
                })

                it("allow to withdraw some shares", async () => {
                    assert.equal((await _withdrawSharesCall(user, DEPOSIT_AMOUNT)).toNumber(), ErrorsEnum.OK)
                    await _withdrawShares(user, DEPOSIT_AMOUNT)
                })

                it("should have increased balance of tokens on an account address", async () => {
                    let accountBalanceAfterWithdrawal = await shares.balanceOf.call(user)
                    assert.equal(accountBalanceAfterWithdrawal.toString(), accountBalanceAfterDeposit.add(DEPOSIT_AMOUNT).toString())
                })

                it("should have reduced balance in TimeHolder", async () => {
                    let balanceAfterWithdrawal = await timeHolder.getDepositBalance.call(shares.address, user)
                    assert.equal(balanceAfterWithdrawal.toString(), balanceAfterDeposit.minus(DEPOSIT_AMOUNT).toString())
                })
            })

            context("several withdrawal requests", () => {
                let initialBalance
                let totalDeposit

                before(async () => {
                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user, })
                    await timeHolder.deposit(shares.address, 2*DEPOSIT_AMOUNT, { from: user, })
                    await timeHolder.deposit(shares.address, 3*DEPOSIT_AMOUNT, { from: user, })
                    totalDeposit = web3.toBigNumber(6*DEPOSIT_AMOUNT)
                })

                after('revert', reverter.revert);

                it("where user should increase his TimeHolder balance", async () => {
                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        initialBalance.add(totalDeposit).toString()
                    )
                })

                it("where miner should have increased balance of shares", async () => {
                    assert.equal(
                        (await shares.balanceOf(miner)).toString(),
                        totalDeposit.toString()
                    )
                })

                const withdrawalRequestId1 = "0xff"
                const withdrawalRequestId2 = "0xee"
                const withdrawalAmount1 = DEPOSIT_AMOUNT / 2
                const withdrawalAmount2 = DEPOSIT_AMOUNT * 4
                const totalWithdrawalAmount = withdrawalAmount1 + withdrawalAmount2

                it("and user should be able to make two withdrawal requests", async () => {
                    await timeHolder.requestWithdrawShares(withdrawalRequestId1, shares.address, withdrawalAmount1, { from: user, })
                    await timeHolder.requestWithdrawShares(withdrawalRequestId2, shares.address, withdrawalAmount2, { from: user, })
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        totalWithdrawalAmount.toString()
                    )
                })

                it("should be able to check withdrawal requests by registration ids with requested params", async () => {
                    {
                        const [ _tokenAddress, _amount, _target, _receiver, ] = await timeHolder.checkRegisteredWithdrawRequest.call(withdrawalRequestId1)
                        assert.equal(_tokenAddress, shares.address)
                        assert.equal(_amount.toString(), withdrawalAmount1.toString())
                        assert.equal(_target, user)
                        assert.equal(_receiver, user)
                    }
                    {
                        const [ _tokenAddress, _amount, _target, _receiver, ] = await timeHolder.checkRegisteredWithdrawRequest.call(withdrawalRequestId2)
                        assert.equal(_tokenAddress, shares.address)
                        assert.equal(_amount.toString(), withdrawalAmount2.toString())
                        assert.equal(_target, user)
                        assert.equal(_receiver, user)
                    }
                })

                it("should allow anyone to resolve withdrawal request", async () => {
                    // needs to approve requested amount of shares before resolving a request
                    const resolver = miner
                    const minerSharesBalance = await shares.balanceOf(resolver)
                    const userSharesBalance = await shares.balanceOf(user)
                    const tx = await timeHolder.resolveWithdrawSharesRequest(withdrawalRequestId1, { from: resolver, })
                    assert.equal(
                        (await shares.balanceOf(resolver)).toString(),
                        minerSharesBalance.sub(withdrawalAmount1).toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(user)).toString(),
                        userSharesBalance.add(withdrawalAmount1).toString()
                    )
                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        totalDeposit.sub(withdrawalAmount1).toString()
                    )
                })

                it("should NOT be able to overflow withdraw amount when some part of balance is already requested", async () => {
                    const withdrawalRequestId3 = "0xdd"
                    assert.equal(
                        (await timeHolder.requestWithdrawShares.call(withdrawalRequestId3, shares.address, withdrawalAmount2, { from: user, })).toNumber(),
                        ErrorsEnum.TIMEHOLDER_WITHDRAW_LIMIT_EXCEEDED
                    )
                })

                it("should allow anyone to resolve second withdrawal request", async () => {
                    // needs to approve requested amount of shares before resolving a request
                    const resolver = miner
                    const minerSharesBalance = await shares.balanceOf(resolver)
                    const userSharesBalance = await shares.balanceOf(user)
                    const tx = await timeHolder.resolveWithdrawSharesRequest(withdrawalRequestId2, { from: resolver, })
                    assert.equal(
                        (await shares.balanceOf(resolver)).toString(),
                        minerSharesBalance.sub(withdrawalAmount2).toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(user)).toString(),
                        userSharesBalance.add(withdrawalAmount2).toString()
                    )
                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        totalDeposit.sub(totalWithdrawalAmount).toString()
                    )
                })
            })

            context("cancelling request", () => {
                let initialBalance
                let totalDeposit

                const withdrawalRequestId1 = "0xff"
                const withdrawalRequestId2 = "0xee"
                const withdrawalAmount1 = DEPOSIT_AMOUNT / 2
                const withdrawalAmount2 = DEPOSIT_AMOUNT * 4
                const totalWithdrawalAmount = withdrawalAmount1 + withdrawalAmount2

                before(async () => {
                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    totalDeposit = web3.toBigNumber(10*DEPOSIT_AMOUNT)
                    await timeHolder.deposit(shares.address, totalDeposit, { from: user, })
                    await timeHolder.requestWithdrawShares(withdrawalRequestId1, shares.address, withdrawalAmount1, { from: user, })
                    await timeHolder.requestWithdrawShares(withdrawalRequestId2, shares.address, withdrawalAmount2, { from: user, })
                })

                after('revert', reverter.revert);

                it("should have total withdrawal amount for a user", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        totalWithdrawalAmount.toString()
                    )
                })

                it("should THROW and NOT be allowed for a user who didn't request the withdrawal", async () => {
                    const stranger = accounts[3]
                    await timeHolder.cancelWithdrawSharesRequest.call(withdrawalRequestId1, { from: stranger, }).then(assert.fail, () => true)
                })

                it("should be allowed for a user who requested the withdrawal with OK code", async () => {
                    assert.equal(
                        (await timeHolder.cancelWithdrawSharesRequest.call(withdrawalRequestId1, { from: user, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should be allowed for a user who requested the withdrawal", async () => {
                    const tx = await timeHolder.cancelWithdrawSharesRequest(withdrawalRequestId1, { from: user, })
                    // TODO: add event check
                })

                it("should NOT have the cancelled withdrawal afterwards", async () => {
                    const [ _tokenAddress, _amount, _target, _receiver, ] = await timeHolder.checkRegisteredWithdrawRequest.call(withdrawalRequestId1)
                    assert.equal(_tokenAddress, utils.zeroAddress)
                    assert.equal(_amount.toString(), '0')
                    assert.equal(_target, utils.zeroAddress)
                    assert.equal(_receiver, utils.zeroAddress)
                })

                it("should have the requested withdraw amount changed afterwards", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, user)).toString(),
                        (totalWithdrawalAmount - withdrawalAmount1).toString()
                    )
                })

                it("should NOT change user's shares balance", async () => {
                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        initialBalance.add(totalDeposit).toString()
                    )
                })
            })

            context("emergency request", () => {
                const depositor = accounts[1]
                const contractOwner = accounts[0]
                const withdrawalRequestId1 = "0xff"
                const withdrawalAmount1 = DEPOSIT_AMOUNT / 2

                let initialBalance
                let totalDeposit

                before(async () => {
                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, depositor)
                    totalDeposit = web3.toBigNumber(10*DEPOSIT_AMOUNT)
                    await timeHolder.deposit(shares.address, totalDeposit, { from: depositor, })
                })

                after('revert', reverter.revert)

                it("should NOT allow to force request withdrawal from non contract owner with UNAUTHORIZED code", async () => {
                    const stranger = accounts[3]
                    assert.equal(
                        (await timeHolder.forceRequestWithdrawShares.call(withdrawalRequestId1, depositor, shares.address, withdrawalAmount1, { from: stranger, })).toNumber(),
                        ErrorsEnum.UNAUTHORIZED
                    )
                })

                it("should allow force request withdrawal from contract owner with OK code", async () => {
                    assert.equal(
                        (await timeHolder.forceRequestWithdrawShares.call(withdrawalRequestId1, depositor, shares.address, withdrawalAmount1, { from: contractOwner, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow force request withdrawal from contract owner", async () => {
                    const tx = await timeHolder.forceRequestWithdrawShares(withdrawalRequestId1, depositor, shares.address, withdrawalAmount1, { from: contractOwner, })
                    // TODO: add event check
                })

                it("should have withdrawal amount for a user", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, depositor)).toString(),
                        withdrawalAmount1.toString()
                    )
                })

                it("should have NO withdrawal amount for contract owner", async () => {
                    assert.equal(
                        (await timeHolder.getRequestedWithdrawAmount.call(shares.address, contractOwner)).toString(),
                        '0'
                    )
                })

                it("should NOT allow to force request withdrawal with the same registration ID with TIMEHOLDER_REGISTRATION_ID_EXISTS code", async () => {
                    assert.equal(
                        (await timeHolder.forceRequestWithdrawShares.call(withdrawalRequestId1, depositor, shares.address, withdrawalAmount1, { from: contractOwner, })).toNumber(),
                        ErrorsEnum.TIMEHOLDER_REGISTRATION_ID_EXISTS
                    )
                })

                it("should be possible to resolve a withdrawal request by anyone with OK code", async () => {
                    const resolver = miner
                    assert.equal(
                        (await timeHolder.resolveWithdrawSharesRequest.call(withdrawalRequestId1, { from: resolver, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should be possible to resolve a withdrawal request by anyone", async () => {
                    const resolver = miner
                    const initialOwnerSharesBalance = await shares.balanceOf(contractOwner)
                    const initialOwnerDepositBalance = await timeHolder.getDepositBalance(shares.address, contractOwner)
                    const initialUserSharesBalance = await shares.balanceOf(depositor)
                    const tx = timeHolder.resolveWithdrawSharesRequest(withdrawalRequestId1, { from: resolver, })
                    // TODO: add event check
                    assert.equal(
                        (await shares.balanceOf(contractOwner)).toString(),
                        initialOwnerSharesBalance.add(withdrawalAmount1).toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(depositor)).toString(),
                        initialUserSharesBalance.toString()
                    )
                    assert.equal(
                        (await timeHolder.getDepositBalance(shares.address, contractOwner)).toString(),
                        initialOwnerDepositBalance.toString()
                    )
                    assert.equal(
                        (await timeHolder.getDepositBalance(shares.address, depositor)).toString(),
                        initialBalance.add(totalDeposit).sub(withdrawalAmount1).toString()
                    )
                })


            })

        })
    })
});
