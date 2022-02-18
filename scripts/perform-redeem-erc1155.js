const {ethers, utils} = require('ethers')
const { LazyMinterERC1155 } = require('../lib')
const abi = require('../abi/NFT1155LazyMint.json')
require("dotenv").config()

const { PRIVATE_KEY_TESTNET, INFURA_PROJECT, ETHERSCAN_API_KEY, PRIVATE_KEY_TESTNET_BUYER, PRIVATE_KEY_MAINNET, OWNER_ADDRESS } = process.env

const provider = new ethers.providers.InfuraProvider(
    'rinkeby',
    INFURA_PROJECT
)

const NFT_CONTRACT_ADDRESS = "<DEPLOYED_SC_ADDRESS>"

const MINTER_ADDRESS = OWNER_ADDRESS
let seller = new ethers.Wallet(PRIVATE_KEY_TESTNET, provider)

const BUYER_ADDRESS = "0xcC7d7D810132c44061d99928AA6e4D63c7c693c7"
let buyer = new ethers.Wallet(PRIVATE_KEY_TESTNET_BUYER, provider)

let contract_seller = new ethers.Contract(NFT_CONTRACT_ADDRESS, abi.abi, seller)
let contract_buyer = new ethers.Contract(NFT_CONTRACT_ADDRESS, abi.abi, buyer)

const go = async () => {

    const pricePerToken = utils.parseEther('0.01')

    const lazyMinter = new LazyMinterERC1155({ contract: contract_seller, signer: seller })
    const voucher = await lazyMinter.createVoucher(1, pricePerToken, 1, 500, "https://gateway.pinata.cloud/ipfs/QmWycePdRyU2bR4tVtLanHjTqQD1N2eZt9FfkUgTxYAPGo")
    console.log('Voucher', voucher)
    console.log('-------------------------------')

    await contract_seller.setSignerAddress(MINTER_ADDRESS)
    console.log('setSignerAddress')
    await contract_seller.setApprovalForAll(BUYER_ADDRESS, true)
    console.log('setApprovalForAll')

    const initialize = await contract_buyer.redeemToken(MINTER_ADDRESS, BUYER_ADDRESS, voucher, { value: pricePerToken, gasLimit: 2100000 })
    console.log('Result', initialize)

}

go()