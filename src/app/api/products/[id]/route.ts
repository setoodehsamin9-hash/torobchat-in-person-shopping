import {NextResponse} from 'next/server';
import {getProduct} from '@/lib/catalog';
import {apiError,idSchema} from '@/lib/db/api';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;idSchema.parse(id);const product=await getProduct(id);return product?NextResponse.json(product):NextResponse.json({error:'کالا پیدا نشد.'},{status:404});}catch(e){return apiError(e);}}
