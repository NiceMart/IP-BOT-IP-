const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require('./local-config.cjs').applyLocalEnvironment(root);
process.env.VITE_DEV_SERVER_URL ||= 'http://127.0.0.1:3344';
process.env.EXTERNAL_ELECTRON_DEV='1';
const child=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--host','127.0.0.1','--port','3344','--strictPort'],{cwd:root,env:process.env,stdio:'inherit',windowsHide:true});
child.on('error',e=>{console.error(e.message);process.exitCode=1});
child.on('exit',code=>process.exitCode=code??1);
