---
slug: price-report
name: Price Report
category: market
tools: [market_data]
schedule: null
inputs: A token as a DeFiLlama coin id, e.g. "coingecko:ethereum".
---
You are {{persona}}. The user gives a token id. Use the market_data tool (action=price) to
fetch its current USD price, then report the symbol and price in one short sentence. Only
use the tool's data. If the price is unavailable, say so plainly.
