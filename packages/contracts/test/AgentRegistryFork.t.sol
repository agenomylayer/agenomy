// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry, ILightAccountFactory} from "../src/AgentRegistry.sol";

/// @dev Opt-in integration test. Runs only when BASE_SEPOLIA_RPC_URL is set,
///      i.e. when invoked with `--fork-url base_sepolia` or with the env var present.
contract AgentRegistryForkTest is Test {
    address internal constant LIGHT_ACCOUNT_FACTORY = 0x0000000000400CdFef5E2714E63d8040b700BC24;

    AgentRegistry internal registry;
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("BASE_SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            forked = false;
            return;
        }
        vm.createSelectFork(rpc);
        registry = new AgentRegistry(LIGHT_ACCOUNT_FACTORY);
        forked = true;
    }

    function test_RealFactory_ReturnsCounterfactualWallet() public {
        if (!forked) {
            emit log("skipping fork test: BASE_SEPOLIA_RPC_URL not set");
            return;
        }

        address owner = address(0xCAFE);
        string memory handle = "forktest-agent";

        uint256 salt = uint256(keccak256(abi.encode(owner, handle)));
        address expected =
            ILightAccountFactory(LIGHT_ACCOUNT_FACTORY).getAddress(owner, salt);

        vm.prank(owner);
        (uint256 agentId, address wallet) = registry.spawnAgent(
            handle,
            0x1111111111111111111111111111111111111111111111111111111111111111,
            0x2222222222222222222222222222222222222222222222222222222222222222
        );

        assertEq(agentId, 1, "first agent id");
        assertTrue(wallet != address(0), "real factory must return a non-zero wallet");
        assertEq(wallet, expected, "registry wallet must match real factory.getAddress");
    }
}
