const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const StorageManager = artifacts.require('StorageManager')
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform')
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy')
const LXValidatorManager = artifacts.require("LXValidatorManager")
const { basename, } = require("path")

module.exports = (deployer, networks, accounts) => {
	deployer.then(async () => {
		const TIME_SYMBOL = 'TIME'

		let MINER_ADDRESS
		const MINER_TOKEN_DEPOSIT_LIMIT = web3.toBigNumber("10000000") // TODO: setup needed value for miner limit

		if (networks !== 'development') {
			throw "Check one more time all addresses and limits to ensure that all set up correctly. Comment this error after a check"
		}

		if (networks === 'development') {
			MINER_ADDRESS = accounts[9] // TODO: setup for other networks separatly
		}

		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(TimeHolder.address, "Deposits")

		const platform = await ChronoBankPlatform.deployed()
		const timeAddress = await platform.proxies(TIME_SYMBOL)
		const timeHolder = await TimeHolder.deployed()
		await timeHolder.init(timeAddress, TimeHolderWallet.address, ERC20DepositStorage.address, LXValidatorManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(timeHolder.address)
		await timeHolder.setupEventsHistory(history.address);

		if (MINER_ADDRESS !== undefined) {
			await timeHolder.setPrimaryMiner(MINER_ADDRESS)
		}

		if (networks === 'development') {
			let time = ChronoBankAssetProxy.at(timeAddress)
			await time.approve(timeHolder.address, web3.toBigNumber(2).pow(255), {from:MINER_ADDRESS});
		}

		if (networks !== 'development') {
			await timeHolder.getMiningDepositLimits(timeAddress, MINER_TOKEN_DEPOSIT_LIMIT)
		}

		console.log(`[MIGRATION] [${parseInt(basename(__filename))}] TimeHolder init: #done`)
	})
}
