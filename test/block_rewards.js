const AtomicSwapERC20 = artifacts.require('AtomicSwapERC20');
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform');
const ChronoBankAsset = artifacts.require('LXChronoBankAsset');
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
        await platform.reissueAsset(TIME_SYMBOL, 100 * Math.pow(10, 8));
        TIME = ChronoBankAssetProxy.at(await platform.proxies(TIME_SYMBOL));
        TIME_ASSET = ChronoBankAsset.at(await TIME.getLatestVersion());

        blockReward = await LXBlockRewardTestable.deployed();
        validatorSet = await LXValidatorSetTestable.deployed();
        validatorManager = await LXValidatorManager.deployed();

        await reverter.promisifySnapshot();
    })

    context("in sidechain", async () => {
        it('should add to validators if account has TIME', async () => {
            let user = accounts[5];

            assert.isTrue((await TIME.balanceOf(user)).isZero());
            assert.isFalse(await validatorManager.isValidator(user));

            let rewardAuthor = await blockReward.reward.call([user], [RewardKind.Author], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardAuthor[1][0].isZero());

            let rewardEmptyStep = await blockReward.reward.call([user], [RewardKind.EmptyStep], {from:SYSTEM_ADDRESS});
            assert.isTrue(rewardEmptyStep[1][0].isZero());

            let validators = await validatorSet.getValidators();
            assert.equal(validators.length, 0);

            await TIME.transfer(user, 100, {from: accounts[0]});
            assert.isTrue((await TIME.balanceOf(user)).eq(100));

            assert.isTrue(await validatorManager.isValidator(user));

            validators = await validatorSet.getValidators();
            assert.equal(validators.length, 0);

            await validatorSet.finalizeChange({from:system});

            validators = await validatorSet.getValidators();
            assert.isTrue(includes(validators, user));
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
