const LXValidatorManager = artifacts.require("LXValidatorManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const TimeHolder = artifacts.require("TimeHolder")
const Storage = artifacts.require("Storage")
const StorageManager = artifacts.require("StorageManager")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const deployConfig = require("../deploy-config")
const { basename, } = require("path")

module.exports = (deployer, network, accounts) => {
	const config = deployConfig({ artifacts: artifacts, web3: web3, network: network, accounts: accounts })
	
	deployer.then(async () => {
		const platform = await ChronoBankPlatform.deployed()
		const sharesAddress = await platform.proxies(config.mining.tokenSymbol);

		await deployer.deploy(LXValidatorManager, Storage.address, "LXValidatorManager")

		const manager = await LXValidatorManager.deployed()
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(manager.address, "LXValidatorManager")

		const history = await MultiEventsHistory.deployed()
		await history.authorize(manager.address)
		await manager.setupEventsHistory(history.address)

		const validatorSet = LXValidatorSet.at(config.mining.validatorSetContract.address)
		const blockReward = LXBlockReward.at(config.mining.blockRewardsContract.address)

		await manager.init(validatorSet.address, TimeHolder.address, sharesAddress)

		await validatorSet.setBackend(manager.address)
		await blockReward.setDataProvider(manager.address);

		console.log(`[MIGRATION] [${parseInt(basename(__filename))}] LXValidatorManager: #done`)
	})
}
