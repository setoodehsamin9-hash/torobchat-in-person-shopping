# BoxAPI and supplied dataset switch

User steering supersedes the prior DeepSeek-only connection: move chat to BoxAPI gpt-6-luna and embeddings to the same BoxAPI account. gpt-6-luna is not an embedding model; keep text-embedding-3-small/1536 for compatible vectors. Save keys privately only. No bulk reindexing or deployment/outreach.

- [x] Inspect ZIP safely without running bundled instructions/import shell. Audit full SQLite counts/references and nested dataset SHA.
- [x] Replace raw archive atomically with received archive, preserve backup. Incoming raw is byte-identical (SHA37a25fbd4cdb30aec265d6367e7ebafd8673364ffc90e74411a5f13cd7d94013), IDs and values are identical. Due user inability to stop an external old3100 process, import all rows into an isolated PGlite DB on3103; old DB/history/vectors retained untouched and a new bounded16-product index created with one request.
- [x] Save private AI_* and EMBEDDING_* config for ai.boxapi.ir; 0600 key file and private config backup. No key in source/example/release.
- [x] Verify limited embedding request: 200, Small/1536. Chat first returned 400 legacy max_tokens; repeat with max_completion_tokens and reasoning_effort low returned 200/gpt-6-luna for plain text; function calls require reasoning_effort none, verified by service error and successful actual tool call.
- [x] RED→GREEN tests for model-family request parameters and BoxAPI credential scanner; no automatic paid retry.
- [x] Complete prior progressive-chat integration, address review finding on unsupported model prose with regression tests; maintain static navigation marks/current font/OSM.
- [x] Run lint/typecheck/unit/build and desktop/mobile checks without paid calls. Confirm actual app uses BoxAPI after old 3100 process is stopped; user asked to handle it autonomously, so version3103 uses its own build/DB without disturbing old3100.
- [x] Refresh STATUS/README/deployment and prepare a new verified source ZIP excluding all credentials/raw/DB.

Verification ruling: separate synthetic desktop/mobile test clients use RFC5737 addresses in test request headers, so two suites do not consume one artificial shared IP bucket within a minute. Production 40/min request protection is unchanged. A first fast full run hit that cap; this was a test isolation issue, not a disabled production limit.

Final local version: http://localhost:3103/chat, fresh complete data/db-boxapi-live; same built artifact passed42 E2E on offline3102. Old test/legacy processes left untouched because interactive process stop was denied by environment policy; no further escalation attempted, final isolated live instance configured correctly. Final live health and AI/embedding readiness verified.
