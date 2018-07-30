const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")
const deployConfig = require("../deploy-config")
const { basename, } = require("path")

module.exports = (deployer, network, accounts) => {
	const config = deployConfig({ artifacts: artifacts, web3: web3, network: network, accounts: accounts })

	deployer.then(async () => {
		if (network === "development") {
			await deployer.deploy(LXBlockReward, config.owner)
			await deployer.deploy(LXValidatorSet, config.owner, config.mining.validatorSetContract.system)

			console.log(`[MIGRATION] [${parseInt(basename(__filename))}] Deploy genesis: #done`)
		}
	})
}
