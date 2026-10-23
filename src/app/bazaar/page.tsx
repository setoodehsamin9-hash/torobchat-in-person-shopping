import type { Metadata } from 'next';
import { BazaarExplorer } from '@/components/bazaar-explorer';

export const metadata:Metadata={title:'بورس‌یاب — ترب‌چت',description:'راسته‌های تهران که فروشندگان هر کالا در آن جمع شده‌اند، روی نقشه'};
export default async function BazaarPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const q=typeof query.q==='string'?query.q.trim().slice(0,120):'';
 const hub=typeof query.hub==='string'&&/^hub_[0-9a-f]{8}$/.test(query.hub)?query.hub:undefined;
 return <BazaarExplorer initialQuery={q} initialHubId={hub}/>;
}
