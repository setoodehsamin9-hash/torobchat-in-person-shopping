import {Pool} from 'pg';
import {database} from '../db/client';
import type {ContactJob,ContactQuote} from './contracts';

export const CONTACT_SCHEMA=`
CREATE TABLE IF NOT EXISTS contact_lock (id integer PRIMARY KEY CHECK(id=1));
INSERT INTO contact_lock VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS contact_quotes (id text PRIMARY KEY,owner_hash text NOT NULL,payload jsonb NOT NULL);
CREATE INDEX IF NOT EXISTS contact_quotes_owner ON contact_quotes(owner_hash);
CREATE TABLE IF NOT EXISTS contact_jobs (id text PRIMARY KEY,owner_hash text NOT NULL,idempotency_key text NOT NULL,quote_id text NOT NULL UNIQUE,payload jsonb NOT NULL, UNIQUE(owner_hash,idempotency_key));
CREATE INDEX IF NOT EXISTS contact_jobs_owner ON contact_jobs(owner_hash);
CREATE TABLE IF NOT EXISTS contact_daily (day text NOT NULL,scope text NOT NULL,quotes integer NOT NULL DEFAULT 0,jobs integer NOT NULL DEFAULT 0,reserved bigint NOT NULL DEFAULT 0,PRIMARY KEY(day,scope));
CREATE TABLE IF NOT EXISTS contact_dispatch_daily (day text PRIMARY KEY,requests integer NOT NULL DEFAULT 0,reserved bigint NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS contact_callback_events (event_id text PRIMARY KEY,job_id text NOT NULL,payload_hash text NOT NULL);
`;
export type StoredJob=ContactJob & {quoteId:string;idempotencyKey:string;claimedAt?:string;dispatchDay?:string;gatewayId?:string};
export interface ContactConnection {query<T extends Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>;}
export interface ContactDatabase extends ContactConnection {exec(sql:string):Promise<unknown>;transaction<T>(fn:(db:ContactConnection)=>Promise<T>):Promise<T>;}
export class ContactStore {
 private ready?:Promise<unknown>;
 constructor(private db:ContactDatabase){}
 async initialize(){await(this.ready??=this.db.exec(CONTACT_SCHEMA).catch(error=>{this.ready=undefined;throw error;}));}
 async atomic<T>(fn:(db:ContactConnection)=>Promise<T>):Promise<T>{await this.initialize();return this.db.transaction(async db=>{await db.query('SELECT id FROM contact_lock WHERE id=1 FOR UPDATE');return fn(db);});}
 async offer(db:ContactConnection,id:string){return(await db.query<{shop_id:string;product_id:string}>('SELECT shop_id,product_id FROM offers WHERE offer_id=$1',[id])).rows[0];}
 async quote(db:ContactConnection,owner:string,id:string){return(await db.query<{payload:ContactQuote}>('SELECT payload FROM contact_quotes WHERE id=$1 AND owner_hash=$2',[id,owner])).rows[0]?.payload;}
 async job(db:ContactConnection,owner:string,id:string){return(await db.query<{payload:StoredJob}>('SELECT payload FROM contact_jobs WHERE id=$1 AND owner_hash=$2',[id,owner])).rows[0]?.payload;}
 async save(db:ContactConnection,job:StoredJob){await db.query('UPDATE contact_jobs SET payload=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(job)]);}
}
let shared:Promise<ContactStore>|undefined;
/** Pool transactions use one pinned connection; PGlite uses its native transaction. */
export function contactStore():Promise<ContactStore>{return shared??=(async()=>{let db:ContactDatabase;if(process.env.DATABASE_URL){const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4});db={query:async<T extends Record<string,unknown>>(sql:string,params:unknown[]=[])=>({rows:(await pool.query(sql,params)).rows as T[]}),exec:sql=>pool.query(sql),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const out=await fn({query:async<T extends Record<string,unknown>>(sql:string,params:unknown[]=[])=>({rows:(await c.query(sql,params)).rows as T[]})});await c.query('COMMIT');return out;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}};}else{db=await database() as unknown as ContactDatabase;}const store=new ContactStore(db);await store.initialize();return store;})().catch(error=>{shared=undefined;throw error;});}
