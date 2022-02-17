const hre = require("hardhat");
require("dotenv").config();

const { PRIVATE_KEY_TESTNET, INFURA_PROJECT, ETHERSCAN_API_KEY, PRIVATE_KEY_MAINNET, OWNER_ADDRESS } = process.env;

async function main() {
    const NFT = await hre.ethers.getContractFactory("NFT1155LazyMint");
    const nft = await NFT.deploy("NFT Collection", "NFT", OWNER_ADDRESS, 250);
    console.log("NFT1155LazyMint is deploying...");
    await nft.deployed();
    console.log("NFT1155LazyMint deployed to: ", nft.address);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });