const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		await deployer.deploy(TimeHolderWallet)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] TimiHolder Wallet: #done`)
	})
}
