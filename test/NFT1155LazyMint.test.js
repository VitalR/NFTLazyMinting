const { expect, assert } = require("chai")
const { BigNumber, utils } = require("ethers")
const { expectRevert, expectEvent } = require("@openzeppelin/test-helpers")
const { ethers } = require("hardhat")
const { LazyMinterERC1155 } = require("../lib")


describe("NFT1155LazyMint", function() {
    const bn = (input) => BigNumber.from(input);
    const BNtoBigInt = (input) => BigInt(input.toString());
    const BigInttoBN = (input) => BigNumber.from(input.toString());
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString())

    let nftLazyContract
    const nftName = "NFT Collection"
    const nftSymbol = "NFT"

    const quantity = 1
    const platformFee = 250
    const royaltyBasisPoints = 300
    const listingPrice = utils.parseEther('1')
    const tokenUri = "https://gateway.pinata.cloud/ipfs/QmWycePdRyU2bR4tVtLanHjTqQD1N2eZt9FfkUgTxYAPGo"

    beforeEach(async () => {
        [owner, signer, creator, buyer, addr1, addr2, wrongSigner, _] = await ethers.getSigners()

        let NFTLazy = await ethers.getContractFactory("NFT1155LazyMint")
        nftLazyContract = await NFTLazy.deploy(nftName, nftSymbol, owner.address, platformFee)
        await nftLazyContract.deployed()
    })

    it("Should be deployed successfully", async () => {
        expect(nftLazyContract).to.not.equal(0x0);
        expect(nftLazyContract).to.not.equal('');
        expect(nftLazyContract).to.not.equal(null);
        expect(nftLazyContract).to.not.equal(undefined);
    })

    it("Should be possible to redeem NFT using signed voucher", async () => {
        const lazyMinter = new LazyMinterERC1155({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(1, listingPrice, quantity, royaltyBasisPoints, tokenUri)

        let feeAmount
        feeAmount = (listingPrice * platformFee) / 10000
        let amount = listingPrice - feeAmount

        await nftLazyContract.connect(creator).setApprovalForAll(buyer.address, true)

        const creatorBalanceBefore = await ethers.provider.getBalance(creator.address)
        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)

        assertBNequal(await nftLazyContract.balanceOf(signer.address, voucher.tokenId), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address, voucher.tokenId), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        expect(await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.emit(nftLazyContract, 'TransferSingle')
            .withArgs(buyer.address, '0x0000000000000000000000000000000000000000', creator.address, voucher.tokenId, voucher.quantity)
            .and.to.emit(nftLazyContract, 'TransferSingle')
            .withArgs(buyer.address, creator.address, buyer.address, voucher.tokenId, voucher.quantity)

        assertBNequal(await nftLazyContract.balanceOf(creator.address, voucher.tokenId), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address, voucher.tokenId), 1)

        expect(await ethers.provider.getBalance(creator.address)).to.equal(BNtoBigInt(creatorBalanceBefore) + (BNtoBigInt(amount)))
        expect(await ethers.provider.getBalance(nftLazyContract.address)).to.equal(BNtoBigInt(feeAmount))
        assert.isTrue((await ethers.provider.getBalance(buyer.address)).lt(BNtoBigInt(buyerBalanceBefore) - (BNtoBigInt(listingPrice))))
    })

})