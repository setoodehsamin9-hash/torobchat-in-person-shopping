import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const builder = path.resolve('scripts/package-release.py');
const python = process.env.PYTHON || 'python3';
const fixtures: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'hamqadam-release-'));
  fixtures.push(root);
  write(root, 'package.json', '{"name":"fixture"}\n');
  write(root, 'src/app/page.tsx', 'export default function Page() { return null; }\n');
  write(root, '.env.example', 'AI_API_KEY=\nDATABASE_URL=\n');
  return root;
}
function write(root: string, name: string, value: string | Buffer) {
  const file = path.join(root, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, value);
}
function run(root: string, args: string[] = []) {
  return spawnSync(python, [builder, '--root', root, ...args], { encoding: 'utf8' });
}
function inspect(file: string): { names: string[]; manifest: { files: { path: string; size: number; sha256: string }[] }; bad: string | null } {
  const result = spawnSync(python, ['-c', [
    'import json,sys,zipfile,hashlib',
    'with zipfile.ZipFile(sys.argv[1]) as z:',
    ' m=json.loads(z.read("RELEASE-MANIFEST.json"))',
    ' assert all(hashlib.sha256(z.read(f["path"])).hexdigest()==f["sha256"] and len(z.read(f["path"]))==f["size"] for f in m["files"])',
    ' print(json.dumps({"names":z.namelist(),"manifest":m,"bad":z.testzip()}))',
  ].join('\n'), file], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout);
}
afterEach(() => { fixtures.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });

describe('source release boundary', () => {
  it('rejects a BoxAPI credential in otherwise ordinary text without echoing it',()=>{
    const root=fixture();const value=['box','ai','fixtureonly012345678901234567890123456789'].join('-');
    write(root,'docs/setup.md',`Connection value: ${value}\n`);const result=run(root,['--check']);
    expect(result.status).not.toBe(0);expect(result.stderr).toContain('secret');expect(result.stderr).not.toContain(value);
  });
  it('rejects a private verified-contact registry accidentally copied into a source JSON file',()=>{
    const root=fixture();write(root,'config/contacts.json',JSON.stringify([{shopId:'s1',destination:['+989','000000001'].join(''),verifiedAt:'2026-10-22T00:00:00Z',verificationReference:'synthetic proof, not a real contact',permission:true}]));
    const result=run(root);expect(result.status).not.toBe(0);expect(result.stderr).toContain('registry');expect(existsSync(path.join(root,'releases/hamqadam-source.zip'))).toBe(false);
  });
  it('ships source, migrations, licenses and empty environment placeholders with a deterministic verified manifest', () => {
    const root = fixture();
    write(root, 'drizzle/0001.sql', 'CREATE TABLE example (id integer);\n');
    write(root, 'scripts/worker.ts', 'console.log("worker");\n');
    write(root, 'src/components/fonts/LICENSE', 'Font license\n');
    write(root, 'src/components/fonts/sample.woff2', Buffer.from([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]));
    expect(run(root).status).toBe(0);
    const first = path.join(root, 'releases/hamqadam-source.zip');
    const result = inspect(first);
    expect(result.names).toEqual(['.env.example', 'drizzle/0001.sql', 'package.json', 'scripts/worker.ts', 'src/app/page.tsx', 'src/components/fonts/LICENSE', 'src/components/fonts/sample.woff2', 'RELEASE-MANIFEST.json']);
    expect(result.bad).toBeNull();
    expect(result.manifest.files.find(file => file.path === 'package.json')?.sha256).toBe(createHash('sha256').update('{"name":"fixture"}\n').digest('hex'));
    expect(run(root, ['--check']).status).toBe(0);
    expect(run(root, ['--output', 'releases/second.zip']).status).toBe(0);
    expect(readFileSync(first).equals(readFileSync(path.join(root, 'releases/second.zip')))).toBe(true);
  });

  it('excludes private environment, data, generated files, captures, credentials and unknown binaries', () => {
    const root = fixture();
    for (const name of ['.env', '.env.local', '.env.production', 'data/raw/torob-dataset.zip', 'data/pglite/base/1', 'node_modules/pkg/index.js', '.next/server/app.js', '.git/config', 'dist/app.js', 'releases/old.zip', 'release/old.zip', 'logs/app.log', 'docs/browser-reference/snapshot.json', 'docs/browser-reference.html', 'docs/browser-capture.json', 'docs/reference/capture.html', 'src/secrets.json', 'src/credentials.json', 'src/app/local.db', 'src/app/payload.bin', 'src/app/.env.example', 'docs/recording.mp4']) {
      write(root, name, 'excluded private content');
    }
    expect(run(root).status).toBe(0);
    expect(inspect(path.join(root, 'releases/hamqadam-source.zip')).names).toEqual(['.env.example', 'package.json', 'src/app/page.tsx', 'RELEASE-MANIFEST.json']);
  });

  it.each(['src/lib/provider.ts', '.env.example'])('fails closed on a secret value in included %s without echoing it', file => {
    const root = fixture();
    const value = ['sk', 'proj', 'temporary-fixture-only-0123456789012345'].join('-');
    write(root, file, file.endsWith('.ts') ? `export const AI_API_KEY = "${value}";\n` : `AI_API_KEY=${value}\n`);
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('secret');
    expect(result.stderr).not.toContain(value);
    expect(result.stderr).toContain(file);
    expect(existsSync(path.join(root, 'releases/hamqadam-source.zip'))).toBe(false);
  });

  it('finds a generic assigned credential and a credential-bearing database URL', () => {
    const root = fixture();
    const credential = ['private', 'fixture', 'credential', '123456'].join('-');
    write(root, 'src/lib/config.ts', `const gatewaySecret = "${credential}";\n`);
    expect(run(root).stderr).toContain('secret');
    write(root, 'src/lib/config.ts', `const connection = "${['postgresql://operator', credential].join(':')}@db.example/app";\n`);
    expect(run(root).status).not.toBe(0);
  });

  it('permits runtime environment lookups and empty secret defaults', () => {
    const root = fixture();
    write(root, 'src/lib/config.ts', 'const gatewaySecret = process.env.GATEWAY_SECRET || "";\n');
    expect(run(root, ['--check']).status).toBe(0);
    expect(run(root).status).toBe(0);
  });

  it('requires worker token and database URL examples to be empty even for short values', () => {
    const root = fixture();
    write(root, '.env.example', 'CONTACT_WORKER_TOKEN=example\n');
    expect(run(root).stderr).toContain('secret');
    write(root, '.env.example', 'DATABASE_URL=example\n');
    expect(run(root).stderr).toContain('secret');
  });

  it('scans font payloads for credential patterns as well as text source', () => {
    const root = fixture();
    const value = ['sk', 'proj', 'temporary-font-fixture-0123456789012345'].join('-');
    write(root, 'src/components/fonts/unsafe.woff2', Buffer.concat([Buffer.from('wOF2\0'), Buffer.from(value)]));
    const result = run(root);
    expect(result.stderr).toContain('secret');
    expect(result.stderr).not.toContain(value);
  });

  it('ships only the three exact public brand image paths with accepted GIF and PNG signatures', () => {
    const root = fixture();
    write(root, 'public/brand/torob-radish.gif', Buffer.from('GIF87a\0'));
    write(root, 'public/brand/torob-rotate.gif', Buffer.from('GIF89a\0'));
    write(root, 'public/brand/torob-radish.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]));
    write(root, 'public/brand/unrelated.gif', Buffer.from('GIF89a\0'));
    write(root, 'public/brand/unrelated.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    write(root, 'src/brand/torob-radish.gif', Buffer.from('GIF89a\0'));
    expect(run(root).status).toBe(0);
    expect(inspect(path.join(root, 'releases/hamqadam-source.zip')).names).toEqual([
      '.env.example', 'package.json', 'public/brand/torob-radish.gif',
      'public/brand/torob-radish.png', 'public/brand/torob-rotate.gif',
      'src/app/page.tsx', 'RELEASE-MANIFEST.json',
    ]);
  });

  it.each(['public/brand/torob-radish.gif', 'public/brand/torob-rotate.gif', 'public/brand/torob-radish.png'])('refuses an invalid signature at %s', name => {
    const root = fixture();
    write(root, name, Buffer.from('unrecognized binary payload\0'));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('signature');
    expect(result.stderr).toContain(name);
    expect(existsSync(path.join(root, 'releases/hamqadam-source.zip'))).toBe(false);
  });

  it.each(['public/brand/torob-radish.gif', 'public/brand/torob-rotate.gif', 'public/brand/torob-radish.png'])('refuses a credential pattern embedded in %s', name => {
    const root = fixture();
    const value = ['sk', 'proj', 'temporary-image-fixture-0123456789012345'].join('-');
    const signature = name.endsWith('.png') ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) : Buffer.from('GIF89a');
    write(root, name, Buffer.concat([signature, Buffer.from(`\0${value}`)]));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('secret');
    expect(result.stderr).not.toContain(value);
    expect(existsSync(path.join(root, 'releases/hamqadam-source.zip'))).toBe(false);
  });

  it.each(['src/lib/linked.ts', 'src/external'])('rejects symlink %s before reading outside the root', name => {
    const root = fixture();
    const outside = fixture();
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    symlinkSync(name.endsWith('.ts') ? path.join(outside, '.env.example') : outside, path.join(root, name));
    const result = run(root);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('symlink');
  });

  it('refuses existing files, paths outside releases and symlinked output directories', () => {
    const root = fixture();
    write(root, 'releases/keep.zip', 'keep me');
    expect(run(root, ['--output', 'releases/keep.zip']).stderr).toContain('already exists');
    expect(readFileSync(path.join(root, 'releases/keep.zip'), 'utf8')).toBe('keep me');
    expect(run(root, ['--output', 'src/app/page.tsx']).status).not.toBe(0);
    expect(run(root, ['--output', '../outside.zip']).status).not.toBe(0);
    const outside = fixture();
    symlinkSync(outside, path.join(root, 'releases/linked'));
    expect(run(root, ['--output', 'releases/linked/new.zip']).status).not.toBe(0);
  });

  it('rejects binary content disguised as source and does not create an archive in scan-only mode', () => {
    const root = fixture();
    write(root, 'src/lib/suspicious.ts', Buffer.from([0, 1, 2, 3]));
    expect(run(root).status).not.toBe(0);
    rmSync(path.join(root, 'src/lib/suspicious.ts'));
    expect(run(root, ['--check']).status).toBe(0);
    expect(existsSync(path.join(root, 'releases'))).toBe(false);
    expect(run(root).status).toBe(0);
  });
});


it.each(['optimized','boxapi'])('packages the %s edition with a verified empty-key profile',edition=>{
 const root=fixture();write(root,'.env.example','AI_API_KEY=\nPORT=\nNEXT_PUBLIC_APP_URL=http://localhost:3100\nNEXT_BUILD_DIR=\n');
 write(root,'archive/old-backend/src/index.ts','local old source');
 expect(run(root,['--edition',edition]).status).toBe(0);
 const result=inspect(path.join(root,'releases/hamqadam-source.zip'));
 expect(result.names).toContain('EDITION.md');expect(result.names.some(name=>name.startsWith('archive/'))).toBe(false);
 const check=spawnSync('python3',['-c','import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(z.read(".env.example").decode());print(z.read("EDITION.md").decode())',path.join(root,'releases/hamqadam-source.zip')],{encoding:'utf8'});
 expect(check.stdout).toContain(`NEXT_BUILD_DIR=.next-${edition}`);expect(check.stdout).toContain(`npm run dev:${edition}`);expect(check.stdout).toContain('AI_API_KEY=\n');
});
