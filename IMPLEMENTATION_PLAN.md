# Torob In-Person Assistant — Implementation Plan

Spec: CODEX_MASTER_PROMPT.md (read completely), AGENTS.md.
Execution: implement locally, continuously verify, no production deployment or outreach without explicit approval.

## Architecture and decisions
- One Next.js App Router application, strict TypeScript, Persian RTL red/white design, shared typed components and API.
- Local database: PGlite, the PostgreSQL engine compiled to WASM, persists under ignored data/db. No PostgreSQL daemon exists locally. Production uses pg with DATABASE_URL and identical parameterized PostgreSQL SQL; Drizzle schema documents types/indices. This is an explicit infrastructure adaptation, not a dataset substitute.
- All 225,903 products, 6,476 shops, 331,506 offers imported from ignored original ZIP using bounded streaming batches. No mock product catalog. Real IDs preserved.
- Safe typed server tools, Zod input validation, OpenAI-compatible configurable tool loop, deterministic transparent mode without key. Model cannot author product/price facts in cards.
- Leaflet/OSM interactive map, manual Tehran neighborhood or consented GPS, list fallback and straight-line distances.
- Sessions and visit selections persist in localStorage; geolocation stays in current browser state, not telemetry. Inquiry records distinguish user-entered / simulation and never seller-confirmed.

## Stages
- [x] 0. Copy original spec/ZIP, audit columns/counts/nulls/JSON/keys/coverage/prices/dates/geography; write docs/data-audit.md.
- [x] 1. DB schema/migrations/import, normalized indexed search, bounded product/shop/offer APIs and health.
- [x] 2. Shared polished home/chat/product/shop/compare/visit/settings routes, responsive cards and filters.
- [x] 3. Validated tool registry, tool events and typed Generative UI, stateful chat, ranking, strict installment, location/map.
- [x] 4. Inquiry draft and explicit simulation timeline, constrained alternatives, schedule and mall details, visit checklist.
- [ ] 5. Unit/data/API/E2E/accessibility checks, lint/typecheck/build/start; docs and Liara/Docker preparation.
- [ ] 6. Production deployment only after owner approval and credentials; otherwise record prerequisites.

## Parallel ownership and integration contracts
Data engineer owns src/lib/db/**, src/lib/domain.ts, src/lib/catalog.ts, src/lib/contracts.ts, scripts/audit-dataset.ts, scripts/import-dataset.ts, scripts/db-migrate.ts, src/app/api/products/**, src/app/api/shops/**, src/app/api/health/**, drizzle/**, tests/data*.ts, docs/data-audit.md.
UI engineer owns src/app pages/layout/globals.css, src/components/**, src/lib/client.ts and src/lib/session.ts. Agent engineer owns src/lib/agent/**, src/app/api/chat/**, src/app/api/tools/** and tests/agent*.ts. Lead owns package/config, integration tests, docs and final fixes by coordination.

## Verification focus
Hard filters precede rank; unknown price/hours/payment remain unknown; exact product/offer IDs and duplicate-shop offers preserved; old requests cannot replace new selection; no fake phone links; no raw AI HTML; API limits/timeouts/body schemas; missing AI/DB/tiles yield honest usable states; 390px/1440px; all counts match original archive.

## Screenshot-guided chat refresh — 2026-10-22
- [x] Use the user-supplied screenshot as visual reference: dark canvas, right conversation rail, centered welcome and rounded composer.
- [x] Keep the independent prototype identity, original vector mark, real typed results, provenance, purchase filters and existing shared APIs.
- [x] Preserve local conversations; provide desktop rail collapse and mobile/tablet drawer. Do not reproduce account identity, subscription banner or unsupported voice controls.
- [x] Verify build, lint, TypeScript, domain tests and desktop/mobile shopping regression suite; manually inspect 390px, 700px and desktop layouts.

## Live reference capture — 2026-10-22
- [x] Inspect user-opened real guest page via browser; save observed assets, static sanitized HTML, typography/geometry and desktop/mobile/menu/login screenshots in an ignored reference ZIP.
- [x] After user login, capture one sample response: product/seller cards, comparison table, sources, product preview and seller rating tooltip on desktop/mobile. Keep account credentials/history out of the reference bundle; no purchase/contact actions.

## Apply captured reference to in-person chat — 2026-10-22
- [x] Horizontal product cards with real specs and accessible product preview; preview uses the same product/offers API and preserves all purchase filters.
- [x] Per-response source panel from typed blocks and tool events, copy response, 64px collapsed rail, compact seller cards and readable comparison tables.
- [x] Keep recorded price/unknown stock/source IDs, inquiry simulation and visit planner; no seller ratings, subscriptions, contacts or reference-site prices imported.
- [x] Verify new preview/source/error paths plus existing mobile/desktop tests, lint, typecheck, unit suite, build and running local app.

## Backend intelligence, 9router, maps and inquiry — 2026-10-22
- [x] Use raw user messages, bounded conversation history and typed record references in a provider-neutral tool agent; grounded IDs and hard filters enforced on the server, transparent deterministic recovery.
- [x] Connect existing local 9router endpoint/key; configurable model, request/tool/token/time limits, persistent daily request cap and key-free status API. No provider or account changes.
- [x] Improve OSM map framing, marker deduplication and network failure fallback; optional name/location-matched Commons place media with attribution, loaded on user request.
- [x] Distinguish user-reported inquiry outcomes from explicit simulation; no fabricated phone outreach or seller confirmations.
- [x] User requested no scenario reruns: perform lint/typecheck/build and read-only provider-model discovery only; do not claim live model or E2E execution.
- Framework decision: retain the existing validated OpenAI-compatible tool runtime, organized as context → guarded tool execution → grounded presentation. LangChain/LangGraph is not an established judging requirement and adds no data authority by itself; document the equivalent stateful workflow honestly.

- Verification boundary: provider model-list HTTP 200; configured model present. No chat completion, unit/E2E scenario reruns or live imagery coverage claim in this integration, per user request.

## Embedding-first hybrid retrieval — 2026-10-23
Design: docs/superpowers/specs/2026-10-23-embedding-retrieval-design.md. Execution: docs/superpowers/plans/2026-10-23-embedding-retrieval.md.
User delegates framework choice; preserve validated runtime and add independent BoxAPI embeddings + pgvector. No automatic bulk embedding spend; keep 9router LLM separate. Key file path pending. No live scenario reruns.

- [x] Embedding provider/store/hybrid retrieval/pre-LLM context, resumable dry-run ingestion, status UI and BoxAPI docs implemented and verified offline.
- [x] Activation: user supplied the BoxAPI key and explicitly approved a bounded job of 16 laptop products and one request; vectors are stored and locally verified. Coverage remains limited to 16 of 225903 products; full-dataset indexing is not authorized or completed.

## Fix conversational credit-laptop failure — 2026-10-23
- [x] Reproduce HTTP 503 from chat and plain product search; isolate strict-empty SQL count bindings with 4 failing real-PostgreSQL regression cases.
- [x] Repair count-query bindings without dropping price/category constraints; recognize credit purchase and conversational laptop/store intent.
- [x] Audit actual linked laptop installment offers and run the original message end-to-end.
- [x] Keep LLM on 9router per explicit user choice; diagnose its independent HTTP 503, without switching to BoxAPI or changing account permissions.
- [x] Run focused regressions, full unit suite, lint/typecheck/build, restart and verify browser/API outcome; truthful status and remaining upstream blocker.

- Previous upstream blocker: Antigravity OAuth token expired and refresh failed (dashboard HTTP 401). On 2026-10-23 the user supplied a new local 9router API key; private configuration was updated, the app restarted, and live model/tool-calling requests succeeded. OAuth invalid_grant root cause itself was not established; the verified current API path works. LLM remains on 9router and embeddings remain separate on BoxAPI.

## Apply user-provided local 9router key — 2026-10-23
- [x] Confirm key destination with user; save only to ignored private .env.local with permissions 0600.
- [x] Verify model discovery and one bounded completion on existing ag/gemini-3.8-flash-low.
- [x] Restart verified project process; test original credit-laptop request through /api/chat: HTTP 200, mode=provider, two model requests, three tool calls, actual eligible offers.
- [x] Record remaining empty embedding index without claiming semantic indexing is active.

## User-selected DeepSeek via 9router — 2026-10-23
- [x] Discover actual DeepSeek model ID, configure oc/deepseek-v4.1-flash-free in private environment, preserve BoxAPI embeddings and credentials.
- [x] Verify direct tool call (HTTP 200, 32.8 seconds); extend the bounded turn timeout from 30 to 60 seconds and restart.
- [x] Test original message through the app and record partial success: provider/tool execution with real eligible offers, but a later model request reaches the 60-second turn timeout. Keep transparent fallback; do not claim a fully completed model chain or change provider without request.

## Fix redundant provider rounds and misleading fallback copy — 2026-10-23
- [x] Verify current status without model spend: 83 local requests remain, DeepSeek configured, embedding index empty.
- [x] Write regression tests for sufficient store/offer results, continued comparison workflow (Persian/Arabic characters), and precise failure reasons.
- [x] Complete simple validated store/offer lookups without a redundant model round; preserve compound workflows and hard constraints.
- [x] Run full checks, restart, perform one bounded live scenario, and record exact outcome: local checks pass, but DeepSeek's first response still times out at 60 seconds. No complete live provider success claimed.
- [x] With explicit user approval, execute one BoxAPI request for 16 laptop products; verify stored vectors and nearest-neighbor retrieval without another embedding API call, restart and check readiness.
- Remaining external limitation: responsiveness of oc/deepseek-v4.1-flash-free through 9router; configuration and key alone do not ensure timely responses. The app's transparent fallback remains necessary.


## تحویل خرید حضوری و اصلاحات کاربر — ۲۳ اکتبر ۲۰۲۶
- [x] حذف کاتالوگ جدا و هدایت `/` به `/chat`؛ جزئیات و مقایسه در جریان خرید حفظ شدند.
- [x] رابط با نام «ترب‌چت — دستیار خرید حضوری»، رنگ‌های مرجع و GIF محلی؛ حالت کاهش حرکت PNG ثابت دارد. اولویت فروشگاه و مراجعه حضوری است.
- [x] مسیر نشان فقط روی offerهای همان محصول با قیود سخت، پیاده/خودرو، کمترین زمان میان مقصدهای منتخب و اتصال چند توقف؛ بدون کلید زمان نامشخص می‌ماند.
- [x] صف استعلام پایدار، مالکیت پرونده، تأیید هزینه و تب پیگیری؛ درگاه واقعی فقط زیرساخت قابل تنظیم است و تماس نمایشی صریحاً صفرهزینه است.
- [x] اقدام مستقیم فروشگاه/نزدیک/اعتباری بدون مدل و امبدینگ؛ کش محدود نشان و ابزارهای کمتر برای درخواست ساده.
- [x] بازبینی امنیتی، اصلاح سقف روز اعزام، حذف نشت رجیستری و رفع توقف صف بر اثر quote قدیمی، همراه تست رگرسیون.
- [x] lint/typecheck/build موفق؛ ۱۳۲ تست واحد/یکپارچه، ۳۲ E2E موبایل/دسکتاپ و ۶ بررسی تولید روی آدرس localhost موفق. اسکن سورس، نبود credential در static و ZIP/manifest معتبر تأیید شد.
- [x] راهنمای سرویس، انتشار، demo و بستهٔ سورس بدون کلید؛ اجرای محلی از START_LOCAL.sh.
- [ ] اتصال و تأیید زنده نشان، درگاه تماس مستقل با مخاطب مجاز، استقرار لیارا و ضبط ویدئو؛ این موارد در این تحویل انجام نشده‌اند.


## تغییر دیتاست و اتصال هر دو سرویس به BoxAPI — ۲۳ اکتبر ۲۰۲۶
- [x] بستهٔ بک‌اند ۴۸فایلی به‌عنوان داده/مرجع بررسی شد؛ دستورها و کد آن اجرا/ادغام خودکار نشد. ZIP داخلی با نسخهٔ قبلی دقیقاً هم‌هش است و به‌صورت atomic جایگزین شد.
- [x] SQLite کامل audit فقط‌خواندنی: quick_check=ok، شمارش کامل و صفر orphan. کد موجود و قراردادهایش حفظ شدند.
- [x] تنظیم خصوصی چت BoxAPI/gpt-6-luna و امبدینگ BoxAPI/Small1536؛ GPT مدل بردارساز نیست. کلید و نسخهٔ قبلی پیکربندی فقط در فایل‌های خصوصی 0600.
- [x] رفع پارامترهای مدل با RED→GREEN: max_completion_tokens، حذف temperature، reasoning_effort=none برای ابزارهای Luna؛ تست واقعی منطق برنامه یک درخواست/یک ابزار و mode=provider بدون fallback داد.
- [x] به‌علت فرایند خارج از دسترس پورت قبلی، ساخت و دیتابیس نسخهٔ نهایی جدا شدند؛ همهٔ ۲۲۵۹۰۳/۶۴۷۶/۳۳۱۵۰۶ رکورد با rejected=0 وارد شدند. DB قبلی حفظ شد و استعلام‌های قبلی خودکار منتقل نمی‌شوند.
- [x] تکمیل UI تدریجی، آیکون ثابت جز پاسخ فعال، پنل‌های کالا و فروشگاه روی OSM، منابع و مقایسه با قیود واقعی. فونت فعلی طبق تأیید کاربر حفظ شد.
- [x] بازبینی مستقل: مشکل ادعای نامعتبر در متن آزاد مدل با واژگان/شکل محدود نیازسنجی و تست‌های بازتولید رفع شد. قیمت/موجودی/تماس از متن مدل پذیرفته نمی‌شود.
- [x] ۱۷۷ تست در ۱۶ فایل و lint/typecheck/build موفق؛ ۴۲ E2E دسکتاپ/موبایل پس از اصلاح لینک، انتظار done و جداسازی مشتری‌های تست موفق.
- [x] تأیید نهایی مرورگر، سلامت و اتصال BoxAPI/Small-ready روی localhost:3103؛ سورس با سازندهٔ دارای اسکن credential/manifest بسته‌بندی می‌شود. انتشار عمومی و تماس واقعی انجام نشده است.

## Focused LLM replies and seller map — 2026-10-23

- Removed unsolicited pre-model retrieval panels and disabled their automatic embedding request; model-selected precise queries remain data tools.
- Valid model prose is the reply, without appended deterministic dataset paragraphs. Missing/unavailable provider retains explicit fallback.
- Product candidates stay internal when a final seller/alternative/comparison result exists. Model product discovery is resolved to actual product-offer-shop matches before recommendation display.
- Shared per-turn presentation window: at most five recommendations, unique shops for seller offers, no repeated offers. Bounded round-robin discovery favors different matching products without relaxing filters.
- Dedicated `/map` reloads at most five offer IDs from DB; price pins and seller choices select one exact offer/product. Preview background/full-map link preserves selection; navigation waits for completed chat to preserve history.
- Legacy stored retrieval panels are hidden on restore. Real stage progress includes an accessible reduced-motion-aware indicator.
- Integration testing in progress. Initial browser run exposed wrong configured origin for new port and overlapping price labels; both are under correction before final build. No production deployment, seller outreach or bulk embedding index.

## Handoff on user request — 2026-10-23

- User requested final runnable version and explicitly stopped further testing. No additional app tests or paid live checks after that instruction.
- Final production build succeeded; runtime uses localhost:3104, .next-focused, and the freshly imported full dataset. Private BoxAPI configuration retained.
- Known limitation remains: direct marker clicks in the small mobile preview can navigate instead of selecting; seller list and dedicated map selection are alternatives. Do not claim the E2E suite is entirely green.
- Latest source archive: releases/torobchat-focused-map-source.zip. Public deployment remains unauthorized/not performed.

## ۲۰۲۶-۱۰-۲۳ — خروجی مرتب و پاسخ واحد پس از بررسی مدل
- درخواست اصلاح‌شده: LLM ابزارهای خواندن دیتاست را انتخاب و نتیجه را بررسی کند؛ هیچ پنل اولیه پیش از پاسخ نهایی نشان داده نشود.
- [x] حذف پایان زودرس مدل، افزودن انتخاب مستند شناسه‌های نهایی و تست منع نمایش نتیجه میانی.
- [x] هماهنگی کارت محصول و فروشنده نقشه با زمینه روشن و قرمز ترب؛ سبک‌سازی بارگذاری بخش‌های جانبی چت.
- [x] دو پروفایل optimized و boxapi روی کد و DB مشترک؛ هر دو دارای مسیر LLM و fallback صریح.
- [x] README گیت‌هاب، راهنمای اجرای دو نسخه و سناریوی پنج‌دقیقه‌ای هکاتون.
- [x] lint/typecheck/test/build و آزمون مرورگر، سپس دو ZIP سورس بدون داده/کلید.
- فایل‌های خام و بک‌اند دریافتی محفوظ‌اند: data/raw/torob-dataset و archive/02-backend-complete-2026-10-22. این پوشه‌ها نباید در سورس انتشار قرار بگیرند.

اعتبارسنجی این تحویل: 207 تست واحد/داده، 48 آزمون مرورگر، lint/typecheck، build دو پروفایل و smoke تولید موفق. کلید واقعی BoxAPI، ویدئوی ضبط‌شده و استقرار عمومی پیش‌نیازهای بیرونی باقی‌اند؛ در STATUS.md به‌صراحت تفکیک شده‌اند.

## اصلاح پس از کلید واقعی — ۲۳ اکتبر ۲۰۲۶
- [x] تنظیم خصوصی کلید و بررسی مستقیم سرویس، بدون چاپ credential.
- [x] بازتولید «لامپ میخوام» و ثبت علت حذف سؤال طبیعی و درخواست زودرس مکان.
- [x] اصلاح guidance، حفظ پاسخ معتبر به جای متن خالی و جست‌وجوی محصول قبل از فیلتر مکانی اختیاری.
- [x] 217 تست، lint/typecheck، دو build و دو نوبت واقعی متصل به BoxAPI در مرورگر.
- [x] بسته‌بندی اصلاح‌شدهٔ v2 با env خالی، جدا از ZIPهای قبلی.

## سه سناریوی خرید حضوری برای ارائه — ۲۳ اکتبر ۲۰۲۶
- [x] بررسی قرارداد محصول و تطبیق سناریوها با کالا/پیشنهاد واقعی دیتاست؛ تنظیم کلید جدید فقط در دو env خصوصی با مجوز 0600.
- [x] متن فارسی مراحل و گوینده برای هدفون دو میلیون، Dell اعتباری تا ۷۰ میلیون و بورس‌یاب لوستر؛ صفحه `/demo` با لینک‌های شروع و جزئیات.
- [x] شروع مستقل سناریو با جایگزینی شرایط خرید، حفظ تاریخچه و عدم ارسال خودکار پیام به مدل.
- [x] lint/typecheck، 221 تست واحد/داده، build پروفایل BoxAPI و 8 بررسی مرورگر موبایل/دسکتاپ موفق؛ سه نوبت چت زنده و پرسش نقشه هم بدون fallback موفق شدند. نتیجه واقعی و محدودیت‌ها در ابتدای STATUS.md ثبت شد؛ تماس واقعی و انتشار عمومی انجام نشده است.
