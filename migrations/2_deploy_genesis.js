const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const path = require("path")

module.exports = (deployer, network, accounts) => {
	deployer.then(async () => {
		if (network === "development") {
			await deployer.deploy(LXBlockReward, accounts[0])
			await deployer.deploy(LXValidatorSet, accounts[0], accounts[4])

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Deploy genesis: #done`)
		}
	})
}
