# In-person Journey and Publish Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task by task, with regression tests and a final review.

**Goal:** A chat-first in-person shopping application with Neshan routes, persistent inquiry tracking and a source release without secrets.
**Architecture:** Reuse authoritative offer APIs. Add bounded server integrations and DB-backed inquiry jobs; render typed route/job data in existing chat and map. Keep all live contact operations disabled unless explicitly configured and individually approved.
**Tech Stack:** Existing Next.js/TypeScript, Zod, PostgreSQL/PGlite, Leaflet, Vitest/Playwright; Python standard library for source ZIP packaging.
**Spec:** docs/superpowers/specs/2026-10-23-in-person-release-design.md

## Global Constraints
- Dataset phone numbers are fictional; never contact them. Offer IDs are the only product/store linkage.
- Secret keys remain server-side and outside the release; no real outreach, deployment or paid API calls in tests.
- Persian RTL; recorded prices and inventory unknown remain distinct from gateway/simulation reports.
- No Git repository exists in the supplied workspace; work in place, keep a ledger and do not invent commits/worktrees.

## Review Focus
- Cross-product IDs, duplicate stores and hard filters must not leak incompatible destinations.
- Missing keys and Neshan failures must show unknown ETA, never a computed travel-time guess.
- Other clients cannot read/cancel someone else's inquiry; callback replay cannot mutate a final result.
- Ambiguous worker dispatch must not cause a second real call; approved cost bounds are enforced.
- Release excludes secrets, local data, symlinks and reference captures, including accidental secret strings in source.

### Task 1: Neshan journeys
Files: src/lib/journeys/{contracts,neshan,service}.ts, src/app/api/journeys/route/route.ts, tests/journeys.test.ts.
Interfaces: `planJourney(input)` accepts productId, offerIds, origin, consent, travelMode, strategy, filters; returns typed routes with ETA, path, source and candidate scope. Map receives `path?:[number,number][]`.
- [x] Tests RED: invalid/mixed offers, missing consent/key, driving/walking endpoint, routed nearest candidate, waypoint order, missing ETA/invalid geometry, bounded requests.
- [x] Implement validated routing adapter, real-offer resolver and bounded persistent request budget; tests GREEN.

### Task 2: Inquiry backend
Files: src/lib/contact/{contracts,store,service,gateway}.ts; API contact/{quotes,jobs,jobs/[id],callback}; scripts/contact-worker.ts; tests/contact.test.ts.
Interfaces: owner capability in `x-shopping-session`; quotes approve mode/channel/max cost, jobs created idempotently by quote; owner GET list persists progress. Gateway dispatch and authenticated callbacks never accept raw dataset phone numbers.
- [x] Tests RED: owner isolation, quote expiry/approval/idempotency, simulation progression, absent verified contact, cost overflow, worker/callback replay.
- [x] Implement persistent schemas, quote/jobs lifecycle, gateway adapter, worker and callbacks; tests GREEN.

### Task 3: Chat-first in-person UI
Files: src/app/page.tsx, layout.tsx, src/components/chat-screen.tsx, ui.tsx, workflows.tsx, shop-map.tsx; new journey-panel.tsx, contact-tracker.tsx, in-person.css; remove home-screen.tsx.
Interfaces: JourneyPanel consumes product + eligible offers + current session; ContactTracker consumes owner-scoped APIs and is reachable from inquiry modal and chat switch.
- [x] Update browser tests for root redirect, new in-person copy and tracking; preserve product previews and hard constraints.
- [x] Implement user-selected Torob GIF identity and reference palette, journey steps, route controls/polyline/product markers, persistent inquiry status switch and secondary online links.
- [x] Test mobile/desktop, accessibility controls, reload and explicit no-key/simulation states.

### Task 4: Clean release and integration
Files: scripts/package-release.py, tests/release.test.ts, .env.example, .gitignore/.dockerignore, README.md, docs/deploy-liara.md, docs/neshan.md, docs/contact-gateway.md.
- [x] Tests RED: archive secret/symlink/data rejection, safe source inclusion; implement allowlist ZIP and manifest/scanner, tests GREEN.
- [x] Document production environment, Postgres/vector/import, worker/callback and operator approval prerequisites.
- [x] Run npm lint/typecheck/test/build; launch without sending live API calls, smoke API and E2E, review findings, create and verify release archive, update STATUS.md.


### User refinement: stores, reference identity and API efficiency — completed
- Explicit user choices: prioritize shops and physical visits; name «ترب‌چت — دستیار خرید حضوری».
- Saved, local Torob reference GIFs, PNG reduced-motion fallback and dark/red palette; provenance documented and only those exact image paths admitted into source releases.
- Typed store actions avoid model/embedding requests, maintain exact product and hard constraints; free-form compound requests retain tool calling. Bounded Neshan cache/coalescing preserves original calculation time.
- Final evidence: 132 tests / 12 files, lint/typecheck/build passed; 32 desktop/mobile E2E passed on no-key development server; six production UI/action checks passed on http://localhost:3100. No live provider test or third-party contact in this integration. See STATUS.md for limitations and release verification.
