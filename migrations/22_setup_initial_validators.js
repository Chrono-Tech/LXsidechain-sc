const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy')
const LXValidatorManager = artifacts.require('LXValidatorManager')
const TimeHolder = artifacts.require('TimeHolder')
const deployConfig = require("../deploy-config")

const { basename, } = require("path")

module.exports = (deployer, network, accounts) => {
	const config = deployConfig({ artifacts: artifacts, web3: web3, network: network, accounts: accounts })

	deployer.then(async () => {
		const platform = await ChronoBankPlatform.deployed()
		const time = await ChronoBankAssetProxy.deployed()
		const validatorManager = await LXValidatorManager.deployed()
		const timeHolder = await TimeHolder.deployed()

		let validators
		if (network === "development") {
		} else if (network === "chronobank-lx-test") {
			validators = config.mining.validators
			validators.push(config.mining.primaryValidator)
			console.info(`### validators ${validators}`)

			await validatorManager.addValidator(config.mining.primaryValidator)

			const timeIssued = validators.length;
			await platform.reissueAsset(config.mining.tokenSymbol, timeIssued)

			await time.approve(await timeHolder.wallet(), timeIssued)
			await timeHolder.depositFor(time.address, config.mining.validators[0], timeIssued)

			await validatorManager.finalizeChange()
			console.log("Initial validators:", await validatorManager.getValidators());
		}

		console.log(`[MIGRATION] [${parseInt(basename(__filename))}] Setup initial validators: #done`)
	})
}
