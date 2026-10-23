import { PGlite } from '@electric-sql/pglite';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
const state=vi.hoisted(()=>({db:null as unknown as PGlite}));
vi.mock('../src/lib/db/client',()=>({query:async(sql:string,params:unknown[]=[])=> (await state.db.query(sql,params)).rows}));
import { searchStoreOffers } from '../src/lib/store-discovery';

beforeAll(async()=>{state.db=new PGlite();await state.db.exec(`
CREATE TABLE products(product_id text PRIMARY KEY,persian_title text,brand_name text,category_name text,model text,image_urls jsonb DEFAULT '[]',specs jsonb DEFAULT '[]',search_text text,search_document tsvector,min_price_toman bigint,max_price_toman bigint,offer_count int DEFAULT 1);
CREATE TABLE shops(shop_id text PRIMARY KEY,name text,address text,location_label text,lat float,lon float,weekly_hours jsonb DEFAULT '{}',payment_options jsonb DEFAULT '[]',category_names jsonb DEFAULT '[]',website_url text,instagram text,supports_fast_delivery text);
CREATE TABLE offers(offer_id text PRIMARY KEY,product_id text,shop_id text,price_toman bigint,last_price_changed_at timestamptz,seller_title text,warranty text,description text);
INSERT INTO shops(shop_id,name,lat,lon,location_label,payment_options,category_names) VALUES
('category-only','بدون پیشنهاد کفش',35.7,51.4,'مرکز','[]','["کفش"]'),
('cash','نقدی',35.7,51.4,'مرکز','[{"channel":"unknown","provider_name":"اعتباری","category_names":[],"min_price_toman":null,"max_price_toman":null}]','[]'),
('credit','حضوری',35.701,51.401,'مرکز','[{"channel":"in_person","provider_name":"حضوری","category_names":["کفش"],"min_price_toman":100,"max_price_toman":2000}]','[]'),
('far','دور',36.7,52.4,'دور','[]','[]'),('no-geo','نامشخص',NULL,NULL,'مرکز','[]','[]');
INSERT INTO products(product_id,persian_title,category_name,search_text,search_document,min_price_toman,max_price_toman,offer_count) VALUES
('p1','کفش مدل یک','کفش','کفش مدل یک',to_tsvector('simple','کفش مدل یک'),500,2500,2),
('p2','کفش مدل دو','کفش','کفش مدل دو',to_tsvector('simple','کفش مدل دو'),1200,1200,1),
('p3','کفش بی موقعیت','کفش','کفش بی موقعیت',to_tsvector('simple','کفش بی موقعیت'),600,600,1),
('p4','کیف','کیف','کیف',to_tsvector('simple','کیف'),700,700,1);
INSERT INTO offers VALUES ('cash1','p1','cash',500,'2026-10-01',NULL,NULL,NULL),('credit1','p1','credit',2500,'2026-10-01',NULL,NULL,NULL),('credit2','p2','credit',1200,'2026-10-01',NULL,NULL,NULL),('nogeo','p3','no-geo',600,NULL,NULL,NULL,NULL),('far1','p2','far',1000,NULL,NULL,NULL,NULL),('bag','p4','category-only',700,NULL,NULL,NULL,NULL);
INSERT INTO shops(shop_id,name) SELECT 'diverse-shop-'||n,'تنوع' FROM generate_series(1,12) n;
INSERT INTO products(product_id,persian_title,category_name,search_text,search_document,min_price_toman,max_price_toman,offer_count)
SELECT 'diverse-product-'||n,'تنوع','تنوع','تنوع',to_tsvector('simple','تنوع'),100,100,CASE WHEN n=1 THEN 8 ELSE 1 END FROM generate_series(1,5) n;
INSERT INTO offers(offer_id,product_id,shop_id,price_toman) SELECT 'diverse-offer-'||n,'diverse-product-1','diverse-shop-'||n,100 FROM generate_series(1,8) n;
INSERT INTO offers(offer_id,product_id,shop_id,price_toman) SELECT 'diverse-offer-'||n,'diverse-product-'||(n-7),'diverse-shop-'||n,100 FROM generate_series(9,12) n;
`);});
afterAll(async()=>state.db.close());
describe('bounded store discovery from actual linked offers',()=>{
 it('does not let many offers for the first product starve other matching products',async()=>{const r=await searchStoreOffers({query:'تنوع',limit:12});expect(r.matches).toHaveLength(5);expect(r.matches.map(m=>m.product.product_id)).toEqual(['diverse-product-1','diverse-product-2','diverse-product-3','diverse-product-4','diverse-product-5']);});
 it('presents each shop at most once even when it offers multiple matching products',async()=>{const r=await searchStoreOffers({query:'کفش'});expect(new Set(r.matches.map(m=>m.offer.shop_id)).size).toBe(r.matches.length);});
 it('keeps exact product/offer/shop linkage and never uses shop categories as inventory',async()=>{const r=await searchStoreOffers({query:'کفش'});expect(r.limited).toBe(true);expect(r.matches.length).toBeGreaterThan(0);expect(r.matches.every(m=>m.product.product_id===m.offer.product_id&&m.offer.shop_id===m.offer.shop.shop_id)).toBe(true);expect(r.matches.some(m=>m.offer.shop_id==='category-only')).toBe(false);expect(new Set(r.matches.map(m=>m.offer.offer_id)).size).toBe(r.matches.length);expect(r.matches.every(m=>m.offer.stock_status==='unknown')).toBe(true);});
 it('requires budget and documented installment eligibility on the same linked offer',async()=>{const r=await searchStoreOffers({query:'کفش',filters:{maxPrice:1500,installmentOnly:true}});expect(r.matches.map(m=>m.offer.offer_id)).toEqual(['credit2']);});
 it('keeps radius and region hard and excludes absent coordinates under a radius',async()=>{const r=await searchStoreOffers({query:'کفش',filters:{lat:35.7,lng:51.4,radiusKm:1,region:'مرکز'}});expect(r.matches.length).toBeGreaterThan(0);expect(r.matches.every(m=>m.offer.shop.location_label==='مرکز'&&m.offer.distance_km!==null&&m.offer.distance_km<=1)).toBe(true);expect(r.matches.map(m=>m.offer.offer_id)).not.toContain('nogeo');expect(r.matches.map(m=>m.offer.offer_id)).not.toContain('far1');});
 it('allows unknown coordinates without a radius and honestly marks distance unknown',async()=>{const r=await searchStoreOffers({query:'کفش',filters:{region:'مرکز'}});expect(r.matches.find(m=>m.offer.offer_id==='nogeo')?.offer.distance_km).toBeNull();});
 it('returns a bounded shortlist and an honest empty result',async()=>{expect((await searchStoreOffers({query:'کفش',limit:1})).matches).toHaveLength(1);expect((await searchStoreOffers({query:'عبارتناموجود'})).matches).toEqual([]);});
 it('rejects unbounded inputs and radius without location',async()=>{await expect(searchStoreOffers({query:'کفش',limit:13})).rejects.toThrow();await expect(searchStoreOffers({query:'کفش',filters:{radiusKm:1}})).rejects.toThrow();await expect(searchStoreOffers({query:' '})).rejects.toThrow();});
});
