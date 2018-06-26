var Rewards = artifacts.require("Rewards")
const Storage = artifacts.require('Storage')
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(Rewards, Storage.address, "Deposits")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Rewards deploy: #done`)
	})
}
