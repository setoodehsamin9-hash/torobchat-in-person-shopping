import type { OfferFilters } from '../contracts';
// Every constraint is checked against one and the same real offer row.
export function productOfferPredicate(filters:OfferFilters,add:(value:unknown)=>string){
  const needed=filters.minPrice!==undefined||filters.maxPrice!==undefined||filters.installmentOnly||Boolean(filters.region)||(filters.lat!==undefined&&filters.lng!==undefined&&filters.radiusKm!==undefined);
  if(!needed)return undefined;
  const where=['bo.product_id=p.product_id'];
  if(filters.minPrice!==undefined||filters.maxPrice!==undefined)where.push('bo.price_toman<=9007199254740991');
  if(filters.minPrice!==undefined)where.push(`bo.price_toman>=${add(filters.minPrice)}`);
  if(filters.maxPrice!==undefined)where.push(`bo.price_toman<=${add(filters.maxPrice)}`);
  if(filters.region)where.push(`bs.location_label=${add(filters.region)}`);
  if(filters.lat!==undefined&&filters.lng!==undefined&&filters.radiusKm!==undefined){const lat=add(filters.lat),lng=add(filters.lng),radius=add(filters.radiusKm);where.push(`bs.lat BETWEEN ${lat}-${radius}/111.0 AND ${lat}+${radius}/111.0`,`(6371*2*asin(sqrt(LEAST(1.0,power(sin(radians(bs.lat-${lat})/2),2)+cos(radians(${lat}))*cos(radians(bs.lat))*power(sin(radians(bs.lon-${lng})/2),2)))))<=${radius}`);}
  if(filters.installmentOnly)where.push(`EXISTS(SELECT 1 FROM jsonb_array_elements(bs.payment_options) payment WHERE payment->>'channel'='in_person' AND (jsonb_array_length(COALESCE(payment->'category_names','[]'::jsonb))=0 OR payment->'category_names' ? p.category_name) AND (payment->>'min_price_toman' IS NULL OR bo.price_toman>=(payment->>'min_price_toman')::bigint) AND (payment->>'max_price_toman' IS NULL OR bo.price_toman<=(payment->>'max_price_toman')::bigint))`);
  return `EXISTS(SELECT 1 FROM offers bo JOIN shops bs ON bs.shop_id=bo.shop_id WHERE ${where.join(' AND ')})`;
}
