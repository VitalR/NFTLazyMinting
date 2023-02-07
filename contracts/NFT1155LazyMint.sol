// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./ERC2981/ERC2981PerTokenRoyalties.sol";
import "./VoucherStruct.sol";


contract NFT1155LazyMint is ERC1155, Ownable, AccessControl, ERC2981PerTokenRoyalties {

    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    address private signerAddress;
    address payable public feeRecipient;
    uint16 public platformFee;

    string public name;
    string public symbol;

    mapping(uint256 => address) public creators;
    mapping(uint256 => uint256) private _totalSupply;
    mapping(uint256 => string) private _tokenURIs;

    modifier onlyCreator(uint256 tokenId) {
        require(creators[tokenId] == msg.sender, "Only creator allowed");
        _;
    }

    event TokenMintedAndSold(uint256 indexed tokenId, address indexed creator, address indexed buyer, uint256 sellingPrice);
    event UpdatePlatformFee(uint16 platformFee);
    event UpdatePlatformFeeRecipient(address payable platformFeeRecipient);

    constructor(string memory _name, string memory _symbol, address payable _feeRecipient, uint16 _platformFee) ERC1155("") {
        name = _name;
        symbol = _symbol;
        feeRecipient = _feeRecipient;
        platformFee = _platformFee;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override (AccessControl, ERC1155, ERC2981) returns (bool) {
        return AccessControl.supportsInterface(interfaceId) || ERC1155.supportsInterface(interfaceId)
        || interfaceId == _INTERFACE_ID_ERC2981;
    }

    function setSignerAddress(address _address) external onlyOwner {
        signerAddress = _address;
    }

    function getSignerAddress() public view returns (address) {
        return signerAddress;
    }

    function redeemToken(address creator, address redeemer, NFTVoucher calldata voucher) external payable returns (uint256) {
        // make sure signature is valid and get the address of the signer
        address signer = _verify(voucher);
        require(signer == signerAddress, "Signature invalid or unauthorized");
        // make sure that the redeemer is paying enough to cover the buyer's cost
        require(voucher.sellingPrice > 0, "Token is not listed for sale");
        require(msg.value >= (voucher.sellingPrice * voucher.quantity), "Insufficient funds to redeem");
        // first assign the token to the signer, to establish provenance on-chain
        _mint(creator, voucher.tokenId, voucher.quantity, bytes(""));

        creators[voucher.tokenId] = creator;
        
        _setTokenURI(voucher.tokenId, voucher.tokenUri);
    
        // transfer the token to the redeemer
        require(isApprovedForAll(creator, redeemer), "Token should be approved for transfering");

        safeTransferFrom(creator, redeemer, voucher.tokenId, voucher.quantity, bytes(""));

        // send funds to the creator and platform owner
        _sendFunds(creator, msg.value);

        // save royalties
        _saveRoyalties(voucher.tokenId, creator, voucher.royaltyBasisPoints);

        emit TokenMintedAndSold(voucher.tokenId, creator, redeemer, msg.value);

        _totalSupply[voucher.tokenId] += voucher.quantity;

        return voucher.tokenId;
    }

    function _verify(NFTVoucher calldata voucher) internal pure returns (address) {
        bytes32 digest = keccak256(abi.encodePacked(voucher.tokenId, voucher.sellingPrice, voucher.quantity, voucher.royaltyBasisPoints, voucher.tokenUri));
        
        return ECDSA.recover(ECDSA.toEthSignedMessageHash(digest), voucher.signature);
    }

    function _sendFunds(address _beneficiary, uint256 _value) internal returns (bool) {
        uint256 feeAmount = (_value * platformFee) / 10000;
        Address.sendValue(payable(_beneficiary), _value - feeAmount);

        return true;
    }

    function _saveRoyalties(uint256 _tokenId, address _royaltyRecipient, uint16 _royaltyValue) internal returns (bool) {
        if (_royaltyValue > 0) {
            _setTokenRoyalty(_tokenId, _royaltyRecipient, _royaltyValue);
        } else {
            _setTokenRoyalty(_tokenId, _royaltyRecipient, 0);
        }
        return true;
    }

    function setCreator(address _to, uint256[] memory _tokenIds) public {
        require(_to != address(0), "Invalid address");
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            uint256 tokenId = _tokenIds[i];
            _setCreator(_to, tokenId);
        }
    }

    function _setCreator(address _to, uint256 _tokenId) internal onlyCreator(_tokenId) {
        creators[_tokenId] = _to;
    }

    function _setTokenURI(uint256 _tokenId, string memory _tokenURI) internal virtual {
        require(_exists(_tokenId), "ERC1155URIStorage: URI set of nonexistent token");
        _tokenURIs[_tokenId] = _tokenURI;
    }

    function tokenURI(uint256 _tokenId) public view returns (string memory) {
        return _tokenURIs[_tokenId];
    }

    function _exists(uint256 _tokenId) internal view virtual returns (bool) {
        return creators[_tokenId] != address(0);
    }

    function updatePlatformFee(uint16 _platformFee) external onlyOwner {
        platformFee = _platformFee;
        emit UpdatePlatformFee(_platformFee);
    }

    function updatePlatformFeeRecipient(address payable _platformFeeRecipient) external onlyOwner {
        feeRecipient = _platformFeeRecipient;
        emit UpdatePlatformFeeRecipient(_platformFeeRecipient);
    }

    function totalSupply(uint256 _tokenId) public view virtual returns (uint256) {
        return _totalSupply[_tokenId];
    }

    function withdraw() public payable onlyOwner {
        (bool success, ) = payable(feeRecipient).call{value: address(this).balance}('');
        require(success, "Withdraw failed");
    }

}