# Persistent inquiry jobs and the gateway boundary

This implementation provides a usable **zero-charge simulation** and a provider-neutral foundation. No working voice/SMS vendor is claimed or supplied. All dataset phone numbers are fictional. The application never reads dataset contacts for dispatch, never updates recorded offers from a report, and never marks a result `seller_confirmed`.

## Public API

Every owner request requires `x-shopping-session`, a cryptographically random 32-byte capability encoded as 64 hexadecimal characters. Generate it with browser `crypto.getRandomValues`, persist it locally, and never place it in URLs, analytics or logs. The server stores its SHA-256 hash only. This capability is bearer authentication: a user clearing browser storage loses access; sharing the capability grants access. Accounts and cross-device recovery are outside this prototype.

- `POST /api/contact/quotes`: `{offerId, channel: "voice"|"sms", mode: "simulation"|"live"}`. Returns `ContactQuote`; TTL 10 minutes. Resolves the exact offer/shop/product relation from `offers`. Unknown tariffs are `null`; unconfigured/disabled live quotes contain `available:false` and a Persian explanation.
- `POST /api/contact/jobs`: `{quoteId, approved:true, approvedMaxCostToman, idempotencyKey}`. The approved ceiling must exactly match the quote. The key is 8–120 letters/digits/underscore/hyphen. Replaying the same quote/key returns its existing job; changing the quote with that key is rejected. One quote can create one job.
- `GET /api/contact/jobs`: `{jobs:[...]}`; most recent 50 owned jobs.
- `GET /api/contact/jobs/:id`: one owned job; another owner sees 404.
- `POST /api/contact/jobs/:id/cancel`: JSON `{}`. Only a job still queued may be cancelled. Cancellation conservatively retains its daily reservation.
- `POST /api/contact/callback`: authenticated gateway reports, described below. This endpoint returns only `{accepted:true}`, never owner capabilities.

All public payloads are strict schemas. A public client cannot submit a phone, verify a contact, supply gateway configuration, change tariffs, or supply stock/price reports. Responses use no-store. Mutation helpers reject cross-site origins, bound JSON to 32 KiB and apply an IP request rate limit. Persistent quote limits are 60 per owner per Tehran calendar day; the application-wide job cap defaults to 100 per day. Database locking serializes quote creation, job approval, reservations, cancellation, claims and callbacks.

## Simulation

Simulation is independent of gateway credentials and always costs **0 تومان**. A persisted job starts queued; at elapsed 3 seconds it becomes dialing (voice) or sending (SMS), at 7 seconds waiting, and at 15 seconds completed (voice) or unanswered (SMS). These are deterministic demonstration intervals, **not live service ETAs**. On retrieval, the server materializes missing timestamped events, so reloads/server restarts preserve progress. A worker is not required for simulation.

Voice completion has outcome `unknown`, with no invented inventory or price. SMS demonstrates an unanswered outcome. Result source is `simulation`, verification status is `simulated`, and every response carries an explicit Persian simulation disclosure. Returning later means checking the persisted record, not a promised notification or actual seller response.

## Operator environment

Live mode is **off by default**. No new paid resource, real dispatch or deployment is authorized by this documentation. Obtain the owner's separate approval before activating those operations.

| Variable | Purpose |
| --- | --- |
| `CONTACT_REAL_MODE=false` | Explicit switch; only literal `true` enables eligibility checks |
| `CONTACT_GATEWAY_URL` | Operator-controlled HTTPS dispatch endpoint; no redirects, URL userinfo, query or fragment |
| `CONTACT_GATEWAY_TOKEN` | Server-only Bearer token of at least 32 characters |
| `CONTACT_CALLBACK_SECRET` | Separate server-only callback Bearer secret of at least 32 characters |
| `CONTACT_REGISTRY_PATH` | Absolute private JSON registry path, outside dataset and source release |
| `CONTACT_VOICE_MAX_COST_TOMAN` | Configured nonnegative integer maximum charge for one voice inquiry |
| `CONTACT_SMS_MAX_COST_TOMAN` | Configured nonnegative integer maximum charge for one SMS inquiry |
| `CONTACT_DAILY_MAX_COST_TOMAN` | Positive configured application-wide daily reservation cap; required for live mode |
| `CONTACT_DAILY_MAX_JOBS` | Application-wide daily job cap, default 100; 0 pauses new jobs |

Tariffs are maximum per-job charges, not guessed market rates or prices for the product. In particular a voice gateway must enforce call duration/termination within the approved maximum. The gateway must contractually enforce the cap before it can be trusted for live use. Report validation cannot reverse an external provider overcharge. Daily usage reserves the full approved maximum atomically and deliberately never refunds unused reservation, even after cancellation/failure. A crash therefore cannot create a fresh allowance accidentally. Calendar boundaries use `Asia/Tehran`.

The private registry is an operator-maintained array. Each entry requires `shopId`, independently verified E.164 `destination`, ISO `verifiedAt`, nonempty `verificationReference` pointing to independent evidence, and `permission:true`. A shop may appear once. The file must be a regular nonsymlink file readable only by its owner (`chmod 600`), under 2 MB, and outside the entire application/source project directory (including config/src/data). Invalid/missing files fail closed to an empty registry. `src/lib/contact/registry.example.json` is deliberately `[]`. **Never populate it by copying fictional dataset numbers.** No UI/API manages this registry. Operator verification and permission records remain external prerequisites, not facts inferred by this application.

## Dispatch contract and worker

Production requires persistent PostgreSQL using `DATABASE_URL` shared by web and worker, and migrations/import before use. Local PGlite works for a single application process; **do not open its directory from a separate worker process while the app has it open**. `CONTACT_SCHEMA` in `src/lib/contact/store.ts` defines idempotent contact tables and is initialized on first contact access. It can also be executed during application migration before serving requests. Tests exclusively use isolated in-memory PGlite.

Dry run, without opening the database or contacting anyone:

```sh
node --import tsx scripts/contact-worker.ts
```

After separately authorizing/configuring a real environment, an external scheduler may invoke one-shot processing:

```sh
node --env-file=/private/server.env --import tsx scripts/contact-worker.ts --dispatch-approved-live
```

Add an optional package command `"contact:worker": "node --import tsx scripts/contact-worker.ts"` if desired. The explicit flag is still required for dispatch. Each invocation scans at most 100 queued **live** jobs under a database lock and claims at most one eligible job. Stale quotes whose contact/tariff/product prerequisites changed become failed with an honest event, so they cannot block later valid jobs. Dispatch reserves the actual Tehran dispatch day in a separate atomic cost/count ledger, including when approval was on a prior day; reservations for uncertain sends are never released. Before network I/O, the job becomes `dispatch_uncertain`. This is intentional: a process dying after send but before receipt cannot safely assume nothing was sent. Concurrent workers cannot claim it twice.

The server sends an HTTPS POST with `Authorization: Bearer CONTACT_GATEWAY_TOKEN`, `Idempotency-Key: <job UUID>`, JSON content type, a 12-second timeout, redirects disabled and an 8 KiB acknowledgment limit. Payload: `{jobId,idempotencyKey,channel,destination,offerId,shopId,productId,productTitle,productModel,maxCostToman,instructions}`. Destination comes exclusively from the private registry. The product title/model are resolved from the imported product record; absent values remain null. The gateway must use that exact subject, and never substitute inventory or prices. A missing product record prevents dispatch. The gateway returns strictly `{gatewayId:string}` after durably accepting the request and enforcing idempotency/cost constraints. The callback URL is provisioned separately on the gateway, not supplied by public requests.

A valid acknowledgment advances an uncertain job to waiting. A concurrent callback is never overwritten. Timeout, HTTP error, malformed/oversized acknowledgment or process interruption leaves `dispatch_uncertain`. **There is no automatic retry or state reset.** An operator must reconcile using the original job UUID at the gateway; a late authenticated callback may resolve the uncertainty. This system provides at-most-one automatic dispatch attempt, not guaranteed delivery. The gateway itself must honor idempotency and avoid duplicate phone/SMS attempts.

## Authenticated callback contract

The gateway must POST over HTTPS to `/api/contact/callback` with `Authorization: Bearer CONTACT_CALLBACK_SECRET` and content type JSON. Protect the endpoint with HTTPS at the ingress and restrict gateway network access where possible. The secret is compared in constant time, is separate from dispatch authentication, and must never be sent to the browser or logged.

```json
{
  "eventId": "gateway-event-unique-001",
  "jobId": "00000000-0000-4000-8000-000000000001",
  "status": "completed",
  "chargedCostToman": 0,
  "result": {"outcome": "unknown", "reportedPriceToman": null}
}
```

This is a protocol example, not an actual job or seller report. Statuses are dialing (voice), sending (SMS), waiting, completed, unanswered, or failed. Cumulative charge must never decrease or exceed the approved maximum. Result fields are accepted only on completed/unanswered; missing values remain unknown. `reportedPriceToman` is integer تومان and stored solely in the job, separate from `offers.price_toman`.

Callbacks can resolve `dispatch_uncertain` directly to a subsequent/terminal state because a response can arrive after an acknowledgment was lost. Otherwise transitions move forward: dialing/sending → waiting/terminal; waiting → terminal. Queued simulation jobs and terminal jobs cannot be mutated by fresh callbacks. Exact callback event replays are acknowledged without adding events; an event ID reused with different normalized content/job is rejected atomically. Terminal reports retain `source:"gateway_report"` and `verificationStatus:"unknown"`: authentication proves the sender, not the truth of a stock/price claim. No callback writes `seller_confirmed` or mutates recorded dataset prices.

## Limits and deployment checks

This is a provider integration foundation. A real gateway, operator-verified contacts/permission, charge enforcement, external worker scheduling, HTTPS callback provisioning and operational reconciliation are prerequisites for future live service. No third-party calls/SMS, production deploy or payment was performed while implementing/testing it. Jobs are limited to 50 per retrieval and globally serialized by a contact lock; this is appropriate for this prototype, with account auth, retention, indexed job/event normalization and distributed throughput controls left to a scaled service. Back up the contact tables with the shared database; keep registry/credentials outside source bundles and container images.

Verification: run `npm test -- --run tests/contact.test.ts tests/contact-http.test.ts tests/contact-config.test.ts`, then `npm run typecheck`, `npm run lint`, and the full suite during integration. No test may open active `data/db`, consume live gateway credentials, or contact a real destination.
