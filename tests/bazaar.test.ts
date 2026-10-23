import { describe,expect,it,vi } from 'vitest';
vi.mock('../src/lib/db/client',()=>({query:async()=>[]}));
import { groupHubs,mallName,streetKey } from '../src/lib/bazaar';
import { composeAnswer,routeByRules } from '../src/lib/bazaar-ask';

const shop=(id:string,address:string,lat:number,lon:number,price:number|null,extra:Record<string,unknown>={})=>({offer_id:`offer_${id}`,product_id:`product_${id}`,price_toman:price===null?null:String(price),shop_id:`shop_${id}`,name:null,address,location_label:'فردوسی',lat,lon,weekly_hours:{},payment_options:[],persian_title:`کالا ${id}`,category_name:'دوربین مدار بسته',...extra});
const rows=[
 shop('a','خیابان جمهوری اسلامی، پاساژ علاءالدین، طبقه ۲',35.6930,51.4140,900),
 shop('b','خیابان جمهوری، پاساژ علاالدین، واحد ۱۲',35.6932,51.4144,700),
 shop('c','جمهوری اسلامی، پاساژ بوشهری',35.6936,51.4150,null),
 shop('d','خیابان لاله زار جنوبی، پاساژ سرای لاله زار',35.6880,51.4180,500),
 shop('e','خیابان لاله‌زار جنوبی، کوچه بهار',35.6884,51.4182,650),
 shop('f','خیابان ولیعصر، تجریش',35.8046,51.4302,100),
 shop('far','خیابان جمهوری، انتهای خیابان',35.7400,51.3000,50),
];

describe('bazaar grouping',()=>{
 it('normalizes street and mall names from the recorded address',()=>{
  expect(streetKey('خیابان جمهوری اسلامی، نبش شیخ هادی',null)?.key).toBe('جمهوری');
  expect(streetKey('خیابان لاله‌زار جنوبی',null)?.key).toBe(streetKey('لاله زار',null)?.key);
  expect(streetKey('',' فردوسی')?.key).toBe('فردوسی');
  expect(mallName('خیابان جمهوری، پاساژ علاءالدین، طبقه ۶')).toBe('پاساژ علاالدین');
  expect(mallName('خیابان حافظ')).toBeNull();
 });
 it('builds districts only from offer rows, drops outliers and single shops',()=>{
  const result=groupHubs(rows as never);
  expect(result.total_shops).toBe(7);
  expect(result.hubs.map(hub=>[hub.name,hub.shop_count])).toEqual([['جمهوری',3],['لاله زار',2]]);
  expect(result.scattered_shops).toBe(2);
  const top=result.hubs[0];
  expect(top.primary).toBe(true);
  expect(top.min_price_toman).toBe(700);
  expect(top.malls[0]).toEqual({name:'پاساژ علاالدین',shop_count:2});
  expect(top.shops.map(item=>item.shop_id)).toEqual(['shop_b','shop_a','shop_c']);
  expect(top.shops.every(item=>item.hours==='unknown'&&!item.installment)).toBe(true);
 });
});

describe('bazaar questions',()=>{
 const result={query:'دوربین',matched_products:7,sample_products:[],computed_at:'',...groupHubs(rows as never)};
 it('routes common Persian questions without a model',()=>{
  expect(routeByRules('ارزان‌ترین کجاست؟')).toBe('cheapest');
  expect(routeByRules('الان کدام‌ها بازند؟')).toBe('open_now');
  expect(routeByRules('از کدام پاساژ شروع کنم؟')).toBe('plan');
  expect(routeByRules('نزدیک‌ترین راسته به من')).toBe('nearest');
  expect(routeByRules('بورس اصلی کجاست؟')).toBe('most_sellers');
  expect(routeByRules('هوا چطوره')).toBe('unsupported');
 });
 it('answers only with computed dataset facts and highlights the shops it names',()=>{
  const cheapest=composeAnswer('cheapest',result);
  expect(cheapest.shop_ids[0]).toBe('shop_d');
  expect(cheapest.text).toContain('۵۰۰ تومان');
  expect(cheapest.text).toContain('استعلام');
  const plan=composeAnswer('plan',result,result.hubs[0].hub_id);
  expect(plan.text).toContain('پاساژ علاالدین');
  expect(plan.shop_ids.sort()).toEqual(['shop_a','shop_b']);
  expect(composeAnswer('nearest',result).needs_location).toBe(true);
  expect(composeAnswer('nearest',result,undefined,{lat:35.688,lng:51.418}).hub_id).toBe(result.hubs[1].hub_id);
  expect(composeAnswer('open_now',result).text).toContain('نامشخص');
 });
});
