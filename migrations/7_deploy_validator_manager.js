const LXValidatorManager = artifacts.require("LXValidatorManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const LXChronoBankAsset = artifacts.require("LXChronoBankAsset")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const path = require("path")

module.exports = (deployer, network) => {
	switch (network) {
		case "sidechain": {
			deployer.then(async () => {
				const ValidatorSetAddress = "0x0000000000000000000000000000000000000005";
				const LH_SYMBOL = 'LHMOON'

				const platform = await ChronoBankPlatform.deployed()
				const sharesAddress = await platform.proxies(LH_SYMBOL);

				await deployer.deploy(LXValidatorManager, ValidatorSetAddress, platform.address, sharesAddress)

				const manager = await LXValidatorManager.deployed()

				const history = await MultiEventsHistory.deployed()
				await history.authorize(manager.address)
				await manager.setupEventsHistory(history.address)

				const asset = await LXChronoBankAsset.deployed()
				await asset.setTransferListener(manager.address)

				console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LXValidatorManager: #done`)
			})
			break;
		}
		default: {
			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}]: #skip`)
		}
	}
}
