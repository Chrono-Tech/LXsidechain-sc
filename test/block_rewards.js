const ChronoBankPlatform = artifacts.require('ChronoBankPlatform');
const ChronoBankAsset = artifacts.require('ChronoBankAsset');
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy');
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const LXValidatorManager = artifacts.require("LXValidatorManager")
const TimeHolder = artifacts.require("TimeHolder")

const Reverter = require('./helpers/reverter');

const RewardKind  = {"Author":0,"EmptyStep":2}

contract('LXBlockReward', function (accounts) {
    let reverter = new Reverter(web3);
    const TIME_SYMBOL = 'TIME';
    const SYSTEM_ADDRESS = "0xfffffffffffffffffffffffffffffffffffffffe";

    const MINER_TOKEN_DEPOSIT_LIMIT = web3.toBigNumber("10000000")

    let TIME;
    let TIME_ASSET;

    let platform;
    let blockReward;
    let validatorSet;
    let validatorManager;
    let system = accounts[4];

    afterEach('revert', reverter.revert);

    before('before', async () => {
        await reverter.promisifySnapshot();

        platform = await ChronoBankPlatform.deployed();

        TIME = ChronoBankAssetProxy.at(await platform.proxies(TIME_SYMBOL));
        TIME_ASSET = ChronoBankAsset.at(await TIME.getLatestVersion());

        blockReward = await LXBlockReward.deployed();
        validatorSet = await LXValidatorSet.deployed();
        validatorManager = await LXValidatorManager.deployed();

        timeHolder = await TimeHolder.deployed()
        timeHolderWallet = await timeHolder.wallet()

        await timeHolder.setMiningDepositLimits(TIME.address, MINER_TOKEN_DEPOSIT_LIMIT)

        await reverter.promisifySnapshot();
    })

    after(async () => {
        await reverter.promisifyRevert(1)
    })

    context("in sidechain", async () => {
        it('should calculate `reward` if an account has locked TIME (via timeHolder deposits)', async () => {
            let user = accounts[5];
            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user)).isZero());
            assert.isFalse(await validatorManager.isValidator(user));

            let rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardAuthor[1][0].isZero());

            let rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.approve(timeHolderWallet, TOKEN_AMOUNT, {from: accounts[0]});
            await timeHolder.depositFor(TIME.address, user, TOKEN_AMOUNT, { from: accounts[0], })
            await timeHolder.lockDepositAndBecomeMiner(TIME.address, TOKEN_AMOUNT, user, { from: user, })
            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user)).toString(16), TOKEN_AMOUNT.toString(16))

            rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isFalse(rewardAuthor[1][0].isZero());

            rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            await timeHolder.unlockDepositAndResignMiner(TIME.address, { from: user, })
            await timeHolder.withdrawShares(TIME.address, TOKEN_AMOUNT, { from: user, })

            rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue((await timeHolder.getLockedDepositBalance(TIME.address, user)).eq(0));
            assert.isTrue(rewardAuthor[1][0].isZero());
        })
    });

    let includes = (array, k) => {
        for(var i=0; i < array.length; i++){
            if( array[i] === k) {
                return true;
            }
        }
        return false;
    }
});
