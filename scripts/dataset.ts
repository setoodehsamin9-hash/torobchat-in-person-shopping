import yauzl from 'yauzl';
import {parse} from 'csv-parse';
import path from 'node:path';
export const archive=path.resolve(process.env.DATASET_ZIP || 'data/raw/torob-dataset.zip');
export const expected={products:225903,shops:6476,offers:331506};
export const nullable=(s:string|undefined):string|null=>!s || s.trim()==='null'?null:s;
export function jsonField<T>(s:string|undefined,fallback:T):T {const v=nullable(s);if(v===null)return fallback;return (JSON.parse(v)??fallback) as T;}
export async function* rows(table:keyof typeof expected):AsyncGenerator<Record<string,string>> {const zip=await new Promise<yauzl.ZipFile>((resolve,reject)=>yauzl.open(archive,{lazyEntries:true,validateEntrySizes:true},(e,z)=>e?reject(e):z?resolve(z):reject(new Error('Missing archive'))));try{const entry=await new Promise<yauzl.Entry>((resolve,reject)=>{zip.on('error',reject);zip.on('entry',(e:yauzl.Entry)=>{if(e.fileName===`torob-dataset/${table}.csv`){if(e.uncompressedSize>2_000_000_000)return reject(new Error('CSV exceeds safe size'));resolve(e);}else zip.readEntry();});zip.on('end',()=>reject(new Error(`Missing ${table}.csv`)));zip.readEntry();});const stream=await new Promise<NodeJS.ReadableStream>((resolve,reject)=>zip.openReadStream(entry,(e,s)=>e?reject(e):s?resolve(s):reject(new Error('Missing stream'))));const parser=stream.pipe(parse({columns:true,bom:true,skip_empty_lines:true,max_record_size:2_000_000}));for await(const row of parser)yield row as Record<string,string>;}finally{zip.close();}}
