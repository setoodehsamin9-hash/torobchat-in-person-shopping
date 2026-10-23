import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite/vector';
import {Pool} from 'pg';
import path from 'node:path';
import fs from 'node:fs/promises';
type Client={query<T extends Record<string,unknown>>(sql:string,params?:unknown[]):Promise<{rows:T[]}>;exec(sql:string):Promise<unknown>;close():Promise<void>};
const globalDb=globalThis as unknown as {torobDb?:Promise<Client>};
async function connect():Promise<Client> {if(process.env.DATABASE_URL){const pool=new Pool({connectionString:process.env.DATABASE_URL,max:8});return {query:async <T extends Record<string,unknown>>(sql:string,params:unknown[]=[])=>({rows:(await pool.query(sql,params)).rows as T[]}),exec:async sql=>pool.query(sql),close:()=>pool.end()};} const folder=process.env.PGLITE_PATH || process.env.LOCAL_DB_PATH || path.join(process.cwd(),'data/db');await fs.mkdir(folder,{recursive:true});return new PGlite(folder,{extensions:{vector}}) as unknown as Client;}
export async function database():Promise<Client> {return globalDb.torobDb??=connect();}
export async function query<T extends Record<string,unknown>>(sql:string,params:unknown[]=[]):Promise<T[]> {return (await (await database()).query<T>(sql,params)).rows;}
export async function execute(sql:string):Promise<void>{await (await database()).exec(sql);}
export async function closeDatabase():Promise<void>{if(globalDb.torobDb){await (await globalDb.torobDb).close();delete globalDb.torobDb;}}
export async function migrate():Promise<void>{await execute(await fs.readFile(path.join(process.cwd(),'src/lib/db/schema.sql'),'utf8'));}
