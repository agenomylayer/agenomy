// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract Deploy is Script {
    // Verified LightAccountFactory v2.0.0 (Base Sepolia + mainnet).
    address internal constant LIGHT_ACCOUNT_FACTORY = 0x0000000000400CdFef5E2714E63d8040b700BC24;

    function run() external returns (AgentRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        registry = new AgentRegistry(LIGHT_ACCOUNT_FACTORY);
        vm.stopBroadcast();

        console2.log("AgentRegistry deployed at:", address(registry));
        console2.log("Deploy block (DEPLOY_BLOCK):", block.number);
        console2.log("LightAccountFactory used:", LIGHT_ACCOUNT_FACTORY);
    }
}
