const ChronoBankPlatform = artifacts.require('ChronoBankPlatform');
const ChronoBankAsset = artifacts.require('ChronoBankAsset');
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy');
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const LXValidatorManager = artifacts.require("LXValidatorManager")

const Reverter = require('./helpers/reverter');

const RewardKind  = {"Author":0,"EmptyStep":2}

contract('LXBlockReward', function (accounts) {
    let reverter = new Reverter(web3);
    const TIME_SYMBOL = 'TIME';
    const SYSTEM_ADDRESS = "0xfffffffffffffffffffffffffffffffffffffffe";
    let TIME;
    let TIME_ASSET;

    let platform;
    let blockReward;
    let validatorSet;
    let validatorManager;
    let system = accounts[4];

    afterEach('revert', reverter.revert);

    before('before', async () => {
        platform = await ChronoBankPlatform.deployed();

        TIME = ChronoBankAssetProxy.at(await platform.proxies(TIME_SYMBOL));
        TIME_ASSET = ChronoBankAsset.at(await TIME.getLatestVersion());

        blockReward = await LXBlockReward.deployed();
        validatorSet = await LXValidatorSet.deployed();
        validatorManager = await LXValidatorManager.deployed();

        await reverter.promisifySnapshot();
    })

    context("in sidechain", async () => {
        it('should calculate `reward` if an account has TIME (via transfer)', async () => {
            let user = accounts[5];
            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user)).isZero());
            assert.isFalse(await validatorManager.isValidator(user));

            let rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardAuthor[1][0].isZero());

            let rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.transfer(user, TOKEN_AMOUNT, {from: accounts[0]});
            assert.isTrue((await TIME.balanceOf(user)).eq(TOKEN_AMOUNT));

            rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isFalse(rewardAuthor[1][0].isZero());

            rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            await TIME.transfer(0x1, TOKEN_AMOUNT, {from: user});

            rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue((await TIME.balanceOf(user)).eq(0));
            assert.isTrue(rewardAuthor[1][0].isZero());
        })

        it('should calculate `reward` if an account has TIME (via revoke)', async () => {
            let user = accounts[5];
            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user)).isZero());
            assert.isFalse(await validatorManager.isValidator(user));

            let rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardAuthor[1][0].isZero());

            let rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.transfer(user, TOKEN_AMOUNT, {from: accounts[0]});
            assert.isTrue((await TIME.balanceOf(user)).eq(TOKEN_AMOUNT));

            rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isFalse(rewardAuthor[1][0].isZero());

            rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            await platform.revokeAsset(TIME_SYMBOL, TOKEN_AMOUNT, {from: user});

            rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue((await TIME.balanceOf(user)).eq(0));
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
