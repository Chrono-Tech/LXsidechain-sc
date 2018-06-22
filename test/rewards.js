const Rewards = artifacts.require("Rewards")
const RewardsWallet = artifacts.require("RewardsWallet")
const TimeHolder = artifacts.require("TimeHolder")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")

const Reverter = require('./helpers/reverter')
const ErrorsEnum = require("../common/errors")

contract('Rewards', (accounts) => {
    let reverter = new Reverter(web3)

    const miner = accounts[9]

    let reward
    let rewardsWallet
    let timeHolder
    let shares
    let asset1

    const SHARES_BALANCE = 1161
    let DEFAULT_SHARE_ADDRESS

    let mintEth = (destination, amount) => {
        return new Promise((resolve, reject) => {
            web3.eth.sendTransaction({ from: miner, to: destination, value: amount, }, (e, r) => {
                e ? reject(e) : resolve(r)
            })
        })
    }

    let getEthSpent = (tx) => {
        tx = tx.tx || tx
        txObj = web3.eth.getTransaction(tx)
        txReceipt = web3.eth.getTransactionReceipt(tx)
        return txObj.gasPrice * txReceipt.gasUsed
    }

    let assertSharesBalance = async (address, expectedBalance) => {
        const balance = await shares.balanceOf(address)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertAsset1Balance = async (address, expectedBalance) => {
        const balance = web3.eth.getBalance(address)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertDepositBalance = async (address, expectedBalance) => {
        const balance = await timeHolder.depositBalance(address)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertDepositBalanceInPeriod = async (address, period, expectedBalance) => {
        const balance = await reward.depositBalanceInPeriod(address, period)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertTotalDepositInPeriod = async (period, expectedBalance) => {
        const balance = await reward.totalDepositInPeriod(period)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertAssetBalanceInPeriod = async (period, expectedBalance) => {
        const balance = await reward.assetBalanceInPeriod(period)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertRewardsLeft = async (expectedBalance) => {
        const balance = await reward.getRewardsLeft()
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertRewardsFor = async (address, expectedBalance) => {
        const balance = await reward.rewardsFor(address)
        assert.isTrue(balance.eq(expectedBalance))
    }

    let assertUniqueHoldersForPeriod = async (period, expectedCount) => {
        const count = await reward.periodUnique(period)
        assert.isTrue(count.eq(expectedCount))
    }

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

    before('Setup', async () => {
        rewardsWallet = await RewardsWallet.deployed()
        reward = await Rewards.deployed()
        timeHolder = await TimeHolder.deployed()

        let platform = await ChronoBankPlatform.deployed()
        shares = ChronoBankAssetProxy.at(await platform.proxies("TIME"))

        DEFAULT_SHARE_ADDRESS = shares.address

        await platform.reissueAsset(await shares.symbol(), 3 * SHARES_BALANCE)
        await shares.transfer(accounts[1], SHARES_BALANCE)
        await shares.transfer(accounts[2], SHARES_BALANCE)

        const wallet = await timeHolder.wallet()
        await shares.approve(wallet, SHARES_BALANCE, {from: accounts[0]})
        await shares.approve(wallet, SHARES_BALANCE, {from: accounts[1]})
        await shares.approve(wallet, SHARES_BALANCE, {from: accounts[2]})
        timeHolder._withdrawShares = _withdrawShares
        timeHolder._withdrawSharesCall = _withdrawSharesCall

        await reverter.promisifySnapshot()
    })

    describe("standard", () => {
        beforeEach(async () => {})

        afterEach('revert', reverter.revert)

        it("should have right wallet address", async () => {
            const wallet = await reward.wallet.call()
            assert.equal(wallet, rewardsWallet.address)
        })

        // TODO
        // it('should return true if was called with 0 shares (copy from prev period)', async () => {
        //     const resultCode = await timeHolder.depositFor.call(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
        //     console.log(resultCode)
        //     assert.equal(resultCode, ErrorsEnum.OK)
        // })

        it('should not deposit if sharesContract.transferFrom() failed', async () => {
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], SHARES_BALANCE + 1)

            await assertSharesBalance(accounts[0], SHARES_BALANCE)
            await assertDepositBalance(accounts[0], 0)
            await assertDepositBalanceInPeriod(accounts[0], 0, 0)
            await assertTotalDepositInPeriod(0, 0)
        })

        it('should be possible to deposit shares', async () => {
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)

            await assertDepositBalance(accounts[0], 100)
            await assertDepositBalanceInPeriod(accounts[0], 0, 100)
            await assertTotalDepositInPeriod(0, 100)
        })

        it('should be possible to make deposit several times in one period', async () => {
            // 1st deposit
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await assertDepositBalance(accounts[0], 100)
            await assertDepositBalanceInPeriod(accounts[0], 0, 100)
            await assertTotalDepositInPeriod(0, 100)
            // 2nd deposit
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await assertDepositBalance(accounts[0], 200)
            await assertDepositBalanceInPeriod(accounts[0], 0, 200)
            await assertTotalDepositInPeriod(0, 200)
            // 3rd deposit
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[1], 100)
            await assertDepositBalance(accounts[1], 100)
            await assertDepositBalanceInPeriod(accounts[1], 0, 100)

            await assertTotalDepositInPeriod(0, 300)
        })

        it('should be possible to call deposit(0) several times', async () => {
            // 1st period - deposit 50
            await mintEth(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 50)

            await reward.closePeriod()
            await assertTotalDepositInPeriod(0, 50)

            await assertAssetBalanceInPeriod(0, 100)

            // 2nd period - deposit 0 several times
            await mintEth(rewardsWallet.address, 200)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            await reward.closePeriod()
            await assertTotalDepositInPeriod(1, 50)

            await assertAssetBalanceInPeriod(1, 200)
        })

        it('should not be possible to close period if period.startDate + closeInterval * 1 days > now', async () => {
            await reward.init(rewardsWallet.address, 2)
            const resultCode = await reward.closePeriod.call()
            assert.notEqual(resultCode, ErrorsEnum.OK)

            await reward.closePeriod()
            // periods.length still 0
            const period = await reward.lastPeriod()
            await assert.equal(period, 0)
        })

        it('should be possible to close period', async () => {
            await reward.closePeriod()
            // periods.length become 1
            const period = await reward.lastPeriod()
            assert.equal(period, 1)
        });

        it('should count incoming rewards separately for each period', async () => {
            // 1st period
            await mintEth(rewardsWallet.address, 100)
            await reward.closePeriod()

            await assertAssetBalanceInPeriod(0, 100)
            await assertRewardsLeft(100)

            // 2nd period
            await mintEth(rewardsWallet.address, 200)
            await reward.closePeriod()

            await assertAssetBalanceInPeriod(1, 200)
            await assertRewardsLeft(300)
        });

        it('should calculate reward', async () => {
            await mintEth(rewardsWallet.address, 100)
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 75, { from: accounts[0], })
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 25, { from: accounts[1], })

            await reward.closePeriod()
            await assertTotalDepositInPeriod(0, 100)

            assert.isTrue(await reward.isCalculatedFor.call(accounts[0], 0))
            await assertRewardsFor(accounts[0], 75)

            assert.isTrue(await reward.isCalculatedFor(accounts[1], 0))
            await assertRewardsFor(accounts[1], 25)
        });

        it('should calculate rewards for several periods', async () => {
            // 1st period - deposit 50
            await mintEth(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 50)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[1], 50)
            await reward.closePeriod()
            await assertTotalDepositInPeriod(0, 100)
            await assertAssetBalanceInPeriod(0, 100)

            // calculate for 1st period
            assert.isTrue(await reward.isCalculatedFor(accounts[0], 0))
            await assertRewardsFor(accounts[0], 50)

            // 2nd period - should accept all shares
            await mintEth(rewardsWallet.address, 200)
            await reward.closePeriod()
            await assertTotalDepositInPeriod(1, 100)
            await assertAssetBalanceInPeriod(1, 200)

            // calculate for 2nd period
            assert.isTrue(await reward.isCalculatedFor(accounts[0], 1))
            await assertRewardsFor(accounts[0], 150)
        })

        it('should not withdraw more shares than you have', async () => {
            const minerBalance = await shares.balanceOf(miner)
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 100, { from: accounts[0], })
            const withdrawResultCode = await timeHolder._withdrawSharesCall(accounts[0], 200)
            assert.equal(withdrawResultCode.toNumber(), ErrorsEnum.TIMEHOLDER_WITHDRAW_LIMIT_EXCEEDED)

            await timeHolder._withdrawShares(accounts[0], 200)
            await assertDepositBalance(accounts[0], 100)
            await assertTotalDepositInPeriod(0, 100)
            await assertSharesBalance(accounts[0], SHARES_BALANCE - 100)
            await assertSharesBalance(miner, minerBalance.plus(100))
        })

        it('should withdraw shares without deposit in new period', async () => {
            let tx = await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 100, { from: accounts[0], })
            await assertDepositBalance(accounts[0], 100)
            await assertDepositBalanceInPeriod(accounts[0], 0, 100)
            await assertTotalDepositInPeriod(0, 100)

            tx = await reward.closePeriod()
            await assertUniqueHoldersForPeriod(0,1)

            await timeHolder._withdrawShares(accounts[0], 50)
            await assertDepositBalance(accounts[0], 50)
            await assertDepositBalanceInPeriod(accounts[0], 1, 50)
            await assertTotalDepositInPeriod(1, 50)
        })

        it('should withdraw shares', async () => {
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 100, { from: accounts[0], })
            const minerBalance = await shares.balanceOf(miner)
            await timeHolder._withdrawShares(accounts[0], 50)
            await assertDepositBalance(accounts[0], 50)
            await assertDepositBalanceInPeriod(accounts[0], 0, 50)
            await assertTotalDepositInPeriod(0, 50)
            await assertSharesBalance(accounts[0], SHARES_BALANCE - 50)
            await assertSharesBalance(miner, minerBalance.sub(50))
        })

        it('should return false if rewardsLeft == 0', async () => {
            const resultCode = await reward.withdrawReward.call(100, { from: accounts[0], })
            assert.notEqual(resultCode, ErrorsEnum.OK)
        })

        it('should withdraw reward', async () => {
            await mintEth(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await reward.closePeriod()
            await assertRewardsFor(accounts[0], 100)

            var balanceBefore0 = web3.eth.getBalance(accounts[0])
            const tx0 = await reward.withdrawReward(100, { from: accounts[0], })
            balanceBefore0 = balanceBefore0.sub(getEthSpent(tx0))
            await assertAsset1Balance(accounts[0], balanceBefore0.plus(100))
            await assertRewardsLeft(0)
            await assertRewardsFor(accounts[0], 0)
        })

        it('should withdraw reward by different shareholders', async () => {
            await mintEth(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[1], 200)
            await reward.closePeriod()
            await assertRewardsFor(accounts[0], 33)
            await assertRewardsFor(accounts[1], 66)

            var balanceBefore0 = web3.eth.getBalance(accounts[0])
            var balanceBefore1 = web3.eth.getBalance(accounts[1])
            const tx0 = await reward.withdrawReward(33, { from: accounts[0], })
            const tx1 = await reward.withdrawReward(66, { from: accounts[1], })
            balanceBefore0 = balanceBefore0.sub(getEthSpent(tx0))
            balanceBefore1 = balanceBefore1.sub(getEthSpent(tx1))
            await assertAsset1Balance(accounts[0], balanceBefore0.plus(33))
            await assertAsset1Balance(accounts[1], balanceBefore1.plus(66))
            await assertRewardsLeft(1)
            await assertRewardsFor(accounts[0], 0)
            await assertRewardsFor(accounts[1], 0)
        })

        it('should allow partial withdraw reward', async () => {
            await mintEth(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await reward.closePeriod()
            await assertRewardsFor(accounts[0], 100)

            var balanceBefore0 = web3.eth.getBalance(accounts[0])
            const tx0 = await reward.withdrawReward(30, { from: accounts[0], })
            balanceBefore0 = balanceBefore0.sub(getEthSpent(tx0))
            await assertAsset1Balance(accounts[0], balanceBefore0.plus(30))
            await assertRewardsLeft(70)
            await assertRewardsFor(accounts[0], 70)
        })
    })
})
