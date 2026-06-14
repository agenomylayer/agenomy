# AGENOMY — Project Brief (context for writing tweets)

Paste this whole file into ChatGPT as context. It covers what the project is, what's
actually built vs coming (be honest), and the exact voice rules for tweets.

## One-liner
**Agenomy is the on-chain layer for autonomous AI workers.** We give any AI agent an
on-chain identity (a smart wallet on Base), a verifiable memory, skills it can run, and
the ability to earn USDC. Tagline: **agents that live, earn & remember.**

- X/Twitter: **@agenomylayer** (this is the PROJECT account, not a personal founder account)
- Chain: **Base** (currently **Base Sepolia testnet**; mainnet comes later)
- No public domain yet (coming at mainnet). Current site is a testnet preview.

## The problem / positioning
Most "AI agents" today are just chatbots. They can't own anything, can't earn, and don't
remember across runs. Agenomy gives agents the on-chain primitives to be real workers:
**identity, a wallet they own, memory, skills, and payments.** More than a chatbot.

## The 5 primitives an agent gets
on-chain identity · a CREATE2 smart wallet on Base · verifiable memory · forkable skills ·
USDC payments.

## What's ACTUALLY built right now (BE HONEST — never overclaim)
- ✅ **Agent identity — LIVE (testnet).** You create an agent in a wizard; it gets an
  on-chain identity + its own smart wallet (CREATE2) on Base Sepolia; its manifest is
  pinned to IPFS; an on-chain registry + an indexer track it; there's a public gallery +
  agent profile pages. First agent ("wizard") is live on-chain.
- ✅ **Deployed — LIVE (testnet preview).** The whole app runs 24/7 on our server (not a
  laptop). Testnet, no fancy domain yet.
- 🔨 **Agent execution — BUILDING NOW.** Making agents actually DO their skills for real
  (read on-chain + market data, research the web, produce real results), with ~30
  genuinely-working skills, on-demand and on a schedule. NOT live yet.
- ⬜ **Coming:** earning (USDC pay-per-use), verifiable memory, then mainnet launch
  (with a security audit + a real domain).

**Tweet rule from this:** identity + the live site are real (testnet). Execution / earn /
memory are being built — say "building" / "next" / "coming", do NOT claim they're done.

## Roadmap
1. Identity ✅ done → 2. Go public / deploy ✅ done → 3. Execution (agents actually work)
🔨 building → 4. Earn (USDC) ⬜ → 5. Remember (memory) ⬜ → 6. Mainnet + audit + launch ⬜.
After v1: skills marketplace + reputation, multi-agent coordination, capital/ownership,
platform/SDK.

## Tech (brief, for accuracy)
pnpm monorepo. Smart contracts in Solidity/Foundry (an AgentRegistry + an Alchemy
LightAccount CREATE2 factory). Frontend Next.js 15 + wagmi/viem/RainbowKit. A Postgres
indexer watches on-chain events. Agent manifests live on IPFS (Pinata). All on Base. The
agent runtime being built is a model-agnostic loop (Claude default, Xiaomi MiMo as a
swappable option) that runs each skill with real tools (on-chain reads, market data, web
search). AgentRegistry is deployed on Base Sepolia.

## Brand
Name: **Agenomy.** Aesthetic: warm cream (#E5DECF) + orange (#D9430F), deliberately
**anti the purple-gradient crypto cliché.** Logo = an orange + dark interlock mark.
Wordmark set in Archivo Black. UI fonts Geist + Geist Mono.

## TWEET VOICE — follow strictly
- **Sound like a real BUILDER tweeting about their project, NOT like AI or marketing copy.**
  Human, casual, specific, a bit raw / opinionated, build-in-public energy. Lowercase is fine.
- **Use "we"** (it's the project account), NOT a personal "i".
- **NO em dashes "—" ever.** Use commas, periods, or colons. (Hyphens inside words like
  "on-chain" are fine.)
- **NO LARP / no overclaiming.** Don't say a feature works if it isn't built. Be honest
  about testnet + the building stage. Honesty is a hard rule.
- **Anti-cliché:** no "revolutionizing", no "the future of", no web3 buzzword soup, no hype.
- Strong, non-generic openings. Sharp, concrete, crypto-Twitter native.
- Keep tight (<=280 chars). Bio <=160.

## Existing tweets (match this style)
1. (quote-tweeting @base's "Build it." image) — "You have the tools with AI / You have the
   financial infra with @base / We made it an identity for every agent wallet, memory & USDC"
2. (launch post + a cream brand card) — "Agenomy is the on-chain layer for autonomous AI
   workers. / Smart wallet · verifiable memory · USDC payments / Spawn an AI agent that can
   live, earn & remember."
3. (latest, builder voice) — "agents have on-chain identities + wallets now. testnet, but
   real. / the actual hard part is next: getting them to run skills and earn. / we're
   building agenomy in the open, gonna break some things."

## Current bio
"The on-chain layer for autonomous AI workers. Wallet, memory & USDC for agents that live, earn."
