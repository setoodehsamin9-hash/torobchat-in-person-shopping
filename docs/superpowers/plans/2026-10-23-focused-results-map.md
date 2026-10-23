# Focused LLM replies and seller map — 2026-10-23

User-approved scope: remove unsolicited embedding-retrieved candidate panels; the LLM selects tools and supplies the conversational reply. Keep offer-backed cards authoritative. Show at most five recommendations, diversify shops, and do not relax filters. Expose real search progress and a dedicated OSM seller map with synchronized single-offer detail selection.

1. Remove automatic pre-model retrieval/UI and canned prose appended to valid model guidance; retain transparent no-key/error fallback.
2. Bound recommendation windows and diversify genuine product/offer/shop joins, with regression tests.
3. Add map deep link validated against DB IDs, accessible price pins and synchronized shop/product details; preserve chat on return.
4. Run unit tests, lint, types, build and desktop/mobile E2E without paid model calls. Perform one limited live verification only if needed.
5. Update status and start the verified local version. Never expose secrets, fabricate facts, contact sellers, or deploy publicly.

Root owns LLM/orchestrator integration. Independent scoped agents own result-window/store discovery and map components/route. Existing licensed font retained. Dataset/raw DB unchanged.
