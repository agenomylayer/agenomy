// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test double for LightAccountFactory v2.0.0 `getAddress`.
/// Deterministic so tests can recompute the expected wallet independently.
contract MockLightAccountFactory {
    function getAddress(address owner, uint256 salt) external pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode(owner, salt)))));
    }
}
