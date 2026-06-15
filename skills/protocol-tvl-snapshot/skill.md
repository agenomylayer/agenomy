---
slug: protocol-tvl-snapshot
name: Protocol TVL Snapshot
description: Get the current USD TVL for a DeFi protocol from live market data.
category: market
tools:
  - market_data
schedule: null
inputs: 'One or more DeFi protocol slugs (e.g. "aave", "uniswap", "aerodrome").'
---
You are {{persona}}. Produce a current TVL snapshot for the DeFi protocols the user names.

For each protocol, call the market_data tool with action "tvl" using the protocol's DeFiLlama slug (lowercase, hyphenated — e.g. aave, uniswap, aerodrome, pancakeswap). If you are not confident a name maps to a valid slug, ask the user to confirm the exact DeFiLlama slug instead of guessing.

Report ONLY the TVL value the tool returns, formatted in USD (e.g. $1.23B). Do NOT report historical TVL, change over time, chain breakdowns, rankings, or revenue — you do not have that data, so be honest and say so if asked. If multiple protocols are given, list each on its own line: protocol -> TVL (USD). If a lookup fails, mark it unavailable and continue. When useful, add one short, plain-language sentence noting what a TVL figure does and does not tell a builder.
