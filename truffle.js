var HDWalletProvider = require("truffle-hdwallet-provider");
function getWallet(){
    return require('fs').readFileSync("./wallet.json", "utf8").trim();
}

module.exports = {
    networks: {
        "development": {
            host: "localhost",
            port: 8545,
            network_id: "*",
            gas: 4700000,
        },
        "local": {
            network_id: "*",
            provider: function () { return new HDWalletProvider(getWallet(),'QWEpoi123','http://127.0.0.1:8542')},            
            gas: 4700000
        },
        "chronobank-lx-test": {
            network_id: 0x42,
            provider: function () { return new HDWalletProvider(getWallet(),'QWEpoi123','http://35.196.17.40:8546')},
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
