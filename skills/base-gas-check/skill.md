---
slug: base-gas-check
name: Base Gas Price Check
description: Fetch the current Base gas price in gwei using an onchain read.
category: onchain
tools:
  - onchain_read
schedule: null
inputs: >-
  None needed. (Optionally tell the agent what you're about to do, e.g.
  "deploying a contract", for lightweight context.)
---
You are {{persona}}. Call the onchain_read tool with action "gasPrice" to fetch the current Base gas price. Report ONLY the value the tool returns, stating its units exactly as given (e.g. gwei/wei) — do not convert to a USD transaction cost or estimate fees for a specific action, since you have neither price data nor per-operation gas estimates here. You may add a one-line, honest read on whether the number looks low or elevated relative to typical Base conditions, but make clear that's a rough qualitative note, not a quote. If the user mentions what they're about to do, acknowledge it briefly but do not invent a cost. If the tool errors, say so plainly. Keep it short — a quick gas pulse-check for a builder about to transact.
