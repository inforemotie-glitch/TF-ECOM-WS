/**
 * The Formulate | page builder
 * Generates index.html, products/*.html, privacy-policy.html, sitemap.xml,
 * robots.txt and site.webmanifest from shared partials, so every page carries
 * the identical header, Meta Pixel code, cart, order form and footer.
 *
 * Product prices and names are read from the CATALOG block inside script.js,
 * so the storefront, cart, checkout and tracking can never disagree on price.
 *
 * Run: node tools/build-pages.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

/* ---------------------------------------------------------------- config */
const SITE = 'https://www.theformulate.co';
const BRAND = 'The Formulate';
const PIXEL_ID = '823926397477218';
const FORMSPREE = 'https://formspree.io/f/xwlkdnva';
const EMAIL = 'theformulate.co@gmail.com';
const PHONE_DISPLAY = '+880 1617-226321';
const PHONE_BN = '+৮৮০ ১৬১৭-২২৬৩২১';
const PHONE_E164 = '+8801617226321';
const WHATSAPP = 'https://wa.me/+8801617226321';
const FACEBOOK = 'https://www.facebook.com/theformulate.co';
const FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Hind+Siliguri:wght@400;500;600;700&family=Jost:wght@400;500;600&display=swap';

const { SPRITE } = require('./lib/icons.cjs');
const DISTRICTS = require('./lib/districts.cjs');
const LQIP = require('./lqip.json');
const CONTENT = [...require('./content/products-hair.cjs'), ...require('./content/products-care.cjs')];

/* ------------------------------------------- catalog from script.js */
const scriptSrc = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const catalogBlock = scriptSrc.split('/* CATALOG:START */')[1].split('/* CATALOG:END */')[0];
const CATALOG = new Function(`${catalogBlock}\nreturn CATALOG;`)();

CONTENT.forEach((c) => {
  if (!CATALOG[c.id]) throw new Error(`Copy exists for unknown product "${c.id}"`);
});
const PRODUCTS = Object.keys(CATALOG).map((id) => {
  const copy = CONTENT.find((c) => c.id === id);
  if (!copy) throw new Error(`No page copy for catalog product "${id}"`);
  return { ...copy, ...CATALOG[id] };
});
const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

/* ---------------------------------------------------------------- helpers */
const BN = '০১২৩৪৫৬৭৮৯';
const bnDigits = (s) => String(s).replace(/\d/g, (d) => BN[d]);
const group = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const bn = (n) => bnDigits(group(n));
const taka = (n) => `৳${bn(n)}`;
const off = (p) => Math.round((1 - p.price / p.compare) * 100);
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ic = (id, cls = '') => `<svg class="ico${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const stars = () => `<span class="stars" aria-hidden="true">${ic('star', 'ico--fill').repeat(5)}</span>`;
const fill = (str, p) =>
  String(str)
    .replace(/\{price\}/g, taka(p.price))
    .replace(/\{compare\}/g, taka(p.compare))
    .replace(/\{save\}/g, taka(p.compare - p.price));
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
const fileHash = (file) => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);
const VERSION = { css: fileHash('styles.css'), js: fileHash('script.js') };
const YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

function webpSize(file) {
  const b = fs.readFileSync(path.join(ROOT, file));
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  if (kind === 'VP8 ') {
    const s = b.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
    return { w: b.readUInt16LE(s + 3) & 0x3fff, h: b.readUInt16LE(s + 5) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unrecognised WebP: ${file}`);
}
const img = (file) => ({ src: `/${file}`, ...webpSize(file) });
// content hash so a re-uploaded poster defeats the 30-day asset cache
const ver = (p) => `${p}?v=${fileHash(p.replace(/^\//, ''))}`;

const IMG = {
  logo: img('assets/img/logo.webp'),
  logoLight: img('assets/img/logo-light.webp'),
  proof: img('assets/img/proof-before-after.webp'),
  banner: img('assets/img/banner-wide.webp'),
  models: [1, 2, 3, 4].map((n) => img(`assets/img/model-${n}.webp`)),
};

const MODEL_ALT = [
  'লাল শার্ট পরা তরুণী হাসিমুখে The Formulate রোজমেরি হেয়ার সিরাম হাতে ধরে আছেন',
  'লাল শার্ট পরা তরুণী হাতের তালুতে The Formulate রোজমেরি হেয়ার সিরাম দেখাচ্ছেন',
  'ফুলেল প্রিন্টের জ্যাকেট পরা তরুণী হাসিমুখে The Formulate হেয়ার সিরাম দেখাচ্ছেন',
  'ফুলেল প্রিন্টের জ্যাকেট পরা তরুণী ড্রপার দিয়ে The Formulate হেয়ার সিরাম ব্যবহার করছেন',
];

/* ================================================================ partials */

function head({ title, description, canonical, image, imageW = 1200, imageH = 630, imageAlt, type = 'website', jsonld = [], preload = [] }) {
  const ogImage = image || `${SITE}/assets/img/og-image.jpg`;
  const ld = jsonld
    .filter(Boolean)
    .map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="bn" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#2F4034">
<meta name="format-detection" content="telephone=no">
<script>document.documentElement.className='js';</script>

<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:locale" content="bn_BD">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="${imageW}">
<meta property="og:image:height" content="${imageH}">
<meta property="og:image:alt" content="${esc(imageAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ogImage}">

<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/icon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://connect.facebook.net">
${preload.map((href) => `<link rel="preload" as="image" href="${href}" fetchpriority="high">`).join('\n')}
<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${FONTS}"></noscript>
<link rel="stylesheet" href="/styles.css?v=${VERSION.css}">

<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
/* PageView is fired by script.js with a UUID eventID that is shared with /api/meta for deduplication. */
</script>
<!-- End Meta Pixel Code -->

${ld}
<script src="/script.js?v=${VERSION.js}" defer></script>
</head>`;
}

function bodyOpen(attrs = '') {
  return `<body${attrs}>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${PIXEL_ID}&amp;ev=PageView&amp;noscript=1"></noscript>
${SPRITE}
<a class="skip" href="#main">মূল কনটেন্টে চলে যান</a>
<div class="progress" data-progress aria-hidden="true"></div>`;
}

const ANNOUNCE = [
  ['truck', 'সারা বাংলাদেশে সম্পূর্ণ ফ্রি ডেলিভারি'],
  ['cash', 'ক্যাশ অন ডেলিভারি, প্রোডাক্ট হাতে পেয়ে টাকা দিন'],
  ['leaf', '100% Natural, Cold Pressed &amp; Steam Distilled'],
  ['sparkle', 'Healthy Hair in 21 Days'],
  ['phone', `অর্ডার ও পরামর্শ: ${PHONE_BN}`],
];

function header({ home = false } = {}) {
  const base = home ? '' : '/';
  const links = [
    ['#products', 'প্রোডাক্ট'],
    ['#why', 'কেন আমরা'],
    ['#ritual', 'ব্যবহারবিধি'],
    ['#reviews', 'রিভিউ'],
    ['#faq', 'প্রশ্নোত্তর'],
    ['#contact', 'যোগাযোগ'],
  ];
  const tickerGroup = (hidden) =>
    `<div class="announce__group"${hidden ? ' aria-hidden="true"' : ''}>${ANNOUNCE.map(([i, t]) => `<span>${ic(i)}${t}</span>`).join('')}</div>`;

  return `
<div class="announce" role="region" aria-label="অফার ও ঘোষণা">
  <div class="announce__track">${tickerGroup(false)}${tickerGroup(true)}</div>
</div>
<header class="header" data-header>
  <div class="shell header__bar">
    <a class="brand" href="/" aria-label="The Formulate হোমপেজ">
      <img src="${IMG.logo.src}" alt="The Formulate" width="${IMG.logo.w}" height="${IMG.logo.h}" fetchpriority="high" decoding="async">
    </a>
    <nav class="nav" aria-label="প্রধান মেনু">
      <ul class="nav__list">
        ${links.map(([href, label]) => `<li><a class="nav__link" href="${base}${href}">${label}</a></li>`).join('\n        ')}
      </ul>
    </nav>
    <div class="header__actions">
      <a class="icon-btn icon-btn--wa" href="${WHATSAPP}" target="_blank" rel="noopener" aria-label="WhatsApp এ মেসেজ করুন">${ic('wa', 'ico--fill')}</a>
      <button class="icon-btn" type="button" data-cart-open aria-controls="cart-drawer" aria-expanded="false" aria-label="কার্ট খুলুন">
        ${ic('bag')}<span class="cart-count" data-cart-count>০</span>
      </button>
      <button class="icon-btn burger" type="button" data-nav-open aria-controls="mobile-nav" aria-expanded="false" aria-label="মেনু খুলুন">${ic('menu')}</button>
    </div>
  </div>
</header>

<nav class="mobile-nav" id="mobile-nav" aria-label="মোবাইল মেনু" aria-hidden="true" inert>
  <div class="mobile-nav__top">
    <img src="${IMG.logo.src}" alt="The Formulate" width="${IMG.logo.w}" height="${IMG.logo.h}" loading="lazy" decoding="async">
    <button class="icon-btn" type="button" data-nav-close aria-label="মেনু বন্ধ করুন">${ic('x')}</button>
  </div>
  <ul class="mobile-nav__list">
    <li><a href="/" data-close-layers>হোম ${ic('chev')}</a></li>
    ${links.map(([href, label]) => `<li><a href="${base}${href}" data-close-layers>${label} ${ic('chev')}</a></li>`).join('\n    ')}
    <li><a href="/privacy-policy" data-close-layers>প্রাইভেসি পলিসি ${ic('chev')}</a></li>
  </ul>
  <div class="mobile-nav__foot">
    <a class="btn btn--primary btn--block" href="${base}#order" data-scroll-order data-cta="Mobile Menu">${ic('zap')}<span class="btn__label">এখনই অর্ডার করুন</span></a>
    <a class="btn btn--outline btn--block" href="${WHATSAPP}" target="_blank" rel="noopener">${ic('wa', 'ico--fill')}<span class="btn__label">WhatsApp এ কথা বলুন</span></a>
  </div>
</nav>`;
}

function productCard(p) {
  return `
<article class="card reveal">
  <a class="card__media" href="${p.url}" aria-label="${esc(p.name)} এর বিস্তারিত দেখুন">
    <img src="${p.img}" alt="${esc(p.name)} ${p.size}, The Formulate" width="760" height="760" loading="lazy" decoding="async" style="background:url(${LQIP[p.id]}) center/cover">
    <span class="card__flags">
      <span class="flag flag--save">${bn(off(p))}% ছাড়</span>
      ${p.badge ? `<span class="flag ${p.badgeBest ? 'flag--best' : 'flag--soft'}">${p.badge}</span>` : ''}
    </span>
    <span class="card__quick"><span class="btn btn--sm">${ic('eye')}বিস্তারিত দেখুন</span></span>
  </a>
  <div class="card__body">
    <div class="card__rating">${stars()}<span>${bnDigits(p.rating.toFixed(1))} (${bn(p.reviews)}<span class="hide-sm"> রিভিউ</span>)</span></div>
    <a href="${p.url}"><h3 class="card__title">${esc(p.name)}</h3></a>
    <p class="card__sub">${esc(p.cardSub)} | ${p.size}</p>
    <p class="card__desc">${p.tagline}</p>
    <div class="card__price">
      <span class="price-now">${taka(p.price)}</span>
      <s class="price-was">${taka(p.compare)}</s>
      <span class="price-save">${taka(p.compare - p.price)} সাশ্রয়</span>
    </div>
    <div class="card__actions">
      <button class="btn btn--outline btn--sm" type="button" data-add-to-cart="${p.id}">${ic('bag')}<span class="btn__label">কার্টে যোগ করুন</span></button>
      <button class="btn btn--primary btn--sm" type="button" data-buy-now="${p.id}" data-cta="Buy Now | ${esc(p.en)}">${ic('zap')}<span class="btn__label">এখনই কিনুন</span></button>
    </div>
  </div>
</article>`;
}

function secCta(text, label, cta, preselect = '') {
  return `
<div class="sec-cta reveal">
  <p>${text}</p>
  <a class="btn btn--primary" href="#order" data-scroll-order data-cta="${esc(cta)}"${preselect ? ` data-preselect="${preselect}"` : ''}>
    <span class="btn__label">${label}</span>${ic('arrow')}
  </a>
</div>`;
}

function statCell(s) {
  const shown = s.count.includes('.') ? bnDigits(s.count) : bn(Number(s.count));
  return `<div class="stats__cell"><span class="stats__num" data-count="${s.count}"${s.suffix ? ` data-suffix="${esc(s.suffix)}"` : ''}>${shown}${s.suffix || ''}</span><span class="stats__label">${s.label}</span></div>`;
}

function quoteCard(q, i, product) {
  const initial = [...q.name.trim()][0];
  return `
<figure class="quote reveal">
  <div class="row gap-8" style="justify-content:space-between">
    ${stars()}
    ${product ? `<a class="pill" style="font-size:.7rem;padding:4px 11px" href="${product.url}">${esc(product.name)}</a>` : ''}
  </div>
  <span class="quote__mark" aria-hidden="true">&ldquo;</span>
  <blockquote><p>${q.text}</p></blockquote>
  <figcaption class="quote__who">
    <span class="avatar avatar--${(i % 4) + 1}" aria-hidden="true">${initial}</span>
    <span><strong>${q.name}</strong><span>${q.place}</span></span>
  </figcaption>
</figure>`;
}

function field({ id, name, label, hint = '', icon, control, top = false }) {
  return `
<div class="field">
  <label class="field__label" for="${id}">${label} <span class="req" aria-hidden="true">*</span>${hint ? `<span class="field__hint">${hint}</span>` : ''}</label>
  <div class="control${top ? ' control--top' : ''}">${ic(icon)}${control}</div>
  <p class="error" id="${id}-err">${ic('alert')}<span></span></p>
</div>`;
}

function orderSection(p = null) {
  const initial = p ? taka(p.price) : taka(0);
  const staticLine = p
    ? `<div class="sum__item"><img src="${p.img}" alt="" width="70" height="70" loading="lazy" decoding="async"><div><div class="sum__name">${esc(p.name)}</div><div class="sum__meta">${p.size}, প্রতিটি ${taka(p.price)}</div></div><span class="sum__line">${taka(p.price)}</span></div>`
    : '';
  const districtOptions = DISTRICTS.map(
    (d) =>
      `<optgroup label="${d.division}">${d.list.map(([b, e]) => `<option value="${b}" data-en="${e}">${b}</option>`).join('')}</optgroup>`
  ).join('');

  return `
<section class="section section--forest order" id="order" aria-labelledby="order-title" data-buybar-hide>
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Cash On Delivery Checkout</span>
      <h2 class="h-1" id="order-title">${p ? 'অর্ডার করুন এখনই, টাকা দিন প্রোডাক্ট হাতে পেয়ে' : 'আপনার অর্ডারটি সম্পন্ন করুন'}</h2>
      <p class="lede">মাত্র ৪টি তথ্য দিন: নাম, মোবাইল নম্বর, জেলা আর ঠিকানা। কোনো অগ্রিম পেমেন্ট নেই। আমাদের টিম কল করে অর্ডার কনফার্ম করবে, তারপর প্রোডাক্ট পৌঁছে যাবে আপনার দরজায়।</p>
    </div>

    <div class="order__grid">
      <div class="panel reveal" data-order-panel>
        <div data-order-body>
          <div class="panel__head">
            <h3 class="h-3">ডেলিভারির তথ্য দিন</h3>
            <p>সবগুলো ঘর পূরণ করা বাধ্যতামূলক</p>
          </div>

          <form action="${FORMSPREE}" method="POST" accept-charset="UTF-8" data-order-form novalidate>
            <div class="form-status" data-form-status role="alert" aria-live="assertive"></div>
            <input type="hidden" name="products" value="${p ? esc(`${p.en} ${p.size} x 1`) : ''}">
            <div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true">
              <label for="f-gotcha">এই ঘরটি খালি রাখুন</label>
              <input type="text" id="f-gotcha" name="_gotcha" tabindex="-1" autocomplete="off">
            </div>

            <div class="form-2">
              ${field({
                id: 'f-name',
                label: 'আপনার নাম',
                icon: 'user',
                control: `<input class="input" id="f-name" name="name" type="text" autocomplete="name" placeholder="যেমন: নুসরাত জাহান" maxlength="80" required aria-required="true" aria-describedby="f-name-err">`,
              })}
              ${field({
                id: 'f-phone',
                label: 'মোবাইল নম্বর',
                hint: '১১ ডিজিট',
                icon: 'phone',
                control: `<input class="input" id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="০১XXXXXXXXX" maxlength="17" required aria-required="true" aria-describedby="f-phone-err">`,
              })}
            </div>
            ${field({
              id: 'f-district',
              label: 'আপনার জেলা',
              icon: 'pin',
              control: `<select class="select" id="f-district" name="district" autocomplete="address-level2" required aria-required="true" aria-describedby="f-district-err"><option value="" selected disabled>তালিকা থেকে আপনার জেলা বেছে নিন</option>${districtOptions}</select>`,
            })}
            ${field({
              id: 'f-address',
              label: 'আপনার সম্পূর্ণ ঠিকানা',
              icon: 'home',
              top: true,
              control: `<textarea class="textarea" id="f-address" name="address" rows="3" autocomplete="street-address" placeholder="বাসা বা ফ্ল্যাট নম্বর, রোড, এলাকা, থানা" maxlength="300" required aria-required="true" aria-describedby="f-address-err"></textarea>`,
            })}

            <button class="btn btn--primary btn--block btn--pulse" type="submit" data-submit>
              <span class="spin" aria-hidden="true"></span>
              <span class="btn__label">অর্ডার কনফার্ম করুন</span>
              <b data-order-total>${initial}</b>
            </button>
            <p class="btn-note">${ic('lock')}আপনার তথ্য সুরক্ষিত। পেমেন্ট শুধু ডেলিভারির সময়।</p>
          </form>
        </div>

        <div class="thanks" data-thanks hidden>
          <div class="thanks__ring">${ic('check')}</div>
          <h3 class="h-2">ধন্যবাদ <span data-thanks-name></span>! আপনার অর্ডারটি আমরা পেয়েছি</h3>
          <p class="mt-16">আমাদের টিম খুব শিগগিরই <strong class="ink" data-thanks-phone></strong> নম্বরে কল করে অর্ডারটি কনফার্ম করবে। কলটি ধরার অনুরোধ রইল, তাহলেই দ্রুত পার্সেল রওনা দেবে।</p>
          <span class="thanks__id">অর্ডার আইডি: <span data-thanks-id></span></span>
          <p class="small mt-16">সর্বমোট <strong class="ink" data-thanks-total></strong>, ক্যাশ অন ডেলিভারি</p>
          <div class="row gap-12 mt-24" style="justify-content:center">
            <a class="btn btn--forest btn--sm" href="${WHATSAPP}" target="_blank" rel="noopener">${ic('wa', 'ico--fill')}<span class="btn__label">WhatsApp এ কথা বলুন</span></a>
            <button class="btn btn--outline btn--sm" type="button" data-new-order>আরেকটি অর্ডার করুন</button>
          </div>
        </div>
      </div>

      <aside class="panel panel--summary reveal" aria-labelledby="sum-title">
        <div class="panel__head">
          <h3 class="h-3" id="sum-title">অর্ডার সামারি</h3>
          <p><span data-order-count>${p ? '১টি' : '০টি'}</span> প্রোডাক্ট, পরিমাণ এখানেই বাড়াতে বা কমাতে পারবেন</p>
        </div>
        <div class="sum" data-order-lines>${staticLine}</div>
        <div class="sum mt-24">
          <div class="sum__row"><span>সাবটোটাল</span><strong data-order-subtotal>${initial}</strong></div>
          <div class="sum__row" data-order-saved-row${p ? '' : ' hidden'}><span>আপনার সাশ্রয়</span><strong class="amberer" data-order-saved>${p ? `- ${taka(p.compare - p.price)}` : taka(0)}</strong></div>
          <div class="sum__row"><span>ডেলিভারি চার্জ</span><strong class="accent">ফ্রি</strong></div>
          <div class="sum__total"><span>সর্বমোট</span><b data-order-total>${initial}</b></div>
        </div>
        <ul class="assure">
          <li>${ic('truck')}<span data-order-eta>জেলা বেছে নিলেই ডেলিভারির আনুমানিক সময় দেখাবে</span></li>
          <li>${ic('cash')}<span>ক্যাশ অন ডেলিভারি, প্রোডাক্ট হাতে পেয়ে টাকা দিন</span></li>
          <li>${ic('shield')}<span>ডেলিভারি ম্যানের সামনেই প্রোডাক্ট দেখে নিতে পারবেন</span></li>
          <li>${ic('phone')}<span>যেকোনো প্রশ্নে কল বা WhatsApp: <a href="${WHATSAPP}" target="_blank" rel="noopener" style="font-weight:600;color:var(--forest)">${PHONE_DISPLAY}</a></span></li>
        </ul>
      </aside>
    </div>
  </div>
</section>`;
}

function contactSection() {
  return `
<section class="section section--soft" id="contact" aria-labelledby="contact-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Get In Touch</span>
      <h2 class="h-1" id="contact-title">কোনো প্রশ্ন? <span class="mark">আমরা আছি</span> আপনার পাশে</h2>
      <p class="lede">কোন প্রোডাক্ট আপনার জন্য ঠিক, কীভাবে ব্যবহার করবেন, কিংবা অর্ডারের খোঁজখবর, যা খুশি জিজ্ঞেস করুন। আমাদের টিম আন্তরিকভাবে উত্তর দেবে।</p>
    </div>
    <div class="contacts" data-stagger>
      <a class="contact-card contact-card--wa reveal" href="${WHATSAPP}" target="_blank" rel="noopener">
        ${ic('wa', 'ico--lead ico--fill')}
        <strong>WhatsApp ও ফোন</strong>
        <span>${PHONE_DISPLAY}</span>
        <span class="contact-card__go">WhatsApp এ মেসেজ করুন ${ic('arrow')}</span>
      </a>
      <a class="contact-card reveal" href="mailto:${EMAIL}">
        ${ic('mail', 'ico--lead')}
        <strong>ইমেইল</strong>
        <span>${EMAIL}</span>
        <span class="contact-card__go">ইমেইল পাঠান ${ic('arrow')}</span>
      </a>
      <a class="contact-card contact-card--fb reveal" href="${FACEBOOK}" target="_blank" rel="noopener">
        ${ic('fb', 'ico--lead ico--fill')}
        <strong>Facebook পেজ</strong>
        <span>facebook.com/theformulate.co</span>
        <span class="contact-card__go">পেজে যান ${ic('arrow')}</span>
      </a>
      <div class="contact-card reveal">
        ${ic('clock', 'ico--lead')}
        <strong>সাপোর্ট টাইম</strong>
        <span>প্রতিদিন সকাল ১০টা থেকে রাত ১০টা। ওয়েবসাইটে অর্ডার নেওয়া হয় ২৪ ঘণ্টা।</span>
      </div>
    </div>
  </div>
</section>`;
}

function footer() {
  return `
<footer class="footer">
  <div class="shell">
    <div class="footer__grid">
      <div class="footer__brand">
        <img src="${IMG.logoLight.src}" alt="The Formulate" width="${IMG.logoLight.w}" height="${IMG.logoLight.h}" loading="lazy" decoding="async">
        <p>প্রকৃতির খাঁটি উপাদানে চুল আর ত্বকের সৎ যত্ন, বাংলাদেশের আবহাওয়া আর মানুষের কথা ভেবে। <span class="en" style="color:var(--amber)">Your 21-Day Hair Growth Secret.</span></p>
        <div class="footer__social">
          <a href="${FACEBOOK}" target="_blank" rel="noopener" aria-label="Facebook">${ic('fb', 'ico--fill')}</a>
          <a href="${WHATSAPP}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic('wa', 'ico--fill')}</a>
          <a href="mailto:${EMAIL}" aria-label="ইমেইল">${ic('mail')}</a>
        </div>
      </div>
      <div>
        <h4>Shop</h4>
        <ul class="footer__links">
          ${PRODUCTS.map((p) => `<li><a href="${p.url}">${ic('chev')}${esc(p.name)}</a></li>`).join('\n          ')}
        </ul>
      </div>
      <div>
        <h4>Help</h4>
        <ul class="footer__links">
          <li><a href="/#order">${ic('chev')}অর্ডার করুন</a></li>
          <li><a href="/#faq">${ic('chev')}সাধারণ প্রশ্নোত্তর</a></li>
          <li><a href="/#contact">${ic('chev')}যোগাযোগ</a></li>
          <li><a href="/privacy-policy">${ic('chev')}প্রাইভেসি পলিসি</a></li>
        </ul>
      </div>
      <div>
        <h4>Contact</h4>
        <ul class="footer__links">
          <li><a href="${WHATSAPP}" target="_blank" rel="noopener">${ic('phone')}${PHONE_DISPLAY}</a></li>
          <li><a href="mailto:${EMAIL}">${ic('mail')}${EMAIL}</a></li>
          <li><a href="${FACEBOOK}" target="_blank" rel="noopener">${ic('fb', 'ico--fill')}theformulate.co</a></li>
          <li><a href="/#order">${ic('truck')}সারা দেশে ফ্রি ডেলিভারি</a></li>
        </ul>
      </div>
    </div>
    <p class="footer__disclaimer">ফলাফল ব্যক্তিভেদে ভিন্ন হতে পারে। এই প্রোডাক্টগুলো কোনো রোগ নির্ণয়, নিরাময় বা প্রতিরোধের জন্য তৈরি নয়। এসেনশিয়াল অয়েল সবসময় ক্যারিয়ার অয়েলে মিশিয়ে ব্যবহার করুন এবং প্রথমবার প্যাচ টেস্ট করে নিন। গর্ভাবস্থায় বা কোনো চর্মরোগ থাকলে ব্যবহারের আগে চিকিৎসকের পরামর্শ নিন।</p>
    <div class="footer__bottom">
      <span>&copy; <span data-year>${bnDigits(YEAR)}</span> The Formulate. সর্বস্বত্ব সংরক্ষিত।</span>
      <nav aria-label="ফুটার লিংক">
        <a href="/privacy-policy">প্রাইভেসি পলিসি</a>
        <a href="/#contact">যোগাযোগ</a>
        <a href="${FACEBOOK}" target="_blank" rel="noopener">Facebook</a>
      </nav>
    </div>
  </div>
</footer>
<a class="wa-float" href="${WHATSAPP}" target="_blank" rel="noopener" aria-label="WhatsApp এ মেসেজ করুন">${ic('wa', 'ico--fill')}</a>`;
}

function faqList(items, name) {
  return `<div class="faq reveal">
  ${items
    .map(
      (f, i) =>
        `<details class="qa" name="${name}"${i === 0 ? ' open' : ''}><summary class="qa__q">${f.q}<span class="qa__sign">${ic('plus')}</span></summary><div class="qa__a"><p>${f.a}</p></div></details>`
    )
    .join('\n  ')}
</div>`;
}

/* ================================================================ JSON-LD */

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND,
  url: SITE,
  logo: `${SITE}/assets/img/icon-512.png`,
  email: EMAIL,
  telephone: PHONE_E164,
  sameAs: [FACEBOOK],
  address: { '@type': 'PostalAddress', addressCountry: 'BD' },
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: PHONE_E164,
    email: EMAIL,
    contactType: 'customer service',
    areaServed: 'BD',
    availableLanguage: ['bn', 'en'],
  },
};

const faqLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: stripTags(f.q),
    acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) },
  })),
});

const productLd = (p) => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: `${p.name} (${p.en}) ${p.size}`,
  description: p.seo.description,
  image: [`${SITE}/assets/img/${p.id}-lg.webp`, `${SITE}/assets/img/og-${p.id}.jpg`],
  sku: p.sku,
  brand: { '@type': 'Brand', name: BRAND },
  offers: {
    '@type': 'Offer',
    url: `${SITE}${p.url}`,
    priceCurrency: 'BDT',
    price: String(p.price),
    priceValidUntil: `${YEAR + 1}-12-31`,
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: BRAND },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'BDT' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BD' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 4, unitCode: 'DAY' },
      },
    },
  },
});

/* ================================================================ home */

const HOME_FAQ = [
  { q: 'The Formulate এর প্রোডাক্ট কি সত্যিই প্রাকৃতিক?', a: 'হ্যাঁ। আমাদের এসেনশিয়াল অয়েলগুলো স্টিম ডিস্টিলেশন আর ক্যারিয়ার অয়েলগুলো কোল্ড প্রেস পদ্ধতিতে তৈরি। রোজমেরি হেয়ার গ্রোথ সিরাম তৈরি প্রাকৃতিক উপাদানে, এবং সালফেট, প্যারাবেন, সিলিকন ও কৃত্রিম সুগন্ধি মুক্ত।' },
  { q: 'কীভাবে অর্ডার করব?', a: `পছন্দের প্রোডাক্টে "এখনই কিনুন" চাপুন অথবা কার্টে যোগ করুন। তারপর অর্ডার ফর্মে নাম, মোবাইল নম্বর, জেলা আর ঠিকানা দিয়ে "অর্ডার কনফার্ম করুন" চাপুন। চাইলে সরাসরি WhatsApp বা কল করেও অর্ডার দিতে পারেন: ${PHONE_BN}।` },
  { q: 'ডেলিভারি চার্জ কত? কতদিনে পাব?', a: 'সারা বাংলাদেশে ডেলিভারি সম্পূর্ণ ফ্রি। ঢাকার ভেতরে সাধারণত ১ থেকে ২ দিন, আর ঢাকার বাইরে ২ থেকে ৪ দিনের মধ্যে প্রোডাক্ট পৌঁছে যায়।' },
  { q: 'অগ্রিম টাকা দিতে হবে?', a: 'না, একদমই না। পুরোপুরি ক্যাশ অন ডেলিভারি। প্রোডাক্ট হাতে পেয়ে, দেখে, তারপর ডেলিভারি ম্যানকে টাকা দেবেন।' },
  { q: 'আমার জন্য কোন প্রোডাক্ট ঠিক হবে?', a: 'চুল পড়া ও পাতলা চুলে রোজমেরি হেয়ার গ্রোথ সিরাম। নিজে হেয়ার অয়েল ব্লেন্ড বানাতে চাইলে রোজমেরি এসেনশিয়াল অয়েল। রুক্ষ, ভঙ্গুর চুলে পাম্পকিন সিড অয়েল। ফ্রিজ কমাতে আর শাইনের জন্য আরগান অয়েল। তৈলাক্ত বা শুষ্ক ত্বকের ভারসাম্যে জোজোবা অয়েল। আর মাথাব্যথা ও ক্লান্তিতে পেপারমিন্ট অয়েল। দ্বিধা থাকলে WhatsApp এ জিজ্ঞেস করুন।' },
  { q: 'প্রোডাক্ট ভাঙা বা ভুল এলে কী হবে?', a: 'ডেলিভারি ম্যানের সামনেই প্যাকেট খুলে দেখে নিন। বোতল ভাঙা, সিল খোলা বা ভুল প্রোডাক্ট হলে তখনই ফেরত দিন, কোনো টাকা দিতে হবে না। পরে কোনো সমস্যা চোখে পড়লে ৪৮ ঘণ্টার মধ্যে ছবিসহ WhatsApp এ জানান, আমরা দ্রুত সমাধান করে দেব।' },
  { q: 'এসেনশিয়াল অয়েল কি সরাসরি লাগানো যায়?', a: 'রোজমেরি ও পেপারমিন্ট এসেনশিয়াল অয়েল অত্যন্ত ঘন, তাই সবসময় নারকেল, জোজোবা বা অলিভের মতো ক্যারিয়ার অয়েলে মিশিয়ে ব্যবহার করুন। আরগান, জোজোবা ও পাম্পকিন সিড অয়েল ক্যারিয়ার অয়েল, এগুলো সরাসরি লাগানো যায়। যেকোনো প্রোডাক্ট প্রথমবার ব্যবহারের আগে প্যাচ টেস্ট করে নিন।' },
];

function homePage() {
  const serum = byId['rosemary-hair-serum'];
  const hero = IMG.models[0];
  const title = 'The Formulate | ২১ দিনের হেয়ার গ্রোথ সিক্রেট | প্রাকৃতিক হেয়ার সিরাম ও এসেনশিয়াল অয়েল';
  const description =
    'The Formulate এর রোজমেরি হেয়ার গ্রোথ সিরাম, রোজমেরি, আরগান, জোজোবা, পাম্পকিন সিড ও পেপারমিন্ট অয়েল। ১০০% প্রাকৃতিক উপাদান, সারা বাংলাদেশে ফ্রি ডেলিভারি ও ক্যাশ অন ডেলিভারি।';

  const jsonld = [
    orgLd,
    { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE, inLanguage: 'bn-BD' },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'The Formulate Collection',
      itemListElement: PRODUCTS.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}${p.url}`, name: `${p.name} (${p.en})` })),
    },
    faqLd(HOME_FAQ),
  ];

  const TRUST = [
    ['leaf', '100% Natural'],
    ['drop', 'Cold Pressed'],
    ['flask', 'Steam Distilled'],
    ['ban', 'Sulfate Free'],
    ['ban', 'Paraben Free'],
    ['heart', 'Cruelty Free'],
    ['shield', 'Silicone Free'],
    ['sun', 'Made For Bangladesh Weather'],
  ];
  const trustGroup = (hidden) =>
    `<div class="logos__group"${hidden ? ' aria-hidden="true"' : ''}>${TRUST.map(([i, t]) => `<span class="logos__item">${ic(i)}${t}</span>`).join('')}</div>`;

  return `${head({ title, description, canonical: `${SITE}/`, jsonld, preload: [hero.src] })}
${bodyOpen()}
${header({ home: true })}

<main id="main">

<!-- ============ HERO ============ -->
<section class="hero" id="top" aria-labelledby="hero-title">
  <div class="shell hero__grid">
    <div class="hero__copy">
      <div class="hero__rating">${stars()}<span>৪.৯ রেটিং, ২,৫০০+ সন্তুষ্ট কাস্টমার</span></div>
      <span class="eyebrow">Your 21-Day Hair Growth Secret</span>
      <h1 class="h-display mt-16" id="hero-title">চুল পড়ার দুশ্চিন্তা এবার শেষ, <span class="mark">২১ দিনেই</span> দেখুন পরিবর্তন</h1>
      <p class="lede hero__lede mt-16">সকালে বালিশে, গোসলের পর ড্রেনে, চিরুনির ফাঁকে জমে থাকা চুল দেখে মন খারাপ হওয়ার অনুভূতিটা আমরা জানি। তাই প্রকৃতির সবচেয়ে কার্যকর উপাদানগুলো দিয়ে The Formulate তৈরি করেছে চুল আর ত্বকের এমন যত্ন, যা কাজ করে একদম গোড়া থেকে। কোনো কড়া কেমিক্যাল নেই, আছে শুধু খাঁটি রোজমেরি, পাম্পকিন সিড, জোজোবা আর পেপারমিন্টের শক্তি।</p>
      <div class="hero__cta">
        <a class="btn btn--primary btn--pulse" href="#order" data-scroll-order data-preselect="rosemary-hair-serum" data-cta="Home Hero | Serum">${ic('zap')}<span class="btn__label">২১ দিনের সিরাম অর্ডার করুন</span></a>
        <a class="btn btn--outline" href="#products"><span class="btn__label">সব প্রোডাক্ট দেখুন</span>${ic('arrow')}</a>
      </div>
      <ul class="hero__trust">
        <li>${ic('truck')}সারা দেশে ফ্রি ডেলিভারি</li>
        <li>${ic('cash')}ক্যাশ অন ডেলিভারি</li>
        <li>${ic('leaf')}১০০% প্রাকৃতিক উপাদান</li>
      </ul>
    </div>
    <div class="hero__art">
      <div class="hero__frame">
        <img src="${hero.src}" alt="${MODEL_ALT[0]}" width="${hero.w}" height="${hero.h}" fetchpriority="high" decoding="async">
      </div>
      <div class="hero__badge hero__badge--tl">${ic('sparkle')}<div><strong>২১ দিন</strong><span>প্রথম পরিবর্তন চোখে পড়ে*</span></div></div>
      <div class="hero__badge hero__badge--br">${ic('truck')}<div><strong>ফ্রি ডেলিভারি</strong><span>সারা বাংলাদেশে</span></div></div>
    </div>
  </div>
</section>

<div class="logos" aria-label="আমাদের প্রতিশ্রুতি">
  <div class="logos__track">${trustGroup(false)}${trustGroup(true)}</div>
</div>

<!-- ============ STOREFRONT ============ -->
<section class="section" id="products" aria-labelledby="products-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">The Collection</span>
      <h2 class="h-1" id="products-title">চুল আর ত্বকের জন্য প্রকৃতির সেরাটা, <span class="mark">এক জায়গায়</span></h2>
      <p class="lede">প্রতিটি বোতলে একটাই প্রতিশ্রুতি: খাঁটি উপাদান, সৎ ফর্মুলা। আপনার প্রয়োজন অনুযায়ী বেছে নিন, কার্টে যোগ করুন অথবা এক ক্লিকেই কিনে ফেলুন।</p>
    </div>
    <div class="products" data-stagger>
      ${PRODUCTS.map(productCard).join('')}
    </div>
    <p class="row gap-8 small mt-32" style="justify-content:center;color:var(--forest);font-weight:500">${ic('truck')}সব প্রোডাক্টে সারা বাংলাদেশে ফ্রি ডেলিভারি এবং ক্যাশ অন ডেলিভারি সুবিধা</p>
  </div>
</section>

<section class="section--tight section--soft">
  <div class="shell">
    <div class="stats reveal">
      ${statCell({ count: '2500', suffix: '+', label: 'সন্তুষ্ট কাস্টমার' })}
      ${statCell({ count: '4.9', label: 'গড় কাস্টমার রেটিং' })}
      ${statCell({ count: '21', suffix: ' দিন', label: 'প্রথম পরিবর্তন চোখে পড়ার সময়*' })}
      ${statCell({ count: '64', label: 'জেলায় ফ্রি ডেলিভারি' })}
    </div>
  </div>
</section>

<!-- ============ STORY ============ -->
<section class="section" id="why" aria-labelledby="story-title">
  <div class="shell split">
    <div class="split__art split__art--tall reveal reveal--left">
      <img src="${IMG.models[2].src}" alt="${MODEL_ALT[2]}" width="${IMG.models[2].w}" height="${IMG.models[2].h}" loading="lazy" decoding="async">
    </div>
    <div class="reveal reveal--right">
      <span class="eyebrow">Our Story</span>
      <h2 class="h-1 mt-16" id="story-title">শুরুটা হয়েছিল একটা <span class="mark">সহজ প্রশ্ন</span> থেকে</h2>
      <p class="lede mt-16">বাজারে এত হেয়ার অয়েল, এত শ্যাম্পু, তবু কেন আমাদের চারপাশের এত মানুষ চুল পড়া নিয়ে কষ্ট পাচ্ছেন? উত্তর খুঁজতে গিয়ে দেখলাম, অনেক প্রোডাক্টই হয় ভেজাল, নয়তো কৃত্রিম সুগন্ধি আর কড়া কেমিক্যালে ভরা।</p>
      <p class="mt-16">তাই ঠিক করলাম, এমন কিছু বানাব যা নিজের পরিবারের হাতে নিশ্চিন্তে তুলে দেওয়া যায়। বিশ্বজুড়ে পরিচিত প্রাকৃতিক উপাদান, বিশুদ্ধ প্রক্রিয়ায় তৈরি, আর বাংলাদেশের গরম, আর্দ্র আবহাওয়ার কথা মাথায় রেখে বাছাই করা। এভাবেই জন্ম নিল The Formulate।</p>
      <ul class="checks mt-24">
        <li>${ic('check')}<span><strong>খাঁটি উপাদান:</strong> কোল্ড প্রেসড ও স্টিম ডিস্টিলড অয়েল, কোনো ফিলার নেই</span></li>
        <li>${ic('check')}<span><strong>ক্লিন ফর্মুলা:</strong> সালফেট, প্যারাবেন, সিলিকন ও কৃত্রিম সুগন্ধি মুক্ত</span></li>
        <li>${ic('check')}<span><strong>সুরক্ষিত প্যাকেজিং:</strong> গ্লাস ড্রপার বোতলে সঠিক মাপে ব্যবহার</span></li>
        <li>${ic('check')}<span><strong>নিশ্চিন্ত কেনাকাটা:</strong> ফ্রি ডেলিভারি, প্রোডাক্ট হাতে পেয়ে টাকা</span></li>
      </ul>
      <div class="row gap-12 mt-32">
        <a class="btn btn--primary" href="#order" data-scroll-order data-preselect="rosemary-hair-serum" data-cta="Home Story">${ic('zap')}<span class="btn__label">আমার যত্ন শুরু করতে চাই</span></a>
        <a class="btn btn--ghost" href="#reviews"><span class="btn__label">রিভিউ পড়ুন</span>${ic('arrow')}</a>
      </div>
    </div>
  </div>
</section>

<!-- ============ WHY US ============ -->
<section class="section section--sand" aria-labelledby="why-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Why The Formulate</span>
      <h2 class="h-1" id="why-title">কেন হাজারো মানুষ <span class="mark">The Formulate</span> বেছে নিচ্ছেন</h2>
      <p class="lede">ভালো প্রোডাক্ট তো দরকারই, সাথে দরকার নিশ্চিন্ত কেনাকাটার অভিজ্ঞতা। আমরা দুটোরই দায়িত্ব নিই।</p>
    </div>
    <div class="tiles tiles--3" data-stagger>
      <div class="tile reveal">${ic('leaf', 'tile__ico')}<h3 class="h-3">১০০% প্রাকৃতিক ও খাঁটি</h3><p>প্রতিটি অয়েল কোল্ড প্রেসড অথবা স্টিম ডিস্টিলড। কোনো ফিলার, কৃত্রিম রং বা সুগন্ধি মেশানো হয় না।</p></div>
      <div class="tile reveal">${ic('ban', 'tile__ico')}<h3 class="h-3">ক্ষতিকর কেমিক্যাল নেই</h3><p>সালফেট, প্যারাবেন আর সিলিকন ছাড়াই তৈরি, তাই দীর্ঘদিন ব্যবহারেও থাকুন নিশ্চিন্ত।</p></div>
      <div class="tile reveal">${ic('sun', 'tile__ico')}<h3 class="h-3">এদেশের আবহাওয়ার জন্য</h3><p>গরম, আর্দ্রতা, ধুলো আর হার্ড ওয়াটারের কথা মাথায় রেখে বাছাই করা হালকা ফর্মুলা।</p></div>
      <div class="tile reveal">${ic('truck', 'tile__ico')}<h3 class="h-3">সারা দেশে ফ্রি ডেলিভারি</h3><p>টেকনাফ থেকে তেঁতুলিয়া, দেশের ৬৪ জেলায় কোনো ডেলিভারি চার্জ ছাড়াই পৌঁছে যায়।</p></div>
      <div class="tile reveal">${ic('cash', 'tile__ico')}<h3 class="h-3">আগে দেখুন, পরে টাকা</h3><p>ক্যাশ অন ডেলিভারি। ডেলিভারি ম্যানের সামনে প্রোডাক্ট দেখে নিশ্চিত হয়ে তারপর পেমেন্ট।</p></div>
      <div class="tile reveal">${ic('message', 'tile__ico')}<h3 class="h-3">পাশে আছি সবসময়</h3><p>কোন প্রোডাক্ট আপনার জন্য ঠিক, কীভাবে ব্যবহার করবেন, যেকোনো প্রশ্নে WhatsApp এ সরাসরি কথা বলুন।</p></div>
    </div>
    ${secCta('সঠিক প্রোডাক্ট বাছাই নিয়ে দ্বিধা? আমাদের সবচেয়ে জনপ্রিয়টা দিয়েই শুরু করুন।', 'রোজমেরি সিরাম অর্ডার করুন', 'Home Why Us', 'rosemary-hair-serum')}
  </div>
</section>

<!-- ============ FEATURED ============ -->
<section class="section" aria-labelledby="featured-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Best Seller</span>
      <h2 class="h-1" id="featured-title">রোজমেরি হেয়ার গ্রোথ সিরাম: <span class="mark">২১ দিনের রহস্য</span></h2>
      <p class="lede">রোজমেরি, পাম্পকিন সিড, জোজোবা আর পেপারমিন্ট। চারটি প্রাকৃতিক শক্তি একসাথে কাজ করে স্ক্যাল্পকে জাগিয়ে তোলে, চুলের গোড়া করে মজবুত।</p>
    </div>
    <a class="band reveal" href="${serum.url}" aria-label="রোজমেরি হেয়ার গ্রোথ সিরামের বিস্তারিত দেখুন">
      <img src="${IMG.banner.src}" alt="The Formulate রোজমেরি হেয়ার সিরাম, রোজমেরি, পেপারমিন্ট, পাম্পকিন সিড ও জোজোবা উপাদানের সাথে" width="${IMG.banner.w}" height="${IMG.banner.h}" loading="lazy" decoding="async">
    </a>
    <div class="ba mt-40">
      <div class="ba__art reveal reveal--left">
        <img src="${IMG.proof.src}" alt="নিয়মিত চুলের যত্নের আগে ও পরের তুলনামূলক ছবি" width="${IMG.proof.w}" height="${IMG.proof.h}" loading="lazy" decoding="async">
        <span class="ba__tag pill pill--solid">নিয়মিত যত্নের আগে ও পরে*</span>
      </div>
      <div class="reveal reveal--right">
        <span class="eyebrow">The Transformation</span>
        <h3 class="h-2 mt-16">পাতলা সিঁথি থেকে ঘন, ঝলমলে চুলের পথে</h3>
        <p class="mt-16">চুলের যত্নে সবচেয়ে বড় ভুল হলো শুধু উপরের চুলের দিকে নজর দেওয়া। আমাদের সিরাম কাজ করে স্ক্যাল্পে, যেখানে চুলের জন্ম। নিয়মিত ব্যবহারে যে পরিবর্তন আশা করতে পারেন:</p>
        <ul class="checks checks--amber mt-24">
          ${serum.proof.ba.points.map(([s, t]) => `<li>${ic('check')}<span><strong>${s}</strong> ${t}</span></li>`).join('\n          ')}
        </ul>
        <div class="row gap-12 mt-24">
          <span class="price-now">${taka(serum.price)}</span>
          <s class="price-was">${taka(serum.compare)}</s>
          <span class="pill pill--amber">${bn(off(serum))}% ছাড়</span>
        </div>
        <div class="row gap-12 mt-24">
          <button class="btn btn--primary" type="button" data-buy-now="${serum.id}" data-cta="Home Featured | Buy">${ic('zap')}<span class="btn__label">এখনই কিনুন</span></button>
          <a class="btn btn--outline" href="${serum.url}"><span class="btn__label">বিস্তারিত জানুন</span>${ic('arrow')}</a>
        </div>
        <p class="tiny mt-16" style="color:var(--muted)">*ফলাফল ব্যক্তিভেদে ভিন্ন হতে পারে। নিয়মিত ও সঠিক ব্যবহারে সেরা ফল পাওয়া যায়।</p>
      </div>
    </div>
  </div>
</section>

<!-- ============ RITUAL ============ -->
<section class="section section--sage" id="ritual" aria-labelledby="ritual-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">The Ritual</span>
      <h2 class="h-1" id="ritual-title">দিনে মাত্র ৫ মিনিট, <span class="mark">বাকিটা প্রকৃতির</span> কাজ</h2>
      <p class="lede">ভালো ফলের জন্য জটিল কোনো রুটিন লাগে না। দরকার শুধু সঠিক প্রোডাক্ট আর নিয়মিত একটু যত্ন।</p>
    </div>
    <div class="steps" data-stagger>
      <div class="step reveal"><span class="step__n" aria-hidden="true"></span><div><h3 class="h-3">বেছে নিন সঠিক যত্ন</h3><p>চুল পড়া আর পাতলা চুলে রোজমেরি সিরাম, ফ্রিজ আর রুক্ষতায় আরগান, ত্বকের ভারসাম্যে জোজোবা। দ্বিধা থাকলে WhatsApp এ জিজ্ঞেস করুন।</p></div></div>
      <div class="step reveal"><span class="step__n" aria-hidden="true"></span><div><h3 class="h-3">আলতো ম্যাসাজে লাগান</h3><p>কয়েক ফোঁটা নিয়ে আঙুলের ডগায় গোল গোল করে ম্যাসাজ করুন। এসেনশিয়াল অয়েল অবশ্যই ক্যারিয়ার অয়েলে মিশিয়ে নেবেন।</p></div></div>
      <div class="step reveal"><span class="step__n" aria-hidden="true"></span><div><h3 class="h-3">নিয়মিত থাকুন, পরিবর্তন দেখুন</h3><p>সপ্তাহে ২ থেকে ৩ বার, টানা অন্তত ২১ দিন। ধৈর্য আর নিয়মিত যত্নেই আসে আসল ফলাফল।</p></div></div>
    </div>
    ${secCta('আজ রাত থেকেই আপনার রিচুয়ালটা শুরু করতে চান?', 'এখনই অর্ডার করুন', 'Home Ritual', 'rosemary-hair-serum')}
  </div>
</section>

<!-- ============ REVIEWS ============ -->
<section class="section section--forest" id="reviews" aria-labelledby="reviews-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Real Reviews</span>
      <h2 class="h-1" id="reviews-title">যারা বদলে গেছেন, তাদের মুখেই শুনুন</h2>
      <p class="lede">প্রতিদিন সারা দেশ থেকে আসা ভালোবাসার মেসেজগুলোই আমাদের সবচেয়ে বড় অনুপ্রেরণা।</p>
    </div>
    <div class="rail" data-stagger>
      ${PRODUCTS.map((p, i) => quoteCard(p.proof.quotes[0], i, p)).join('')}
    </div>
    <div class="ugc mt-40" data-stagger>
      ${IMG.models.map((m, i) => `<figure class="reveal"><img src="${m.src}" alt="${MODEL_ALT[i]}" width="${m.w}" height="${m.h}" loading="lazy" decoding="async"></figure>`).join('\n      ')}
    </div>
    <p class="center en mt-16" style="letter-spacing:.16em;color:var(--amber);font-size:.8rem">#TheFormulateRitual</p>
    ${secCta('আপনার সফলতার গল্পটাও শুরু হোক আজ থেকেই।', 'আমিও অর্ডার করতে চাই', 'Home Reviews', 'rosemary-hair-serum')}
  </div>
</section>

${orderSection(null)}

<!-- ============ FAQ ============ -->
<section class="section" id="faq" aria-labelledby="faq-title">
  <div class="shell shell--narrow">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Questions &amp; Answers</span>
      <h2 class="h-1" id="faq-title">আপনার মনে যে প্রশ্নগুলো আসছে</h2>
      <p class="lede">অর্ডার করার আগে এই উত্তরগুলো একবার দেখে নিন। আরও কিছু জানার থাকলে WhatsApp এ নির্দ্বিধায় জিজ্ঞেস করুন।</p>
    </div>
    ${faqList(HOME_FAQ, 'home-faq')}
    ${secCta('সব প্রশ্নের উত্তর পেয়ে গেছেন? তাহলে আর দেরি কেন।', 'অর্ডার করতে এগিয়ে যান', 'Home FAQ')}
  </div>
</section>

${contactSection()}

</main>
${footer()}
</body>
</html>
`;
}

/* ================================================================ product */

function productPage(p) {
  const canonical = `${SITE}${p.url}`;
  const lg = ver(`/assets/img/${p.id}-lg.webp`);
  const gallery = [
    { src: lg, alt: `${p.name} ${p.size}, The Formulate` },
    ...p.gallery.map((g) => ({ src: ver(`/assets/img/${g.file}.webp`), alt: g.alt })),
  ];
  const save = p.compare - p.price;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'হোম', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'প্রোডাক্ট', item: `${SITE}/#products` },
      { '@type': 'ListItem', position: 3, name: p.name, item: canonical },
    ],
  };

  return `${head({
    title: p.seo.title,
    description: p.seo.description,
    canonical,
    image: `${SITE}/assets/img/og-${p.id}.jpg`,
    imageAlt: `${p.name} ${p.size}, The Formulate`,
    type: 'product',
    jsonld: [orgLd, productLd(p), breadcrumb, faqLd(p.faq)],
    preload: [lg],
  })}
${bodyOpen(` data-product="${p.id}"`)}
${header()}

<div class="pbar">
  <div class="shell">
    <nav class="crumbs" aria-label="ব্রেডক্রাম্ব">
      <a href="/">হোম</a>${ic('chev')}<a href="/#products">প্রোডাক্ট</a>${ic('chev')}<span aria-current="page">${esc(p.name)}</span>
    </nav>
  </div>
</div>

<main id="main">

<!-- ============ 1. HERO ============ -->
<section class="phero" aria-labelledby="p-title">
  <div class="shell phero__grid">
    <div data-gallery>
      <div class="phero__media">
        <img data-gallery-main src="${lg}" alt="${esc(gallery[0].alt)}" width="1200" height="1200" fetchpriority="high" decoding="async" style="background:url(${LQIP[p.id]}) center/cover">
        <span class="phero__flag flag flag--save">${bn(off(p))}% ছাড়</span>
      </div>
      ${
        gallery.length > 1
          ? `<div class="phero__thumbs" role="tablist" aria-label="প্রোডাক্টের ছবি">
        ${gallery
          .map(
            (g, i) =>
              `<button type="button" role="tab" data-gallery-thumb data-src="${g.src}" data-alt="${esc(g.alt)}" aria-selected="${i === 0}" aria-label="ছবি ${bn(i + 1)}"><img src="${g.src}" alt="" width="160" height="160" loading="lazy" decoding="async"></button>`
          )
          .join('\n        ')}
      </div>`
          : ''
      }
    </div>

    <div>
      <span class="eyebrow">${p.hero.eyebrow}</span>
      <div class="phero__meta mt-16">
        ${stars()}<span>${bnDigits(p.rating.toFixed(1))} রেটিং</span><span>${bn(p.reviews)} রিভিউ</span>
        <span class="pill">${ic('truck')}ফ্রি ডেলিভারি</span>
      </div>
      <h1 class="h-1" id="p-title">${p.hero.title}</h1>
      <p class="lede">${p.hero.lede}</p>
      <p class="small mt-16"><strong class="ink">কার জন্য:</strong> ${p.hero.forWho}</p>
      <div class="phero__price" data-buybar-hide>
        <span class="price-now">${taka(p.price)}</span>
        <s class="price-was">${taka(p.compare)}</s>
        <span class="pill pill--amber">${taka(save)} সাশ্রয়</span>
        <span class="small" style="color:var(--muted)">${esc(p.en)}, ${p.size}</span>
      </div>
      <div class="phero__cta">
        <a class="btn btn--primary btn--pulse" href="#order" data-scroll-order data-cta="Hero | ${esc(p.en)}">${ic('zap')}<span class="btn__label">এখনই অর্ডার করুন</span></a>
        <button class="btn btn--outline" type="button" data-add-to-cart="${p.id}">${ic('bag')}<span class="btn__label">কার্টে যোগ করুন</span></button>
      </div>
      <ul class="phero__usp">
        ${p.hero.usp.map((u) => `<li>${ic('check')}<span>${u}</span></li>`).join('\n        ')}
      </ul>
    </div>
  </div>
</section>

<!-- ============ 2. PROBLEM ============ -->
<section class="section" id="problem" aria-labelledby="problem-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">${p.problem.eyebrow}</span>
      <h2 class="h-1" id="problem-title">${p.problem.title}</h2>
      <p class="lede">${p.problem.lede}</p>
    </div>
    <div class="tiles tiles--4" data-stagger>
      ${p.problem.pains.map((x) => `<div class="tile tile--pain reveal">${ic(x.icon, 'tile__ico')}<h3 class="h-3">${x.title}</h3><p>${x.text}</p></div>`).join('\n      ')}
    </div>
    <p class="story reveal">${p.problem.story}</p>
    ${secCta(fill(p.problem.cta, p), 'আমি সমাধান চাই', `Problem | ${p.en}`)}
  </div>
</section>

<!-- ============ 3. SOLUTION ============ -->
<section class="section section--sand" id="solution" aria-labelledby="solution-title">
  <div class="shell">
    <div class="split">
      <div class="split__art reveal reveal--left">
        <img src="${lg}" alt="${esc(p.name)} এর উপাদান ও বোতল" width="1200" height="1200" loading="lazy" decoding="async">
      </div>
      <div class="reveal reveal--right">
        <span class="eyebrow">${p.solution.eyebrow}</span>
        <h2 class="h-1 mt-16" id="solution-title">${p.solution.title}</h2>
        <p class="lede mt-16">${p.solution.lede}</p>
        <ul class="checks mt-24">
          ${p.solution.points.map((x) => `<li>${ic('check')}<span><strong>${x.name}</strong><span class="en-tag">${x.en}</span><br>${x.text}</span></li>`).join('\n          ')}
        </ul>
      </div>
    </div>
    <div class="head head--center mt-40 reveal" style="margin-bottom:28px">
      <span class="eyebrow eyebrow--center">How To Use</span>
      <h3 class="h-2 mt-16">ব্যবহারের নিয়ম, মাত্র ৩ ধাপে</h3>
    </div>
    <div class="steps" data-stagger>
      ${p.solution.steps.map((s) => `<div class="step reveal"><span class="step__n" aria-hidden="true"></span><div><h3 class="h-3">${s.title}</h3><p>${s.text}</p></div></div>`).join('\n      ')}
    </div>
    ${secCta(fill(p.solution.cta, p), 'রুটিন শুরু করতে অর্ডার করুন', `Solution | ${p.en}`)}
  </div>
</section>

<!-- ============ 4. BENEFITS ============ -->
<section class="section" id="benefits" aria-labelledby="benefits-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">${p.benefits.eyebrow}</span>
      <h2 class="h-1" id="benefits-title">${p.benefits.title}</h2>
      <p class="lede">${p.benefits.lede}</p>
    </div>
    <div class="tiles tiles--3" data-stagger>
      ${p.benefits.items.map((x) => `<div class="tile tile--win reveal">${ic(x.icon, 'tile__ico')}<h3 class="h-3">${x.title}</h3><p>${x.text}</p></div>`).join('\n      ')}
    </div>
    <div class="compare-wrap reveal mt-40">
      <table class="compare">
        <caption class="sr-only">${esc(p.benefits.us)} বনাম ${esc(p.benefits.them)}</caption>
        <thead><tr><th scope="col">তুলনা</th><th scope="col">${p.benefits.us}</th><th scope="col">${p.benefits.them}</th></tr></thead>
        <tbody>
          ${p.benefits.rows.map((r) => `<tr><th scope="row">${r[0]}</th><td class="yes">${ic('check')}${r[1]}</td><td class="no">${ic('x')}${r[2]}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
    </div>
    ${secCta(fill(p.benefits.cta, p), 'এখনই অর্ডার করুন', `Benefits | ${p.en}`)}
  </div>
</section>

<!-- ============ 5. SOCIAL PROOF ============ -->
<section class="section section--forest" id="reviews" aria-labelledby="proof-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">${p.proof.eyebrow}</span>
      <h2 class="h-1" id="proof-title">${p.proof.title}</h2>
      <p class="lede">${p.proof.lede}</p>
    </div>
    <div class="stats reveal">
      ${p.proof.stats.map(statCell).join('\n      ')}
    </div>
    ${
      p.proof.ba
        ? `<div class="ba mt-40">
      <div class="ba__art reveal reveal--left">
        <img src="${IMG.proof.src}" alt="নিয়মিত চুলের যত্নের আগে ও পরের তুলনামূলক ছবি" width="${IMG.proof.w}" height="${IMG.proof.h}" loading="lazy" decoding="async">
        <span class="ba__tag pill pill--solid">নিয়মিত যত্নের আগে ও পরে*</span>
      </div>
      <div class="reveal reveal--right">
        <h3 class="h-2">${p.proof.ba.title}</h3>
        <p class="mt-16">${p.proof.ba.text}</p>
        <ul class="checks mt-24">
          ${p.proof.ba.points.map(([s, t]) => `<li>${ic('check')}<span><strong>${s}</strong> ${t}</span></li>`).join('\n          ')}
        </ul>
        <p class="tiny mt-16" style="opacity:.7">*ফলাফল ব্যক্তিভেদে ভিন্ন হতে পারে। নিয়মিত ও সঠিক ব্যবহারে সেরা ফল পাওয়া যায়।</p>
      </div>
    </div>`
        : ''
    }
    <div class="rail mt-40" data-stagger>
      ${p.proof.quotes.map((q, i) => quoteCard(q, i)).join('')}
    </div>
    <div class="chips mt-32 reveal" style="justify-content:center">
      <span class="chip">${ic('cash')}ক্যাশ অন ডেলিভারি</span>
      <span class="chip">${ic('truck')}সারা দেশে ফ্রি ডেলিভারি</span>
      <span class="chip">${ic('leaf')}100% Natural</span>
      <span class="chip">${ic('heart')}Cruelty Free</span>
      <span class="chip">${ic('shield')}ডেলিভারির সময় দেখে নিন</span>
    </div>
    ${secCta(fill(p.proof.cta, p), 'আমিও অর্ডার করতে চাই', `Social Proof | ${p.en}`)}
  </div>
</section>

<!-- ============ 6. OFFER & PRICING ============ -->
<section class="section section--sand" id="offer" aria-labelledby="offer-title">
  <div class="shell">
    <div class="offer reveal reveal--scale" data-buybar-hide>
      <span class="offer__ribbon">${p.offer.ribbon}</span>
      <span class="eyebrow eyebrow--center mt-16">Special Price</span>
      <h2 class="h-2 mt-16" id="offer-title">${p.offer.title}</h2>
      <p class="mt-16">${fill(p.offer.lede, p)}</p>
      <div class="offer__price">
        <span class="price-now">${taka(p.price)}</span>
        <s class="price-was">${taka(p.compare)}</s>
      </div>
      <span class="pill pill--amber">${ic('gift')}আপনি সাশ্রয় করছেন ${taka(save)} (${bn(off(p))}%)</span>
      <ul class="offer__incl">
        ${p.offer.includes.map((x) => `<li>${ic('check')}<span>${x}</span></li>`).join('\n        ')}
      </ul>
      <p class="small ink" style="font-weight:600">আজকের ডেলিভারি ব্যাচে জায়গা পেতে অর্ডার করুন, সময় বাকি:</p>
      <div class="countdown" data-countdown role="timer" aria-label="আজকের অর্ডার ব্যাচ বন্ধ হতে বাকি সময়">
        <div><b>০০</b><span>ঘণ্টা</span></div>
        <div><b>০০</b><span>মিনিট</span></div>
        <div><b>০০</b><span>সেকেন্ড</span></div>
      </div>
      <a class="btn btn--primary btn--block btn--pulse" href="#order" data-scroll-order data-cta="Offer | ${esc(p.en)}">${ic('zap')}<span class="btn__label">${p.offer.cta}</span></a>
      <span class="btn-note">${ic('lock')}ক্যাশ অন ডেলিভারি, কোনো অগ্রিম পেমেন্ট নেই</span>
    </div>
  </div>
</section>

<!-- ============ 7. FAQ + FINAL CTA ============ -->
<section class="section" id="faq" aria-labelledby="faq-title">
  <div class="shell shell--narrow">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Questions &amp; Answers</span>
      <h2 class="h-1" id="faq-title">আপনার মনে যে প্রশ্নগুলো আসছে</h2>
      <p class="lede">অর্ডার করার আগে এই উত্তরগুলো একবার দেখে নিন। আরও কিছু জানার থাকলে WhatsApp এ জিজ্ঞেস করুন।</p>
    </div>
    ${faqList(p.faq, 'p-faq')}
  </div>
  <div class="shell">
    <div class="final reveal">
      <span class="eyebrow eyebrow--center">Final Step</span>
      <h2 class="h-1 mt-16">${p.final.title}</h2>
      <p class="lede mt-16">${p.final.text}</p>
      <div class="row gap-12" style="justify-content:center">
        <a class="btn btn--primary btn--pulse" href="#order" data-scroll-order data-cta="Final CTA | ${esc(p.en)}">${ic('zap')}<span class="btn__label">${p.final.cta}</span></a>
        <a class="btn btn--light" href="${WHATSAPP}" target="_blank" rel="noopener">${ic('wa', 'ico--fill')}<span class="btn__label">WhatsApp এ প্রশ্ন করুন</span></a>
      </div>
      <p class="small mt-16" style="opacity:.75">${taka(p.price)} | ফ্রি ডেলিভারি | ক্যাশ অন ডেলিভারি</p>
    </div>
  </div>
</section>

${orderSection(p)}

<!-- ============ CROSS SELL ============ -->
<section class="section section--soft" aria-labelledby="xsell-title">
  <div class="shell">
    <div class="head head--center reveal">
      <span class="eyebrow eyebrow--center">Pairs Well With</span>
      <h2 class="h-1" id="xsell-title">যত্নটাকে আরও সম্পূর্ণ করুন</h2>
      <p class="lede">${esc(p.name)} এর সাথে দারুণ মানিয়ে যায় আমাদের এই প্রোডাক্টগুলোও।</p>
    </div>
    <div class="products" data-stagger>
      ${p.crossSell.map((id) => productCard(byId[id])).join('')}
    </div>
  </div>
</section>

</main>
${footer()}

<div class="buybar" data-buybar>
  <div class="buybar__price"><b>${taka(p.price)}</b><s>${taka(p.compare)}</s></div>
  <a class="btn btn--primary" href="#order" data-scroll-order data-cta="Sticky Bar | ${esc(p.en)}">${ic('zap')}<span class="btn__label">এখনই অর্ডার করুন</span></a>
</div>
</body>
</html>
`;
}

/* ================================================================ privacy */

function privacyPage() {
  const title = 'প্রাইভেসি পলিসি | The Formulate';
  const description =
    'The Formulate কীভাবে আপনার নাম, মোবাইল নম্বর, ঠিকানা ও ব্রাউজিং তথ্য সংগ্রহ, ব্যবহার ও সুরক্ষা করে। Meta Pixel, Conversions API, Formspree ও কুকি সংক্রান্ত বিস্তারিত।';
  const ext = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;

  return `${head({ title, description, canonical: `${SITE}/privacy-policy`, jsonld: [orgLd] })}
${bodyOpen()}
${header()}

<div class="pbar">
  <div class="shell">
    <nav class="crumbs" aria-label="ব্রেডক্রাম্ব"><a href="/">হোম</a>${ic('chev')}<span aria-current="page">প্রাইভেসি পলিসি</span></nav>
  </div>
</div>

<main id="main">
<section class="phero">
  <div class="shell shell--narrow">
    <span class="eyebrow">Privacy Policy</span>
    <h1 class="h-1 mt-16">প্রাইভেসি পলিসি</h1>
    <p class="lede mt-16">আপনার বিশ্বাসই আমাদের সবচেয়ে বড় সম্পদ। তাই আপনি যখন The Formulate থেকে কেনাকাটা করেন বা আমাদের ওয়েবসাইট ঘুরে দেখেন, তখন কোন তথ্য আমরা নিই, কেন নিই আর কীভাবে সুরক্ষিত রাখি, সবটা এখানে সহজ ভাষায় খুলে বললাম।</p>
  </div>
</section>

<section class="section">
  <div class="shell shell--narrow">
    <article class="legal">
      <div class="legal__meta"><strong class="ink">কার্যকর হওয়ার তারিখ:</strong> ${bnDigits('15')} সেপ্টেম্বর, ${bnDigits(YEAR)}<br><strong class="ink">প্রযোজ্য:</strong> theformulate.co ওয়েবসাইট, এর সকল পেজ, অর্ডার ফর্ম এবং আমাদের সাথে আপনার যোগাযোগ</div>

      <h2>১. আমরা কারা</h2>
      <p>The Formulate বাংলাদেশভিত্তিক একটি প্রাকৃতিক হেয়ার কেয়ার ও স্কিন কেয়ার ব্র্যান্ড। এই নীতিমালায় "আমরা", "আমাদের" বলতে The Formulate কে বোঝানো হয়েছে, আর "আপনি" বলতে আমাদের ওয়েবসাইটের ভিজিটর ও কাস্টমারকে। এই ওয়েবসাইট ব্যবহার করে বা অর্ডার দিয়ে আপনি এই নীতিমালার সাথে সম্মত হচ্ছেন।</p>

      <h2>২. আমরা কী কী তথ্য সংগ্রহ করি</h2>
      <h3>ক. যে তথ্য আপনি নিজে দেন</h3>
      <ul>
        <li>অর্ডার ফর্মে দেওয়া আপনার নাম, মোবাইল নম্বর, জেলা ও সম্পূর্ণ ঠিকানা</li>
        <li>কোন প্রোডাক্ট কতটি অর্ডার করেছেন এবং মোট মূল্য</li>
        <li>WhatsApp, ফোন কল, ইমেইল বা Facebook এ যোগাযোগের সময় আপনি যা জানান</li>
      </ul>
      <h3>খ. যে তথ্য স্বয়ংক্রিয়ভাবে সংগ্রহ হয়</h3>
      <ul>
        <li>IP address, ব্রাউজার ও ডিভাইসের ধরন (User Agent)</li>
        <li>কোন পেজ দেখেছেন, কোন প্রোডাক্ট কার্টে যোগ করেছেন, কোন বাটনে ক্লিক করেছেন</li>
        <li>কোথা থেকে এসেছেন, যেমন Facebook বিজ্ঞাপন বা লিংকের UTM প্যারামিটার</li>
        <li>কুকি ও অনুরূপ আইডেন্টিফায়ার, যেমন _fbp ও _fbc</li>
      </ul>
      <h3>গ. যা শুধু আপনার ব্রাউজারেই থাকে</h3>
      <p>আপনার কার্টে কোন প্রোডাক্ট আছে, সেই তালিকা আপনার নিজের ডিভাইসের ব্রাউজার স্টোরেজে (localStorage) রাখা হয়, যাতে পেজ বদলালেও কার্ট হারিয়ে না যায়। অর্ডার দেওয়ার আগ পর্যন্ত এটি আমাদের কাছে আসে না।</p>
      <p><strong class="ink">আমরা কখনো কার্ড নম্বর, ব্যাংক অ্যাকাউন্ট বা মোবাইল ব্যাংকিংয়ের পিন সংগ্রহ করি না।</strong> পেমেন্ট হয় শুধুমাত্র ক্যাশ অন ডেলিভারিতে। কেউ The Formulate এর নাম করে পিন বা OTP চাইলে তা দেবেন না, সাথে সাথে আমাদের জানান।</p>

      <h2>৩. তথ্য কেন ব্যবহার করি</h2>
      <ul>
        <li>আপনার অর্ডার গ্রহণ, কল করে কনফার্ম করা এবং ডেলিভারি দেওয়ার জন্য</li>
        <li>কুরিয়ার প্রতিষ্ঠানের কাছে ডেলিভারির প্রয়োজনীয় তথ্য পাঠানোর জন্য</li>
        <li>আপনার প্রশ্ন, অভিযোগ বা রিটার্ন সংক্রান্ত সহায়তা দেওয়ার জন্য</li>
        <li>ওয়েবসাইট কতটা ভালো কাজ করছে তা বুঝে উন্নত করার জন্য</li>
        <li>Facebook ও Instagram এ প্রাসঙ্গিক বিজ্ঞাপন দেখানো ও বিজ্ঞাপনের কার্যকারিতা মাপার জন্য</li>
        <li>ভুয়া বা প্রতারণামূলক অর্ডার প্রতিরোধের জন্য</li>
        <li>বাংলাদেশের প্রচলিত আইনি বাধ্যবাধকতা পালনের জন্য</li>
      </ul>

      <h2>৪. Meta Pixel ও Conversions API</h2>
      <p>আমাদের ওয়েবসাইটে Meta Platforms, Inc. এর Meta Pixel এবং Meta Conversions API ব্যবহার করা হয়। আপনি পেজ দেখলে, প্রোডাক্ট দেখলে, কার্টে যোগ করলে, অর্ডার ফর্মে গেলে বা অর্ডার সম্পন্ন করলে সেই ইভেন্টের তথ্য Meta এর কাছে যায়।</p>
      <ul>
        <li>একই ইভেন্ট আপনার ব্রাউজার থেকে (Pixel) এবং আমাদের সার্ভার থেকে (Conversions API) পাঠানো হয়, একই ইভেন্ট আইডি দিয়ে, যাতে Meta একটি ইভেন্ট একবারই গণনা করে।</li>
        <li>সার্ভার থেকে পাঠানো হয় IP address, User Agent, _fbp ও _fbc আইডি, প্রোডাক্ট আইডি ও অর্ডারের মূল্য।</li>
        <li>অর্ডার সম্পন্ন হলে আপনার মোবাইল নম্বর, নাম ও জেলা পাঠানোর আগে SHA-256 পদ্ধতিতে একমুখী হ্যাশ করে অপাঠযোগ্য কোডে রূপান্তর করা হয়। আসল নম্বর বা নাম Meta এর কাছে সরাসরি পাঠানো হয় না।</li>
      </ul>
      <p>Meta এই তথ্য কীভাবে ব্যবহার করে তা জানতে ${ext('https://www.facebook.com/privacy/policy/', 'Meta এর প্রাইভেসি পলিসি')} দেখুন। কোন বিজ্ঞাপন দেখবেন তা নিয়ন্ত্রণ করতে Facebook এর ${ext('https://www.facebook.com/adpreferences/', 'Ad Preferences')} থেকে সেটিং বদলাতে পারেন।</p>

      <h2>৫. অর্ডার ফর্ম ও Formspree</h2>
      <p>অর্ডার ফর্মে দেওয়া তথ্য Formspree নামের একটি ফর্ম প্রসেসিং সেবার মাধ্যমে এনক্রিপ্টেড (HTTPS) সংযোগে আমাদের ব্যবসায়িক ইমেইলে পৌঁছায়। Formspree শুধু এই ফর্ম পৌঁছে দেওয়ার কাজে তথ্য প্রসেস করে। বিস্তারিত জানতে ${ext('https://formspree.io/legal/privacy-policy/', 'Formspree এর প্রাইভেসি পলিসি')} দেখুন।</p>

      <h2>৬. কুকি ও ব্রাউজার স্টোরেজ</h2>
      <ul>
        <li><strong class="ink">_fbp</strong> (Meta, ৯০ দিন): আপনার ব্রাউজারকে বেনামে শনাক্ত করে বিজ্ঞাপনের ফলাফল মাপতে</li>
        <li><strong class="ink">_fbc</strong> (Meta, ৯০ দিন): আপনি কোনো Facebook বিজ্ঞাপনে ক্লিক করে এসেছেন কি না তা বুঝতে</li>
        <li><strong class="ink">tf_cart_v1</strong> (localStorage): আপনার কার্ট মনে রাখতে, আপনি ব্রাউজার ডেটা মুছলে মুছে যায়</li>
        <li><strong class="ink">tf_src</strong> (sessionStorage): কোন লিংক বা বিজ্ঞাপন থেকে এসেছেন, ব্রাউজার ট্যাব বন্ধ করলেই মুছে যায়</li>
      </ul>
      <p>ব্রাউজারের সেটিং থেকে যেকোনো সময় কুকি ব্লক বা মুছে ফেলতে পারেন। এতে আমাদের ওয়েবসাইট থেকে কেনাকাটায় কোনো সমস্যা হবে না। এছাড়া ফন্ট দেখানোর জন্য Google Fonts ব্যবহার করা হয়, ফলে ফন্ট লোডের সময় আপনার IP address Google এর সার্ভারে যায়।</p>

      <h2>৭. তথ্য কার সাথে শেয়ার করি</h2>
      <p>আমরা আপনার ব্যক্তিগত তথ্য কখনো বিক্রি করি না, ভাড়াও দিই না। শুধু নিচের ক্ষেত্রগুলোতে প্রয়োজনীয় অংশটুকু শেয়ার করা হয়:</p>
      <ul>
        <li><strong class="ink">কুরিয়ার ও ডেলিভারি পার্টনার:</strong> নাম, মোবাইল নম্বর, ঠিকানা ও পরিশোধযোগ্য টাকার পরিমাণ</li>
        <li><strong class="ink">Meta:</strong> উপরে ৪ নম্বর অংশে বর্ণিত বিজ্ঞাপন পরিমাপের তথ্য</li>
        <li><strong class="ink">Formspree:</strong> অর্ডার ফর্ম আমাদের কাছে পৌঁছে দেওয়ার জন্য</li>
        <li><strong class="ink">Vercel:</strong> ওয়েবসাইট হোস্টিং ও সার্ভার ফাংশন চালানোর জন্য, যেখানে সাধারণ সার্ভার লগ তৈরি হয়</li>
        <li><strong class="ink">আইন প্রয়োগকারী সংস্থা:</strong> বাংলাদেশের প্রচলিত আইন অনুযায়ী বৈধ অনুরোধ পেলে</li>
      </ul>

      <h2>৮. তথ্য কতদিন রাখি</h2>
      <p>অর্ডারের তথ্য অর্ডার সম্পন্ন করা, হিসাব রাখা, রিটার্ন বা অভিযোগ নিষ্পত্তি এবং আইনি প্রয়োজনে যতদিন দরকার ততদিন রাখা হয়, সাধারণত সর্বোচ্চ ৩ বছর। এরপর তথ্য মুছে ফেলা হয় অথবা এমনভাবে বেনামি করা হয় যাতে আপনাকে আর শনাক্ত করা না যায়।</p>

      <h2>৯. তথ্যের নিরাপত্তা</h2>
      <p>পুরো ওয়েবসাইট HTTPS এনক্রিপশনে চলে। অর্ডারের তথ্য দেখার অনুমতি শুধু অর্ডার প্রসেসের দায়িত্বে থাকা মানুষদের। Meta তে পাঠানোর আগে সংবেদনশীল তথ্য হ্যাশ করা হয়, আর Conversions API এর গোপন টোকেন শুধু সার্ভারে রাখা থাকে, ব্রাউজারে কখনো যায় না। তবে ইন্টারনেটে কোনো ব্যবস্থাই শতভাগ ঝুঁকিমুক্ত নয়, তাই কোনো সন্দেহজনক কিছু চোখে পড়লে দ্রুত আমাদের জানান।</p>

      <h2>১০. আপনার অধিকার</h2>
      <ul>
        <li>আমাদের কাছে আপনার কী তথ্য আছে তা জানতে চাওয়া</li>
        <li>ভুল বা অসম্পূর্ণ তথ্য সংশোধন করতে বলা</li>
        <li>আইনি প্রয়োজনের বাইরে থাকা তথ্য মুছে ফেলার অনুরোধ করা</li>
        <li>অফার বা প্রচারমূলক মেসেজ আর না পাঠাতে বলা</li>
        <li>কুকি ব্লক করে বা Facebook Ad Preferences বদলে বিজ্ঞাপন ট্র্যাকিং সীমিত করা</li>
      </ul>
      <p>যেকোনো অনুরোধ পাঠান <a href="mailto:${EMAIL}">${EMAIL}</a> ঠিকানায় অথবা ${ext(WHATSAPP, 'WhatsApp এ')}। আমরা সাধারণত ৭ কর্মদিবসের মধ্যে সাড়া দিই।</p>

      <h2>১১. শিশুদের গোপনীয়তা</h2>
      <p>আমাদের ওয়েবসাইট ১৮ বছরের কম বয়সীদের জন্য নয় এবং আমরা জেনেশুনে তাদের কাছ থেকে ব্যক্তিগত তথ্য সংগ্রহ করি না। ১৮ বছরের কম বয়সী কেউ অর্ডার করতে চাইলে অভিভাবকের মাধ্যমে করুন। ভুলবশত এমন কোনো তথ্য আমাদের কাছে এসে থাকলে জানালে তা মুছে ফেলা হবে।</p>

      <h2>১২. প্রযোজ্য আইন</h2>
      <p>এই নীতিমালা গণপ্রজাতন্ত্রী বাংলাদেশের প্রচলিত আইন অনুযায়ী পরিচালিত ও ব্যাখ্যা করা হবে, যার মধ্যে ভোক্তা-অধিকার সংরক্ষণ আইন, ২০০৯ এবং ব্যক্তিগত তথ্য সুরক্ষা, সাইবার নিরাপত্তা ও ডিজিটাল লেনদেন সংক্রান্ত প্রযোজ্য আইন ও বিধিমালা অন্তর্ভুক্ত।</p>

      <h2>১৩. নীতিমালার পরিবর্তন</h2>
      <p>ব্যবসা, প্রযুক্তি বা আইনের পরিবর্তনের সাথে তাল মিলিয়ে আমরা সময়ে সময়ে এই নীতিমালা হালনাগাদ করতে পারি। বড় কোনো পরিবর্তন হলে এই পেজের উপরে কার্যকর হওয়ার তারিখ বদলে দেওয়া হবে। নিয়মিত এই পেজটি দেখে নেওয়ার অনুরোধ রইল।</p>

      <h2>১৪. যোগাযোগ</h2>
      <p>এই নীতিমালা বা আপনার তথ্য নিয়ে যেকোনো প্রশ্নে যোগাযোগ করুন:</p>
      <ul>
        <li><strong class="ink">ইমেইল:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a></li>
        <li><strong class="ink">ফোন ও WhatsApp:</strong> ${ext(WHATSAPP, PHONE_DISPLAY)}</li>
        <li><strong class="ink">Facebook:</strong> ${ext(FACEBOOK, 'facebook.com/theformulate.co')}</li>
        <li><strong class="ink">দেশ:</strong> বাংলাদেশ</li>
      </ul>
    </article>
  </div>
</section>

${contactSection()}
</main>
${footer()}
</body>
</html>
`;
}

/* ================================================================ write */

const written = [];

function write(rel, content) {
  const dash = content.search(/[\u2013\u2014]/);
  if (dash > -1) {
    throw new Error(`En/em dash found in ${rel}: "...${content.slice(Math.max(0, dash - 60), dash + 20)}..."`);
  }
  if (/\{(price|compare|save)\}/.test(content)) throw new Error(`Unfilled price token in ${rel}`);
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  written.push([rel, Buffer.byteLength(content)]);
}

write('index.html', homePage());
PRODUCTS.forEach((p) => write(`products/${p.id}.html`, productPage(p)));
write('privacy-policy.html', privacyPage());

write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>${SITE}/</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority><image:image><image:loc>${SITE}/assets/img/model-1.webp</image:loc></image:image></url>
${PRODUCTS.map(
  (p) =>
    `  <url><loc>${SITE}${p.url}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority><image:image><image:loc>${SITE}/assets/img/${p.id}-lg.webp</image:loc></image:image></url>`
).join('\n')}
  <url><loc>${SITE}/privacy-policy</loc><lastmod>${TODAY}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>
`
);

write(
  'robots.txt',
  `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`
);

write(
  'site.webmanifest',
  JSON.stringify(
    {
      name: 'The Formulate',
      short_name: 'Formulate',
      description: 'Your 21-Day Hair Growth Secret',
      lang: 'bn',
      start_url: '/',
      display: 'standalone',
      background_color: '#FAF7F2',
      theme_color: '#2F4034',
      icons: [
        { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/assets/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    null,
    2
  ) + '\n'
);

console.log(`styles.css?v=${VERSION.css}  script.js?v=${VERSION.js}`);
written.forEach(([rel, bytes]) => console.log(`${String(Math.round(bytes / 1024)).padStart(4)}KB  ${rel}`));
