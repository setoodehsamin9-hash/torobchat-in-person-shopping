import { NextResponse } from 'next/server';
import { getShop } from '@/lib/catalog';
import { apiError,idSchema } from '@/lib/db/api';
import { placeMedia } from '@/lib/place-media';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;idSchema.parse(id);const shop=await getShop(id);if(!shop)return NextResponse.json({error:'فروشگاه پیدا نشد.'},{status:404});try{return NextResponse.json({media:await placeMedia(shop)});}catch{return NextResponse.json({media:null,note:'سرویس تصویر عمومی در دسترس نیست؛ نقشه و آدرس ثبت‌شده قابل استفاده‌اند.'});}}catch(e){return apiError(e);}}
