const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")
const LXChronoBankAsset = artifacts.require("LXChronoBankAsset")
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		const chronoBankAssetProxy = await ChronoBankAssetProxy.deployed()
		await chronoBankAssetProxy.proposeUpgrade(LXChronoBankAsset.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Final token setup: #done`)
	})
}
