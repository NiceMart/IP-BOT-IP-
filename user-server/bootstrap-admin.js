const bcrypt = require('bcryptjs');
// Only an empty local database gets the documented development account.
async function bootstrapAdmin(db, host) {
 const run=(sql,args=[])=>new Promise((resolve,reject)=>db.run(sql,args,function(e){e?reject(e):resolve(this)}));
 const get=sql=>new Promise((resolve,reject)=>db.get(sql,(e,row)=>e?reject(e):resolve(row)));
 await run('BEGIN IMMEDIATE');
 try {
  const row=await get('SELECT COUNT(*) AS count FROM users');
  if(row.count){await run('COMMIT');return false;}
  if(!['127.0.0.1','localhost','::1'].includes(host)) throw Error('Initialize on loopback first and change the default administrator password before network deployment.');
  const hash=await bcrypt.hash('123456',10);
  const user=await run("INSERT INTO users (username,email,password,role,status,max_devices,video_quota,video_used) VALUES (?, ?, ?, 'admin', 'active', 5, 9999, 0)",['15912345678','15912345678',hash]);
  const expires=new Date();expires.setFullYear(expires.getFullYear()+100);
  await run("INSERT INTO user_subscriptions (user_id,subscription_type,expires_at) VALUES (?, 'admin', ?)",[user.lastID,expires.toISOString()]);
  await run('COMMIT');return true;
 } catch(e){await run('ROLLBACK');throw e;}
}
module.exports={bootstrapAdmin};
