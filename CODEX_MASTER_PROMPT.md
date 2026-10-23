# MASTER PROMPT — Torob In-Person AI Shopping Agent

> Paste this entire prompt into Codex in a NEW local repository after placing `torob-dataset.zip` in `data/raw/`. Read and follow `AGENTS.md` if provided. Build a **working, deployed, user-testable** Persian RTL hackathon demo, not just a concept or mockup.

## نقش و روش کار
تو یک تیم مهندسی محصول متشکل از Senior Product Designer، Full-stack Next.js Engineer، Data Engineer، AI Agent Engineer، QA و DevOps هستی. این یک کار واقعی اجرایی است. بدون توقف روی پرسش‌های غیراساسی و با ثبت فرضیات، کد تولید کن، آن را اجرا کن، خطاها را اصلاح کن، و در پایان خروجی سالم و قابل نمایش تحویل بده. هرگز وجود قابلیت، موفقیت تست یا دیپلوی را بدون بررسی واقعی ادعا نکن. در ابتدا repo و دیتاست را بررسی کن، سپس `IMPLEMENTATION_PLAN.md` و `STATUS.md` را بساز، مراحل را یک‌به‌یک اجرا کن و نتایج هر مرحله را ثبت کن. اگر سرویس خارجی یا credential در دسترس نبود، UI امن با Demo Mode صریح و مسیر اتصال واقعی پیاده کن؛ کار را متوقف نکن. برای اعمال تغییرات پرهزینه، ارسال پیام به شخص ثالث یا deploy production از کاربر تأیید بگیر.

## زمینه و هدف چالش
پروژه یک نمونه اولیه مستقل با طراحی الهام‌گرفته از **torob.com** و **chat.torob.com** است؛ بدون ادعای مالکیت، وابستگی سازمانی، یا دستکاری سایت واقعی. هدف ساخت دستیار خرید حضوری در فروشگاه‌ها، پاساژها و مراکز خرید تهران است. محصول باید کاربر را در چهار مرحله همراهی کند:
1. نیازسنجی، انتخاب مدل و مقایسه محصولات و قیمت‌های ثبت‌شده؛
2. یافتن فروشگاه‌هایی که واقعاً offer محصول را دارند در محدوده کاربر؛
3. مقایسه فروشگاه‌ها براساس قیمت، فاصله، ساعات کاری و شرایط پرداخت؛
4. کمک به استعلام قیمت/موجودی/زمان مراجعه و پیشنهاد جایگزین در صورت عدم پاسخ، تعطیلی یا عدم موجودی.

پروژه باید فارسی، راست‌به‌چپ، mobile-first، با سرعت مناسب و Generative UI واقعی باشد. مجموع امتیاز ۳۰۰ است: محصول ۷۵، UX ۷۵، هوشمندی ۵۰، دیپلوی ۴۰، فنی ۴۰، دیتاست ۲۰. ویدئوی نمایشی حدود ۵ دقیقه **الزامی** است.

## دو رابط، یک منبع حقیقت
- `/` صفحه اصلی **الهام‌گرفته از ترب**: هدر، لوگوی الهام‌گرفته و مجاز، جست‌وجوی کالا/فروشگاه، دسته‌ها، و ورودی خیلی واضح «ترب‌چت — خرید حضوری» در کنار سرچ. به‌وضوح برچسب «نمونه اولیه مستقل هکاتون» داشته باشد.
- `/chat` یک تجربه **مستقل و تمام‌صفحه** شبیه محصول مستقل Torob Chat، با تاریخچه مکالمه، پیشنهادهای آماده، کنترل مکان و بودجه، پنل نتایج و کارت‌های تعامل‌پذیر.
- `/products/[id]` جزئیات محصول و فهرست فروشندگان؛ `/shops/[id]` جزئیات فروشگاه؛ `/compare` مقایسه؛ `/visit-plan` برنامه مراجعه.
- مسیر اول و دوم باید session/deep link مشترک یا حداقل امکان handoff با URL state داشته باشند؛ دو کدبیس مستقل نساز.
- یک shared component library و API مشترک برای هر دو تجربه پیاده کن.
- اگر کنترل واقعی `torob.com` نداریم، هیچ کد یا جمله‌ای نباید ادعا کند که روی دامنه واقعی ترب تغییراتی اعمال شده؛ پروژه روی localhost/دامنه دمو خودمان مستقر می‌شود.
- از تصویر/آیکون واقعی ترب‌چت فقط در صورت امکان دسترسی مجاز به asset استفاده کن؛ در غیر این صورت نشان اختصاصی نزدیک از نظر زبان بصری، نه کپی ادعاییِ دارایی ناشناخته. هیچ تصویر URL یا endpoint غیرواقعی اختراع نکن.

## دیتاست واقعی (اول الزامی: audit)
فایل `data/raw/torob-dataset.zip` را با zipfile/stream inspect کن، به صورت امن و chunked استخراج و import کن. ساختار بررسی‌شده:
- `shops.csv`: **6,476** rows. Columns: `address, category_names, contacts, instagram, lat, location_label, lon, name, payment_options, shop_id, supports_fast_delivery, website_url, weekly_hours`.
- `products.csv`: **225,903** rows. Columns: `brand_name, category_name, image_urls, model, persian_title, product_id, specs`.
- `offers.csv`: **331,506** rows. Columns: `description, last_price_changed_at, offer_id, price_toman, product_id, seller_title, shop_id, warranty`.
- CSV fields may contain JSON-encoded arrays/objects and literal string `null` (not just empty cells). Inspect actual field shape before mapping.
- Monetary values are in **تومان** (`price_toman`). Never convert them to ریال by mistake; store exact integer/bigint appropriately.
- `offers` is the only evidence linking a PARTICULAR shop to a PARTICULAR product. Shop category alone is **NOT** proof of stock or an offer.
- Roughly 6,364 of 6,476 shop names are anonymized/fake. ALL phone numbers are fictional. **Never dial, WhatsApp, text, or expose these as real contact points.** 112 shops have website/Instagram data (90 websites, 22 Instagram accounts), but still do not assume their dataset phone numbers are real.
- Positions are supplied for 6,476 shops; 4,473 have nonempty weekly hours; 266 have nonempty payment options; 224,684 products have image URLs and 144,599 have specs (measured from this archive).
- Sampled `last_price_changed_at` spans 2020-12-03 to 2026-10-13. Always show exact offer timestamp and a freshness status. Do NOT claim today's verified price/inventory or verified open-now based on a dataset snapshot.
- ~3,179 address strings mention `پاساژ`, ~4,224 mention `طبقه`, ~2,380 mention `واحد`, which can power in-mall guidance when present. Do not invent missing floor/shop identifiers.

Build `scripts/audit-dataset` that reports row counts, column names, missingness, duplicates, foreign key gaps, prices, timestamps, geocoordinate validity, JSON parse errors, and per-feature coverage; write results to `docs/data-audit.md`. Import should be idempotent and resilient to malformed rows, with validation and useful logs. Do not commit the huge ZIP, generated CSVs, .env, secrets, or database dump to Git. Preserve source IDs and provenance.

## فناوری (پیش‌فرض؛ تغییر تنها با دلیل واضح در plan)
- Node.js LTS (prefer 22+), Next.js App Router + TypeScript + React, Tailwind CSS, shadcn/ui with RTL support, Lucide icons, a legible Persian font legally distributed through CSS or local assets as permitted.
- PostgreSQL + Prisma or Drizzle; JSONB for optional nested fields; proper indexes on IDs, offer.product_id, offer.shop_id, price, timestamps, and location. Geographic nearest-neighbor may initially use bounding-box SQL plus Haversine server-side; do NOT assume PostGIS is provisioned on Liara. For Persian search implement Unicode normalization (`ي→ی`, `ك→ک`, diacritics removal, zero-width chars, Persian/Arabic digit normalization) and server-side index/search (pg_trgm if available; fallback deterministic search). Support fuzzy ranking, relevance, pagination and query timing metrics.
- AI SDK (`ai`, `@ai-sdk/react`) or equivalent **tool-calling** runtime with Zod input/output validation, server-side tool handlers, multi-step tool use, graceful provider fallback; use compatible env-configured AI provider. Streaming is preferred when reliable. Do not leak API keys to clients. Never treat model-written product IDs/prices as trustworthy: all facts must come from database tool results.
- React Leaflet/MapLibre with OpenStreetMap tiles subject to provider usage rules; map fallback with store list when tiles/network unavailable. Geolocation only with user consent, plus manual Tehran neighborhood selection and map pin. Haversine is straight-line distance, not walking/driving travel time; link to verified external map deep-links where appropriate rather than invent ETA.
- Testing: Vitest for data/domain logic, Playwright for mobile+desktop E2E where feasible, basic accessibility checks, lint/typecheck/build. Need `.env.example`, Dockerfile or verified Liara Next.js configuration, health endpoint, README, deploy guide.

## شکل محصول و UX، نه فقط چت
Visual direction: professional Torob-adjacent palette (red primary, white neutrals), compact cards, sticky chat composer on mobile, logical RTL spacing, real product photos from permitted image URLs with placeholders, accessible contrast, loading skeletons, focus-visible and keyboard interactions, mobile bottom navigation, readable Persian numerals and تومان formatting. Explicit Demo badge and source/freshness labels; do not mix mock outcomes with real records.

Pages/screens to implement:
1. Landing/search: product search, quick prompts, category browse, highlighted «با ترب‌چت حضوری بخر», responsive layout.
2. Chat: welcome suggestions and guided conversation with clear steps, chat stream, interactive result cards, editable chips for بودجه / محدوده / کاربرد / اقساط / زمان مراجعه, side-by-side search/map on desktop, stacked bottom sheet on mobile.
3. Product discovery: display true products from dataset with image, price *range where offers exist*, brand, specs; explain recommendation; ask only high-value follow-ups (purpose, price, preferences). Support comparing 2–4 valid products on specs and recorded prices.
4. Shops: show only linked shop offers, list/map toggle, source timestamp, price, shop address, distance when location provided, reported hours and payment features. Clicking card opens location detail and in-mall textual hint.
5. Comparison: side-by-side seller comparison table/cards for same product, sorting/filtering by price/distance/likely working-hours and *confirmed in-person installment channel*. Show unknown states explicitly.
6. Contact/pre-visit: prewritten Persian inquiry with product/model, offer timestamp, price and questions («آیا موجود است؟ قیمت امروز؟ امکان مراجعه؟ طبقه و واحد؟»). Only copy/share to permitted **real** publicly listed channel after user action; no fake phone communication. All other cases show «شماره داده‌شده آزمایشی است؛ تماس واقعی ممکن نیست» and optionally a **clearly labeled SIMULATED** seller-response flow for judges. Persist simulated contact result with provenance and timestamp, not as factual verification.
7. Alternatives: in case of out-of-stock / no reply / closed: equivalent stores with the *same product* first, then similar products in the same category and user budget; preserve location and installment constraints. Explain tradeoffs, clearly disclose when relaxing a constraint and only with user approval.
8. Visit planner: shortlist, visit checklist, map pins, preferred hours according to supplied weekly schedule with timezone `Asia/Tehran`; don't claim a shop is currently open with certainty. In-mall navigation extracts پاساژ/طبقه/واحد **only if present**.
9. Settings / trust explanation: explanation of demo, dataset scope (selective Tehran sample), fake identities/phones, price age, verification labels, location privacy, AI provider mode.

Reusable Generative UI components (data-driven, never raw AI-generated HTML): `ProductCard`, `ProductCarousel`, `ProductCompareTable`, `ShopCard`, `StoreComparison`, `ShopMap`, `FilterBar`, `PriceFreshnessBadge`, `VerificationStatus`, `InstallmentBadge`, `HoursBadge`, `LocationPicker`, `InquiryDraft`, `ContactStatusTimeline`, `AlternativeOfferPanel`, `VisitPlan`, `InMallDirections`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `SourceLabel`, `ToolEventStep`, `ConfidenceExplanation`. Tool output should be transformed into typed UI block descriptors; render through a registry with known schemas and safe fallbacks. Every action/button must work, change state, or explain why disabled; avoid decorative placebo controls. Buttons/cards should let the user continue without sending a chat message for every small action.

## Data contract / trust policy
Every offer in API responses should include `product_id`, `shop_id`, `offer_id`, `price_toman|null`, `last_price_changed_at|null`, `source='torob_hackathon_dataset'`, `price_status='recorded'`, `stock_status='unknown'` by default; separate `verification_status` with values `unknown | simulated | seller_confirmed` (seller_confirmed only if independently legitimate, provable direct verification occurred). Provide recorded hours as `schedule_status='reported'`, no certainty about live status. Support price freshness thresholds as a transparent UX rule and show age in days. Missing values must not be silently set to zero or 'available'. Distinguish `payment_options.channel='in_person'` vs `unknown` clearly; strict installment filter includes only documented in-person entries, never guessing based on provider name/category. An unknown provider channel is not automatically eligible.

## Real agent logic: stateful workflows + safe tools
Implement a conversational purchase-session state: intent, product constraints, budget min/max, user manual/GPS location, radius, preferred shop hours, date, needs-installment, selected products/offers, candidate stores, verified-vs-unknown contact information, and task timeline. Use persistent client or server session state (no sensitive geolocation logged by default).

Define *working* server-side tools with Zod schemas:
- `searchProducts(query, category?, budget?, limit?, cursor?)`
- `getProductDetails(productId)`
- `compareProducts(productIds[])`
- `getProductOffers(productId, filters, pagination)`
- `findNearbyStores(productId, latitude?, longitude?, radiusKm?, installmentOnly?, visitAt?)`
- `getStoreDetails(shopId)`
- `compareOffers(productId, offerIds[])`
- `getStoreHours(shopId, dateTimeTehran)`
- `getPaymentOptions(shopId)`
- `buildInquiryDraft(shopId, productId, offerId)`
- `recordInquiryStatus(offerId, status, channel, provenance)` only for user-entered/simulated states and never forge seller-confirmed state
- `findAlternatives(productId, constraints, reason)`
- `buildVisitPlan(offerIds[], location?, day?)`
All tools must query real DB, return bounded/typed values, observe rate limits, and be auditable. The LLM chooses tools and human-like explanation but **does not author unsupported inventory/prices/hours or mark fake contact as real**. Implement deterministic orchestration fallback if LLM key fails. Fail gracefully in Persian.

## Search, ranking and recommendation
Normalize Persian input; recall both title, brand, category, seller_title; return only genuine product rows and offer rows. Search boosts title/phrase match, category fit, budget, specs and coverage by shops. Ranking explanation should be human-readable and derived from factors. Offer ranking may use user preference weights: 30% price (available only), 25% distance (only with location), 20% schedule fit (only if recorded), 15% price freshness, 10% in-person-payment fit (only if known). Re-normalize weights over available evidence; do not pretend missing data has score 0. Hard filters (budget maximum, installment channel, radius) take precedence over rank, and never silently exclude all results without an explanation/reset filter. Show distances in kilometers as straight-line distances; do not fabricate travel time. Provide proper pagination. Keep comparison within genuinely matching products rather than similarly named but different variants.

## Contact reality and simulation safety
All dataset phone numbers are fake. Do NOT initiate real calls, WhatsApp, SMS, external email or outreach using them. 90 website and 22 Instagram fields may support an external link/pre-filled inquiry (if terms permit) with a clear user click, never unattended automated outreach or scraping. If wanting to demonstrate follow-up automation, add a visible `DEMO_CONTACT_MODE=true` switch with deterministic simulated responses such as «موجود»، «ناموجود»، «پاسخ نداد»، «قیمت تغییر کرد» and traceable provenance `simulation`. Never silently contaminate verified records. If external real communication becomes possible later, require verified, permitted contact source, user confirmation, status evidence and explicit audit trail.

## API and code design
Prefer the following (adapt to codebase after audit):
```
app/
  page.tsx
  chat/page.tsx
  products/[id]/page.tsx
  shops/[id]/page.tsx
  compare/page.tsx
  visit-plan/page.tsx
  api/chat/route.ts
  api/products/route.ts
  api/products/[id]/offers/route.ts
  api/shops/route.ts
  api/shops/[id]/route.ts
  api/health/route.ts
components/
  shared/
  chat/
  generative-ui/
  search/
  map/
  product/
  shop/
lib/
  db/
  dataset/
  search/
  ranking/
  agent/tools/
  validation/
  privacy/
scripts/
  audit-dataset.ts
  import-dataset.ts
  smoke-test.ts
prisma/ or drizzle/
tests/
docs/
  architecture.md
  data-audit.md
  safety-and-trust.md
  deploy-liara.md
  demo-script.md
AGENTS.md
STATUS.md
IMPLEMENTATION_PLAN.md
.env.example
README.md
```
Expose sane filters and cursor pagination. Handle input errors, SQL injection via parameterized queries, XSS prevention, HTML sanitization/React escaping, SSRF-safe external references, CORS/CSRF as applicable, timeouts, secrets hygiene. Add tool-call logging without sensitive location/phone leaks. Ensure no unbounded rendering/query on 331k offers.

## Production and deploy
Local: `pnpm install`, `pnpm db:migrate`, `pnpm data:audit`, `pnpm data:import`, `pnpm dev` and test equivalents; document and actually verify commands. Use `.env.example` for `DATABASE_URL`, `AI_API_KEY`, `AI_BASE_URL`/provider options, `AI_MODEL`, `DEMO_CONTACT_MODE`, public app URL and optional map config; no real secrets committed. Keep Vercel/provider env implementation flexible. Build + start must run. Liara: refer to current official docs; choose supported Next.js/Node/Docker hosting, managed PostgreSQL, correct migrations/import, health check, resource estimates, request logs, environment setup, and independent deployment URL. Do not assume ephemeral container files hold permanent DB state. If runtime doesn't have Liara credentials, prepare scripts/docs and explicitly indicate deployment requires owner approval. Prefer a single deployable application with `/` and `/chat` routes; only add a separate subdomain through DNS/rewrite when feasible without duplicating backend.

## Acceptance tests: all critical
1. Direct visit `/` and `/chat` loads Persian RTL with TorobChat action.
2. A real query (e.g. `شارژر اپل ۲۰ وات` or `هدفون انکر R50i`) retrieves actual products with exact dataset IDs and valid images; no placeholders pretending real product records.
3. Real product has joined offers, compares vendor offers, and displays recorded price and recorded last-change timestamp distinctly.
4. Apply user-set budget and location/radius -> result list/map changes; no GPS permission still works via Tehran neighborhood picker.
5. Strict in-person installment filter only passes `channel='in_person'`; unknown fields are explicitly marked unknown.
6. Similar alternative model and alternative shop work on out-of-stock and unanswered simulation paths, preserve constraints.
7. Recorded shop schedule / address with actual mall/floor/unit displays correctly; unsupported fields absent or unknown.
8. Attempted call to dataset fake number **never occurs**. Simulated status visibly says شبیه‌سازی, not seller-verified.
9. All cards and chat actions work on a 390px mobile viewport and desktop; no RTL clipping, keyboard accessibility.
10. Refresh/deep-link works. Empty state / missing image / missing price / invalid geo / unavailable AI key / DB failure all have honest error states.
11. Validate row counts after import; spot-check relationships and price conversion; representative queries are reasonably fast.
12. `lint`, `typecheck`, `test`, `build` and E2E smoke test pass, or failed checks are openly listed with precise reproduction steps.
13. Local `pnpm start` or Docker execution passes `/api/health`; deployment instructions verified to available extent.
14. Five-minute end-user demo storyline recorded in `docs/demo-script.md`, featuring product recommendation, comparisons, map/radius, strict financing, seller inquiry (demo simulation), alternative, visit checklist, second standalone UI entry.

## Implement in stages (Do not stop after stage 1)
- Stage 0: inspect repo/environment/ZIP; generate `docs/data-audit.md`, `IMPLEMENTATION_PLAN.md`, `.gitignore`, `STATUS.md`. Detect existing code, reuse working parts.
- Stage 1: project foundation, DB schema+migrations+reliable importer, data test + search endpoints.
- Stage 2: responsive Torob-inspired homepage and standalone chat, shared design system, typed product/store cards and comparisons.
- Stage 3: agent tool calls, user-state, filtering, map, price freshness, strict installment and valid offer joins.
- Stage 4: contact draft/simulation safety, alternative flow, mall directions, visit plan, edge cases.
- Stage 5: quality, accessibility, tests, fixes, deploy preparation and demo script.
- Stage 6: if authorized/configured, deploy and smoke-test public URL; otherwise state EXACT outstanding external prerequisites and provide verified local result.

At the end of each stage: run appropriate checks, update `STATUS.md` with Done / In progress / Blocked and actual evidence; commit logical changes when possible. If an action is blocked, continue independent local work. Do not mark tasks complete on appearance alone. Do not replace functionality with polished static screens. Keep data factual and user-facing Persian copy excellent.

## Final required report
At completion respond **in Persian** with: repository/file tree summary, implemented vs demo-simulated vs blocked feature matrix, database row counts and sample product IDs, exact local launch commands, actual test results, project/demo URLs only if real, Liara deployment status, five-minute presentation route and known limitations. Build the app fully before this report.
