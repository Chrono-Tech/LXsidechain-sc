const ChronoBankAsset = artifacts.require("ChronoBankAsset")
const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")
const LXValidatorManager = artifacts.require("LXValidatorManager")
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		await deployer.deploy(ChronoBankAsset)
		const asset = await ChronoBankAsset.deployed()
		await asset.init(ChronoBankAssetProxy.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAsset: #done`)
	})
}
