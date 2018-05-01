var HDWalletProvider = require("truffle-hdwallet-provider");
function getWallet(){
    return require('fs').readFileSync("./wallet.json", "utf8").trim();
}

module.exports = {
    networks: {
        "development": {
            host: "localhost",
            port: 8545,
            network_id: "*" // Match any network id
        },
        "local": {
            provider: new HDWalletProvider(getWallet(),'QWEpoi123','http://127.0.0.1:8540'),
            network_id: "*", // Match any network id
            gas: 0x222222
        },
        "chronobank-lx-prod": {
            network_id: 456719, // TODO
            provider: new HDWalletProvider(getWallet(),'QWEpoi123','https://public-sidechain.chronobank.io'),
            port: 8545,
            gas: 4700000
        },
        "chronobank-lx-test": {
            network_id: 456719, // TODO
            provider: new HDWalletProvider(getWallet(),'QWEpoi123','https://private-sidechain.chronobank.io'),
            port: 8545,
            gas: 4700000
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    },
    migrations_directory: './migrations'
};
