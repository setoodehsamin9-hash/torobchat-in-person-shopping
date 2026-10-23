import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {contactOptions} from '../src/lib/contact/config';
let dir:string;
beforeEach(async()=>{dir=await fs.mkdtemp(path.join(os.tmpdir(),'contact-config-'));vi.stubEnv('CONTACT_REAL_MODE','true');});
afterEach(async()=>{vi.unstubAllEnvs();vi.restoreAllMocks();await fs.rm(dir,{recursive:true,force:true});});
it('refuses even a chmod-600 verified contact registry inside the source project',async()=>{
 const file=path.join(dir,'contacts.json');await fs.writeFile(file,JSON.stringify([{shopId:'shop',destination:['+989','000000001'].join(''),verifiedAt:'2026-10-22T00:00:00Z',verificationReference:'synthetic independent source',permission:true}]),{mode:0o600});
 vi.stubEnv('CONTACT_REGISTRY_PATH',file);vi.spyOn(process,'cwd').mockReturnValue(dir);
 expect((await contactOptions()).registry).toEqual([]);
});
it('fails closed with no registry and rejects malformed tariff configuration',async()=>{vi.stubEnv('CONTACT_REGISTRY_PATH','');vi.stubEnv('CONTACT_VOICE_MAX_COST_TOMAN','10garbage');const o=await contactOptions();expect(o.registry).toEqual([]);expect(o.voiceMaxCostToman).toBeUndefined();});
it('loads only a private operator file and rejects duplicate shop identities or symlinks',async()=>{const file=path.join(dir,'contacts.json');const c={shopId:'shop',destination:'+989000000001',verifiedAt:'2026-10-22T00:00:00Z',verificationReference:'test-only independent source',permission:true};await fs.writeFile(file,JSON.stringify([c]),{mode:0o600});vi.stubEnv('CONTACT_REGISTRY_PATH',file);expect((await contactOptions()).registry).toHaveLength(1);await fs.chmod(file,0o644);expect((await contactOptions()).registry).toEqual([]);await fs.chmod(file,0o600);await fs.writeFile(file,JSON.stringify([c,c]));expect((await contactOptions()).registry).toEqual([]);await fs.writeFile(file,JSON.stringify([c]));const link=path.join(dir,'link.json');await fs.symlink(file,link);vi.stubEnv('CONTACT_REGISTRY_PATH',link);expect((await contactOptions()).registry).toEqual([]);});
