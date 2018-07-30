const Rewards = artifacts.require("Rewards")
const RewardsWallet = artifacts.require("RewardsWallet")
const StorageManager = artifacts.require("StorageManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(Rewards.address, "Deposits")

		const rewards = await Rewards.deployed()
		await rewards.init(RewardsWallet.address, 0)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(Rewards.address)
		await rewards.setupEventsHistory(history.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Rewards setup: #done`)
	})
}
