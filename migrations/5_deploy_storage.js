const Storage = artifacts.require('Storage')
const StorageManager = artifacts.require('StorageManager')
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(Storage)
		await deployer.deploy(StorageManager)

		const storage = await Storage.deployed()
		await storage.setManager(StorageManager.address)

		const history = await MultiEventsHistory.deployed()
		const storageManager = await StorageManager.deployed()
		await storageManager.setupEventsHistory(history.address)
		await history.authorize(StorageManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Storage Contracts: #done`)
	})
}
