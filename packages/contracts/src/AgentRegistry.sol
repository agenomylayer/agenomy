// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILightAccountFactory {
    function getAddress(address owner, uint256 salt) external view returns (address);
}

/// @title AgentRegistry
/// @notice Registers AI agents with unique handles and a counterfactual LightAccount wallet.
///         The smart-account wallet is NOT deployed here; its address is predicted via the
///         LightAccountFactory's view `getAddress` (CREATE2 counterfactual address).
contract AgentRegistry {
    struct Agent {
        address owner;
        address wallet;
        bytes32 manifestHash;
        bytes32 configHash;
        string handle;
        uint64 createdAt;
    }

    event AgentSpawned(
        uint256 indexed agentId,
        address indexed owner,
        address wallet,
        string handle,
        bytes32 manifestHash,
        bytes32 configHash
    );

    error HandleTaken();
    error InvalidHandle();

    ILightAccountFactory public immutable factory;

    /// @dev Also the id of the last spawned agent; ids start at 1.
    uint256 public totalAgents;

    mapping(uint256 => Agent) internal _agentsById;
    mapping(bytes32 => uint256) internal _agentIdByHandleHash;

    constructor(address factory_) {
        factory = ILightAccountFactory(factory_);
    }

    function spawnAgent(string calldata handle, bytes32 manifestHash, bytes32 configHash)
        external
        returns (uint256 agentId, address wallet)
    {
        if (!_validateHandle(handle)) revert InvalidHandle();

        bytes32 handleHash = keccak256(bytes(handle));
        if (_agentIdByHandleHash[handleHash] != 0) revert HandleTaken();

        uint256 salt = uint256(keccak256(abi.encode(msg.sender, handle)));
        wallet = factory.getAddress(msg.sender, salt);

        agentId = ++totalAgents;

        _agentsById[agentId] = Agent({
            owner: msg.sender,
            wallet: wallet,
            manifestHash: manifestHash,
            configHash: configHash,
            handle: handle,
            createdAt: uint64(block.timestamp)
        });
        _agentIdByHandleHash[handleHash] = agentId;

        emit AgentSpawned(agentId, msg.sender, wallet, handle, manifestHash, configHash);
    }

    function getAgentByHandle(string calldata handle) external view returns (Agent memory) {
        return _agentsById[_agentIdByHandleHash[keccak256(bytes(handle))]];
    }

    function getAgentById(uint256 agentId) external view returns (Agent memory) {
        return _agentsById[agentId];
    }

    /// @notice False for invalid format OR already-taken handles.
    function isHandleAvailable(string calldata handle) external view returns (bool) {
        if (!_validateHandle(handle)) return false;
        return _agentIdByHandleHash[keccak256(bytes(handle))] == 0;
    }

    /// @dev bytes length 3..32; each byte in [a-z], [0-9], or '-' (0x2d). Lowercase only.
    function _validateHandle(string calldata handle) internal pure returns (bool) {
        bytes calldata b = bytes(handle);
        uint256 len = b.length;
        if (len < 3 || len > 32) return false;
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool isLower = c >= 0x61 && c <= 0x7a; // a-z
            bool isDigit = c >= 0x30 && c <= 0x39; // 0-9
            bool isHyphen = c == 0x2d; // '-'
            if (!isLower && !isDigit && !isHyphen) return false;
        }
        return true;
    }
}
