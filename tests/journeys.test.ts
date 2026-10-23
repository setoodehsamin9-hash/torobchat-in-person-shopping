import {afterEach,describe,expect,it,vi} from 'vitest';
import type {EnrichedOffer,Product} from '../src/lib/contracts';
const mocks=vi.hoisted(()=>({getOffer:vi.fn(),getProduct:vi.fn(),query:vi.fn()}));
vi.mock('../src/lib/catalog',()=>({getOffer:mocks.getOffer,getProduct:mocks.getProduct}));
vi.mock('../src/lib/db/client',()=>({query:mocks.query}));
import {planJourney} from '../src/lib/journeys/service';
import {decodePolyline,neshanDirection} from '../src/lib/journeys/neshan';
const product:Product={product_id:'p1',persian_title:'محصول آزمایشی تست',brand_name:null,category_name:'آزمون',model:null,image_urls:[],specs:[],min_price_toman:100,max_price_toman:100,offer_count:2};
const offer=(id:string,lat=35.7):EnrichedOffer=>({offer_id:id,product_id:'p1',shop_id:'shop_'+id,price_toman:100,last_price_changed_at:null,seller_title:null,warranty:null,description:null,source:'torob_hackathon_dataset',price_status:'recorded',stock_status:'unknown',verification_status:'unknown',shop:{shop_id:'shop_'+id,name:'فروشگاه آزمون',address:null,location_label:'مرکز',lat,lon:51.4,weekly_hours:{},payment_options:[],category_names:[],website_url:null,instagram:null,supports_fast_delivery:null,identity_verified:false},distance_km:null,installment_eligible:true,payment_notes:[],freshness:{age_days:null,status:'unknown'},hours:{state:'unknown',label:'نامشخص',schedule_status:'unknown'},score:0,reasons:[]});
const input={productId:'p1',offerIds:['o1','o2'],origin:{lat:35.71,lng:51.41},consent:true,travelMode:'car',strategy:'nearest',filters:{}};
// Standard documented encoded-polyline example; coordinates independently known.
const fixture=(seconds:number)=>({routes:[{overview_polyline:{points:'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},legs:[{distance:{value:1500},duration:{value:seconds},summary:'خیابان نمونه',steps:[]}]}]});
let setupCount=0;
function setup(){vi.stubEnv('NESHAN_API_KEY',`test-key-${++setupCount}`);mocks.query.mockResolvedValue([{requests:1}]);mocks.getProduct.mockResolvedValue(product);mocks.getOffer.mockImplementation(async(id:string)=>offer(id,id==='o1'?35.7:35.72));}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});
describe('bounded evidence-based Neshan routes',()=>{
 it('requires explicit location disclosure consent before network access',async()=>{setup();await expect(planJourney({...input,consent:false})).rejects.toThrow();});
 it('reports missing configuration with no invented ETA',async()=>{setup();vi.stubEnv('NESHAN_API_KEY','');const r=await planJourney(input);expect(r.status).toBe('configuration_required');expect('route'in r).toBe(false);});
 it('rejects a shop offer for a different product',async()=>{setup();mocks.getOffer.mockResolvedValue({...offer('o1'),product_id:'other'});await expect(planJourney(input)).rejects.toThrow('محصول');});
 it.each([{filters:{maxPrice:50}},{filters:{installmentOnly:true},ineligible:true},{filters:{region:'غرب'}},{filters:{lat:35.8,lng:51.5,radiusKm:1}}])('preserves hard constraints when resolving destinations: %j',async({filters,ineligible})=>{setup();if(ineligible)mocks.getOffer.mockResolvedValue({...offer('o1'),installment_eligible:false});await expect(planJourney({...input,filters})).rejects.toThrow('شرایط');});
 it('chooses lowest routed duration rather than straight-line proximity',async()=>{setup();vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:URL)=>Response.json(fixture(String(url).includes('35.7%2C')?600:120))));const r=await planJourney(input);expect(r.status).toBe('ready');if(r.status==='ready'){expect(r.route.durationSeconds).toBe(120);expect(r.route.stops[0].offerId).toBe('o2');expect(r.scope).toContain('انتخاب');}expect(fetch).toHaveBeenCalledTimes(2);});
 it('uses the documented pedestrian endpoint and sends the key only in a header',async()=>{setup();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json(fixture(392))));const r=await planJourney({...input,offerIds:['o1'],travelMode:'walking'});expect(r.status).toBe('ready');const [url,options]=vi.mocked(fetch).mock.calls[0];expect(String(url)).toContain('/v4/direction?');expect(String(url)).toContain('type=pedestrian');expect(String(url)).not.toContain('test-key');expect(new Headers(options?.headers).get('Api-Key')).toBe(process.env.NESHAN_API_KEY);});
 it('connects only selected distinct stores and supplies intermediate waypoints',async()=>{setup();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...fixture(100),routes:[{...fixture(100).routes[0],legs:[...fixture(100).routes[0].legs,...fixture(100).routes[0].legs]}]})));const r=await planJourney({...input,strategy:'connect'});expect(r.status).toBe('ready');if(r.status==='ready'){expect(r.route.stops).toHaveLength(2);expect(r.route.durationSeconds).toBe(200);expect(r.route.ordering).toBe('straight_line_heuristic');}expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('waypoints=');});
 it('does not invent time when provider duration is absent',async()=>{setup();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({routes:[{overview_polyline:{points:'_p~iF~ps|U'},legs:[{distance:{value:100}}]}]})));const r=await planJourney({...input,offerIds:['o1']});expect(r.status).toBe('unavailable');expect('route'in r).toBe(false);});
 it('reuses an identical route without reserving quota and preserves its original calculation time',async()=>{
   setup();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T09:00:00Z'));
   vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(fixture(120))));
   const first=await planJourney({...input,offerIds:['o1']});vi.advanceTimersByTime(60000);
   const second=await planJourney({...input,offerIds:['o1']});
   expect(first.status).toBe('ready');expect(second.status).toBe('ready');
   if(first.status==='ready'&&second.status==='ready'){expect(second.calculatedAt).toBe(first.calculatedAt);expect(second.route.durationSeconds).toBe(120);}
   expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.query.mock.calls.filter(([sql])=>String(sql).startsWith('INSERT INTO routing_usage_daily'))).toHaveLength(1);
 });
 it('coalesces pending identical requests into one paid fetch and one quota reservation',async()=>{
   setup();vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(fixture(180))));
   const results=await Promise.all(Array.from({length:6},()=>planJourney({...input,offerIds:['o1']})));
   expect(results.every(r=>r.status==='ready'&&r.route.durationSeconds===180)).toBe(true);
   expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.query.mock.calls.filter(([sql])=>String(sql).startsWith('INSERT INTO routing_usage_daily'))).toHaveLength(1);
 });
 it('cancels one waiting caller without cancelling another caller sharing the route request',async()=>{
   setup();let finish!:(response:Response)=>void;const response=new Promise<Response>(resolve=>{finish=resolve;});
   vi.stubGlobal('fetch',vi.fn().mockReturnValue(response));const controller=new AbortController();
   const cancelled=neshanDirection(input.origin,[{lat:35.7,lng:51.4}],'car',controller.signal);
   const remaining=neshanDirection(input.origin,[{lat:35.7,lng:51.4}],'car');controller.abort();
   const rejection=expect(cancelled).rejects.toThrow('unavailable');finish(Response.json(fixture(90)));
   await rejection;expect(await remaining).toMatchObject({durationSeconds:90});expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('expires old routes after two minutes rather than relabeling stale ETA as fresh',async()=>{
   setup();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-23T09:00:00Z'));
   let count=0;vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(fixture(++count===1?120:300))));
   await planJourney({...input,offerIds:['o1']});vi.advanceTimersByTime(120001);
   const result=await planJourney({...input,offerIds:['o1']});
   expect(result).toMatchObject({status:'ready',route:{durationSeconds:300},calculatedAt:'2026-10-23T09:02:00.001Z'});expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('does not cache provider failures or retry them automatically',async()=>{
   setup();let count=0;vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>++count===1?new Response('',{status:503}):Response.json(fixture(99))));
   expect(await planJourney({...input,offerIds:['o1']})).toMatchObject({status:'unavailable'});expect(fetch).toHaveBeenCalledTimes(1);
   expect(await planJourney({...input,offerIds:['o1']})).toMatchObject({status:'ready',route:{durationSeconds:99}});expect(fetch).toHaveBeenCalledTimes(2);
 });
 it('separates mode, endpoint version, origin, stop order and credential configurations in cache keys',async()=>{
   setup();vi.stubGlobal('fetch',vi.fn().mockImplementation(async(url:URL)=>Response.json({...fixture(100),routes:[{...fixture(100).routes[0],legs:url.searchParams.has('waypoints')?[...fixture(100).routes[0].legs,...fixture(100).routes[0].legs]:fixture(100).routes[0].legs}]})));
   const origin={lat:35.71,lng:51.41},stops=[{lat:35.7,lng:51.4},{lat:35.72,lng:51.4}];
   await neshanDirection(origin,stops,'car');await neshanDirection(origin,stops,'car');
   await neshanDirection(origin,stops,'walking');vi.stubEnv('NESHAN_WALKING_API_VERSION','v1');await neshanDirection(origin,stops,'walking');
   await neshanDirection({...origin,lat:35.711},stops,'car');await neshanDirection(origin,[...stops].reverse(),'car');
   vi.stubEnv('NESHAN_API_KEY','independent-rotated-test-key');await neshanDirection(origin,stops,'car');
   expect(fetch).toHaveBeenCalledTimes(6);
 });
 it('bounds retained routes so old entries are evicted',async()=>{
   setup();vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json(fixture(100))));
   for(let i=0;i<129;i++)await neshanDirection({lat:35+i/10000,lng:51.4},[{lat:35.7,lng:51.4}],'car');
   await neshanDirection({lat:35,lng:51.4},[{lat:35.7,lng:51.4}],'car');expect(fetch).toHaveBeenCalledTimes(130);
 });
 it('rejects malformed geometry and bounds candidate count',async()=>{expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([[38.5,-120.2],[40.7,-120.95],[43.252,-126.453]]);expect(()=>decodePolyline('~~~~~~~')).toThrow();setup();await expect(planJourney({...input,offerIds:Array.from({length:7},(_,i)=>'o'+i)})).rejects.toThrow();});
});
