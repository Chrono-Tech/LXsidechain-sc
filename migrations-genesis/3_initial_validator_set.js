var LXValidatorSet = artifacts.require("./LXValidatorSet.sol");

module.exports = function(deployer,network) {
    deployer.deploy(LXValidatorSet, ["0x00aa39d30f0d20ff03a22ccfc30b7efbfca597c2", "0x002e28950558fbede1a9675cb113f0bd20912019"]);
};
