const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const StorageManager = artifacts.require('StorageManager')
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform')
const LXValidatorManager = artifacts.require("LXValidatorManager")
const deployConfig = require("../deploy-config")
const { basename, } = require("path")

module.exports = (deployer, network, accounts) => {
	const config = deployConfig({ artifacts: artifacts, web3: web3, network: network, accounts: accounts })

	deployer.then(async () => {
		if (network !== 'development') {
			throw "Check one more time all addresses and limits to ensure that all set up correctly. Comment this error after a check"
		}

		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(TimeHolder.address, "Deposits")

		const platform = await ChronoBankPlatform.deployed()
		const timeAddress = await platform.proxies(config.mining.tokenSymbol)
		const timeHolder = await TimeHolder.deployed()
		await timeHolder.init(timeAddress, TimeHolderWallet.address, ERC20DepositStorage.address, LXValidatorManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(timeHolder.address)
		await timeHolder.setupEventsHistory(history.address);
		await timeHolder.setPrimaryMiner(config.mining.primaryValidator)

		if (network !== 'development') {
			await timeHolder.setMiningDepositLimits(timeAddress, config.mining.depositLimit)
		}

		console.log(`[MIGRATION] [${parseInt(basename(__filename))}] TimeHolder init: #done`)
	})
}
