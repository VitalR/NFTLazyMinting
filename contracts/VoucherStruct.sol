// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

struct NFTVoucher {
    /// @notice The id of the token to be redeemed. Must be unique - if another token with this ID already exists, the redeem function will revert.
    uint256 tokenId;

    /// @notice The minimum price (in wei) that the NFT creator is willing to accept for the initial sale of this NFT.
    uint256 sellingPrice;

    /// @notice Amount of tokens to mint. (needed for ERC-1155 NFTs, set as 1 for ERC-721)
    uint256 quantity;

    /// @notice Percentage basis-points for royalty on secondary sales, eg 495 == 4.95%
    uint16 royaltyBasisPoints;

    /// @notice The metadata URI to associate with this token.
    string tokenUri;

    /// @notice the EIP-712 signature of all other fields in the NFTVoucher struct. For a voucher to be valid, it must be signed by an account with the MINTER_ROLE.
    bytes signature;
}