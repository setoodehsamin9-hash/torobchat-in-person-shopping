import {NextResponse} from 'next/server';
import {getShop,getShopOffers} from '@/lib/catalog';
import {apiError,idSchema,offerSchema,readParams} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;idSchema.parse(id);if(!await getShop(id))return NextResponse.json({error:'فروشگاه پیدا نشد.'},{status:404});return NextResponse.json(await getShopOffers(id,offerSchema.parse(readParams(request))));}catch(e){return apiError(e);}}
