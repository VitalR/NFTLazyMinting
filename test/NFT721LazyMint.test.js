const { expect, assert } = require("chai")
const { BigNumber, utils } = require('ethers')
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const ether = require("@openzeppelin/test-helpers/src/ether")
const { ethers } = require("hardhat")
const { LazyMinter } = require('../lib')


describe("NFT721LazyMint", function() {
    const bn = (input) => BigNumber.from(input);
    const BNtoBigInt = (input) => BigInt(input.toString());
    const BigInttoBN = (input) => BigNumber.from(input.toString());
    const assertBNequal = (bnOne, bnTwo) => assert.strictEqual(bnOne.toString(), bnTwo.toString())

    let nftLazyContract
    const nftName = "NFT Collection"
    const nftSymbol = "NFT"

    const tokenId = 1
    const quantity = 1
    const platformFee = 250
    const royaltyBasisPoints = 500
    const listingPrice = utils.parseEther('1')
    const tokenUri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"

    beforeEach(async () => {
        [owner, signer, creator, buyer, addr1, addr2, wrongSigner, _] = await ethers.getSigners()

        let NFTLazy = await ethers.getContractFactory("NFT721LazyMint")
        nftLazyContract = await NFTLazy.deploy(nftName, nftSymbol, owner.address, platformFee)
        await nftLazyContract.deployed()
    })

    it.only("Should be deployed successfully", async () => {
        expect(nftLazyContract).to.not.equal(0x0);
        expect(nftLazyContract).to.not.equal('');
        expect(nftLazyContract).to.not.equal(null);
        expect(nftLazyContract).to.not.equal(undefined);
    })

    it.only("Should be possible to redeem NFT using signed voucher", async () => {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, quantity, royaltyBasisPoints, tokenUri)

        const creatorBalanceBefore = await ethers.provider.getBalance(signer.address)
        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
 
        let feeAmount
        feeAmount = (listingPrice * platformFee) / 10000
        // console.log(feeAmount)
        let amount = listingPrice - feeAmount;
        // console.log(amount)

        assertBNequal(await nftLazyContract.balanceOf(creator.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        const ownerBalanceBefore = await ethers.provider.getBalance(owner.address)

        expect(await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.emit(nftLazyContract, 'Transfer')
            .withArgs('0x0000000000000000000000000000000000000000', creator.address, voucher.tokenId)
            .and.to.emit(nftLazyContract, 'Transfer')
            .withArgs(creator.address, buyer.address, voucher.tokenId)

        assertBNequal(await nftLazyContract.balanceOf(creator.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)

        expect(await ethers.provider.getBalance(creator.address)).to.equal(BNtoBigInt(creatorBalanceBefore) + (BNtoBigInt(amount)))
        expect(await ethers.provider.getBalance(owner.address)).to.equal(BNtoBigInt(ownerBalanceBefore) + (BNtoBigInt(feeAmount)))
        assert.isTrue((await ethers.provider.getBalance(buyer.address)).lt(BNtoBigInt(buyerBalanceBefore) - (BNtoBigInt(listingPrice))))
    })

    it("Should revert redeem if NFT is already claimed", async function() {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.setSignerAddress(signer.address)

        expect(await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.emit(nftLazyContract, 'Transfer')
            .withArgs('0x0000000000000000000000000000000000000000', creator.address, voucher.tokenId)
            .and.to.emit(nftLazyContract, 'Transfer')
            .withArgs(creator.address, buyer.address, voucher.tokenId)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)

        await expect(nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.be.revertedWith('ERC721: token already minted')

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)
    })

    it("Should revert redeem if NFT voucher is signed by an unauthorized account", async function() {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: wrongSigner })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        await nftLazyContract.setSignerAddress(signer.address)

        await expect(nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.be.revertedWith('Signature invalid or unauthorized')

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)
    })

    it("Should revert redeem if NFT voucher is modified", async function() {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: wrongSigner })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        await nftLazyContract.setSignerAddress(signer.address)
        
        voucher.tokenId = 2
        await expect(nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.be.revertedWith('Signature invalid or unauthorized')

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)       
    })

    it("Should revert redeem if NFT voucher has an invalid signature", async function() {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: wrongSigner })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        await nftLazyContract.setSignerAddress(signer.address)
        
        const dummyData = ethers.utils.randomBytes(128)
        voucher.signature = await signer.signMessage(dummyData)

        await expect(nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice }))
            .to.be.revertedWith('Signature invalid or unauthorized')

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)       
    })

    it("Should be possible to redeem NFT using signed voucher several time with single signer", async () => {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice })

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)

        const voucher2 = await lazyMinter.createVoucher(2, listingPrice, royaltyBasisPoints, tokenUri)

        await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher2, { value: listingPrice })

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 2)
    })

    it("Should be possible to redeem NFT using signed voucher with different signers", async () => {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice })

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)

        const lazyMinter2 = new LazyMinter({ contract: nftLazyContract, signer: addr1 })
        const voucher2 = await lazyMinter2.createVoucher(2, listingPrice, royaltyBasisPoints, tokenUri)

        await nftLazyContract.connect(owner).setSignerAddress(addr1.address)

        await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher2, { value: listingPrice })

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 2)
    })

    it("Should revert redeem NFT using signed voucher in case try to mint the same tokenId", async () => {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice })

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)

        const voucher2 = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        await expect(nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher2, { value: listingPrice }))
            .to.be.revertedWith('ERC721: token already minted')

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)
    })

    it("Should be possible to verify creator royalties after redeem NFT", async () => {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, listingPrice, royaltyBasisPoints, tokenUri)

        let royalty
        royalty = (listingPrice * royaltyBasisPoints) / 10000
        // console.log(royalty)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        await nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: listingPrice })

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 1)

        // console.log((await nftLazyContract.royaltyInfo(1, listingPrice)).toString())
        let royaltyRecipient, royaltyAmount
        [royaltyRecipient, royaltyAmount] = await nftLazyContract.royaltyInfo(1, listingPrice)
        expect(royaltyRecipient).to.be.equal(creator.address)
        assertBNequal(royaltyAmount, royalty)
    })

    it("Should revert redeem NFT if listingPrice is zero", async () => {
        const lazyMinter = new LazyMinter({ contract: nftLazyContract, signer: signer })
        const voucher = await lazyMinter.createVoucher(tokenId, 0, royaltyBasisPoints, tokenUri)

        assertBNequal(await nftLazyContract.balanceOf(signer.address), 0)
        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)

        await nftLazyContract.connect(owner).setSignerAddress(signer.address)

        await expect(nftLazyContract.connect(buyer).redeemToken(creator.address, buyer.address, voucher, { value: 0 }))
            .to.be.revertedWith('Token is not listed for sale')

        assertBNequal(await nftLazyContract.balanceOf(buyer.address), 0)
    })

})
