/**
 * The Formulate | asset pipeline
 * Turns the raw brand files (6MB PNGs, 6250px logo) into web-optimised WebP/PNG
 * assets inside assets/img/. Requires ffmpeg on PATH. Run: node tools/build-assets.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img');
fs.mkdirSync(OUT, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const src = (p) => path.join(ROOT, p);
const out = (p) => path.join(OUT, p);
const kb = (p) => Math.round(fs.statSync(p).size / 1024);
const log = [];

/* ---------- product posters: flatten, resize, webp ---------- */
const PRODUCTS = [
  ['rosemary-hair-serum', 'Product Description/Rosemary Hair Growth Serum/Rosemary Hair Growth Serum.jpg'],
  ['rosemary-essential-oil', 'Product Description/Rosemary Essential Oil/Rosemary Essential Oil.png'],
  ['argan-oil', 'Product Description/Argan Essential Oil/Argan Essential Oil.png'],
  ['jojoba-oil', 'Product Description/Jojoba Essential Oil/Jojoba Essential Oil.png'],
  ['pumpkin-seed-oil', 'Product Description/Pumpkin Seed Essential Oil/Pumpkin Seed Essential Oil.png'],
  ['peppermint-essential-oil', 'Product Description/Peppermint Essential Oil/Peppermint Essential Oil.png'],
];

for (const [slug, file] of PRODUCTS) {
  ff(['-i', src(file), '-vf', 'scale=760:760:flags=lanczos,format=rgb24', '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '78', '-compression_level', '6', out(slug + '.webp')]);
  ff(['-i', src(file), '-vf', 'scale=1200:1200:flags=lanczos,format=rgb24', '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', out(slug + '-lg.webp')]);
  // per-product Open Graph card: square poster centred on the sand brand colour
  ff(['-i', src(file), '-vf', 'scale=630:630:flags=lanczos,pad=1200:630:(ow-iw)/2:0:color=0xE8E2D8,format=yuvj420p',
    '-frames:v', '1', '-q:v', '3', out('og-' + slug + '.jpg')]);
  ff(['-i', src(file), '-vf', 'scale=20:20:flags=area,format=rgb24', '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '40', out('_lqip-' + slug + '.webp')]);
  log.push(slug + '.webp ' + kb(out(slug + '.webp')) + 'KB / -lg ' + kb(out(slug + '-lg.webp')) + 'KB');
}

/* ---------- logo: trim whitespace, two colourways ---------- */
// content box measured from the 6250px master: x1221 y2673 w3870 h818
const LOGO = src('Logo/The Formulate.co Logo (main.).webp');
const PAD = 90;
const crop = 'crop=' + (3870 + PAD * 2) + ':' + (818 + PAD * 2) + ':' + (1221 - PAD) + ':' + (2673 - PAD);

ff(['-i', LOGO, '-vf', crop + ',scale=620:-1:flags=lanczos,format=rgba', '-frames:v', '1',
  '-c:v', 'libwebp', '-quality', '92', out('logo.webp')]);
// cream monochrome version for the dark footer: keep the alpha shape, repaint RGB
ff(['-i', LOGO, '-vf', crop + ',scale=620:-1:flags=lanczos,format=rgba,geq=r=250:g=247:b=242:a=alpha(X\\,Y)',
  '-frames:v', '1', '-c:v', 'libwebp', '-quality', '92', out('logo-light.webp')]);
log.push('logo.webp ' + kb(out('logo.webp')) + 'KB, logo-light.webp ' + kb(out('logo-light.webp')) + 'KB');

/* ---------- favicon / app icons from the "F." mark ---------- */
// mark box on the 2000px master: x730 y582 w605 h871 -> square crop with padding
const FAV = src('Logo/The Formulate.co Logo (Favicon.).webp');
const favCrop = 'crop=1264:1264:400:385';
for (const size of [16, 32, 48, 180, 512]) {
  ff(['-i', FAV, '-vf', favCrop + ',scale=' + size + ':' + size + ':flags=lanczos,format=rgb24',
    '-frames:v', '1', out('icon-' + size + '.png')]);
}
fs.renameSync(out('icon-180.png'), out('apple-touch-icon.png'));
ff(['-i', FAV, '-vf', favCrop + ',scale=400:400:flags=lanczos,format=rgba', '-frames:v', '1',
  '-c:v', 'libwebp', '-quality', '92', out('mark.webp')]);

/* ---------- favicon.ico (PNG-payload ICO, 16/32/48) ---------- */
const icoSizes = [16, 32, 48];
const pngs = icoSizes.map((s) => fs.readFileSync(out('icon-' + s + '.png')));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = 6 + 16 * icoSizes.length;
const dirs = icoSizes.map((s, i) => {
  const d = Buffer.alloc(16);
  d.writeUInt8(s, 0);
  d.writeUInt8(s, 1);
  d.writeUInt16LE(1, 4);
  d.writeUInt16LE(32, 6);
  d.writeUInt32LE(pngs[i].length, 8);
  d.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return d;
});
fs.writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([header, ...dirs, ...pngs]));
log.push('favicon.ico ' + kb(path.join(ROOT, 'favicon.ico')) + 'KB');

/* ---------- social proof, models, banners ---------- */
ff(['-i', src('Social Proof/Haircare Before and After Social Proof.webp'),
  '-vf', 'scale=1000:1000:flags=lanczos,format=rgb24', '-frames:v', '1',
  '-c:v', 'libwebp', '-quality', '80', out('proof-before-after.webp')]);

const MODELS = fs.readdirSync(src('Model Poster')).filter((f) => /\.webp$/i.test(f)).sort();
MODELS.forEach((f, i) => {
  ff(['-i', src(path.join('Model Poster', f)),
    '-vf', 'scale=620:-1:flags=lanczos,format=rgb24', '-frames:v', '1',
    '-c:v', 'libwebp', '-quality', '80', out('model-' + (i + 1) + '.webp')]);
});

ff(['-i', src('Static Banner RHS (1)/Static Banner RHS (1).webp'),
  '-vf', 'scale=1800:-1:flags=lanczos,format=rgb24', '-frames:v', '1',
  '-c:v', 'libwebp', '-quality', '82', out('banner-wide.webp')]);
ff(['-i', src('Static Banner RHS (1)/RHS Top Banner (1).webp'),
  '-vf', 'scale=1600:-1:flags=lanczos,format=rgb24', '-frames:v', '1',
  '-c:v', 'libwebp', '-quality', '82', out('banner-top.webp')]);

/* ---------- Open Graph card (1200x630 JPEG, letterboxed banner) ---------- */
ff(['-i', src('Static Banner RHS (1)/RHS Top Banner (1).webp'),
  '-vf', 'scale=1200:-1:flags=lanczos,pad=1200:630:(ow-iw)/2:(oh-ih)/2:color=0xF1F8F7,format=yuvj420p',
  '-frames:v', '1', '-q:v', '3', out('og-image.jpg')]);
log.push('og-image.jpg ' + kb(out('og-image.jpg')) + 'KB');

/* ---------- emit LQIP data URIs for the HTML build ---------- */
const lqip = {};
for (const [slug] of PRODUCTS) {
  const p = out('_lqip-' + slug + '.webp');
  lqip[slug] = 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64');
  fs.unlinkSync(p);
}
fs.writeFileSync(path.join(ROOT, 'tools', 'lqip.json'), JSON.stringify(lqip, null, 2));

console.log(log.join('\n'));
console.log('\n--- assets/img ---');
let total = 0;
for (const f of fs.readdirSync(OUT).sort()) {
  total += fs.statSync(out(f)).size;
  console.log(String(kb(out(f))).padStart(5) + 'KB  ' + f);
}
console.log('TOTAL ' + Math.round(total / 1024) + 'KB');
