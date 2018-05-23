const AtomicSwapERC20 = artifacts.require('AtomicSwapERC20');
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform');
const ChronoBankAsset = artifacts.require('ChronoBankAsset');
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy');
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const LXBlockRewardTestable = artifacts.require("LXBlockRewardTestable")
const LXValidatorSetTestable = artifacts.require("LXValidatorSetTestable")
const LXValidatorManager = artifacts.require("LXValidatorManager")
const ERC20 = artifacts.require('./ERC20.sol');

const utils = require('./helpers/utils');
const Reverter = require('./helpers/reverter');
const bytes32 = require("./helpers/bytes32");

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

        blockReward = await LXBlockRewardTestable.deployed();
        validatorSet = await LXValidatorSetTestable.deployed();
        validatorManager = await LXValidatorManager.deployed();

        await reverter.promisifySnapshot();
    })

    context("in sidechain", async () => {
        it('should automatically add an account to the validators if an account has TIME', async () => {
            let user = accounts[5];
            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user)).isZero());
            assert.isFalse(await validatorManager.isValidator(user));

            let rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardAuthor[1][0].isZero());

            let rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            assert.equal((await validatorSet.getValidators()).length, 0);

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.transfer(user, TOKEN_AMOUNT, {from: accounts[0]});
            assert.isTrue((await TIME.balanceOf(user)).eq(TOKEN_AMOUNT));

            assert.isTrue(await validatorManager.isPending(user));
            assert.isFalse(await validatorManager.isValidator(user));
            assert.equal((await validatorSet.getValidators()).length, 0);

            await validatorSet.finalizeChange({from:system});

            assert.isTrue(await validatorManager.isPending(user));
            assert.isTrue(await validatorManager.isValidator(user));
            assert.equal((await validatorSet.getValidators()).length, 1);
            assert.isTrue(includes(await validatorSet.getValidators(), user));
        })

        it('should automatically add multiple accounts to validators if the accounts has TIME', async () => {
            let user1 = accounts[5];
            let user2 = accounts[6];
            let user3 = accounts[7];

            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isFalse(await validatorManager.isValidator(user1));
            assert.isFalse(await validatorManager.isValidator(user2));
            assert.isFalse(await validatorManager.isValidator(user3));

            assert.equal((await validatorSet.getValidators()).length, 0);

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT * 3);

            await TIME.transfer(user1, TOKEN_AMOUNT, {from: accounts[0]});
            await TIME.transfer(user2, TOKEN_AMOUNT, {from: accounts[0]});
            await TIME.transfer(user3, TOKEN_AMOUNT, {from: accounts[0]});

            assert.isFalse((await TIME.balanceOf(user1)).isZero());
            assert.isFalse((await TIME.balanceOf(user2)).isZero());
            assert.isFalse((await TIME.balanceOf(user3)).isZero());

            await validatorSet.finalizeChange({from:system});

            assert.isTrue(await validatorManager.isValidator(user1));
            assert.isTrue(await validatorManager.isValidator(user2));
            assert.isTrue(await validatorManager.isValidator(user3));
            assert.equal((await validatorSet.getValidators()).length, 3);

            assert.isTrue(includes(await validatorSet.getValidators(), user1));
            assert.isTrue(includes(await validatorSet.getValidators(), user2));
            assert.isTrue(includes(await validatorSet.getValidators(), user3));
        })

        it('should automatically remove an account from validators if an account has no TIME anymore', async () => {
            let user1 = accounts[5];

            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.transfer(user1, TOKEN_AMOUNT, {from: accounts[0]});
            await validatorSet.finalizeChange({from:system});

            assert.isFalse((await TIME.balanceOf(user1)).isZero());
            assert.isTrue(await validatorManager.isValidator(user1));

            await TIME.transfer(accounts[0], TOKEN_AMOUNT, {from: user1});
            await validatorSet.finalizeChange({from:system});

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));
        })

        it('should automatically remove multiple accounts from validators if the accounts has no TIME anymore', async () => {
            let user1 = accounts[5];
            let user2 = accounts[6];

            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));

            assert.isTrue((await TIME.balanceOf(user2)).isZero());
            assert.isFalse(await validatorManager.isValidator(user2));

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT * 2);

            await TIME.transfer(user1, TOKEN_AMOUNT, {from: accounts[0]});
            await TIME.transfer(user2, TOKEN_AMOUNT, {from: accounts[0]});
            await validatorSet.finalizeChange({from:system});

            assert.isFalse((await TIME.balanceOf(user1)).isZero());
            assert.isTrue(await validatorManager.isValidator(user1));

            assert.isFalse((await TIME.balanceOf(user2)).isZero());
            assert.isTrue(await validatorManager.isValidator(user2));

            await TIME.transfer(accounts[0], TOKEN_AMOUNT, {from: user1});
            await TIME.transfer(accounts[0], TOKEN_AMOUNT, {from: user2});
            await validatorSet.finalizeChange({from:system});

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));

            assert.isTrue((await TIME.balanceOf(user2)).isZero());
            assert.isFalse(await validatorManager.isValidator(user2));
        })

        it('should automatically remove an account from validators if an account burned all his tokens', async () => {
            let user1 = accounts[5];

            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.transfer(user1, TOKEN_AMOUNT, {from: accounts[0]});
            await validatorSet.finalizeChange({from:system});

            assert.isFalse((await TIME.balanceOf(user1)).isZero());
            assert.isTrue(await validatorManager.isValidator(user1));

            await platform.revokeAsset(TIME_SYMBOL, TOKEN_AMOUNT, {from: user1});
            await validatorSet.finalizeChange({from:system});

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));
        })

        it('should automatically remove multiple accounts from validators if the accounts burned all his tokens', async () => {
            let user1 = accounts[5];
            let user2 = accounts[6];

            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));

            assert.isTrue((await TIME.balanceOf(user2)).isZero());
            assert.isFalse(await validatorManager.isValidator(user2));

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT * 2);

            await TIME.transfer(user1, TOKEN_AMOUNT, {from: accounts[0]});
            await TIME.transfer(user2, TOKEN_AMOUNT, {from: accounts[0]});
            await validatorSet.finalizeChange({from:system});

            assert.isFalse((await TIME.balanceOf(user1)).isZero());
            assert.isTrue(await validatorManager.isValidator(user1));

            assert.isFalse((await TIME.balanceOf(user2)).isZero());
            assert.isTrue(await validatorManager.isValidator(user2));

            await platform.revokeAsset(TIME_SYMBOL, TOKEN_AMOUNT, {from: user1});
            await validatorSet.finalizeChange({from:system});

            await platform.revokeAsset(TIME_SYMBOL, TOKEN_AMOUNT, {from: user2});
            await validatorSet.finalizeChange({from:system});

            assert.isTrue((await TIME.balanceOf(user1)).isZero());
            assert.isFalse(await validatorManager.isValidator(user1));
            assert.isTrue((await TIME.balanceOf(user2)).isZero());
            assert.isFalse(await validatorManager.isValidator(user2));
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
