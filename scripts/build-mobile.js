// scripts/build-mobile.js — Copy source files into www/ before cap sync
// Run via: npm run build:mobile  (or npm run sync)
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW  = path.join(ROOT, 'www');

if (!fs.existsSync(WWW)) fs.mkdirSync(WWW, { recursive: true });

function copy(src, dest) {
  fs.copyFileSync(src, dest);
  const rel = path.relative(ROOT, dest);
  console.log('  copied →', rel);
}

console.log('Building www/...');
copy(path.join(ROOT, 'nerva-ui-shared.js'),   path.join(WWW, 'nerva-ui-shared.js'));
copy(path.join(ROOT, 'nerva-storage.js'),     path.join(WWW, 'nerva-storage.js'));
copy(path.join(ROOT, 'nerva-sync-stub.js'),   path.join(WWW, 'nerva-sync-stub.js'));
copy(path.join(ROOT, 'nerva-safety.js'),      path.join(WWW, 'nerva-safety.js'));
copy(path.join(ROOT, 'nerva-v11-core.jsx'),   path.join(WWW, 'nerva-v11-core.jsx'));
copy(path.join(ROOT, 'tweaks-panel.jsx'),     path.join(WWW, 'tweaks-panel.jsx'));
copy(path.join(ROOT, 'checkpoint-card.jsx'),  path.join(WWW, 'checkpoint-card.jsx'));
copy(path.join(ROOT, 'nerva-app.jsx'),        path.join(WWW, 'nerva-app.jsx'));
console.log('Done. Run: npx cap sync');
