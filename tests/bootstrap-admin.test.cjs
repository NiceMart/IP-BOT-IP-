const {test}=require('node:test'),assert=require('node:assert/strict');
const sqlite=require('../user-server/node_modules/sqlite3');
const bcrypt=require('../user-server/node_modules/bcryptjs');
const {bootstrapAdmin}=require('../user-server/bootstrap-admin');
test('bootstrap creates a hashed local admin once, preserves changed passwords and rolls back network initialization',async()=>{
 const db=new sqlite.Database(':memory:');
 const run=sql=>new Promise((r,j)=>db.run(sql,e=>e?j(e):r()));
 const get=sql=>new Promise((r,j)=>db.get(sql,(e,row)=>e?j(e):r(row)));
 try {
 await run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, password TEXT, role TEXT, status TEXT, max_devices INTEGER, video_quota INTEGER, video_used INTEGER)');
 await run('CREATE TABLE user_subscriptions (user_id INTEGER,subscription_type TEXT,expires_at TEXT)');
 await assert.rejects(bootstrapAdmin(db,'0.0.0.0'),/loopback/);
 assert.equal((await get('SELECT COUNT(*) AS n FROM users')).n,0);
 assert.equal(await bootstrapAdmin(db,'127.0.0.1'),true);
 const row=await get('SELECT * FROM users');assert.equal(row.email,'15912345678');assert.equal(row.role,'admin');assert.equal(await bcrypt.compare('123456',row.password),true);
 await run("UPDATE users SET password='changed-hash'");
 assert.equal(await bootstrapAdmin(db,'127.0.0.1'),false);
 assert.equal((await get('SELECT password FROM users')).password,'changed-hash');
 assert.equal((await get('SELECT COUNT(*) AS n FROM user_subscriptions')).n,1);
 } finally {await new Promise(r=>db.close(r));}
});
