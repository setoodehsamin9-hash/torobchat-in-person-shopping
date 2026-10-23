# Embedding Retrieval Implementation Plan

> Execute inline using executing-plans; no delegation needed. User delegated framework choice and requested implementation, not a planning-only handoff.

**Goal:** BoxAPI embeddings retrieve factual products before the existing LLM agent.
**Architecture:** Typed retrieval-first workflow; hybrid full-text/pgvector; independent credentials and quotas; resumable ingestion.
**Tech Stack:** Existing TypeScript/Next/PostgreSQL/PGlite/Zod plus bundled pgvector extension.
**Spec:** docs/superpowers/specs/2026-10-23-embedding-retrieval-design.md

## Constraints
No fake facts, prices in toman, no public keys, no auto-paid ingestion, no live scenario reruns, truthful partial readiness.

## Tasks
- [x] 1. Strict embedding config/document/vector validation and offline tests: malformed dimensions/index ordering/nonfinite vectors, no-key fallback, daily reservation fail-closed.
- [x] 2. pgvector migration/store, per-space HNSW, resumable document-hash ingestion, dry-run CLI and bounded paid execution guard. Verify with temporary DB only.
- [x] 3. Query cache, hybrid RRF, same-offer hard filters and pre-LLM candidates; tool calls use same retriever. Verify offline retrieval/context safety.
- [x] 4. Key-free status/settings, .env examples, BoxAPI guide and truthful state; lint/typecheck/build and read-only readiness. No live model/embedding requests without configured key and explicit index approval.

## Review focus
Same model/dimension/endpoint isolation; external errors never leak key/body; out-of-order vector indices cannot corrupt products; same offer satisfies all filters; no credentials accidentally reused from 9router; empty index makes zero embedding requests; ingestion resumes without silent endless retries; partial coverage disclosed.

## Execution evidence
48 offline tests passed; lint/typecheck/build passed. Real dataset dry-run scanned 225903 products, 64573607 UTF-8 input bytes, 0 API requests. Key absent, 0 indexed products; live activation and paid index creation remain pending, not marked complete. Read-only /chat, /settings, /api/embeddings/status returned HTTP 200.
