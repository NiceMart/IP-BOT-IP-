const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
require('./local-config.cjs').applyLocalEnvironment(root);
for(const file of ['dist/index.html','dist-electron/main/index.js','dist-electron/preload/index.js'])if(!fs.existsSync(path.join(root,file)))throw Error('Built desktop file missing: '+file+'. Run npm run build first.');
const env={...process.env};delete env.VITE_DEV_SERVER_URL;delete env.ELECTRON_RUN_AS_NODE;delete env.EXTERNAL_ELECTRON_DEV;
console.log('Opening the built desktop interface; no Vite development server is required.');
const child=spawn(require('electron'),['.'],{cwd:root,env,stdio:'inherit',windowsHide:true});
child.on('error',error=>{console.error(error.message);process.exitCode=1});
child.on('exit',code=>process.exitCode=code??1);
