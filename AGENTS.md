# Codex repository guidance — Torob In-Person Shopping Agent

This repository implements a Persian RTL, mobile-first, evidence-based in-person shopping assistant for Tehran using the official challenge dataset. Read `CODEX_MASTER_PROMPT.md` as the product contract before writing code. Keep `IMPLEMENTATION_PLAN.md` and `STATUS.md` truthful and current.

## Rules that must never be violated
- Product/shop/offer facts must come from real imported CSV records and traceable shop/product/offer IDs. Never invent inventory or prices.
- The shop's category is NOT evidence that it offers a specific item; product-shop linkage requires an `offers` row.
- Dataset phone numbers are all fabricated; no calls/texts to them. Most seller names are anonymized. Only user-initiated links to valid published website/Instagram sources are allowed; simulation must be clearly labeled.
- Recorded price and recorded working hours do not prove live price, current inventory or live-open status.
- Preserve `price_toman` currency. `payment_options.channel = unknown` is NOT the same as `in_person`.
- UI is Persian/RTL with functioning, accessible controls and explicit provenance/staleness badges. No untrusted AI-generated HTML; render typed components from validated tool responses.
- `torob.com` and `chat.torob.com` are third-party real sites; this repository is an independent prototype and never modifies their production pages.
- Do not commit raw dataset, secrets, local DB or credentials. Keep ZIP under `data/raw/torob-dataset.zip` and gitignore it.
- Ask explicit approval before production deployment, paid resource changes, or real third-party outreach. Do not claim success without verification.

## Engineering expectations
- Prefer strict TypeScript, small reusable components, server-side data access, schema validation and streaming dataset import.
- Aim for `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` on every final integration.
- Keep working route `/`, independent `/chat`, and stable APIs that share the same database.
- Import all provided rows and audit data quality; don't silently seed 12 hard-coded demo products as the entire dataset.
- Handle absent AI API key with a functioning transparent deterministic mode rather than a broken or fraudulent chat experience.
- When unavailable data exists, render `نامشخص`, not a guessed value.
