const LXChronoBankAsset = artifacts.require("LXChronoBankAsset")
const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")
const LXValidatorManager = artifacts.require("LXValidatorManager")
const path = require("path")

module.exports = (deployer, network) => {
	switch (network) {
		case "sidechain": {
			deployer.then(async () => {
				await deployer.deploy(LXChronoBankAsset)
				const asset = await LXChronoBankAsset.deployed()

				await asset.init(ChronoBankAssetProxy.address)

				const manager = await LXValidatorManager.deployed()
				await asset.setTransferListener(manager.address);

				console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAsset: #done`)
			})
			break
		}
		default: {
			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}]: #skip`)
		}
	}
}
