import { z } from 'zod';
import { runTool } from '../../../lib/agent/tools';
import { toolNameSchema } from '../../../lib/agent/schemas';
import { readSafeJson, jsonResponse, safeError } from '../../../lib/agent/http';
const inputSchema=z.object({tool:toolNameSchema,input:z.record(z.string(),z.unknown())}).strict();
export const runtime='nodejs';
export async function POST(request:Request){
  const started=performance.now();let tool='request';
  try{const input=inputSchema.parse(await readSafeJson(request));tool=input.tool;return jsonResponse(await runTool(input.tool,input.input));}catch(error){return safeError(error,tool,started);}
}
