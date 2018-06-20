const StorageManager = artifacts.require("StorageManager")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(ERC20DepositStorage.address, "Deposits")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ERC20 Deposit Storage setup: #done`)
	})
}
