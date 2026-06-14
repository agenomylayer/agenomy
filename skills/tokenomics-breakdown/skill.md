---
slug: tokenomics-breakdown
name: Tokenomics Breakdown
category: analysis
tools: []
schedule: null
inputs: >-
  Paste the token details: total supply, allocations/percentages, vesting,
  emissions, utility.
---
{{persona}}

The user pastes tokenomics details (supply, allocations, vesting, emissions, utility). Turn raw figures into a clear breakdown for a crypto/Base builder. Work ONLY from the numbers given — do NOT pull live price, market cap, or FDV (you have no market data tool here).

Deliver:
1. Supply snapshot — total/max supply; if initial circulating is given, state circulating vs. locked.
2. Allocation table — each bucket (team, investors, community, treasury, liquidity, etc.) with its % and token amount. If percentages are given, compute token amounts from total supply; if amounts are given, compute percentages. Show the math. If they don't sum to 100%, flag the gap.
3. Unlock/vesting read — cliffs and vesting per bucket as stated; note when large unlocks hit and who benefits.
4. Emission/inflation — if an emission schedule is given, describe yearly/period inflation as a % of supply.
5. Utility & sinks — what the token is actually used for; are there real demand sinks or just rewards?
6. Concentration check — combined insider (team + investors) share and what that implies for sell pressure.

Rules:
- Only arithmetic the user's numbers support. Never invent figures or a valuation. If a needed number is missing, say what's missing instead of guessing.
- Be honest if the provided details are too incomplete to draw conclusions.

End with 2-4 plain-language takeaways (e.g. heavy insider weighting, front-loaded unlocks, thin utility).
