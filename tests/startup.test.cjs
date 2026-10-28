const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {ensureLocalConfig}=require('../scripts/init-local-config.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'ipbot-startup-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'scripts'));for(const name of ['launch.cjs','local-config.cjs','init-local-config.cjs'])fs.copyFileSync(path.resolve(__dirname,'../scripts',name),path.join(root,'scripts',name));fs.writeFileSync(path.join(root,'sensitive.config.example.json'),JSON.stringify({APP_NAME:'IP Bot',JWT_SECRET:'',AUTH_SERVER_URL:'http://127.0.0.1:3002'}));return root;}
test('first run creates a random private config and preserves existing credentials',t=>{
 const root=fixture(t),first=ensureLocalConfig(root);assert.equal(first.created,true);const bytes=fs.readFileSync(first.path);const config=JSON.parse(bytes);assert.match(config.JWT_SECRET,/^[a-f0-9]{64}$/);assert.equal(config.APP_NAME,'IP Bot');assert.equal(ensureLocalConfig(root).created,false);assert.deepEqual(fs.readFileSync(first.path),bytes);
});
test('the config initializer can be imported without terminating its caller',t=>{
 const root=fixture(t);ensureLocalConfig(root);const result=spawnSync(process.execPath,['-e',`require(${JSON.stringify(path.join(root,'scripts/init-local-config.cjs'))}); console.log('caller-alive')`],{encoding:'utf8'});assert.equal(result.status,0);assert.match(result.stdout,/caller-alive/);
});
test('diagnostic mode reports missing dependencies without installing or initializing',t=>{
 const root=fixture(t);const result=spawnSync(process.execPath,['scripts/launch.cjs','server'],{cwd:root,encoding:'utf8',env:{...process.env,IPBOT_LAUNCH_CHECK:'1'}});assert.equal(result.status,2);assert.match(result.stdout,/dependencies are missing/);assert.equal(fs.existsSync(path.join(root,'sensitive.config.json')),false);assert.equal(fs.existsSync(path.join(root,'node_modules')),false);
});
test('invalid existing private config is preserved and its startup failure is logged',t=>{
 const root=fixture(t),file=path.join(root,'sensitive.config.json');fs.writeFileSync(file,'{invalid-json');const env={...process.env};delete env.IPBOT_LAUNCH_CHECK;const result=spawnSync(process.execPath,['scripts/launch.cjs','server'],{cwd:root,encoding:'utf8',env});assert.equal(result.status,1);assert.match(result.stdout,/ERROR:/);assert.equal(fs.readFileSync(file,'utf8'),'{invalid-json');const logs=fs.readdirSync(path.join(root,'logs'));assert.equal(logs.length,1);assert.match(fs.readFileSync(path.join(root,'logs',logs[0]),'utf8'),/ERROR:/);
});
