// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/utils/Address.sol";
import "./StorageSlot.sol";


contract MarketProxy {
    /**
     * @dev Proxy Owner address.
     */
    address public proxyOwner;

    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 private constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * @dev Emitted when the implementation is upgraded.
     */
    event ImplementationUpgraded(address indexed implementation);
    /**
     * @dev Emitted when the proxy owner is updated.
     */
    event OwnerUpdated(address proxyOwner);

    constructor() {
        proxyOwner = msg.sender;
    }

    /**
     * @dev Proxy Owner utils.
     */
    modifier onlyProxyOwner() {
        require(proxyOwner == msg.sender, 'Proxy: caller is not the proxy owner');
        _;
    }

    function updateProxyOwner(address _newOwner) external onlyProxyOwner returns (bool) {
        proxyOwner = _newOwner;
        emit OwnerUpdated(_newOwner);
        return true;
    }

    /**
     * @dev Returns the current implementation address.
     */
    function getImplementation() public view returns (address) {
        return StorageSlot.getAddressAt(_IMPLEMENTATION_SLOT);
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     *  Perform implementation upgrade. Emits an {ImplementationUpgraded} event.
     */
    function setImplementation(address newImplementation) external onlyProxyOwner {
        require(Address.isContract(newImplementation), "ERC1967: new implementation is not a contract");
        StorageSlot.setAddressAt(_IMPLEMENTATION_SLOT, newImplementation);
        emit ImplementationUpgraded(newImplementation);
    }

    /**
     * @dev Delegates the current call to `implementation`.
     *
     * This function does not return to its internal call site, it will return directly to the external caller.
     */
    function _delegate(address implementation) internal virtual {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    /**
     * @dev Delegates the current call to the address returned by `_implementation()`.
     *
     * This function does not return to its internal call site, it will return directly to the external caller.
     */
    function _fallback() internal {
        _delegate(StorageSlot.getAddressAt(_IMPLEMENTATION_SLOT));
    }

    /**
     * @dev Delegates the current call to the address returned by `_implementation()`.
     *
     * This function does not return to its internal call site, it will return directly to the external caller.
     */
    fallback() external payable {
        _fallback();
    }

    /**
     * @dev Fallback function that delegates calls to the address returned by `_implementation()`. Will run if call data
     * is empty.
     */
    receive() external payable {
        _fallback();
    }
}