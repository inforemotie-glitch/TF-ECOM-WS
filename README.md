# The Formulate | Storefront

Static ecommerce storefront for **The Formulate** (Bangla first, English accents), with:

- Multi-product storefront homepage with working cart, **Add To Cart** and **Buy Now**
- 6 product landing pages, each with the 7 conversion sections, and an order form CTA in every section
- Cash on delivery checkout that posts to **Formspree** (`https://formspree.io/f/xwlkdnva`, delivered to theformulate.co@gmail.com)
- **Meta Pixel + Conversions API** with strict deduplication (shared UUID v4 `eventID`)
- Privacy policy, SEO metadata, JSON-LD, sitemap, favicon set and Open Graph cards

No framework, no build step on Vercel. Plain HTML, one CSS file, one JS file, one serverless function.

---

## 1. Folder structure

Upload **the contents of this folder** as the root of your GitHub repository.

```
TF ECOM WEB/                         <- repository root
├── index.html                       storefront homepage
├── products/
│   ├── rosemary-hair-serum.html     /products/rosemary-hair-serum
│   ├── rosemary-essential-oil.html
│   ├── pumpkin-seed-oil.html
│   ├── argan-oil.html
│   ├── jojoba-oil.html
│   └── peppermint-essential-oil.html
├── privacy-policy.html              /privacy-policy
├── styles.css                       all styling, palette, animations
├── script.js                        cart, checkout, UUID, Pixel + CAPI, smooth scroll
├── api/
│   └── meta.js                      Vercel serverless function, served at /api/meta
├── assets/img/                      optimised product images, logo, icons, OG cards
├── favicon.ico
├── site.webmanifest
├── robots.txt
├── sitemap.xml
├── vercel.json                      clean URLs, caching, security headers
├── package.json                     "type": "module" so api/meta.js can use `export default`
├── .vercelignore                    keeps raw brand files and tools out of the deployment
├── .gitignore
├── .env.example                     variable names for Vercel
├── .env.local                       your real token for local testing only (git-ignored, never commit)
│
├── tools/                           build scripts, not deployed
│   ├── build-pages.cjs              generates every HTML page, sitemap, robots, manifest
│   ├── build-assets.cjs             converts raw brand images to web-ready WebP/JPEG (needs ffmpeg)
│   ├── content/products-hair.cjs    copy for serum, rosemary oil, pumpkin seed oil
│   ├── content/products-care.cjs    copy for argan, jojoba, peppermint
│   └── lib/                         icon sprite, 64 districts
├── _legacy/products/                your previous standalone pages, kept for reference, not deployed
└── Logo/, Model Poster/, Product Description/, Social Proof/, Static Banner RHS (1)/
                                     raw brand files, not deployed
```

**`api/meta.js` must stay exactly at `api/meta.js` in the repository root.** Vercel turns every file in the root `api/` folder into a serverless function automatically, so this file becomes `https://yourdomain/api/meta`. Do not move it into `assets/` or any subfolder.

---

## 2. Deploy to Vercel (via GitHub)

1. **Push to GitHub**
   ```bash
   cd "E:/TF ECOM WEB"
   git init
   git add .
   git commit -m "The Formulate storefront"
   git branch -M main
   git remote add origin https://github.com/<your-account>/theformulate-store.git
   git push -u origin main
   ```
   `.gitignore` already keeps `.env.local` (your token) out of GitHub.

2. **Import the project in Vercel**
   Vercel dashboard, **Add New**, **Project**, pick the repository, then:
   | Setting | Value |
   |---|---|
   | Framework Preset | **Other** |
   | Root Directory | `./` |
   | Build Command | leave empty |
   | Output Directory | leave empty |
   | Install Command | leave empty |

3. **Add the environment variables** (before the first deploy, or redeploy after adding them)
   Project, **Settings**, **Environment Variables**. Add each one and tick **Production**, **Preview** and **Development**:

   | Name | Value |
   |---|---|
   | `META_PIXEL_ID` | `823926397477218` |
   | `META_CAPI_TOKEN` | your Conversions API access token (the `EAAPQ...` value) |

   Optional:
   | Name | When to use |
   |---|---|
   | `META_TEST_EVENT_CODE` | Only while testing. Copy the code from Events Manager, Test Events. **Delete it after testing**, otherwise live events are treated as test events. |
   | `ALLOWED_ORIGINS` | `https://theformulate.co,https://www.theformulate.co` to reject calls to `/api/meta` from other websites. |

   Environment variables only apply to new deployments. After adding or changing one, open **Deployments**, choose the latest, and click **Redeploy**.

4. **Deploy.** Vercel serves the static files and builds `api/meta.js` as a Node.js function. No build step runs.

5. **Connect the domain**
   Project, **Settings**, **Domains**, add `www.theformulate.co` and `theformulate.co`, and set **www** as primary (the apex redirects to it). The canonical URLs, sitemap and Open Graph tags use `https://www.theformulate.co`. If you use a different domain, change `SITE` at the top of `tools/build-pages.cjs`, run `node tools/build-pages.cjs`, and push.

---

## 3. Verify tracking and orders after going live

### Meta Pixel + Conversions API deduplication
1. Events Manager, your Pixel, **Test Events**. Copy the test code, add it as `META_TEST_EVENT_CODE` in Vercel, redeploy.
2. Open the live site and click around (view a product, Add To Cart, Buy Now).
3. In Test Events each event should appear from both **Browser** and **Server** and show as **Deduplicated**.
4. Remove `META_TEST_EVENT_CODE` and redeploy.

Quick server check from any terminal:
```bash
curl -X POST https://www.theformulate.co/api/meta \
  -H "Content-Type: application/json" \
  -d '{"eventName":"PageView","eventId":"manual-test-001"}'
```
Expected: `{"ok":true,"eventId":"manual-test-001","events_received":1,...}`. If you see `Conversions API is not configured`, the environment variables are missing or the project was not redeployed.

**Events sent:** `PageView` (every page), `ViewContent` (product pages), `Lead` (every primary CTA click), `AddToCart`, `InitiateCheckout`, `Purchase` (after Formspree confirms the order). Each one fires `fbq('track', name, data, { eventID })` and immediately POSTs the same `eventId` to `/api/meta`. On purchase, phone, name and district are SHA-256 hashed on the server before reaching Meta; the token never reaches the browser.

### Formspree orders
1. Place one real test order on the live site.
2. The first time, Formspree may email **theformulate.co@gmail.com** asking you to confirm the form. Confirm it, and check the spam folder.
3. In the Formspree dashboard, form settings: keep **reCAPTCHA disabled**. The checkout submits in the background, which reCAPTCHA blocks. Bots are already filtered by the hidden `_gotcha` honeypot field.
4. Check your Formspree plan's monthly submission limit. The free tier is small (50 per month when last checked). Once orders exceed it, submissions are rejected, so upgrade before running ads.

Each order email arrives with the subject `নতুন অর্ডার TF-YYMMDD-NNNN | Tk total | name` and lists name, phone (normalised to `01XXXXXXXXX`), district, full address, itemised products, total, page URL, Dhaka time and the ad or UTM source.

---

## 4. Editing the site

All HTML pages are generated so the header, Pixel code, cart, order form and footer stay identical everywhere. Edit the source, then rebuild:

| To change | Edit | Then run |
|---|---|---|
| Prices, product names, SKUs | `CATALOG` block at the top of `script.js` | `node tools/build-pages.cjs` |
| Product landing page copy | `tools/content/products-hair.cjs` or `products-care.cjs` | `node tools/build-pages.cjs` |
| Homepage or privacy policy copy | `tools/build-pages.cjs` (`homePage`, `privacyPage`) | `node tools/build-pages.cjs` |
| Colours, spacing, animation | `styles.css` | `node tools/build-pages.cjs` (refreshes the cache-busting `?v=` hash) |
| Product photos, logo, banners | replace files in the raw brand folders | `node tools/build-assets.cjs`, then `node tools/build-pages.cjs` |

The page builder refuses to write a page containing an em dash or en dash, or an unfilled `{price}` token.

To add a product, add an entry to `CATALOG` in `script.js`, add its copy object to one of the content files, add its source image to `tools/build-assets.cjs`, then run both build scripts.

### Local preview
```bash
npx vercel dev          # full site including /api/meta, reads .env.local
# or, static only:
npx serve .             # /api/meta will 404 locally, which is harmless
```

---

## 5. Before you run ads (launch checklist)

- [ ] **Replace illustrative social proof with real data.** Star ratings, review counts, the "২,৫০০+ কাস্টমার" figure and all testimonials are realistic placeholders written for layout and tone. Publishing invented reviews or numbers can breach consumer protection rules and Meta ad policies. Update them in `tools/content/*.cjs` and the homepage section of `tools/build-pages.cjs`. Product JSON-LD intentionally has no review markup, so Google never sees placeholder ratings.
- [ ] **Confirm the operational promises in the copy** match how you actually work: support hours (সকাল ১০টা থেকে রাত ১০টা), delivery times (Dhaka 1 to 2 days, outside 2 to 4 days), the check-at-delivery and 48-hour damage policy, and the 3-year data retention period in the privacy policy.
- [ ] **Rotate the Conversions API token.** It was shared in plain text while building this. Generate a new one in Events Manager, update `META_CAPI_TOKEN` in Vercel, redeploy, and update `.env.local`.
- [ ] Place a real test order and confirm the Formspree email (section 3).
- [ ] Confirm deduplication in Meta Test Events, then remove `META_TEST_EVENT_CODE`.
- [ ] Add the site to Google Search Console and submit `https://www.theformulate.co/sitemap.xml`.
