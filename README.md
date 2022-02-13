# NFT Lazy Minting Smart Contract Project Setup

## Setup and tests

- Clone the project:
```
git clone repo_link
```
- Install the dependencies:
```
npm install
```
- Run the tests:
```
npm test
```
- Compile the contracts:
```
npm run compile
```

## Pre-deployment

- Add appropriate values for keys in .env file:

```
PRIVATE_KEY_TESTNET=''
ETHERSCAN_API_KEY=''
INFURA_PROJECT=''
OWNER_ADDRESS=''
PRIVATE_KEY_MAINNET=''

PRIVATE_KEY_TESTNET_BUYER=''
```

## Deployment

- Rinkeby:
```
npx hardhat run scripts/1-deploy.js --network rinkeby
```

- Mainnet:
```
npx hardhat run scripts/1-deploy.js --network mainnet
```

## Verify and Publishing

- Rinkeby:
```
npx hardhat verify --network rinkeby <DEPLOYED_SC_ADDRESS> "nftName" "nftSymbol" "feeRecipientAddress" "platformFee"
```

- Mainnet:
```
npx hardhat verify --network mainnet <DEPLOYED_SC_ADDRESS> "nftName" "nftSymbol" "feeRecipientAddress" "platformFee"
```

## Perform redeem token transaction

- Set NFT_CONTRACT_ADDRESS == <DEPLOYED_SC_ADDRESS> in the script and run:

```
node scripts/perform-redeem.js
```
