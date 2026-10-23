CREATE INDEX IF NOT EXISTS offers_product_id_idx ON offers(product_id);
CREATE INDEX IF NOT EXISTS offers_shop_id_idx ON offers(shop_id);
CREATE INDEX IF NOT EXISTS offers_price_idx ON offers(price_toman);
CREATE INDEX IF NOT EXISTS offers_changed_idx ON offers(last_price_changed_at);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_name);
CREATE INDEX IF NOT EXISTS products_search_idx ON products USING gin(search_document);
CREATE INDEX IF NOT EXISTS products_price_idx ON products(min_price_toman);
CREATE INDEX IF NOT EXISTS shops_location_idx ON shops(lat,lon);
