const LXValidatorManager = artifacts.require("LXValidatorManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ChronoBankAsset = artifacts.require("ChronoBankAsset")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const LXValidatorSetTestable = artifacts.require("LXValidatorSetTestable")
const LXBlockRewardTestable = artifacts.require("LXBlockRewardTestable")
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		const DEFAULT_VALIDATOR_SET_ADDRESS = "0x0000000000000000000000000000000000000005"
		const DEFAULT_BLOCK_REWARD_ADDRESS = "0x0000000000000000000000000000000000000042"

		let validatorSetAddress = (network == "development") ? LXValidatorSetTestable.address : DEFAULT_VALIDATOR_SET_ADDRESS
		let blockRewardAddress = (network == "development") ? LXBlockRewardTestable.address : DEFAULT_BLOCK_REWARD_ADDRESS

		const TIME_SYMBOL = 'TIME'

		const platform = await ChronoBankPlatform.deployed()
		const sharesAddress = await platform.proxies(TIME_SYMBOL);

		await deployer.deploy(LXValidatorManager, validatorSetAddress, platform.address, sharesAddress)

		const manager = await LXValidatorManager.deployed()

		const history = await MultiEventsHistory.deployed()
		await history.authorize(manager.address)
		await manager.setupEventsHistory(history.address)

		await platform.setListener(manager.address, TIME_SYMBOL)

		const validatorSet = LXValidatorSet.at(validatorSetAddress)
		const blockReward = LXBlockReward.at(blockRewardAddress)

		await validatorSet.setBackend(LXValidatorManager.address)
		await blockReward.setDataProvider(LXValidatorManager.address);

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LXValidatorManager: #done`)
	})
}
