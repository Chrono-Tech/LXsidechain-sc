const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy')
const LXValidatorManager = artifacts.require('LXValidatorManager')

const path = require("path")

module.exports = (deployer, networks, accounts) => {
	deployer.then(async () => {
		let platform = await ChronoBankPlatform.deployed()
		let time = await ChronoBankAssetProxy.deployed()
		let validatorManager = await LXValidatorManager.deployed()

		let validators
		if (networks === "development") {
		} else if (networks === "chronobank-lx-test") {
			validators = ["0x00aa39d30f0d20ff03a22ccfc30b7efbfca597c2", "0x002e28950558fbede1a9675cb113f0bd20912019"];

			await platform.reissueAsset("TIME", validators.length)
			for (validator of validators) {
				await time.transfer(validator, 1)
			}

			await validatorManager.finalizeChange()
			console.log("Initial validators:", await validatorManager.getValidators());
		}

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Setup initial validators: #done`)
	})
}
