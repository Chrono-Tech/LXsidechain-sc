var MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		await deployer.deploy(MultiEventsHistory)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Events History: #done`)
	})
}
