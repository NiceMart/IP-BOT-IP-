// Run with Electron's own Node runtime, rather than the system Node ABI.
const assert = require('node:assert/strict');
if (!process.versions.electron) throw new Error('Runtime checks must run inside Electron.');
const Database = require('better-sqlite3');
const db = new Database(':memory:');
try { assert.equal(db.prepare('SELECT 1 AS ready').get().ready, 1); }
finally { db.close(); }
const sharp = require('sharp');
assert.ok(sharp.versions.vips, 'Sharp native image runtime is unavailable.');
// ws already has JavaScript / built-in UTF-8 fallbacks. These accelerators use
// Node-API prebuilds and must not be recompiled against Electron's V8 ABI.
for (const name of ['bufferutil', 'utf-8-validate']) {
  try { require(name); console.log(`[runtime] ${name}: prebuilt accelerator ready`); }
  catch { console.log(`[runtime] ${name}: using WebSocket fallback`); }
}
console.log(`[runtime] Electron ${process.versions.electron}, ABI ${process.versions.modules}: SQLite and Sharp ready`);
