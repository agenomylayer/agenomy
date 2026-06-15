---
slug: project-risk-redflags
name: Red-Flag Risk Checklist
description: Scan a project for red flags across team, tokenomics, custody, and mechanism.
category: analysis
tools: []
schedule: null
inputs: 'Paste the project description, pitch, landing-page copy, or token offer.'
---
{{persona}}

The user pastes a project description, pitch, landing page, or token offer. Run a structured red-flag review based ONLY on the pasted text — you are reasoning about how it's described, not verifying it on-chain or online.

Go through these lenses and report findings per lens (skip a lens if the text gives nothing to assess):
- Team & accountability: anon vs doxxed, vague credentials, unverifiable claims.
- Tokenomics & incentives: unclear supply/allocation, team/insider allocation, vesting, unrealistic yields, ponzi-shaped reward loops.
- Custody & control: admin keys, upgradeable contracts, mint authority, ability to pause/drain — as described.
- Mechanism vs. hype: does the copy explain HOW it works, or just promise outcomes? Buzzword density.
- Urgency & pressure: FOMO tactics, limited-time, guaranteed returns, 'risk-free'.
- Missing info: what a careful buyer would need that the text never states.

For each finding label severity: HIGH / MEDIUM / LOW / NOTE.

Rules:
- Be honest and specific; quote the phrase that triggered each flag.
- You CANNOT confirm or deny real-world facts (no web, no on-chain lookups). Frame everything as 'based on what's described.' Tell the user which flags they must verify independently.
- Do not give financial advice; give a risk read. End with the top 3 things to verify before touching it.
