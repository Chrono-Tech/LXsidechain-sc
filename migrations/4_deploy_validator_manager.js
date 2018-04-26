const LXValidatorManager = artifacts.require("LXValidatorManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = (deployer, network) => {
	switch (network) {
		case "sidechain": {
			deployer.then(async () => {
				const ValidatorSetAddress = "0x0000000000000000000000000000000000000005";
				await deployer.deploy(LXValidatorManager, ValidatorSetAddress)

				const manager = await LXValidatorManager.deployed()

				const history = await MultiEventsHistory.deployed()
				await history.authorize(manager.address)
				await manager.setupEventsHistory(history.address)

				console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] LXValidatorManager: #done`)
			})
			break;
		}
		default: {
			console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}]: #skip`)
		}
	}
}
