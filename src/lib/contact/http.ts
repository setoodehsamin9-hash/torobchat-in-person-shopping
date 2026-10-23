import {ToolError} from '../agent/tools';
import {ownerHash} from './service';
export function contactOwner(request:Request){const owner=request.headers.get('x-shopping-session')??'';ownerHash(owner);return owner;}
export function callbackSecret(request:Request){const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))throw new ToolError('اعتبار گزارش درگاه پذیرفته نشد.',401);return auth.slice(7);}
