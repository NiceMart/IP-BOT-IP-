const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ignore=require('ignore');
const root=path.resolve(__dirname,'..');
function sourceFiles(base=root){const rules=ignore().add(fs.readFileSync(path.join(base,'.gitignore'),'utf8')),files=[];
 function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.posix.join(rel,e.name);if(e.name==='.git'||e.isSymbolicLink()||rules.ignores(p+(e.isDirectory()?'/':'')))continue;if(e.isDirectory())walk(path.join(dir,e.name),p);else files.push(p);}}walk(base);return files.sort();}
function audit(base=root){const files=sourceFiles(base),findings=[];
 const forbidden=/(?:^|\/)(?:node_modules|data|modes|logs|dist(?:-[^/]+)?|resources-bundles)(?:\/|$)|(?:^|\/)\.env$|(?:^|\/)sensitive\.config\.json$|\.(?:db|sqlite3?)(?:$|[-.])|\.(?:pem|p12|pfx|key)$/i;
 const patterns=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['GitHub-token',/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}/],['cloud-access-key',/\bAKIA[A-Z0-9]{16}\b|\bLTAI[A-Za-z0-9]{20,}\b/]];
 let bytes=0;const hashes={};
 for(const rel of files){if(forbidden.test(rel))findings.push({file:rel,rule:'private-file'});const data=fs.readFileSync(path.join(base,rel));bytes+=data.length;hashes[rel]=crypto.createHash('sha256').update(data).digest('hex');
 if(/\.(?:[cm]?js|ts|vue|py|json|md|html|ya?ml|css|less|sh|bat|ps1|env\.example)$/.test(rel)&&data.length<5e6){const text=data.toString('utf8');for(const [rule,p]of patterns)if(p.test(text))findings.push({file:rel,rule});}
 }
 for(const name of ['README.md','README.en.md','LICENSE','NOTICE','THIRD_PARTY_NOTICES.md','.env.example','package-lock.json','user-server/package-lock.json'])if(!files.includes(name))findings.push({file:name,rule:'required-file-missing'});
 return {files:files.length,bytes,findings,paths:files,sha256:hashes};}
module.exports={sourceFiles,audit};
if(require.main===module){const r=audit();console.log(JSON.stringify({files:r.files,MB:+(r.bytes/1048576).toFixed(2),findings:r.findings},null,2));process.exitCode=r.findings.length?1:0;}
