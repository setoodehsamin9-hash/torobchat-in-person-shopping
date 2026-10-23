'use client';
import { useCallback,useEffect,useState } from 'react';
import type { PurchaseSession } from './contracts';
const KEY='torob-purchase-session-v1';
let memorySession:PurchaseSession|undefined;
export function readSession():PurchaseSession{if(memorySession)return memorySession;try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch{return {};}}
export function clearSession(){memorySession=undefined;localStorage.removeItem(KEY);window.dispatchEvent(new Event('purchase-session'));}
export function safeSession(session:PurchaseSession):PurchaseSession{const {lat,lng,radiusKm,...safe}=session;void lat;void lng;void radiusKm;return safe;}
export function saveSession(session:PurchaseSession){memorySession=session;localStorage.setItem(KEY,JSON.stringify(safeSession(session)));window.dispatchEvent(new Event('purchase-session'));}
export function selectProduct(productId:string){saveSession({...readSession(),product_id:productId,selected_product_ids:[productId],selected_offer_ids:[]});}
export function usePurchaseSession(){const [session,set]=useState<PurchaseSession>({});useEffect(()=>{const sync=()=>set(readSession());sync();window.addEventListener('purchase-session',sync);return()=>window.removeEventListener('purchase-session',sync);},[]);const update=useCallback((patch:Partial<PurchaseSession>)=>{const next={...readSession(),...patch};saveSession(next);set(next);},[]);const replace=useCallback((next:PurchaseSession)=>{saveSession(next);set(next);},[]);return {session,update,replace};}
export function readIds(key:string):string[]{try{return JSON.parse(localStorage.getItem(key)||'[]');}catch{return [];}}
export function toggleId(key:string,id:string,max=20){const ids=readIds(key);const next=ids.includes(id)?ids.filter(v=>v!==id):[...ids,id].slice(-max);localStorage.setItem(key,JSON.stringify(next));if(key==='torob-compare-products')saveSession({...readSession(),selected_product_ids:next,selected_offer_ids:[]});if(key==='torob-visit-offers')saveSession({...readSession(),selected_offer_ids:next});window.dispatchEvent(new Event(key));return next;}
export function useIds(key:string){const [ids,set]=useState<string[]>([]);useEffect(()=>{const sync=()=>set(readIds(key));sync();window.addEventListener(key,sync);window.addEventListener('storage',sync);return()=>{window.removeEventListener(key,sync);window.removeEventListener('storage',sync);};},[key]);return {ids,toggle:(id:string,max?:number)=>set(toggleId(key,id,max)),clear:()=>{localStorage.removeItem(key);set([]);window.dispatchEvent(new Event(key));}};}
