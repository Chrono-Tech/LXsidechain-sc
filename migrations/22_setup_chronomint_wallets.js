const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderWallet = artifacts.require('TimeHolderWallet')
const RewardsWallet = artifacts.require('RewardsWallet')
const Rewards = artifacts.require('Rewards')
const path = require("path")

module.exports = (deployer, networks, accounts) => {
	deployer.then(async () => {
		const timeHolderWallet = await TimeHolderWallet.deployed()
		await timeHolderWallet.init(TimeHolder.address)
		
		const rewardsWallet = await RewardsWallet.deployed()
		await rewardsWallet.init(Rewards.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Setup wallets: #done`)
	})
}
