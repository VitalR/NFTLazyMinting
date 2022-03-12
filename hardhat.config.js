require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-gas-reporter");
require("dotenv").config();

const { PRIVATE_KEY_TESTNET, INFURA_PROJECT, ETHERSCAN_API_KEY, POLYGONSCAN_API_KEY, PRIVATE_KEY_MAINNET } = process.env;

module.exports = {
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT}`,
      accounts: [PRIVATE_KEY_TESTNET]
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT}`,
      accounts: [PRIVATE_KEY_TESTNET]
    }, 
    // mainnet: {
    //   url: `https://mainnet.infura.io/v3/${INFURA_PROJECT}`,
    //   accounts: [PRIVATE_KEY_MAINNET]
    // },
    // matic: {
    //   url: `https://polygon-mainnet.infura.io/v3/${INFURA_PROJECT}`,
    //   accounts: [PRIVATE_KEY_MAINNET]
    // },
    // mumbai: {
    //   url: `https://polygon-mumbai.infura.io/v3/${INFURA_PROJECT}`,
    //   accounts: [PRIVATE_KEY_TESTNET]
    // },
  },
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasPrice: "7100000000",
  gas: "auto",
  gasReporter: {
    gasPrice: 1,
    enabled: false,
    showTimeSpent: true
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    apiKey: POLYGONSCAN_API_KEY
  }
};