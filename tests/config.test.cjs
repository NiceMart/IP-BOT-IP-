const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {parseEnv,loadLocalConfig}=require('../scripts/local-config.cjs');
test('env parser preserves quoted values without evaluating code',()=>{
 assert.deepEqual(parseEnv('APP_NAME="IP Bot"\n# note\nJWT_SECRET=abc # comment\nIGNORED_LOWER=no\nCOMMAND="$(never-run)"'),{APP_NAME:'IP Bot',JWT_SECRET:'abc',IGNORED_LOWER:'no',COMMAND:'$(never-run)'});
});
test('environment overrides local files; blank template values retain JSON defaults',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ipbot-config-'));
 const old=process.env.APP_NAME;
 try {fs.writeFileSync(path.join(root,'sensitive.config.json'),JSON.stringify({APP_NAME:'json',JWT_SECRET:'generated'}));fs.writeFileSync(path.join(root,'.env'),'APP_NAME=env\nJWT_SECRET=');
 assert.equal(loadLocalConfig(root).JWT_SECRET,'generated');process.env.APP_NAME='process';assert.equal(loadLocalConfig(root).APP_NAME,'process');
 } finally {if(old===undefined)delete process.env.APP_NAME;else process.env.APP_NAME=old;fs.rmSync(root,{recursive:true,force:true});}
});
