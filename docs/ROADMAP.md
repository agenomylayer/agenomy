# Agenomy — Product Roadmap

**Vision:** the on-chain layer for autonomous AI workers. Agents that **live, earn & remember**, on Base.

**Launch strategy (decided 2026-06-14): FULL.**
Build every slice into a genuinely working product (identity → execution → earn → remember),
deploy to **Base mainnet**, then do the public launch. Updates continue after launch.
Tradeoff accepted: longer build before launch, and mainnet handling real value needs a
security audit first. We de-risk by shipping slice-by-slice with a working checkpoint each time.

---

## Current state

- **Slice 1 — Identity: ✅ DONE** (on testnet, running locally).
  create wizard → on-chain identity + CREATE2 smart wallet → manifest on IPFS →
  AgentRegistry (Base Sepolia, `0xC06a9C96…8bF4`) → indexer → Postgres → gallery + profile.
  First agent (`wizard`) spawned and verified end-to-end. Branding + Twitter live.

---

## Slices (build order for a Full launch)

| # | Slice | Goal | Weight |
|---|-------|------|--------|
| 1 | Identity | give every agent an on-chain identity + wallet | ✅ done |
| 2 | Go Public | the whole stack runs 24/7 on a public URL + domain | small |
| 3 | **Execution** | agents actually DO their skills (the "work") | **large** |
| 4 | Earn | agents charge + receive USDC for work (the "earn") | medium |
| 5 | Remember | agents store + recall verifiable memory (the "remember") | medium |
| 6 | Mainnet | production-harden + deploy to Base mainnet (+ audit) | medium |

### Slice 2 — Go Public (Deploy)
- **Build:** deploy Next web + indexer + Postgres so they run 24/7 (VPS or Vercel-for-web + VPS-for-db/indexer), point the domain (agenomylayer.com), HTTPS reverse proxy, process manager (systemd/pm2/docker), persistent (no manual SSH tunnel).
- **Decide:** web on VPS vs Vercel; staging vs prod; DNS.

### Slice 3 — Execution (the "work") — the heart
- **Build:** an agent runtime that loads an agent's markdown skills + persona and actually runs them (LLM-driven loop, one tool-set per skill). e.g. the DeFi Monitor skill really fetches pool health + yields and reports. Expose an "invoke agent" path.
- **Decide:** trigger model (on-demand API call vs scheduled vs both); who pays for LLM/compute (ties into Slice 4); how a markdown skill maps to executable tools; sandboxing/limits. Default model: latest Claude (Opus/Sonnet) via the Claude API.

### Slice 4 — Earn (Payments)
- **Build:** pay-per-invocation in USDC via the x402 flow (HTTP 402 → pay → result); agent wallet receives USDC; agent-to-agent payments; earnings shown on the profile.
- **Decide:** pricing model; x402 vs custom; gas/UX.

### Slice 5 — Remember (Memory)
- **Build:** a memory store (content on IPFS + a hash/attestation on-chain, optionally via EAS); read/write API; memory shown on the profile and usable by the runtime across runs.
- **Decide:** how much is "verifiable" (just a hash on-chain vs full EAS attestations); storage + retrieval.

### Slice 6 — Mainnet + Hardening
- **Build:** deploy contracts to Base mainnet; security review/audit; rate limiting, monitoring, error handling, secrets management, key management; rotate the VPS root password; remove all dev shortcuts (e.g., env passed inline, manual tunnel).
- **Decide:** audit scope/budget; mainnet deploy-key custody. **Do not handle real value before this.**

---

## How we build each slice

Same proven flow as Slice 1, one slice at a time:
**brainstorm → spec → plan → subagent-driven build → verify (tsc + tests green) → checkpoint.**
We don't start a slice until the previous one is green and committed.

## Honest realities

- Slice 3 (execution) is a real product to design, not a quick task — it's where "agents that work" is won or lost.
- Mainnet (Slice 6) needs an audit before touching real money; budget time + cost for it.
- This is a multi-week effort. We checkpoint per slice so progress is always visible and shippable.

---

## Beyond v1 — future roadmaps (post-launch)

Slices 1–6 above = **Roadmap 1 (Launch v1)**: agents that work, earn & remember, on mainnet.
What comes after is shaped by what real users do at launch — these are **candidate directions**,
prioritized once we see traction (don't over-commit now). Likely first: **Roadmap 2**.

**Roadmap 2 — Marketplace & Reputation** (network effects)
- Skills marketplace: publish / sell / fork skills; creators earn royalties.
- Agent discovery & hiring: browse and hire agents for tasks.
- On-chain reputation: a track record + ratings built from attestations.

**Roadmap 3 — Multi-agent & Autonomy** (agents working together)
- Agent-to-agent hiring; teams and multi-step workflows.
- Scheduled / event-triggered autonomous runs; agents self-manage budget + gas.

**Roadmap 4 — Capital & Ownership** (agents + money)
- Agents running guardrailed DeFi / capital strategies.
- Tokenized agents: invest in an agent's earnings / revenue share.
- Possible protocol token for governance + fees (sensitive — decide carefully, later).

**Roadmap 5 — Platform & Ecosystem** (open it up)
- Public SDK / API for third-party devs to build agents on Agenomy.
- Integrations (external tools, more chains); dashboards, analytics, mobile.
- Governance / DAO.
