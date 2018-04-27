const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const LXBlockRewardTestable = artifacts.require("LXBlockRewardTestable")
const LXValidatorSetTestable = artifacts.require("LXValidatorSetTestable")
const path = require("path")

module.exports = (deployer, network, accounts) => {
	deployer.then(async () => {
		if (network === "development") {
			await deployer.deploy(LXBlockReward, accounts[0])
			await deployer.deploy(LXValidatorSet, accounts[0])
			await deployer.deploy(LXValidatorSetTestable, accounts[0])
			await deployer.deploy(LXBlockRewardTestable, accounts[0])

			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Deploy genesis: #done`)
		}
	})
}
