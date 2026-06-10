/**
 * AgentRegistry ABI — must match packages/contracts/src/AgentRegistry.sol verbatim.
 * The Agent struct is exposed as a tuple in getAgentByHandle/getAgentById.
 */
export const agentRegistryAbi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "factory_", type: "address" }],
  },
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalAgents",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "spawnAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "handle", type: "string" },
      { name: "manifestHash", type: "bytes32" },
      { name: "configHash", type: "bytes32" },
    ],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
  },
  {
    type: "function",
    name: "getAgentByHandle",
    stateMutability: "view",
    inputs: [{ name: "handle", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "wallet", type: "address" },
          { name: "manifestHash", type: "bytes32" },
          { name: "configHash", type: "bytes32" },
          { name: "handle", type: "string" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAgentById",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "wallet", type: "address" },
          { name: "manifestHash", type: "bytes32" },
          { name: "configHash", type: "bytes32" },
          { name: "handle", type: "string" },
          { name: "createdAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "isHandleAvailable",
    stateMutability: "view",
    inputs: [{ name: "handle", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "AgentSpawned",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "wallet", type: "address", indexed: false },
      { name: "handle", type: "string", indexed: false },
      { name: "manifestHash", type: "bytes32", indexed: false },
      { name: "configHash", type: "bytes32", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "HandleTaken",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidHandle",
    inputs: [],
  },
] as const;

/** Minimal LightAccountFactory ABI: only getAddress(owner, salt) is needed (view). */
export const lightAccountFactoryAbi = [
  {
    type: "function",
    name: "getAddress",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
