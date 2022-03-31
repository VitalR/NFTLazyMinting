// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
pragma abicoder v2;

import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../ERC2981/IERC2981Royalties.sol";
import "../ERC2981/ERC2981.sol";
import "./Ownable.sol";


contract MarketNFT721Implementation is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant _INTERFACE_ID_ERC2981 = 0x2a55205a;

    address public WETH;
  
    // Signer address
    address private signerAddress;

    /// @notice Platform fee
    uint16 public platformFee;
    /// @notice Platform fee recipient
    address payable public feeRecipient;

    /// @dev Indicates that the contract has been initialized
    bool public initialized;

    // Events
    event ItemSold(address nftContract, uint256 tokenId, address seller, address buyer, uint256 value);
    event OfferAccepted(address nftContract, uint256 tokenId, address seller, address buyer, uint256 value, address paymentToken);
    event RoyaltiesPaid(address nftContract, uint256 tokenId, address royaltiesReceiver, uint256 royaltiesAmount);
    event RoyaltiesPaidWithERC20(address nftContract, uint256 tokenId, address royaltiesReceiver, uint256 royaltiesAmount, address paymentToken);
    event UpdatePlatformFeeRecipient(address payable platformFeeRecipient);
    event UpdatePlatformFee(uint16 platformFee);

    /// @dev Initializes the contract. Can only be called once
    function initialize(address payable _feeRecipient, uint16 _platformFee, address _WETH) external returns (bool) {
        require(!initialized, "Contract is already initialized");
        feeRecipient = _feeRecipient;
        platformFee = _platformFee;
        WETH = _WETH;
        _setOwnership();
        initialized = true;
        return true;
    }

    /// @notice Checks if NFT contract implements the ERC-2981 interface
    /// @param _contract - the address of the NFT contract to query
    /// @return true if ERC-2981 interface is supported, false otherwise
    function _checkRoyalties(address _contract) view internal returns (bool) {
        (bool success) = ERC2981(_contract).supportsInterface(_INTERFACE_ID_ERC2981);
        return success;
    }

    /// @notice Set signer address
    /// @dev Only admin
    /// @param _address - the signer address
    function setSignerAddress(address _address) external onlyOwner {
        signerAddress = _address;
    }

    function getSignerAddress() public view returns (address) {
        return signerAddress;
    }

    /// @notice Method for updating platform fee
    /// @dev Only admin
    /// @param _platformFee uint16 the platform fee to set
    function updatePlatformFee(uint16 _platformFee) external onlyOwner {
        platformFee = _platformFee;
        emit UpdatePlatformFee(_platformFee);
    }

    /// @notice Method for updating platform fee address
    /// @dev Only admin
    /// @param _platformFeeRecipient payable address the address to sends the funds to
    function updatePlatformFeeRecipient(address payable _platformFeeRecipient) external onlyOwner {
        feeRecipient = _platformFeeRecipient;
        emit UpdatePlatformFeeRecipient(_platformFeeRecipient);
    }

    /// @notice Method for (re-selling) buying listed NFT a token and transfers royalties if applicable
    /// @param _nftContract - nftAddress of the smart contract token to sell
    /// @param _tokenId - id of the token to sell
    /// @param _seller - currect owner of the token to sell
    /// @param _pricePerItem sale price for each item
    // / @param _quantity amount of token to sell
    function buyItem(
        address _nftContract, 
        uint256 _tokenId, 
        address _seller, 
        uint256 _pricePerItem,
        bytes memory _signature
    ) external payable nonReentrant {
        bytes32 messageHash = keccak256(abi.encodePacked(_nftContract, _tokenId, _seller, _pricePerItem));
        require(ECDSA.recover(ECDSA.toEthSignedMessageHash(messageHash), _signature) == getSignerAddress(), "Invalid signature");

        require(IERC721(_nftContract).isApprovedForAll(_seller, address(this)), "Item not approved");

        require(msg.value >= _pricePerItem, "Amount sent to low");
        uint256 saleValue = msg.value;
        uint256 feeAmount = (saleValue * platformFee) / 10000;

        // Pay royalties if applicable
        if (_checkRoyalties(_nftContract)) {
            saleValue = _deduceRoyalties(_nftContract, _tokenId, saleValue);
        }

        // Transfer funds to the feeRecipient
        (bool success, ) = payable(feeRecipient).call{value: feeAmount}('');
        require(success, "Fee Amount transfer failed");

        // Transfer funds to the seller
        (bool success2, ) = payable(_seller).call{value: saleValue - feeAmount}('');
        require(success2, "Seller funds transfer failed");
        
        // Transfer NFT to buyer
        IERC721(_nftContract).safeTransferFrom(_seller, _msgSender(), _tokenId);
        
        // Broadcast the sale
        emit ItemSold(_nftContract, _tokenId, _seller, _msgSender(), msg.value);
    }

    /// @notice Transfers royalties to the rightsowner if applicable
    /// @param _nftContract - nftAddress of the smart contract token to sell
    /// @param _tokenId - the NFT assed queried for royalties
    /// @param _grossSaleValue - the price at which the asset will be sold
    /// @return netSaleAmount - the value that will go to the seller after
    ///         deducting royalties
    function _deduceRoyalties(address _nftContract, uint256 _tokenId, uint256 _grossSaleValue) internal returns (uint256 netSaleAmount) {
        // Get amount of royalties to pays and recipient
        (address royaltiesReceiver, uint256 royaltiesAmount) = IERC2981Royalties(_nftContract).royaltyInfo(_tokenId, _grossSaleValue);

        // Deduce royalties from sale value
        uint256 netSaleValue = _grossSaleValue - royaltiesAmount;

        // Transfer foyalties to rightholder if not zero
        if (royaltiesAmount > 0) {
            (bool success, ) = payable(royaltiesReceiver).call{value: royaltiesAmount}('');
            require(success, "Royalty transfer failed");
        }

        // Broadcast royalties payment
        emit RoyaltiesPaid(_nftContract, _tokenId, royaltiesReceiver, royaltiesAmount);
        return netSaleValue;
    }

}