
module.exports = function generateConfig({ artifacts, web3, network, accounts, }) {
	const LXBlockReward = artifacts.require("LXBlockReward")
	const LXValidatorSet = artifacts.require("LXValidatorSet")

	const config = {
		"chronobank-lx-test": {
			// TODO: setup **owner** address according to genesis generation
			owner: "0xfebc7d461b970516c6d3629923c73cc6475f1d13",
			mining: {
				tokenSymbol: "TIME", // symbol of a token that is used for mining
				depositLimit: "1", // setup TimeHolder's deposit limit to become a miner
				validatorSetContract: {
					address: "0x0000000000000000000000000000000000000011",
					// TODO: setup **system** address according to genesis generation
					system: "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE",
				},
				blockRewardsContract: {
					address: "0x0000000000000000000000000000000000000042",
				},
				// TODO: setup **validator** address according to genesis generation
				primaryValidator: "0x002e28950558fbede1a9675cb113f0bd20912019",
				// TODO: setup **validators** address according to genesis generation
				validators: [
					"0x00aa39d30f0d20ff03a22ccfc30b7efbfca597c2",
				],
			},
		},
		"chronobank-lx-production": {
			// TODO: setup **owner** address according to genesis generation
			owner: "0x24495670DB97F50a404400d7aA155537E2fE09e8",
			mining: {
				tokenSymbol: "TIME", // symbol of a token that is used for mining
				depositLimit: "1", // setup TimeHolder's deposit limit to become a miner
				validatorSetContract: {
					address: "0x0000000000000000000000000000000000000011",
					// TODO: setup **system** address according to genesis generation
					system: "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE",
				},
				blockRewardsContract: {
					address: "0x0000000000000000000000000000000000000042",
				},
				// TODO: setup **validator** address according to genesis generation
				primaryValidator: "0x24495670DB97F50a404400d7aA155537E2fE09e8",
				validators: [],
			},
		},
		"development": {
			owner: null,
			mining: {
				tokenSymbol: "TIME",
				depositLimit: "1",
				validatorSetContract: {
					address: null,
					system: null,
				},
				blockRewardsContract: {
					address: null,
				},
				primaryValidator: null,
				validators: [],
			},
		},
	}

	if (network === 'development') {
		const devConfig = config[network]
		devConfig.owner = accounts[0]
		devConfig.mining.validatorSetContract.address = LXValidatorSet.isDeployed() ? LXValidatorSet.address : null
		devConfig.mining.validatorSetContract.system = accounts[4]
		devConfig.mining.blockRewardsContract.address = LXBlockReward.isDeployed() ? LXBlockReward.address : null
		devConfig.mining.primaryValidator = accounts[9]

		return devConfig
	}

	if (config[network] === undefined) {
		throw `Setup deploy configuration for ${network}`
	}

	return config[network]
}