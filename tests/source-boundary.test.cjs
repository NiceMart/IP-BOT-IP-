const {test}=require('node:test'),assert=require('node:assert/strict');
const {sourceFiles}=require('../scripts/audit-source.cjs');
test('source selection excludes private configuration, databases, dependencies and runtime binaries',()=>{
 const files=sourceFiles();assert.ok(files.includes('package-lock.json'));assert.ok(files.includes('user-server/package-lock.json'));
 assert.ok(files.includes('electron/resources/extra/common/config/system-templates.json'));
 assert.ok(files.every(p=>!/(?:^|\/)(node_modules|data|modes)(?:\/|$)|sensitive\.config\.json$|\.db$/.test(p)));
 assert.ok(files.every(p=>!/^electron\/resources\/extra\/(win-|common\/(python|models|playwright))/.test(p)));
});
