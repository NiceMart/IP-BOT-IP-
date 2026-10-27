const {test}=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const root=path.resolve(__dirname,'..');
async function freePort(){return new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});}
test('isolated backend: accounts, configuration, admin permissions and account ownership',{timeout:45000},async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ipbot-server-')),port=await freePort();
 const child=spawn(process.execPath,['user-server/server.js'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATABASE_PATH:path.join(temp,'users.db'),JWT_SECRET:'isolated-test-secret-'.repeat(3)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const call=async(route,method='GET',body,token)=>{const r=await fetch(`http://127.0.0.1:${port}/api/${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),headers:r.headers};};
 t.after(async()=>{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));fs.rmSync(temp,{recursive:true,force:true});});
 let ready=false;for(let i=0;i<120;i++){try{await call('system/config/public');ready=true;break;}catch{if(child.exitCode!==null)throw Error('Backend failed to start: '+logs);await new Promise(r=>setTimeout(r,100));}}
 assert.ok(ready,'backend started');
 await t.test('anonymous and invalid tokens cannot obtain cloud credentials',async()=>{
  assert.deepEqual((await call('system/config/public')).data.config,{});assert.equal((await call('system/config/public','GET',undefined,'invalid')).status,401);
  assert.equal((await call('generate-test-cdkey','POST',{})).status,401);
  assert.equal((await call('admin/users')).status,401);
 });
 let admin,member;
 await t.test('first local account becomes admin; second account requires a generated invitation',async()=>{
  const r=await call('register','POST',{username:'qa-admin',email:'admin@example.invalid',password:'FixtureOnly!12345',device_fingerprint:'qa-admin-device'});
  assert.equal(r.data.success,true,r.data.message);admin=r.data;assert.equal(admin.user.role,'admin');
  const blocked=await call('register','POST',{username:'qa-member',email:'member@example.invalid',password:'FixtureOnly!12345',device_fingerprint:'qa-member-device'});assert.equal(blocked.data.success,false);
  const card=await call('generate-test-cdkey','POST',{},admin.token);assert.equal(card.data.success,true);
  const memberResult=await call('register','POST',{username:'qa-member',email:'member@example.invalid',password:'FixtureOnly!12345',device_fingerprint:'qa-member-device',cdkey:card.data.cdkey});
  assert.equal(memberResult.data.success,true,memberResult.data.message);member=memberResult.data;assert.equal(member.user.role,'user');
 });
 await t.test('valid login and token verification preserve the existing account flow',async()=>{
  const login=await call('login','POST',{email:'admin@example.invalid',password:'FixtureOnly!12345',device_fingerprint:'qa-admin-device'});assert.equal(login.data.success,true,login.data.message);
  const verify=await call('verify','POST',{token:login.data.token,device_fingerprint:'qa-admin-device'});assert.equal(verify.data.valid,true);admin.token=login.data.token;
 });
 await t.test('admin saves configuration; only authenticated trusted clients can read it',async()=>{
  const update=await call('admin/system/config','PUT',{configs:{aliyun_bailian_api_key:'synthetic-not-a-provider-key'}},admin.token);assert.equal(update.data.success,true);
  const auth=await call('system/config/public','GET',undefined,member.token);assert.equal(auth.data.config.aliyun_bailian_api_key,'synthetic-not-a-provider-key');
  assert.deepEqual((await call('system/config/public')).data.config,{});
  assert.equal((await call('admin/users','GET',undefined,member.token)).status,403);
 });
 await t.test('subscription, quota and generation logs enforce account ownership',async()=>{
  assert.equal((await call(`video/quota/${member.user.id}`)).status,401);
  assert.equal((await call(`video/quota/${admin.user.id}`,'GET',undefined,member.token)).status,403);
  assert.equal((await call(`video/quota/${member.user.id}`,'GET',undefined,member.token)).data.success,true);
  assert.equal((await call('subscription/check','POST',{user_id:member.user.id},member.token)).data.hasAccess,true);
  assert.equal((await call('user/generation-log','POST',{userId:admin.user.id,type:'voice'},member.token)).status,403);
  assert.equal((await call('user/generation-log','POST',{userId:member.user.id,type:'voice',detail:'isolated fixture'},member.token)).data.success,true);
 });
 await t.test('untrusted browser origins do not receive CORS access',async()=>{
  const r=await fetch(`http://127.0.0.1:${port}/api/system/config/public`,{headers:{Origin:'https://untrusted.invalid'}});assert.equal(r.headers.get('access-control-allow-origin'),null);
 });
});
