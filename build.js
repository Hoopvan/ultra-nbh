// Build de production pour Vercel : injecte les variables d'environnement
// SUPABASE_URL / SUPABASE_ANON_KEY dans js/config.js, et copie tout dans dist/.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const ASSETS = ['style.css', 'manifest.json', 'sw.js', '_headers', 'icon-192.png', 'icon-512.png', 'logo-nbh.png', 'content'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const { SUPABASE_URL, SUPABASE_ANON_KEY, ORG_SLUG = 'nbh' } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans les variables d\'environnement.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// index.html
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// js/ — copie tout, puis substitue les credentials dans config.js
copyRecursive(path.join(ROOT, 'js'), path.join(OUT, 'js'));
const configPath = path.join(OUT, 'js', 'config.js');
let configJs = fs.readFileSync(configPath, 'utf8');
configJs = configJs
  .replace(/\{\{SUPABASE_URL\}\}/g, SUPABASE_URL)
  .replace(/\{\{SUPABASE_ANON_KEY\}\}/g, SUPABASE_ANON_KEY)
  .replace(/\{\{ORG_SLUG\}\}/g, ORG_SLUG);
fs.writeFileSync(configPath, configJs);

for (const asset of ASSETS) {
  const src = path.join(ROOT, asset);
  if (fs.existsSync(src)) copyRecursive(src, path.join(OUT, asset));
}

console.log('Build OK -> dist/');
