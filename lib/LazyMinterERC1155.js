const ethers = require("ethers")

// These constants must match the ones used in the smart contract.
const SIGNING_DOMAIN_NAME = "LazyNFT-Voucher"
const SIGNING_DOMAIN_VERSION = "1"

/**
 * JSDoc typedefs.
 * 
 * @typedef {object} NFTVoucherERC1155
 * @property {ethers.BigNumber | number} tokenId the id of the un-minted NFT
 * @property {ethers.BigNumber | number} sellingPrice the selling price (in wei) that the creator will accept to redeem this NFT
 * @property {ethers.BigNumber | number} quantity the amount of tokens to mint NFT
 * @property {ethers.BigNumber | number} royaltyBasisPoints Percentage basis-points for royalty on secondary sales, eg 495 == 4.95%. defaults to zero
 * @property {string} tokenUri the metadata URI to associate with this NFT
 * @property {ethers.BytesLike} signature an EIP-712 signature of all fields in the NFTVoucher, apart from signature itself.
 */

/**
 * LazyMinterERC1155 is a helper class that creates NFTVoucher objects and signs them, to be redeemed later by the LazyNFT contract.
 */
class LazyMinterERC1155 {
    /**
    * Create a new LazyMinterERC1155 targeting a deployed instance of the LazyNFT contract.
    * 
    * @param {Object} options
    * @param {ethers.Contract} contract an ethers Contract that's wired up to the deployed contract
    * @param {ethers.Signer} signer a Signer whose account is authorized to mint NFTs on the deployed contract
    */

    constructor({ contract, signer }) {
        this.contract = contract
        this.signer = signer
    }

    /**
    * Creates a new NFTVoucher object and signs it using this LazyMinter's signing key.
    * 
    * @param {ethers.BigNumber | number} tokenId the id of the un-minted NFT
    * @param {ethers.BigNumber | number} sellingPrice the selling price (in wei) that the creator will accept to redeem this NFT. defaults to zero
    * @param {ethers.BigNumber | number} quantity the amount of tokens to mint NFT
    * @param {ethers.BigNumber | number} royaltyBasisPoints the percentage basis-points for royalty on secondary sales, eg 495 == 4.95%. defaults to zero
    * @param {string} tokenUri the metadata URI to associate with this NFT
    * 
    * @returns {NFTVoucherERC1155}
    */
    async createVoucher(tokenId, sellingPrice = 0, quantity = 0, royaltyBasisPoints = 0, tokenUri) {
        const voucher = { tokenId, sellingPrice, quantity, royaltyBasisPoints, tokenUri}
        const dataHash = ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint16", "string"],
            [tokenId, sellingPrice, quantity, royaltyBasisPoints, tokenUri]
        )
        const dataHashBin = ethers.utils.arrayify(dataHash)
        const signature = await this.signer.signMessage(dataHashBin)
        return {
            ...voucher,
            signature,
        }
    }

}

module.exports = {
    LazyMinterERC1155
}