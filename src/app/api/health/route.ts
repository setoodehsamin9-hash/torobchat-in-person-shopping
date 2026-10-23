import {NextResponse} from 'next/server';
import {getCounts} from '@/lib/catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){try{const counts=await getCounts();const ready=counts.products===225903&&counts.shops===6476&&counts.offers===331506;return NextResponse.json({ok:ready,status:ready?'ok':'data_incomplete',database:process.env.DATABASE_URL?'postgresql':'local_pglite',counts,source:'torob_hackathon_dataset'},{status:ready?200:503});}catch{return NextResponse.json({ok:false,status:'database_unavailable',message:'پایگاه داده در دسترس نیست.'},{status:503});}}
