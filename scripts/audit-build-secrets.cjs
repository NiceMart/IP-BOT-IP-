const fs=require('node:fs'),path=require('node:path');
const {loadLocalConfig}=require('./local-config.cjs');
const root=path.resolve(__dirname,'..'),secrets=[];
function collect(o){for(const[k,v]of Object.entries(o||{})){if(v&&typeof v==='object')collect(v);else if(typeof v==='string'&&/key|secret|token|password/i.test(k)&&v.length>=12)secrets.push(v);}}
collect(loadLocalConfig(root));
let files=0;const findings=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|mjs|cjs|map|json|html)$/.test(e.name)){files++;const text=fs.readFileSync(p,'utf8');if(secrets.some(s=>text.includes(s)))findings.push(path.relative(root,p));}}}
for(const name of ['dist','dist-electron']){const p=path.join(root,name);if(!fs.existsSync(p))throw Error('Build first: missing '+name);walk(p);}
console.log(JSON.stringify({checkedFiles:files,credentialValuesCompared:secrets.length,findings},null,2));
process.exitCode=findings.length?1:0;
