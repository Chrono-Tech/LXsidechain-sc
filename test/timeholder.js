const Rewards = artifacts.require("Rewards")
const TimeHolder = artifacts.require("TimeHolder")
const FakeCoin = artifacts.require("FakeCoin")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")

const Reverter = require('./helpers/reverter')
const utils = require("./helpers/utils")
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")

contract('New version of TimeHolder', (accounts) => {
    let reverter = new Reverter(web3);

    let reward;
    let timeHolder;
    let timeHolderWallet
    let shares;
    let asset1;
    let asset2;

    let miner = accounts[9]

    const ZERO_INTERVAL = 0;
    const SHARES_BALANCE = 100000000;
    const UINT_MAX = web3.toBigNumber(2).pow(256).sub(1)

    let _withdrawShares = async (sender, amount) => {
        await timeHolder.withdrawShares(shares.address, amount, { from: sender, })
    }

    let _withdrawSharesCall = async (sender, amount) => {
        return await timeHolder.withdrawShares.call(shares.address, amount, { from: sender, })
    }

    before('Setup', async() => {
        reward = await Rewards.deployed()
        timeHolder = await TimeHolder.deployed()

        timeHolderWallet = await timeHolder.wallet()

        let platform = await ChronoBankPlatform.deployed()
        shares = ChronoBankAssetProxy.at(await platform.proxies("TIME"))

        await platform.reissueAsset(await shares.symbol(), 3 * SHARES_BALANCE)
        await shares.transfer(accounts[1], SHARES_BALANCE);
        await shares.transfer(accounts[2], SHARES_BALANCE);

        await shares.approve(timeHolderWallet, SHARES_BALANCE, {from: accounts[0]})
        await shares.approve(timeHolderWallet, SHARES_BALANCE, {from: accounts[1]})
        await shares.approve(timeHolderWallet, SHARES_BALANCE, {from: accounts[2]})

        asset1 = await FakeCoin.new("FAKE2", "FAKE2", 4);
        asset2 = await FakeCoin.new("FAKE3", "FAKE3", 4);

        await asset1.mint(accounts[0], SHARES_BALANCE);
        await asset1.mint(accounts[1], SHARES_BALANCE);

        await asset2.mint(accounts[0], SHARES_BALANCE);
        await asset2.mint(accounts[1], SHARES_BALANCE);

        await reverter.promisifySnapshot();
    });

    context("initial state", () => {
        const DEPOSIT_AMOUNT = 100

        describe("without primary miner", () => {
            it("should NOT allow to make a deposit with TIMEHOLDER_MINER_REQUIRED code", async () => {
                await timeHolder.setPrimaryMiner(0x0, { from: accounts[0], })
                let result = await timeHolder.deposit.call(shares.address, DEPOSIT_AMOUNT, { from: accounts[0],})
                assert.equal(result, ErrorsEnum.TIMEHOLDER_MINER_REQUIRED)
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
                assert.equal(event.address, MultiEventsHistory.address)
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

        context("withdrawal with", () => {
            const user = accounts[1]
            const DEPOSIT_AMOUNT = 100

            it("and should have primary miner", async () => {
                assert.equal(await timeHolder.getPrimaryMiner.call(), miner)
            })

            context("success flow", () => {
                let initialBalance
                let initialMinerSharesBalance
                let initialWalletSharesBalance

                before(async () => {
                    await shares.approve(timeHolderWallet, UINT_MAX, { from: miner, })

                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    initialMinerSharesBalance = await shares.balanceOf(miner)
                    initialWalletSharesBalance = await shares.balanceOf(timeHolderWallet)
                })

                after('revert', reverter.revert);

                it("should allow to deposit", async () => {
                    const tx = await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user, })
                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        initialBalance.plus(DEPOSIT_AMOUNT).toString()
                    )

                    {
                        const event = (await eventsHelper.findEvent([timeHolder,], tx, "Deposit"))[0]
                        assert.isDefined(event)
                        assert.equal(event.args.token, shares.address)
                        assert.equal(event.args.who, user)
                        assert.equal(event.args.amount.toString(), DEPOSIT_AMOUNT.toString())
                    }
                    {
                        const event = (await eventsHelper.findEvent([timeHolder,], tx, "MinerDeposited"))[0]
                        assert.isDefined(event)
                        assert.equal(event.args.token, shares.address)
                        assert.equal(event.args.amount.toString(), DEPOSIT_AMOUNT.toString())
                        assert.equal(event.args.miner, miner)
                        assert.equal(event.args.sender, user)
                    }
                })

                it("miner should receive deposited amount of shares", async () => {
                    assert.equal(
                        (await shares.balanceOf(miner)).toString(),
                        initialMinerSharesBalance.add(DEPOSIT_AMOUNT)
                    )
                })

                it("reward wallet should have initial shares balance", async () => {
                    assert.equal(
                        (await shares.balanceOf(timeHolderWallet)).toString(),
                        initialWalletSharesBalance.toString()
                    )
                })

                it("should NOT be able to withdraw for more amount than user has with TIMEHOLDER_INSUFFICIENT_BALANCE code", async () => {
                    const currentBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, currentBalance.plus(1), { from: user, })).toString(),
                        ErrorsEnum.TIMEHOLDER_INSUFFICIENT_BALANCE
                    )
                })

                it("should be able to withdraw for less or equal amount as deposit balance with OK code", async () => {
                    const currentBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, currentBalance, { from: user, })).toString(),
                        ErrorsEnum.OK
                    )
                })

                let withdrawalBalance

                it("should allow to withdraw", async () => {
                    withdrawalBalance = await timeHolder.getDepositBalance.call(shares.address, user)
                    const resolver = miner
                    const minerSharesBalance = await shares.balanceOf(resolver)
                    const userSharesBalance = await shares.balanceOf(user)
                    const tx = await timeHolder.withdrawShares(shares.address, withdrawalBalance, { from: user, })
                    
                    {
                        const event = (await eventsHelper.findEvent([timeHolder,], tx, "WithdrawShares"))[0]
                        assert.isDefined(event)
                        assert.equal(event.args.token, shares.address)
                        assert.equal(event.args.who, user)
                        assert.equal(event.args.amount, withdrawalBalance.toString())
                        assert.equal(event.args.receiver, user)
                    }

                    assert.equal(
                        (await shares.balanceOf(resolver)).toString(),
                        minerSharesBalance.sub(withdrawalBalance).toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(user)).toString(),
                        userSharesBalance.add(withdrawalBalance).toString()
                    )

                    assert.equal(
                        (await shares.balanceOf(timeHolderWallet)).toString(),
                        initialWalletSharesBalance.toString()
                    )

                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        initialBalance.toString()
                    )
                })
            })

            context("several deposits", () => {
                let initialBalance
                let initialAccountBalance

                before(async () => {
                    await shares.approve(timeHolderWallet, UINT_MAX, { from: miner, })

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

            context("emergency withdrawal", () => {
                const depositor = accounts[1]
                const contractOwner = accounts[0]
                const withdrawalAmount1 = DEPOSIT_AMOUNT / 2

                let initialBalance
                let totalDeposit

                before(async () => {
                    await shares.approve(timeHolderWallet, UINT_MAX, { from: miner, })

                    initialBalance = await timeHolder.getDepositBalance.call(shares.address, depositor)
                    totalDeposit = web3.toBigNumber(10*DEPOSIT_AMOUNT)
                    await timeHolder.deposit(shares.address, totalDeposit, { from: depositor, })
                })

                after('revert', reverter.revert)

                it("should NOT allow to force request withdrawal from non contract owner with UNAUTHORIZED code", async () => {
                    const stranger = accounts[3]
                    assert.equal(
                        (await timeHolder.forceWithdrawShares.call(depositor, shares.address, withdrawalAmount1, { from: stranger, })).toNumber(),
                        ErrorsEnum.UNAUTHORIZED
                    )
                })

                it("should allow force request withdrawal from contract owner with OK code", async () => {
                    assert.equal(
                        (await timeHolder.forceWithdrawShares.call(depositor, shares.address, withdrawalAmount1, { from: contractOwner, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow force withdrawal from contract owner", async () => {
                    const resolver = miner
                    const minerSharesBalance = await shares.balanceOf(resolver)
                    const initialOwnerSharesBalance = await shares.balanceOf(contractOwner)
                    const initialOwnerDepositBalance = await timeHolder.getDepositBalance(shares.address, contractOwner)
                    const initialUserSharesBalance = await shares.balanceOf(depositor)
                    const tx = await timeHolder.forceWithdrawShares(depositor, shares.address, withdrawalAmount1, { from: contractOwner, })
                    
                    {
                        const event = (await eventsHelper.findEvent([timeHolder,], tx, "WithdrawShares"))[0]
                        assert.isDefined(event)
                        assert.equal(event.args.token, shares.address)
                        assert.equal(event.args.who, depositor)
                        assert.equal(event.args.amount, withdrawalAmount1.toString())
                        assert.equal(event.args.receiver, contractOwner)
                    }

                    assert.equal(
                        (await shares.balanceOf(contractOwner)).toString(),
                        initialOwnerSharesBalance.add(withdrawalAmount1).toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(depositor)).toString(),
                        initialUserSharesBalance.toString()
                    )
                    assert.equal(
                        (await shares.balanceOf(resolver)).toString(),
                        minerSharesBalance.sub(withdrawalAmount1).toString()
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

            context("limited allowance", () => {

                before(async () => {
                    await shares.approve(timeHolderWallet, DEPOSIT_AMOUNT, { from: miner, })

                    await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })
                    await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })
                })

                after('revert', reverter.revert)

                it("should NOT allow to withdraw more than allowed with TIMEHOLDER_TRANSFER_FAILED code", async () => {
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, DEPOSIT_AMOUNT + 1, { from: user, })).toNumber(),
                        ErrorsEnum.TIMEHOLDER_TRANSFER_FAILED
                    )
                })

                it("should allow to withdraw equal to allowed sum with OK code", async () => {
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, DEPOSIT_AMOUNT, { from: user, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow to withdraw equal to allowed sum", async () => {
                    await timeHolder.withdrawShares(shares.address, DEPOSIT_AMOUNT, { from: user, })

                    assert.equal(
                        (await shares.allowance(miner, timeHolderWallet)).toString(),
                        '0'
                    )
                })

                it("should NOT allow to withdraw deposited than allowed with TIMEHOLDER_TRANSFER_FAILED code", async () => {
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, DEPOSIT_AMOUNT, { from: user, })).toNumber(),
                        ErrorsEnum.TIMEHOLDER_TRANSFER_FAILED
                    )
                })
            })

            context("unlimited allowance", () => {
                const HALF_OF_UINT_MAX = UINT_MAX.div(2).truncated()

                before(async () => {
                    await shares.approve(timeHolderWallet, 0, { from: user, })
                    await shares.approve(timeHolderWallet, UINT_MAX, { from: miner, })

                    let platform = await ChronoBankPlatform.deployed()
                    await platform.reissueAsset(await shares.symbol(), HALF_OF_UINT_MAX)
                    await shares.transfer(user, HALF_OF_UINT_MAX)

                    await shares.approve(timeHolderWallet, HALF_OF_UINT_MAX, { from: user, })
                    await timeHolder.deposit(shares.address, HALF_OF_UINT_MAX, { from: user })
                })

                after('revert', reverter.revert)

                it("should allow to withdraw half of max amount of total token from TimeHolder with OK code", async () => {
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, HALF_OF_UINT_MAX, { from: user, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow to withdraw equal to deposited amount", async () => {
                    await timeHolder.withdrawShares(shares.address, HALF_OF_UINT_MAX, { from: user, })

                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        '0'
                    )
                    assert.isTrue(
                        (await shares.allowance(miner, timeHolderWallet)).eq(UINT_MAX)
                    )
                })

                it("should allow to deposit the same value (HALF_OF_UINT_MAX) for the second time", async () => {
                    await shares.approve(timeHolderWallet, HALF_OF_UINT_MAX, { from: user, })
                    await timeHolder.deposit(shares.address, HALF_OF_UINT_MAX, { from: user })
                    
                    assert.isTrue(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).eq(HALF_OF_UINT_MAX)
                    )
                })
                
                it("should allow to withdraw (2nd time) half of max amount of total token from TimeHolder with OK code", async () => {
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, HALF_OF_UINT_MAX, { from: user, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow to withdraw (3rd time) equal to deposited amount", async () => {
                    await timeHolder.withdrawShares(shares.address, HALF_OF_UINT_MAX, { from: user, })

                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        '0'
                    )
                    assert.isTrue(
                        (await shares.allowance(miner, timeHolderWallet)).eq(UINT_MAX)
                    )
                })

                it("should allow to deposit the same value (HALF_OF_UINT_MAX) for the third time", async () => {
                    await shares.approve(timeHolderWallet, HALF_OF_UINT_MAX, { from: user, })
                    await timeHolder.deposit(shares.address, HALF_OF_UINT_MAX, { from: user })
                    assert.isTrue(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).eq(HALF_OF_UINT_MAX)
                    )
                })
                
                it("should allow to withdraw (3nd time) half of max amount of total token from TimeHolder with OK code", async () => {
                    assert.equal(
                        (await timeHolder.withdrawShares.call(shares.address, HALF_OF_UINT_MAX, { from: user, })).toNumber(),
                        ErrorsEnum.OK
                    )
                })

                it("should allow to withdraw (3rd time) equal to deposited amount", async () => {
                    await timeHolder.withdrawShares(shares.address, HALF_OF_UINT_MAX, { from: user, })

                    assert.equal(
                        (await timeHolder.getDepositBalance.call(shares.address, user)).toString(),
                        '0'
                    )
                    assert.isTrue(
                        (await shares.allowance(miner, timeHolderWallet)).eq(UINT_MAX)
                    )
                })
            })
        })
    })
});
