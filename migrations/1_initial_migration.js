var Migrations = artifacts.require("./Migrations.sol")

module.exports = (deployer, network) => {
	deployer.then(async () => {
		await deployer.deploy(Migrations)
	})
}
