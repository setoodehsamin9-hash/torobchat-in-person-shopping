import {existsSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.join(process.env.NEXT_BUILD_DIR||'.next','standalone');assert.ok(existsSync(root),'Build standalone first');
assert.equal(existsSync(path.join(root,'data')),false,'Mutable DB or raw dataset was copied into production bundle');
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else {assert.ok(!e.name.endsWith('.zip'),'Source archive in bundle: '+file);assert.ok(!/^\.env(?:\.|$)/.test(e.name),'Environment credentials in bundle: '+file);}}}
walk(root);console.log('PASS standalone contains no raw ZIP, local database, or .env credentials');
