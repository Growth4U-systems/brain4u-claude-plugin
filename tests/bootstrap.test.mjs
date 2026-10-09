import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../install.sh', import.meta.url));
const realNode = process.execPath;

async function runBootstrap(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'brain4u-bootstrap-'));
  const bin = path.join(root, 'bin');
  const plugin = path.join(root, 'plugin cache with spaces');
  const source = path.join(root, 'marketplace with spaces');
  await mkdir(bin); await mkdir(source);
  for (const file of ['.claude-plugin/plugin.json','skills/brain4u-install/SKILL.md','engine/bin/brain4u-installer.js']) {
    await mkdir(path.dirname(path.join(plugin,file)), { recursive:true });
    await writeFile(path.join(plugin,file), '{}');
  }
  const options = { root, plugin, source, mode:'fresh', ...overrides };
  await writeFile(path.join(root,'fixture.json'), JSON.stringify(options));
  await writeFile(path.join(bin,'claude'), `#!${realNode}
const fs=require('fs'), path=require('path');
const root=process.env.BOOTSTRAP_FIXTURE;
const o=JSON.parse(fs.readFileSync(path.join(root,'fixture.json')));
const a=process.argv.slice(2), cmd=a.join(' ');
fs.appendFileSync(path.join(root,'calls.jsonl'), JSON.stringify(a)+'\\n');
if(cmd==='--version'){console.log(o.oldClaude?'2.1.168 (Claude Code)':'2.1.169 (Claude Code)');process.exit(0);}
if(cmd==='plugin marketplace list --json'){
 const entry=o.useGithub
   ? {name:'brain4u',source:'github',repo:o.mode==='conflict'?'unrelated/brain4u':'Growth4U-systems/brain4u-claude-plugin'}
   : {name:'brain4u',source:'directory',path:o.mode==='conflict'?'/unrelated/marketplace':o.source};
 console.log(JSON.stringify(o.mode==='fresh'?[]:[entry]));
}else if(a[0]==='plugin'&&a[1]==='marketplace'&&a[2]==='add'){
 if(o.downloadFails)process.exit(1);
}else if(cmd==='plugin list --json'){
 const enabled=!o.disabled||fs.existsSync(path.join(root,'enabled'));
 console.log(JSON.stringify([{id:'brain4u-installer@brain4u',scope:'user',enabled,version:'0.3.2',installPath:o.incomplete?'/not-installed':o.plugin}]));
}else if(a[1]==='enable'){
 if(!o.disabled)process.exit(1); // Real CLI fails if already enabled.
 fs.writeFileSync(path.join(root,'enabled'),'true');
}
`, { mode:0o700 });
  await writeFile(path.join(bin,'gh'), '#!/usr/bin/env bash\nexit 0\n', { mode:0o700 });
  const args = options.useGithub ? ['--no-wizard'] : ['--source-directory',source,'--no-wizard'];
  // Deliver the complete program over stdin, as curl | bash does.
  const result = spawnSync('bash',['-s','--',...args], {
    input:await readFile(script), encoding:'utf8',
    env:{...process.env,PATH:`${bin}:${process.env.PATH}`,BOOTSTRAP_FIXTURE:root},
  });
  const calls = (await readFile(path.join(root,'calls.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  return { ...result, calls };
}

test('piped install works with spaces and does not enable an already enabled plugin', async()=>{
  const r=await runBootstrap();
  assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/Plugin instalado y habilitado: 0.3.2/);
  assert.ok(r.calls.some(x=>x.slice(0,3).join(' ')==='plugin marketplace add'));
  assert.ok(!r.calls.some(x=>x[1]==='enable'));
});
test('rerun updates the known marketplace',async()=>{
  const r=await runBootstrap({mode:'existing'});
  assert.equal(r.status,0,r.stderr);
  assert.ok(r.calls.some(x=>x.join(' ')==='plugin marketplace update brain4u'));
  assert.ok(!r.calls.some(x=>x[2]==='add'));
});
test('an unrelated marketplace with the same name prevents any installation',async()=>{
  const r=await runBootstrap({mode:'conflict'});
  assert.equal(r.status,1);
  assert.match(r.stderr,/otro origen/);
  assert.ok(!r.calls.some(x=>x[1]==='install'||x[2]==='update'||x[2]==='add'));
});
test('a failed download never proceeds to plugin installation',async()=>{
  const r=await runBootstrap({downloadFails:true});
  assert.equal(r.status,1);
  assert.match(r.stderr,/No se pudo acceder/);
  assert.ok(!r.calls.some(x=>x[1]==='install'));
});
test('a disabled plugin is enabled and verified again',async()=>{
  const r=await runBootstrap({disabled:true});
  assert.equal(r.status,0,r.stderr);
  assert.ok(r.calls.some(x=>x[1]==='enable'));
  assert.equal(r.calls.filter(x=>x.join(' ')==='plugin list --json').length,2);
});
test('missing installed files prevent success',async()=>{
  const r=await runBootstrap({incomplete:true});
  assert.equal(r.status,1);
  assert.match(r.stderr,/comprobación del plugin no pasó/);
});
test('an older Claude Code stops before marketplace changes',async()=>{
  const r=await runBootstrap({oldClaude:true});
  assert.equal(r.status,1);
  assert.match(r.stderr,/Actualiza Claude Code/);
  assert.deepEqual(r.calls,[['--version']]);
});
test('the public entry point uses the intended GitHub marketplace',async()=>{
  const r=await runBootstrap({useGithub:true});
  assert.equal(r.status,0,r.stderr);
  assert.ok(r.calls.some(x=>x.join(' ')==='plugin marketplace add Growth4U-systems/brain4u-claude-plugin --scope user'));
});
test('a matching GitHub marketplace is reused on rerun',async()=>{
  const r=await runBootstrap({useGithub:true,mode:'existing'});
  assert.equal(r.status,0,r.stderr);
  assert.ok(r.calls.some(x=>x.join(' ')==='plugin marketplace update brain4u'));
});
test('a different GitHub repository prevents installation',async()=>{
  const r=await runBootstrap({useGithub:true,mode:'conflict'});
  assert.equal(r.status,1);
  assert.ok(!r.calls.some(x=>x[1]==='install'||x[2]==='update'||x[2]==='add'));
});
