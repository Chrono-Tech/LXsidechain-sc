const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const StorageManager = artifacts.require('StorageManager')
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform')
const path = require("path")

module.exports = (deployer, networks, accounts) => {
	deployer.then(async () => {
		const TIME_SYMBOL = 'TIME'
		
		let MINER_ADDRESS
		if (networks == 'development') {
			MINER_ADDRESS = accounts[9] // TODO: setup for other networks separatly
		}

		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(TimeHolder.address, "Deposits")
		
		const platform = await ChronoBankPlatform.deployed()
		const timeAddress = await platform.proxies(TIME_SYMBOL)
		const timeHolder = await TimeHolder.deployed()
		await timeHolder.init(timeAddress, TimeHolderWallet.address, ERC20DepositStorage.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(timeHolder.address)

		if (MINER_ADDRESS !== undefined) {
			await timeHolder.setPrimaryMiner(MINER_ADDRESS)
		}

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] TimeHolder init: #done`)
	})
}
