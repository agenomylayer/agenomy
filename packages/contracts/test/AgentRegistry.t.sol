// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {MockLightAccountFactory} from "./mocks/MockLightAccountFactory.sol";

contract AgentRegistryTest is Test {
    AgentRegistry internal registry;
    MockLightAccountFactory internal factory;

    address internal owner = address(0xABCD);

    bytes32 internal constant MANIFEST_HASH =
        0x1111111111111111111111111111111111111111111111111111111111111111;
    bytes32 internal constant CONFIG_HASH =
        0x2222222222222222222222222222222222222222222222222222222222222222;

    // Mirror of the event in AgentRegistry for vm.expectEmit.
    event AgentSpawned(
        uint256 indexed agentId,
        address indexed owner,
        address wallet,
        string handle,
        bytes32 manifestHash,
        bytes32 configHash
    );

    function setUp() public {
        factory = new MockLightAccountFactory();
        registry = new AgentRegistry(address(factory));
    }

    // Recompute the salt exactly as the contract must: keccak256(abi.encode(msg.sender, handle)).
    function _expectedWallet(address owner_, string memory handle) internal view returns (address) {
        uint256 salt = uint256(keccak256(abi.encode(owner_, handle)));
        return factory.getAddress(owner_, salt);
    }

    function test_SpawnHappyPath_ReturnsIdAndCounterfactualWallet() public {
        string memory handle = "alice";
        address expectedWallet = _expectedWallet(owner, handle);

        vm.prank(owner);
        (uint256 agentId, address wallet) = registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);

        assertEq(agentId, 1, "first agentId must be 1");
        assertEq(wallet, expectedWallet, "wallet must equal factory.getAddress(owner, salt)");
        assertEq(registry.totalAgents(), 1, "totalAgents must increment to 1");
    }

    function test_SpawnEmitsAgentSpawned() public {
        string memory handle = "alice";
        address expectedWallet = _expectedWallet(owner, handle);

        // Check all topics + data. agentId=1, owner indexed.
        vm.expectEmit(true, true, false, true, address(registry));
        emit AgentSpawned(1, owner, expectedWallet, handle, MANIFEST_HASH, CONFIG_HASH);

        vm.prank(owner);
        registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);
    }

    function test_SpawnStoresAgent_ByHandleAndById() public {
        string memory handle = "alice";
        address expectedWallet = _expectedWallet(owner, handle);

        vm.prank(owner);
        (uint256 agentId,) = registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);

        AgentRegistry.Agent memory byHandle = registry.getAgentByHandle(handle);
        AgentRegistry.Agent memory byId = registry.getAgentById(agentId);

        assertEq(byHandle.owner, owner);
        assertEq(byHandle.wallet, expectedWallet);
        assertEq(byHandle.manifestHash, MANIFEST_HASH);
        assertEq(byHandle.configHash, CONFIG_HASH);
        assertEq(byHandle.handle, handle);
        assertEq(uint256(byHandle.createdAt), uint256(uint64(block.timestamp)));

        // Same struct retrievable by id.
        assertEq(byId.owner, byHandle.owner);
        assertEq(byId.wallet, byHandle.wallet);
        assertEq(byId.handle, byHandle.handle);
        assertEq(byId.manifestHash, byHandle.manifestHash);
        assertEq(byId.configHash, byHandle.configHash);
        assertEq(uint256(byId.createdAt), uint256(byHandle.createdAt));
    }

    function test_RevertWhen_HandleTaken() public {
        string memory handle = "alice";

        vm.prank(owner);
        registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);

        // Even a different owner cannot reuse the handle.
        vm.prank(address(0xBEEF));
        vm.expectRevert(AgentRegistry.HandleTaken.selector);
        registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);
    }

    function test_RevertWhen_HandleTooShort() public {
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.InvalidHandle.selector);
        registry.spawnAgent("ab", MANIFEST_HASH, CONFIG_HASH);
    }

    function test_RevertWhen_HandleTooLong() public {
        // 33 bytes (max is 32).
        string memory tooLong = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        assertEq(bytes(tooLong).length, 33);
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.InvalidHandle.selector);
        registry.spawnAgent(tooLong, MANIFEST_HASH, CONFIG_HASH);
    }

    function test_RevertWhen_HandleHasUppercase() public {
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.InvalidHandle.selector);
        registry.spawnAgent("Alice", MANIFEST_HASH, CONFIG_HASH);
    }

    function test_RevertWhen_HandleHasIllegalChar() public {
        // underscore (0x5f) is not allowed; only [a-z],[0-9],'-'.
        vm.prank(owner);
        vm.expectRevert(AgentRegistry.InvalidHandle.selector);
        registry.spawnAgent("al_ce", MANIFEST_HASH, CONFIG_HASH);
    }

    function test_HandleWithDigitsAndHyphen_IsValid() public {
        string memory handle = "a-1-9";
        vm.prank(owner);
        (uint256 agentId,) = registry.spawnAgent(handle, MANIFEST_HASH, CONFIG_HASH);
        assertEq(agentId, 1);
    }

    function test_IsHandleAvailable_TrueForFreeValid_FalseForTakenAndInvalid() public {
        assertTrue(registry.isHandleAvailable("alice"), "free valid handle is available");
        assertFalse(registry.isHandleAvailable("ab"), "too short is unavailable");
        assertFalse(registry.isHandleAvailable("Alice"), "uppercase is unavailable");
        assertFalse(registry.isHandleAvailable("al_ce"), "illegal char is unavailable");

        vm.prank(owner);
        registry.spawnAgent("alice", MANIFEST_HASH, CONFIG_HASH);
        assertFalse(registry.isHandleAvailable("alice"), "taken handle is unavailable");
    }

    function test_AgentIdsIncrement_AcrossSpawns() public {
        vm.prank(owner);
        (uint256 id1,) = registry.spawnAgent("alice", MANIFEST_HASH, CONFIG_HASH);
        vm.prank(owner);
        (uint256 id2,) = registry.spawnAgent("bob", MANIFEST_HASH, CONFIG_HASH);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.totalAgents(), 2);
    }
}
