# Dataset audit

Full streaming audit completed 2026-10-23T14:03:32.194Z. Only exact ZIP members are read; no extraction or contact values are logged.

All monetary amounts are exact integer toman. Phone contacts are fabricated and excluded from application database. IDs are preserved. An offer is the sole product–shop relationship.

## products
Rows: **225,903**. Duplicate IDs: 0.
Columns: brand_name, category_name, image_urls, model, persian_title, product_id, specs
Foreign key gaps: {"product_id":0,"shop_id":0}. Invalid coordinates: 0; prices: 0; dates: 0. Unsafe JavaScript integer prices: 0 (stored exactly as PostgreSQL bigint; API numeric price is unknown for these anomalous values).
Price range (toman): unknown–unknown. Timestamp range: unknown–unknown.

| Field | Missing (empty or literal null) |
| --- | ---: |
| brand_name | 168269 |
| category_name | 0 |
| image_urls | 0 |
| model | 221847 |
| persian_title | 2 |
| product_id | 0 |
| specs | 0 |

JSON parse errors: {}
Feature coverage: {"image_urls":224684,"specs":144599}

## shops
Rows: **6,476**. Duplicate IDs: 0.
Columns: address, category_names, contacts, instagram, lat, location_label, lon, name, payment_options, shop_id, supports_fast_delivery, website_url, weekly_hours
Foreign key gaps: {"product_id":0,"shop_id":0}. Invalid coordinates: 0; prices: 0; dates: 0. Unsafe JavaScript integer prices: 0 (stored exactly as PostgreSQL bigint; API numeric price is unknown for these anomalous values).
Price range (toman): unknown–unknown. Timestamp range: unknown–unknown.

| Field | Missing (empty or literal null) |
| --- | ---: |
| address | 1 |
| category_names | 0 |
| contacts | 0 |
| instagram | 6454 |
| lat | 0 |
| location_label | 1 |
| lon | 0 |
| name | 0 |
| payment_options | 0 |
| shop_id | 0 |
| supports_fast_delivery | 4875 |
| website_url | 6386 |
| weekly_hours | 0 |

JSON parse errors: {}
Feature coverage: {"category_names":4679,"contacts":6476,"weekly_hours":4473,"پاساژ":3179,"طبقه":4224,"واحد":2380,"website_url":90,"payment_options":266,"payment_channel_unknown":211,"payment_channel_in_person":174,"instagram":22}

## offers
Rows: **331,506**. Duplicate IDs: 0.
Columns: description, last_price_changed_at, offer_id, price_toman, product_id, seller_title, shop_id, warranty
Foreign key gaps: {"product_id":0,"shop_id":0}. Invalid coordinates: 0; prices: 0; dates: 0. Unsafe JavaScript integer prices: 11 (stored exactly as PostgreSQL bigint; API numeric price is unknown for these anomalous values).
Price range (toman): 1–733518940747298944. Timestamp range: 2020-12-03T08:51:32.129Z–2026-10-13T00:02:35.297Z.

| Field | Missing (empty or literal null) |
| --- | ---: |
| description | 293129 |
| last_price_changed_at | 769 |
| offer_id | 0 |
| price_toman | 15083 |
| product_id | 0 |
| seller_title | 0 |
| shop_id | 0 |
| warranty | 272563 |

JSON parse errors: {}
Feature coverage: {}

## Interpretation

Coverage is dataset evidence only: prices are recorded, stock is unknown, hours are reported. Payment channels marked unknown cannot satisfy strict in-person financing. Freshness UI thresholds are 0–7 days recent, 8–30 aging, >30 stale; future dates are unknown. Address tokens are shown only when present. This selective Tehran dataset is not a complete inventory or live merchant directory.
