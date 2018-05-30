var LXBlockReward = artifacts.require("./LXBlockReward.sol");

module.exports = function(deployer,network) {
    deployer.deploy(LXBlockReward);
};
