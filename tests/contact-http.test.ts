import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {ContactStore} from '../src/lib/contact/store';
import {ContactService} from '../src/lib/contact/service';
const bound=vi.hoisted(()=>({service:null as ContactService|null}));
vi.mock('../src/lib/contact/config',()=>({contactService:async()=>bound.service}));
import {POST as quote} from '../src/app/api/contact/quotes/route';
import {GET as list,POST as create} from '../src/app/api/contact/jobs/route';
import {GET as get} from '../src/app/api/contact/jobs/[id]/route';
import {POST as cancel} from '../src/app/api/contact/jobs/[id]/cancel/route';
const owner='1'.repeat(64),other='2'.repeat(64);let db:PGlite;
function request(url:string,body?:unknown,session=owner){return new Request(`https://app.example.test/api/contact/${url}`,{method:body?'POST':'GET',headers:{'x-shopping-session':session,'content-type':'application/json','x-forwarded-for':'contact-http-test'},body:body?JSON.stringify(body):undefined});}
beforeEach(async()=>{db=new PGlite();await db.exec("CREATE TABLE offers(offer_id text PRIMARY KEY,shop_id text,product_id text);INSERT INTO offers VALUES('offer','shop','product')");bound.service=new ContactService(new ContactStore(db));});
afterEach(async()=>{await db.close();});
describe('public contact HTTP boundary',()=>{
 it('returns no-store responses and requires an unguessable owner capability',async()=>{const bad=await list(request('jobs',undefined,'weak'));expect(bad.status).toBe(401);const ok=await list(request('jobs'));expect(ok.headers.get('cache-control')).toBe('no-store');expect(await ok.json()).toEqual({jobs:[]});});
 it('rejects cross-origin mutations before creating a quote',async()=>{const req=request('quotes',{offerId:'offer',channel:'sms',mode:'simulation'});req.headers.set('origin','https://evil.example.test');expect((await quote(req)).status).toBe(403);});
 it('creates, restores and cancels only the owning session job without exposing internal fields',async()=>{const q=await(await quote(request('quotes',{offerId:'offer',channel:'sms',mode:'simulation'}))).json();const created=await create(request('jobs',{quoteId:q.id,approved:true,approvedMaxCostToman:0,idempotencyKey:'http-test-key'}));expect(created.status).toBe(201);const j=await created.json();expect(j).not.toHaveProperty('idempotencyKey');expect(j).not.toHaveProperty('quoteId');expect(JSON.stringify(j)).not.toContain(owner);const ctx={params:Promise.resolve({id:j.id})};expect((await get(request(`jobs/${j.id}`,undefined,other),ctx)).status).toBe(404);expect((await cancel(request(`jobs/${j.id}/cancel`,{},other),ctx)).status).toBe(404);expect((await(await list(request('jobs'))).json()).jobs[0].id).toBe(j.id);expect((await(await cancel(request(`jobs/${j.id}/cancel`,{}),ctx)).json()).status).toBe('cancelled');});
});
