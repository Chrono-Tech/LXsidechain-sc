const ChronoBankPlatform = artifacts.require('ChronoBankPlatform');
const ChronoBankAsset = artifacts.require('ChronoBankAsset');
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy');
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const LXValidatorManager = artifacts.require("LXValidatorManager")
const TimeHolder = artifacts.require("TimeHolder")

const Reverter = require('./helpers/reverter');

const RewardKind  = {"Author":0,"EmptyStep":2}

contract('LXValidatorManager', function (accounts) {
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
    let timeHolder
    let timeHolderWallet
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
        it('should automatically add an account to the validators if an account has locked TIME (in timeholder)', async () => {
            let user = accounts[5];
            const TOKEN_AMOUNT = 100 * Math.pow(10, 8);

            assert.isTrue((await TIME.balanceOf(user)).isZero());
            assert.isFalse(await validatorManager.isValidator(user));

            assert.equal((await validatorSet.getValidators()).length, 0);

            await platform.reissueAsset(TIME_SYMBOL, TOKEN_AMOUNT);

            await TIME.approve(timeHolderWallet, TOKEN_AMOUNT, {from: accounts[0]});
            await timeHolder.depositFor(TIME.address, user, TOKEN_AMOUNT, { from: accounts[0], })
            await timeHolder.lockDepositAndBecomeMiner(TIME.address, TOKEN_AMOUNT, user, { from: user, })
            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user)).toString(16), TOKEN_AMOUNT.toString(16))

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

            for (var _user of [ user1, user2, user3, ]) {
                await TIME.approve(timeHolderWallet, TOKEN_AMOUNT, {from: accounts[0]});
                await timeHolder.depositFor(TIME.address, _user, TOKEN_AMOUNT, { from: accounts[0], })
                await timeHolder.lockDepositAndBecomeMiner(TIME.address, TOKEN_AMOUNT, _user, { from: _user, })
                assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, _user)).toString(16), TOKEN_AMOUNT.toString(16))
            }

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

            await TIME.approve(timeHolderWallet, TOKEN_AMOUNT, {from: accounts[0]});
            await timeHolder.depositFor(TIME.address, user1, TOKEN_AMOUNT, { from: accounts[0], })
            await timeHolder.lockDepositAndBecomeMiner(TIME.address, TOKEN_AMOUNT, user1, { from: user1, })
            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user1)).toString(16), TOKEN_AMOUNT.toString(16))

            await validatorSet.finalizeChange({from:system});

            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user1)).toString(16), TOKEN_AMOUNT.toString(16))
            assert.isTrue(await validatorManager.isValidator(user1));

            await timeHolder.unlockDepositAndResignMiner(TIME.address, { from: user1, })
            await validatorSet.finalizeChange({from:system});

            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user1)).toString(16), '0')
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

            for (var _user of [ user1, user2, ]) {
                await TIME.approve(timeHolderWallet, TOKEN_AMOUNT, {from: accounts[0]});
                await timeHolder.depositFor(TIME.address, _user, TOKEN_AMOUNT, { from: accounts[0], })
                await timeHolder.lockDepositAndBecomeMiner(TIME.address, TOKEN_AMOUNT, _user, { from: _user, })
                assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, _user)).toString(16), TOKEN_AMOUNT.toString(16))
            }

            await validatorSet.finalizeChange({from:system});

            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user1)).toString(16), TOKEN_AMOUNT.toString(16))
            assert.isTrue(await validatorManager.isValidator(user1));

            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user2)).toString(16), TOKEN_AMOUNT.toString(16))
            assert.isTrue(await validatorManager.isValidator(user2));

            for (var _user of [ user1, user2, ]) {
                await timeHolder.unlockDepositAndResignMiner(TIME.address, { from: _user, })
            }

            await validatorSet.finalizeChange({from:system});

            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user1)).toString(16), '0')
            assert.isFalse(await validatorManager.isValidator(user1));
            
            assert.equal((await timeHolder.getLockedDepositBalance(TIME.address, user2)).toString(16), '0')
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
