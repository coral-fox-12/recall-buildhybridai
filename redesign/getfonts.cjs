// Download the exact woff2 files (latin subset) for Newsreader + IBM Plex
// Mono, so the site has zero external font dependencies.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const url = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;1,6..72,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const css = execFileSync('curl', ['-s', '-A', UA, url], { encoding: 'utf8', maxBuffer: 1 << 22 });

const blocks = css.split('/*').map(b => b.trim()).filter(b => b.startsWith('latin */'));
const wanted = [];
for (const b of blocks) {
  const fam = (b.match(/font-family: '([^']+)'/) || [])[1];
  const weight = (b.match(/font-weight: (\d+)/) || [])[1];
  const style = (b.match(/font-style: (\w+)/) || [])[1] || 'normal';
  const src = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
  if (!fam || !weight || !src) continue;
  const file = fam.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + (style === 'italic' ? 'italic-' : '') + weight + '.woff2';
  wanted.push({ fam, weight, style, src, file });
}
console.log('found', wanted.length, 'latin faces');
const dir = path.join(__dirname, '..', 'fonts');
fs.mkdirSync(dir, { recursive: true });
for (const w of wanted) {
  const dest = path.join(dir, w.file);
  execFileSync('curl', ['-s', '-o', dest, w.src], { timeout: 60000 });
  const size = fs.statSync(dest).size;
  console.log(w.file, size, 'bytes');
  if (size < 1000) throw new Error('suspiciously small: ' + w.file);
}
