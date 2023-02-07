// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./ERC2981/ERC2981PerTokenRoyalties.sol";
import "./VoucherStruct.sol";


contract NFT721LazyMint is ERC721URIStorage, Ownable, AccessControl, ERC2981PerTokenRoyalties {

    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;
    
    address private signerAddress;
    address payable public feeRecipient;

    uint256 public totalSupply;
    uint16 public platformFee;

    mapping(uint256 => address) public creators;

    modifier onlyCreator(uint256 tokenId) {
        require(creators[tokenId] == msg.sender, "Only creator allowed");
        _;
    }

    event TokenMintedAndSold(uint256 indexed tokenId, address indexed creator, address indexed buyer, uint256 sellingPrice);
    event UpdatePlatformFee(uint16 platformFee);
    event UpdatePlatformFeeRecipient(address payable platformFeeRecipient);

    constructor(string memory _name, string memory _symbol, address payable _feeRecipient, uint16 _platformFee) ERC721(_name, _symbol) {
        feeRecipient = _feeRecipient;
        platformFee = _platformFee;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override (AccessControl, ERC721, ERC2981) returns (bool) {
        return AccessControl.supportsInterface(interfaceId) || ERC721.supportsInterface(interfaceId)
        || interfaceId == _INTERFACE_ID_ERC2981;
    }

    function setSignerAddress(address _address) external onlyOwner {
        signerAddress = _address;
    }

    function getSignerAddress() public view returns (address) {
        return signerAddress;
    }

    function redeemToken(address creator, address redeemer, NFTVoucher calldata voucher) public payable returns (uint256) {
        // make sure signature is valid and get the address of the signer
        address signer = _verify(voucher);
        require(signer == signerAddress, "Signature invalid or unauthorized");
        // make sure that the redeemer is paying enough to cover the buyer's cost
        require(voucher.sellingPrice > 0, "Token is not listed for sale");
        require(msg.value >= voucher.sellingPrice, "Insufficient funds to redeem");
        // first assign the token to the creator, to establish provenance on-chain
        _mint(creator, voucher.tokenId);

        creators[voucher.tokenId] = creator;
        
        _setTokenURI(voucher.tokenId, voucher.tokenUri);
    
        // transfer the token to the redeemer
        _transfer(creator, redeemer, voucher.tokenId);

        // send funds to the creator and platform owner
        _sendFunds(creator, msg.value);

        // save royalties
        _saveRoyalties(voucher.tokenId, creator, voucher.royaltyBasisPoints);

        emit TokenMintedAndSold(voucher.tokenId, creator, redeemer, msg.value);

        totalSupply += 1;

        return voucher.tokenId;
    }

    function _verify(NFTVoucher calldata voucher) internal pure returns (address) {
        bytes32 digest = keccak256(abi.encodePacked(voucher.tokenId, voucher.sellingPrice, voucher.quantity, voucher.royaltyBasisPoints, voucher.tokenUri));
        
        return ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), voucher.signature);
    }

    function _sendFunds(address beneficiary, uint256 value) internal returns (bool) {
        uint256 feeAmount = (value * platformFee) / 10000;

        // Transfer funds to the feeRecipient
        (bool success, ) = payable(feeRecipient).call{value: feeAmount}('');
        require(success, "Fee Amount transfer failed");

        // Transfer funds to the creator
        (bool success2, ) = payable(beneficiary).call{value: value - feeAmount}('');
        require(success2, "Seller funds transfer failed");

        return true;
    }

    function _saveRoyalties(uint256 tokenId, address royaltyRecipient, uint16 royaltyValue) internal returns (bool) {
        if (royaltyValue > 0) {
            _setTokenRoyalty(tokenId, royaltyRecipient, royaltyValue);
        } else {
            _setTokenRoyalty(tokenId, royaltyRecipient, 0);
        }
        return true;
    }

    function setCreator(address to, uint256[] memory tokenIds) public {
        require(to != address(0), "Invalid address");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            _setCreator(to, tokenId);
        }
    }

    function _setCreator(address to, uint256 tokenId) internal onlyCreator(tokenId) {
        creators[tokenId] = to;
    }

    function updatePlatformFee(uint16 _platformFee) external onlyOwner {
        platformFee = _platformFee;
        emit UpdatePlatformFee(_platformFee);
    }

    function updatePlatformFeeRecipient(address payable _platformFeeRecipient) external onlyOwner {
        feeRecipient = _platformFeeRecipient;
        emit UpdatePlatformFeeRecipient(_platformFeeRecipient);
    }

}