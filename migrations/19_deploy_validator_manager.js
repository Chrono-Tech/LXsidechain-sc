const LXValidatorManager = artifacts.require("LXValidatorManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const TimeHolder = artifacts.require("TimeHolder")
const Storage = artifacts.require("Storage")
const StorageManager = artifacts.require("StorageManager")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const { basename, } = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		const DEFAULT_VALIDATOR_SET_ADDRESS = "0x0000000000000000000000000000000000000011"
		const DEFAULT_BLOCK_REWARD_ADDRESS = "0x0000000000000000000000000000000000000042"

		let validatorSetAddress = (network == "development") ? LXValidatorSet.address : DEFAULT_VALIDATOR_SET_ADDRESS
		let blockRewardAddress = (network == "development") ? LXBlockReward.address : DEFAULT_BLOCK_REWARD_ADDRESS

		const TIME_SYMBOL = 'TIME'

		const platform = await ChronoBankPlatform.deployed()
		const sharesAddress = await platform.proxies(TIME_SYMBOL);

		await deployer.deploy(LXValidatorManager, Storage.address, "LXValidatorManager")

		const manager = await LXValidatorManager.deployed()
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(manager.address, "LXValidatorManager")

		const history = await MultiEventsHistory.deployed()
		await history.authorize(manager.address)
		await manager.setupEventsHistory(history.address)

		await manager.init(LXValidatorSet.address, TimeHolder.address, sharesAddress)

		const validatorSet = LXValidatorSet.at(validatorSetAddress)
		const blockReward = LXBlockReward.at(blockRewardAddress)

		await validatorSet.setBackend(LXValidatorManager.address)
		await blockReward.setDataProvider(LXValidatorManager.address);

		console.log(`[MIGRATION] [${parseInt(basename(__filename))}] LXValidatorManager: #done`)
	})
}
