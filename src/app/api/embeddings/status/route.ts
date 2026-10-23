import { embeddingStatus } from '@/lib/retrieval/status';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await embeddingStatus(),{headers:{'cache-control':'no-store'}});}
