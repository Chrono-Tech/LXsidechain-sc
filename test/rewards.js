const Storage = artifacts.require("Storage")
const Rewards = artifacts.require("Rewards")
const RewardsWallet = artifacts.require("RewardsWallet")
const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderWallet = artifacts.require("TimeHolderWallet")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const FakeCoin = artifacts.require("FakeCoin")
const FakeCoin2 = artifacts.require("FakeCoin2")
const FakeCoin3 = artifacts.require("FakeCoin3")
const ManagerMock = artifacts.require("ManagerMock")

const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")

contract('Rewards', (accounts) => {
    let reverter = new Reverter(web3)
    
    let reward
    let rewardsWallet
    let timeHolder
    let timeHolderWalle
    let erc20DepositStorage
    let storage
    let multiEventsHistory
    let shares
    let asset1
    let asset2
    let storageManager
    
    const fakeArgs = [0,0,0,0,0,0,0,0]
    const ZERO_INTERVAL = 0
    const SHARES_BALANCE = 1161
    const CHRONOBANK_PLATFORM_ID = 1
    
    let DEFAULT_SHARE_ADDRESS
    
    const STUB_PLATFORM_ADDRESS = 0x0
    
    let defaultInit = async () => {
        await storage.setManager(storageManager.address)
        await rewardsWallet.init(reward.address)
        await reward.init(rewardsWallet.address, asset1.address, ZERO_INTERVAL)
        await timeHolderWallet.init(timeHolder.address)
        await timeHolder.init(DEFAULT_SHARE_ADDRESS, timeHolderWallet.address, erc20DepositStorage.address)
        await multiEventsHistory.authorize(reward.address)
    }
    
    let assertSharesBalance = async (address, expectedBalance) => {
        const balance = await shares.balanceOf(address)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertAsset1Balance = async (address, expectedBalance) => {
        const balance = await asset1.balanceOf(address)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertAsset2Balance = async (address, expectedBalance) => {
        const balance = await asset2.balanceOf(address)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertDepositBalance = async (address, expectedBalance) => {
        const balance = await timeHolder.depositBalance(address)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertDepositBalanceInPeriod = async (address, period, expectedBalance) => {
        const balance = await reward.depositBalanceInPeriod(address, period)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertTotalDepositInPeriod = async (period, expectedBalance) => {
        const balance = await reward.totalDepositInPeriod(period)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertAssetBalanceInPeriod = async (assetAddress, period, expectedBalance) => {
        const balance = await reward.assetBalanceInPeriod(assetAddress, period)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertRewardsLeft = async (assetAddress, expectedBalance) => {
        const balance = await reward.getRewardsLeft(assetAddress)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertRewardsFor = async (address, assetAddress, expectedBalance) => {
        const balance = await reward.rewardsFor(assetAddress, address)
        assert.equal(balance.toString(), '' + expectedBalance)
    }
    
    let assertUniqueHoldersForPeriod = async (period, expectedCount) => {
        const count = await reward.periodUnique(period)
        assert.equal(count.toString(), '' + expectedCount)
    }
    
    before('Setup', async () => {
        storage = await Storage.new()
        rewardsWallet = await RewardsWallet.new()
        reward = await Rewards.new(storage.address, "Deposits")
        timeHolderWallet = await TimeHolderWallet.new()
        timeHolder = await TimeHolder.new(storage.address,"Deposits")
        erc20DepositStorage = await ERC20DepositStorage.new(storage.address,"Deposits")
        multiEventsHistory = await MultiEventsHistory.deployed()
        storageManager = await ManagerMock.new()
        shares = await FakeCoin.new()
        asset1 = await FakeCoin2.new()
        asset2 = await FakeCoin3.new()
        
        DEFAULT_SHARE_ADDRESS = shares.address
        
        await shares.mint(accounts[0], SHARES_BALANCE)
        await shares.mint(accounts[1], SHARES_BALANCE)
        await shares.mint(accounts[2], SHARES_BALANCE)
        
        await reverter.promisifySnapshot()
    })

    describe("standard", () => {
        beforeEach(async () => {
            await defaultInit()
        })
    
        afterEach('revert', reverter.revert)
            
        it('should receive the rigth reward assets list', async () => {
            const assets = await reward.getAssets.call()
            assert.lengthOf(assets, 1)
            assert.equal(assets[0], asset1.address)
        })
        
        it("should have right wallet address", async () => {
            const wallet = await reward.wallet.call()
            assert.equal(wallet, rewardsWallet.address)
        })
        
        it('should return true if was called with 0 shares (copy from prev period)', async () => {
            const resultCode = await timeHolder.depositFor.call(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            assert.equal(resultCode, ErrorsEnum.OK)
        })
        
        it('should not deposit if sharesContract.transferFrom() failed', async () => {
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], SHARES_BALANCE + 1)
            
            await assertSharesBalance(accounts[0], 1161)
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
            await asset1.mint(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 50)
            
            await reward.closePeriod()
            await assertTotalDepositInPeriod(0, 50)
            
            await assertAssetBalanceInPeriod(asset1.address, 0, 100)
            
            // 2nd period - deposit 0 several times
            await asset1.mint(rewardsWallet.address, 200)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 0)
            await reward.closePeriod()
            await assertTotalDepositInPeriod(1, 50)
            
            await assertAssetBalanceInPeriod(asset1.address, 1, 200)
        })

        it('should not be possible to close period if period.startDate + closeInterval * 1 days > now', async () => {
            await reward.init(rewardsWallet.address, asset1.address, 2)
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
            await asset1.mint(rewardsWallet.address, 100)
            await reward.closePeriod()
            
            await assertAssetBalanceInPeriod(asset1.address, 0, 100)
            await assertRewardsLeft(asset1.address, 100)
            
            // 2nd period
            await asset1.mint(rewardsWallet.address, 200)
            await reward.closePeriod()
            
            await assertAssetBalanceInPeriod(asset1.address, 1, 200)
            await assertRewardsLeft(asset1.address, 300)
        });
        
        it('should calculate reward', async () => {
            await asset1.mint(rewardsWallet.address, 100)
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 75, { from: accounts[0] })
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 25, { from: accounts[1] })
            
            await reward.closePeriod()
            await assertTotalDepositInPeriod(0, 100)
            
            assert.isTrue(await reward.isCalculatedFor.call(asset1.address, accounts[0], 0))
            await assertRewardsFor(accounts[0], asset1.address, 75)
            
            assert.isTrue(await reward.isCalculatedFor(asset1.address, accounts[1], 0))
            await assertRewardsFor(accounts[1], asset1.address, 25)
        });
        
        it('should calculate rewards for several periods', async () => {
            // 1st period - deposit 50
            await asset1.mint(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 50)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[1], 50)
            await reward.closePeriod()
            await assertTotalDepositInPeriod(0, 100)
            await assertAssetBalanceInPeriod(asset1.address, 0, 100)
            
            // calculate for 1st period      
            assert.isTrue(await reward.isCalculatedFor(asset1.address, accounts[0], 0))
            await assertRewardsFor(accounts[0], asset1.address, 50)
            
            // 2nd period - should accept all shares
            await asset1.mint(rewardsWallet.address, 200)
            await reward.closePeriod()
            await assertTotalDepositInPeriod(1, 100)
            await assertAssetBalanceInPeriod(asset1.address, 1, 200)
            
            // calculate for 2nd period      
            assert.isTrue(await reward.isCalculatedFor(asset1.address, accounts[0], 1))
            await assertRewardsFor(accounts[0], asset1.address, 150)
        })
        
        it('should not withdraw more shares than you have', async () => {
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 100)
            const withdrawResultCode = await timeHolder.withdrawShares.call(DEFAULT_SHARE_ADDRESS, 200)
            assert.notEqual(withdrawResultCode, ErrorsEnum.OK)
            
            await timeHolder.withdrawShares(DEFAULT_SHARE_ADDRESS, 200)
            await assertDepositBalance(accounts[0], 100)
            await assertTotalDepositInPeriod(0, 100)
            await assertSharesBalance(accounts[0], SHARES_BALANCE - 100)
            await assertSharesBalance(timeHolderWallet.address, 100)
        })
        
        it('should withdraw shares without deposit in new period', async () => {
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 100)
            await assertDepositBalance(accounts[0], 100)
            await assertDepositBalanceInPeriod(accounts[0], 0, 100)
            await assertTotalDepositInPeriod(0, 100)
            
            await reward.closePeriod()
            await assertUniqueHoldersForPeriod(0,1)
            
            await timeHolder.withdrawShares(DEFAULT_SHARE_ADDRESS, 50)
            await assertDepositBalance(accounts[0], 50)
            await assertDepositBalanceInPeriod(accounts[0], 1, 50)
            await assertTotalDepositInPeriod(1, 50)
        })
        
        it('should withdraw shares', async () => {
            await timeHolder.deposit(DEFAULT_SHARE_ADDRESS, 100)
            await timeHolder.withdrawShares(DEFAULT_SHARE_ADDRESS, 50)
            await assertDepositBalance(accounts[0], 50)
            await assertDepositBalanceInPeriod(accounts[0], 0, 50)
            await assertTotalDepositInPeriod(0, 50)
            await assertSharesBalance(accounts[0], SHARES_BALANCE - 50)
            await assertSharesBalance(timeHolderWallet.address, 50)
        })
        
        it('should return false if rewardsLeft == 0', async () => {
            const resultCode = await reward.withdrawReward.call(asset1.address, 100, {from: accounts[0],})
            assert.notEqual(resultCode, ErrorsEnum.OK)
        })
        
        it('should withdraw reward', async () => {
            await asset1.mint(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await reward.closePeriod()
            await assertRewardsFor(accounts[0], asset1.address, 100)
            
            await reward.withdrawReward(asset1.address, 100, {from: accounts[0]})
            await assertAsset1Balance(accounts[0], 100)
            await assertRewardsLeft(asset1.address, 0)
            await assertRewardsFor(accounts[0], asset1.address, 0)
        })
        
        it('should withdraw reward by different shareholders', async () => {
            await asset1.mint(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[1], 200)
            await reward.closePeriod()
            await assertRewardsFor(accounts[0], asset1.address, 33)
            await assertRewardsFor(accounts[1], asset1.address, 66)
            
            await reward.withdrawReward(asset1.address, 33, {from: accounts[0]})
            await reward.withdrawReward(asset1.address, 66, {from: accounts[1]})
            await assertAsset1Balance(accounts[0], 33)
            await assertAsset1Balance(accounts[1], 66)
            await assertRewardsLeft(asset1.address, 1)
            await assertRewardsFor(accounts[0], asset1.address, 0)
            await assertRewardsFor(accounts[1], asset1.address, 0)
        })
        
        it('should allow partial withdraw reward', async () => {
            await asset1.mint(rewardsWallet.address, 100)
            await timeHolder.depositFor(DEFAULT_SHARE_ADDRESS, accounts[0], 100)
            await reward.closePeriod()
            await assertRewardsFor(accounts[0], asset1.address, 100)
            
            await reward.withdrawReward(asset1.address, 30, {from: accounts[0]})
            await assertAsset1Balance(accounts[0], 30)
            await assertRewardsLeft(asset1.address, 70)
            await assertRewardsFor(accounts[0], asset1.address, 70)
        })
    })    
})
