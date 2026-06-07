// Build de production pour Vercel : injecte les variables d'environnement
// SUPABASE_URL / SUPABASE_ANON_KEY (définies dans Project Settings > Environment
// Variables) dans index.html, et copie les assets statiques dans dist/.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const ASSETS = ['manifest.json', 'sw.js', '_headers', 'icon-192.png', 'icon-512.png', 'logo-nbh.png', 'content'];

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

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans les variables d\'environnement.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/\{\{SUPABASE_URL\}\}/g, SUPABASE_URL).replace(/\{\{SUPABASE_ANON_KEY\}\}/g, SUPABASE_ANON_KEY);
fs.writeFileSync(path.join(OUT, 'index.html'), html);

for (const asset of ASSETS) {
  const src = path.join(ROOT, asset);
  if (fs.existsSync(src)) copyRecursive(src, path.join(OUT, asset));
}

console.log('Build OK -> dist/');
