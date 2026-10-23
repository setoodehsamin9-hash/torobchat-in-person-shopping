import {NextResponse} from 'next/server';
import {getShop} from '@/lib/catalog';
import {apiError,idSchema} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;idSchema.parse(id);const shop=await getShop(id);return shop?NextResponse.json(shop):NextResponse.json({error:'فروشگاه پیدا نشد.'},{status:404});}catch(e){return apiError(e);}}
