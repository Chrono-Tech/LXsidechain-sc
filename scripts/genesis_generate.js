const LXBlockReward = artifacts.require("LXBlockReward")
const LXValidatorSet = artifacts.require("LXValidatorSet")

const genesis = require("./genesis-template.json")
const minimist = require('minimist')
const fs = require("fs");

module.exports = async (callback, arg) => {
    var argv = minimist(process.argv.slice(2), {string: ['owner', 'validators', 'output']})

    let lxBlockRewardTx = await LXBlockReward.new(argv.owner)
    let lxBlockRewardTxInput = web3.eth.getTransaction(lxBlockRewardTx.transactionHash)

    let lxValidatorSetTx = await LXValidatorSet.new(argv.owner)
    let lxValidatorSetTxInput = web3.eth.getTransaction(lxValidatorSetTx.transactionHash)

    genesis.accounts["0x0000000000000000000000000000000000000011"].constructor = lxValidatorSetTxInput.input
    genesis.accounts["0x0000000000000000000000000000000000000042"].constructor = lxBlockRewardTxInput.input
    genesis.accounts[argv.owner] = {balance:"1000000000000000000000000"};
    genesis.engine.authorityRound.params.validators.multi["0"].list = argv.validators.split(',')

    fs.writeFile("./genesis/" + argv.output, JSON.stringify(genesis, null, "\t"), (err) => {
        if (err) {
            console.error(err);
            return;
        };
        console.log("Genesis file has been created");
        callback();
    });
}
