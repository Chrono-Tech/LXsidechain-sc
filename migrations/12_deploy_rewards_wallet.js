var RewardsWallet = artifacts.require("RewardsWallet")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(RewardsWallet)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Rewards Wallet deploy: #done`)
	})
}
