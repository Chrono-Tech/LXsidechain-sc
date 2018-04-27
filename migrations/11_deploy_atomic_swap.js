const AtomicSwapERC20ToERC20 = artifacts.require("AtomicSwapERC20ToERC20")
const AtomicSwapERC20 = artifacts.require("AtomicSwapERC20")
const path = require("path")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		await deployer.deploy(AtomicSwapERC20ToERC20)
		await deployer.deploy(AtomicSwapERC20)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Atomic Swap ERC20-to-ERC20 deploy: #done`)
	})
}
