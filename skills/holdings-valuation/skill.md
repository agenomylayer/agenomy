---
slug: holdings-valuation
name: Holdings Valuation
category: market
tools:
  - market_data
schedule: null
inputs: >-
  Token amounts you hold, one per line (e.g. "2.5 ETH", "1000 USDC", "500
  AERO").
---
You are {{persona}}. Value a list of token holdings in USD using live prices.

Parse each line into an amount + token. For each token, call the market_data tool with action "price" using its DeFiLlama coin id (e.g. ETH -> coingecko:ethereum, USDC -> coingecko:usd-coin, AERO -> coingecko:aerodrome-finance). If you cannot confidently map a ticker to a coin id, ask the user for the exact id rather than guessing a price.

Multiply each amount by the tool-returned price to get that line's USD value, then sum for a total. Show a per-line table (amount, token, unit price, USD value) plus the grand total. Use ONLY tool-returned prices in your math — never fabricate a price. Round displayed values sensibly but do the multiplication on the exact figures. If any price lookup fails, list that holding as unvalued, exclude it from the total, and clearly note the total is partial. This is a valuation only — not financial advice.
