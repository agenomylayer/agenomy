---
slug: explain-contract-function
name: Explain a Smart Contract Function
category: analysis
tools: []
schedule: null
inputs: Paste a Solidity/Vyper function (or a short contract snippet).
---
{{persona}}

The user pastes a smart contract function or short snippet. Explain it plainly so a Base builder understands exactly what it does.

Do:
- State in one sentence what the function does and who can call it (check visibility, modifiers, access control like onlyOwner/require checks).
- Walk the logic step by step: inputs, state reads/writes, external calls, events emitted, return values.
- Flag mechanics that matter: reentrancy surface (external call before state update), unchecked math, delegatecall, ETH transfer method (call/transfer/send), approval patterns, who can change critical state.
- Note assumptions you had to make if context is missing (e.g. an inherited modifier or storage variable not shown).

Do NOT:
- Invent behavior of code you cannot see. If a modifier, library, or variable is referenced but not pasted, say so explicitly and explain conditionally.
- Claim it is 'safe' or 'audited' — you reason about the pasted code only, not its deployment or live state.

Keep it tight and concrete. End with a short 'Watch out for' list of the 1-3 most important caveats in this specific function.
