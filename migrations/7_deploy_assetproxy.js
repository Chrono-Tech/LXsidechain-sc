const ChronoBankAssetProxy = artifacts.require("ChronoBankAssetProxy")
const ChronoBankPlatform = artifacts.require("ChronoBankPlatform")
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		const TIME_SYMBOL = 'TIME'
		const TIME_NAME = 'Chronobank TIME'
		const TIME_DESCRIPTION = 'Chronobank TIME'

		const BASE_UNIT = 8
		const IS_REISSUABLE = true

		await deployer.deploy(ChronoBankAssetProxy)

		const platform = await ChronoBankPlatform.deployed()
		await platform.issueAsset(TIME_SYMBOL, 0, TIME_NAME, TIME_DESCRIPTION, BASE_UNIT, IS_REISSUABLE)

		const proxy = await ChronoBankAssetProxy.deployed()
		await proxy.init(platform.address, TIME_SYMBOL, TIME_NAME)
		await platform.setProxy(proxy.address, TIME_SYMBOL)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ChronoBankAssetProxy(TIME): #done`)
	})
}
