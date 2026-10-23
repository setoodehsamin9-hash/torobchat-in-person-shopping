# Conversational Streaming and Store Panels Implementation Plan

> **For agentic workers:** use superpowers:executing-plans; independent UI and store-discovery tasks use superpowers:dispatching-parallel-agents with non-overlapping files.

**Goal:** Real configured-model conversation, progressively rendered validated UI, static navigation marks and OSM store discovery.
**Architecture:** Optional NDJSON on the same chat route; observed tools emit validated blocks. Structured model guidance is separate from authoritative facts. A joined-offer discovery tool feeds a typed store/map panel.
**Tech Stack:** Existing Next.js/React/TypeScript, Zod, PGlite/PostgreSQL, Leaflet, Vitest/Playwright. No new framework/dependency.
**Spec:** docs/superpowers/specs/2026-10-23-conversational-stream-design.md

## Global Constraints
- No fabricated prices/inventory or phone outreach; category is not a product offer.
- Private BoxAPI config stays private (latest user switches chat from 9router to gpt-6-luna); Neshan kept but not called in tests.
- Current licensed font retained at user's explicit request; only chat icon animated, reduced motion static.
- No Git metadata here: edit existing workspace; no invented commit/worktree.

## Review Focus
- No unsafe/free-text seller claims; empty/no-key/error/cancel states retain honest provenance.
- Stream must show real partial work before done, bound framing, reject malformed records and not replay old history animation.
- Category/store matches must have real offers and obey the same offer's budget/region/installment/radius.
- ShopMap must not claim live inventory, ETA or product evidence from category alone.
- JSON clients and existing modal/card controls must remain compatible and mobile must not overflow.

### Task 1: Root — provider guidance and chat transport
Files: agent/provider.ts, agent/orchestrator.ts, api/chat/route.ts, new lib/chat-stream.ts, lib/chat-stream-client.ts, lib/agent/guidance.ts, tests/agent.test.ts, tests/chat-stream.test.ts.
- [x] RED tests: preserve safe model greeting/guidance; reject invented price/contact/live claims; no paid retry; emit valid tool/block events before done; cancellation/malformed client frames.
- [x] Add optional model guidance and source-only fact rendering; emit status/tool/block and safe text chunks; preserve default JSON and error status before streaming.
- [x] Verify focused tests, then one bounded actual configured model/tool call without embeddings.

### Task 2: Independent UI — static branding and progressive messages
Files: components/brand-mark.tsx, chat-screen.tsx, new assistant-response.tsx, app/conversation.css, tests/e2e/in-person.spec.ts and new progressive.spec.ts.
Interfaces: root exports streamChat(input,onEvent,signal?) -> Promise<ChatResponse> and ChatStreamEvent status/tool/block/text/done/error. Canonical done.response is persisted; new transient responses only animate. Import new CSS from chat-screen.
- [x] Browser regression: static PNG header/sidebar/welcome, GIF only response/loading; reduced motion PNG; partial text/panel visible before done; cancelled response not replayed/saved as complete.
- [x] Consume actual stream; keep existing filters/history/modals, show explicit model vs direct-DB mode; no API keys or provider config edits.

### Task 3: Independent store discovery and prepared panels
Files: lib/contracts.ts, agent/schemas.ts, agent/tools.ts, new lib/store-discovery.ts, components/workflows.tsx, shop-map.tsx, new shopping-task-panel.tsx, new shopping-panels.css; tests/store-discovery.test.ts and tools tests as separate file.
Interfaces: tool searchStoreOffers({query,filters,limit<=12}) returns {query,matches:{product,offer}[],limited:true}; UIBlock type store_discovery has same fields and title. Root wires tool guarding/intent and streaming. Return only actual linked offers; no category-based inventory claim.
- [x] RED tests: real joined product/offer identity, same-offer hard filters, empty/missing geo and bounded search, no duplicate IDs.
- [x] Implement tool/schema/output and OSM store/list task panel; improve product task controls without raw generated HTML; preserve existing exported renderers.

### Task 4: Root — integrate and deliver
- [x] Review both tasks and new security boundaries; run lint/typecheck/test/build and desktop/mobile E2E without live API keys.
- [x] Start production locally; verify health/static marks/typed UI; document exact live model outcome and limitations.
- [x] Update STATUS/IMPLEMENTATION_PLAN and source ZIP, verify secret/data exclusion and manifest integrity. No production deployment.

Rulings: independent local3101 build/DB avoids an unrelated old3100 process; incoming raw is byte-identical but reimported into isolated DB with zero rejected rows. Review found unsupported claims escaping a denylist: finite needs/process vocabulary + sentence forms now reject written-out prices/outreach/hours; four demonstrated failures were RED→GREEN. Missing selected-product details link found by E2E was restored; canonical history test now waits for completion rather than cancelling a streaming turn. BoxAPI Luna parameters were verified via actual error responses and a successful one-request tool call. No paid retry is automatic.
