/* =====================================================================
   The Formulate | script.js
   Cart, checkout (Formspree), Meta Pixel + Conversions API with shared
   event IDs, smooth scrolling and interface motion. Zero dependencies.
   ===================================================================== */
(() => {
  'use strict';

  /* CATALOG:START */
  const CATALOG = {
    'rosemary-hair-serum': {
      id: 'rosemary-hair-serum',
      sku: 'TF-RHS-50',
      name: 'রোজমেরি হেয়ার গ্রোথ সিরাম',
      en: 'Rosemary Hair Growth Serum',
      size: '50ml',
      price: 1249,
      compare: 1649,
      img: '/assets/img/rosemary-hair-serum.webp?v=ac9962b7',
      url: '/products/rosemary-hair-serum',
    },
    'rosemary-essential-oil': {
      id: 'rosemary-essential-oil',
      sku: 'TF-REO-30',
      name: 'রোজমেরি এসেনশিয়াল অয়েল',
      en: 'Rosemary Essential Oil',
      size: '30ml',
      price: 750,
      compare: 1150,
      img: '/assets/img/rosemary-essential-oil.webp?v=1696404f',
      url: '/products/rosemary-essential-oil',
    },
    'pumpkin-seed-oil': {
      id: 'pumpkin-seed-oil',
      sku: 'TF-PSO-30',
      name: 'পাম্পকিন সিড অয়েল',
      en: 'Pumpkin Seed Oil',
      size: '30ml',
      price: 670,
      compare: 1150,
      img: '/assets/img/pumpkin-seed-oil.webp?v=664875c6',
      url: '/products/pumpkin-seed-oil',
    },
    'argan-oil': {
      id: 'argan-oil',
      sku: 'TF-ARG-30',
      name: 'আরগান অয়েল',
      en: 'Argan Oil',
      size: '30ml',
      price: 870,
      compare: 1350,
      img: '/assets/img/argan-oil.webp?v=beea9952',
      url: '/products/argan-oil',
    },
    'jojoba-oil': {
      id: 'jojoba-oil',
      sku: 'TF-JOJ-30',
      name: 'জোজোবা অয়েল',
      en: 'Jojoba Oil',
      size: '30ml',
      price: 670,
      compare: 970,
      img: '/assets/img/jojoba-oil.webp?v=5a922112',
      url: '/products/jojoba-oil',
    },
    'peppermint-essential-oil': {
      id: 'peppermint-essential-oil',
      sku: 'TF-PEO-30',
      name: 'পেপারমিন্ট এসেনশিয়াল অয়েল',
      en: 'Peppermint Essential Oil',
      size: '30ml',
      price: 550,
      compare: 990,
      img: '/assets/img/peppermint-essential-oil.webp?v=85cefc02',
      url: '/products/peppermint-essential-oil',
    },
  };
  /* CATALOG:END */

  const CONFIG = {
    pixelId: '823926397477218',
    currency: 'BDT',
    capiEndpoint: '/api/meta',
    orderEndpoint: 'https://formspree.io/f/xwlkdnva',
    cartKey: 'tf_cart_v1',
    maxQty: 10,
    whatsapp: 'https://wa.me/+8801617226321',
    phoneDisplay: '+880 1617-226321',
  };

  const doc = document;
  const root = doc.documentElement;
  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const pageSlug = doc.body.dataset.product;
  const PAGE_PRODUCT = pageSlug && CATALOG[pageSlug] ? pageSlug : null;

  /* ------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------ */
  const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
  const toBnDigits = (s) => String(s).replace(/\d/g, (d) => BN_DIGITS[d]);
  const toEnDigits = (s) => String(s).replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d));
  const group = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const bn = (n) => toBnDigits(group(n));
  const taka = (n) => '৳' + bn(n);
  const takaEn = (n) => 'Tk ' + group(n);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const icon = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* private mode or storage full: cart still works for this page view */
      }
    },
  };

  /* ------------------------------------------------------------------
     Event ID utility (UUID v4)
     ------------------------------------------------------------------ */
  function uuidv4() {
    const c = window.crypto || window.msCrypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    const b = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(b);
    } else {
      for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    }
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  /* ------------------------------------------------------------------
     First-party Meta identifiers (_fbp / _fbc)
     Seeding them before the first event means the Pixel and the
     Conversions API report the very same browser ID.
     ------------------------------------------------------------------ */
  function cookieDomain() {
    const host = location.hostname;
    if (!host || /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[.*\])$/.test(host) || /\.vercel\.app$/.test(host)) return '';
    const parts = host.split('.');
    if (parts.length <= 2) return '.' + host;
    const tld = parts[parts.length - 1];
    const sld = parts[parts.length - 2];
    return '.' + parts.slice(tld.length === 2 && sld.length <= 3 ? -3 : -2).join('.');
  }

  function readCookie(name) {
    const match = doc.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function writeCookie(name, value, days) {
    const domain = cookieDomain();
    doc.cookie =
      `${name}=${value}; max-age=${days * 86400}; path=/; SameSite=Lax` +
      (domain ? `; domain=${domain}` : '') +
      (location.protocol === 'https:' ? '; Secure' : '');
  }

  function ensureFbp() {
    let fbp = readCookie('_fbp');
    if (!fbp) {
      fbp = `fb.1.${Date.now()}.${Math.floor(1e9 + Math.random() * 9e9)}`;
      writeCookie('_fbp', fbp, 90);
    }
    return fbp;
  }

  function ensureFbc() {
    let fbc = readCookie('_fbc');
    let clickId = '';
    try {
      clickId = new URLSearchParams(location.search).get('fbclid') || '';
    } catch (err) {
      clickId = '';
    }
    if (clickId && (!fbc || fbc.split('.').slice(3).join('.') !== clickId)) {
      fbc = `fb.1.${Date.now()}.${clickId}`;
      writeCookie('_fbc', fbc, 90);
    }
    return fbc || '';
  }

  /* ------------------------------------------------------------------
     Meta tracking: browser Pixel + server CAPI, one shared eventID
     ------------------------------------------------------------------ */
  const Meta = {
    lastLeadAt: 0,
    checkoutSent: false,

    track(eventName, customData = {}, userData = {}) {
      const eventId = uuidv4();
      const fbp = ensureFbp();
      const fbc = ensureFbc();

      // 1) browser Pixel
      try {
        if (typeof window.fbq === 'function') {
          window.fbq('track', eventName, customData, { eventID: eventId });
        }
      } catch (err) {
        /* Pixel blocked by an extension: the server event still lands */
      }

      // 2) server Conversions API, fired immediately with the same eventId
      try {
        fetch(CONFIG.capiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({
            eventName,
            eventId,
            eventSourceUrl: location.href,
            customData,
            userData,
            fbp,
            fbc,
          }),
        }).catch(() => {});
      } catch (err) {
        /* offline */
      }

      return eventId;
    },

    commerce(lines) {
      const contents = lines.map((l) => ({ id: CATALOG[l.id].sku, quantity: l.qty, item_price: CATALOG[l.id].price }));
      return {
        content_ids: contents.map((c) => c.id),
        content_type: 'product',
        contents,
        num_items: lines.reduce((s, l) => s + l.qty, 0),
        value: sumLines(lines),
        currency: CONFIG.currency,
      };
    },

    lead(label) {
      const now = Date.now();
      if (now - this.lastLeadAt < 4000) return; // swallow double taps
      this.lastLeadAt = now;
      const p = PAGE_PRODUCT ? CATALOG[PAGE_PRODUCT] : null;
      this.track(
        'Lead',
        p
          ? { content_name: p.en, content_ids: [p.sku], content_type: 'product', value: p.price, currency: CONFIG.currency, cta: label }
          : { content_name: label || 'Primary CTA', value: 0, currency: CONFIG.currency, cta: label }
      );
    },

    addToCart(id, qty) {
      const p = CATALOG[id];
      this.track('AddToCart', {
        content_ids: [p.sku],
        content_name: p.en,
        content_type: 'product',
        contents: [{ id: p.sku, quantity: qty, item_price: p.price }],
        value: p.price * qty,
        currency: CONFIG.currency,
      });
    },

    checkout() {
      if (this.checkoutSent) return;
      const lines = getOrderLines();
      if (!lines.length) return;
      this.checkoutSent = true;
      this.track('InitiateCheckout', this.commerce(lines));
    },
  };

  /* ------------------------------------------------------------------
     Cart
     ------------------------------------------------------------------ */
  const clampQty = (q) => Math.max(1, Math.min(CONFIG.maxQty, parseInt(q, 10) || 1));
  const sumLines = (lines) => lines.reduce((s, l) => s + CATALOG[l.id].price * l.qty, 0);
  const sumCompare = (lines) => lines.reduce((s, l) => s + CATALOG[l.id].compare * l.qty, 0);
  const countLines = (lines) => lines.reduce((s, l) => s + l.qty, 0);

  const Cart = {
    lines: [],
    subscribers: [],

    load() {
      const raw = store.get(CONFIG.cartKey, []);
      this.lines = Array.isArray(raw)
        ? raw.filter((l) => l && CATALOG[l.id]).map((l) => ({ id: l.id, qty: clampQty(l.qty) }))
        : [];
    },
    save() {
      store.set(CONFIG.cartKey, this.lines);
      this.emit();
    },
    emit() {
      this.subscribers.forEach((fn) => fn());
    },
    subscribe(fn) {
      this.subscribers.push(fn);
    },
    has(id) {
      return this.lines.some((l) => l.id === id);
    },
    qty(id) {
      const line = this.lines.find((l) => l.id === id);
      return line ? line.qty : 0;
    },
    add(id, qty = 1) {
      if (!CATALOG[id]) return;
      const line = this.lines.find((l) => l.id === id);
      if (line) line.qty = clampQty(line.qty + qty);
      else this.lines.push({ id, qty: clampQty(qty) });
      this.save();
    },
    set(id, qty) {
      if (qty < 1) return this.remove(id);
      const line = this.lines.find((l) => l.id === id);
      if (line) line.qty = clampQty(qty);
      else this.lines.push({ id, qty: clampQty(qty) });
      this.save();
    },
    remove(id) {
      this.lines = this.lines.filter((l) => l.id !== id);
      this.save();
    },
    removeMany(ids) {
      this.lines = this.lines.filter((l) => !ids.includes(l.id));
      this.save();
    },
  };

  /** Lines shown in the order form. A product page always includes its own product. */
  function getOrderLines() {
    const lines = Cart.lines.map((l) => ({ id: l.id, qty: l.qty }));
    if (PAGE_PRODUCT) {
      const idx = lines.findIndex((l) => l.id === PAGE_PRODUCT);
      const own = idx > -1 ? lines.splice(idx, 1)[0] : { id: PAGE_PRODUCT, qty: 1 };
      lines.unshift(own);
    }
    return lines;
  }

  /* ------------------------------------------------------------------
     Shared UI chrome: scrim, cart drawer, toast
     ------------------------------------------------------------------ */
  function mountChrome() {
    doc.body.insertAdjacentHTML(
      'beforeend',
      `<div class="scrim" data-scrim></div>
      <aside class="drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden="true" tabindex="-1">
        <div class="drawer__top">
          ${icon('bag')}
          <h3 id="cart-title">আপনার কার্ট</h3>
          <span class="pill" data-cart-pill>০টি প্রোডাক্ট</span>
          <button class="icon-btn" type="button" data-cart-close aria-label="কার্ট বন্ধ করুন">${icon('x')}</button>
        </div>
        <div class="drawer__body" data-cart-body></div>
        <div class="drawer__foot" data-cart-foot>
          <div class="sum__row"><span>সাবটোটাল</span><strong data-cart-subtotal>৳০</strong></div>
          <div class="sum__row"><span>ডেলিভারি চার্জ</span><strong class="accent">ফ্রি, সারা বাংলাদেশে</strong></div>
          <button class="btn btn--primary btn--block" type="button" data-cart-checkout>
            <span class="btn__label">অর্ডার কনফার্ম করতে এগিয়ে যান</span>${icon('arrow')}
          </button>
          <button class="btn btn--ghost btn--block" type="button" data-cart-close>আরও কেনাকাটা করুন</button>
        </div>
      </aside>
      <div class="toast" role="status" aria-live="polite" data-toast>${icon('check')}<span data-toast-text></span></div>`
    );
    const drawer = $('#cart-drawer');
    drawer.inert = true;
  }

  let toastTimer = 0;
  function toast(message) {
    const el = $('[data-toast]');
    if (!el) return;
    $('[data-toast-text]', el).textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
  }

  /* layers: one drawer open at a time, focus restored on close */
  const Layers = {
    open: null,
    lastFocus: null,

    show(el) {
      if (!el) return;
      if (this.open && this.open !== el) this.hide(true);
      this.lastFocus = doc.activeElement;
      const gap = window.innerWidth - root.clientWidth;
      if (gap > 0) doc.body.style.paddingRight = gap + 'px';
      el.inert = false;
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      $('[data-scrim]').classList.add('is-on');
      doc.body.classList.add('is-locked');
      $$(`[aria-controls="${el.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'true'));
      this.open = el;
      const first = el.querySelector('button, a[href], input, select');
      setTimeout(() => (first || el).focus({ preventScroll: true }), 80);
    },

    hide(swapping = false) {
      const el = this.open;
      if (!el) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
      $$(`[aria-controls="${el.id}"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
      this.open = null;
      if (swapping) return;
      $('[data-scrim]').classList.remove('is-on');
      doc.body.classList.remove('is-locked');
      doc.body.style.paddingRight = '';
      if (this.lastFocus && typeof this.lastFocus.focus === 'function') this.lastFocus.focus({ preventScroll: true });
    },
  };

  /* ------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------ */
  function qtyControl(id, qty, lockAtOne) {
    return `<div class="qty" data-qty="${id}">
      <button type="button" data-qty-dec aria-label="পরিমাণ কমান"${lockAtOne && qty <= 1 ? ' disabled style="opacity:.35"' : ''}>${icon('minus')}</button>
      <output aria-live="polite">${bn(qty)}</output>
      <button type="button" data-qty-inc aria-label="পরিমাণ বাড়ান">${icon('plus')}</button>
    </div>`;
  }

  function renderCartCount() {
    const n = countLines(Cart.lines);
    $$('[data-cart-count]').forEach((el) => {
      const before = el.textContent;
      el.textContent = bn(n);
      el.classList.toggle('is-on', n > 0);
      if (n > 0 && before !== el.textContent) {
        el.classList.remove('is-bump');
        void el.offsetWidth;
        el.classList.add('is-bump');
      }
    });
    const pill = $('[data-cart-pill]');
    if (pill) pill.textContent = `${bn(n)}টি প্রোডাক্ট`;
  }

  function renderDrawer() {
    const body = $('[data-cart-body]');
    const foot = $('[data-cart-foot]');
    if (!body) return;

    if (!Cart.lines.length) {
      foot.hidden = true;
      body.innerHTML = `<div class="sum__empty">
        ${icon('bag')}
        <strong class="ink">আপনার কার্ট এখনো খালি</strong>
        <p>চুল আর ত্বকের যত্নের জন্য আমাদের প্রোডাক্টগুলো একবার দেখে নিন। পছন্দেরটা এক ক্লিকেই যোগ হয়ে যাবে।</p>
        <a class="btn btn--forest btn--sm" href="/#products" data-cart-close>প্রোডাক্ট দেখুন</a>
      </div>`;
      return;
    }

    foot.hidden = false;
    body.innerHTML = Cart.lines
      .map((l) => {
        const p = CATALOG[l.id];
        return `<div class="cart-line">
          <a href="${p.url}"><img src="${p.img}" alt="${esc(p.name)}" width="74" height="74" loading="lazy" decoding="async"></a>
          <div>
            <a class="cart-line__name" href="${p.url}">${esc(p.name)}</a>
            <div class="cart-line__meta"><span class="en">${esc(p.en)}</span>, ${esc(p.size)}</div>
            ${qtyControl(l.id, l.qty, false)}
          </div>
          <div class="cart-line__end">
            <span class="cart-line__price">${taka(p.price * l.qty)}</span>
            <button class="cart-line__rm" type="button" data-remove="${l.id}">${icon('trash')}সরান</button>
          </div>
        </div>`;
      })
      .join('');
    $('[data-cart-subtotal]').textContent = taka(sumLines(Cart.lines));
  }

  let frozenLines = null; // after a successful order, keep showing what was bought

  function renderOrderSummary() {
    const box = $('[data-order-lines]');
    if (!box) return;
    const frozen = Boolean(frozenLines);
    const lines = frozenLines || getOrderLines();
    const form = $('[data-order-form]');

    if (!lines.length) {
      box.innerHTML = `<div class="sum__empty">
        ${icon('bag')}
        <p>এখনো কোনো প্রোডাক্ট বেছে নেননি। নিচের যেকোনোটিতে ট্যাপ করলেই অর্ডারে যোগ হয়ে যাবে।</p>
        <div class="chips" style="justify-content:center">
          ${Object.values(CATALOG)
            .map((p) => `<button class="chip" type="button" data-quick-add="${p.id}">${icon('plus')}${esc(p.name)}</button>`)
            .join('')}
        </div>
      </div>`;
    } else {
      box.innerHTML = lines
        .map((l) => {
          const p = CATALOG[l.id];
          const isOwn = l.id === PAGE_PRODUCT;
          return `<div class="sum__item">
            <img src="${p.img}" alt="${esc(p.name)}" width="70" height="70" loading="lazy" decoding="async">
            <div>
              <div class="sum__name">${esc(p.name)}</div>
              <div class="sum__meta">${esc(p.size)}, প্রতিটি ${taka(p.price)}${isOwn || frozen ? '' : ` <button type="button" class="cart-line__rm" data-remove="${l.id}" style="display:inline-flex;margin-left:6px">${icon('x')}বাদ দিন</button>`}</div>
              ${frozen ? '<div class="sum__meta">পরিমাণ: ' + bn(l.qty) + 'টি</div>' : qtyControl(l.id, l.qty, isOwn)}
            </div>
            <span class="sum__line">${taka(p.price * l.qty)}</span>
          </div>`;
        })
        .join('');

      const others = Object.values(CATALOG).filter((p) => !lines.some((l) => l.id === p.id));
      if (others.length && !frozen) {
        box.innerHTML += `<div class="sum__more">
          <p class="tiny">সাথে আরও কিছু নিতে চান? ট্যাপ করলেই যোগ হবে:</p>
          <div class="chips">${others
            .map((p) => `<button class="chip chip--sm" type="button" data-quick-add="${p.id}">${icon('plus')}${esc(p.name)}</button>`)
            .join('')}</div>
        </div>`;
      }
    }

    const subtotal = sumLines(lines);
    const saved = sumCompare(lines) - subtotal;
    const set = (sel, text) => $$(sel).forEach((el) => (el.textContent = text));
    set('[data-order-count]', `${bn(countLines(lines))}টি`);
    set('[data-order-subtotal]', taka(subtotal));
    set('[data-order-saved]', saved > 0 ? `- ${taka(saved)}` : taka(0));
    set('[data-order-total]', taka(subtotal));
    $$('[data-order-saved-row]').forEach((el) => (el.hidden = saved <= 0));

    if (form) {
      const hidden = form.querySelector('input[name="products"]');
      if (hidden) {
        hidden.value = lines.map((l) => `${CATALOG[l.id].en} ${CATALOG[l.id].size} x ${l.qty}`).join(', ');
      }
    }
  }

  function renderAll() {
    renderCartCount();
    renderDrawer();
    renderOrderSummary();
  }

  function flashAdded(btn) {
    if (!btn || btn.dataset.flashing) return;
    btn.dataset.flashing = '1';
    const original = btn.innerHTML;
    btn.innerHTML = `${icon('check')}<span class="btn__label">যোগ হয়েছে</span>`;
    setTimeout(() => {
      btn.innerHTML = original;
      delete btn.dataset.flashing;
    }, 1600);
  }

  /* ------------------------------------------------------------------
     Navigation to the order form
     ------------------------------------------------------------------ */
  function goToOrder() {
    const target = doc.getElementById('order');
    if (!target) {
      location.href = '/#order';
      return;
    }
    Layers.hide();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    const panel = $('[data-order-panel]', target);
    setTimeout(
      () => {
        if (panel) {
          panel.classList.remove('is-flash');
          void panel.offsetWidth;
          panel.classList.add('is-flash');
        }
        const first = $('input[name="name"]', target);
        if (first && !coarsePointer && !first.value) first.focus({ preventScroll: true });
      },
      reducedMotion ? 0 : 750
    );
  }

  /* ------------------------------------------------------------------
     Global click delegation
     ------------------------------------------------------------------ */
  function onClick(e) {
    const t = e.target.closest(
      '[data-add-to-cart],[data-buy-now],[data-scroll-order],[data-cart-open],[data-cart-close],[data-cart-checkout],' +
        '[data-nav-open],[data-nav-close],[data-qty-inc],[data-qty-dec],[data-remove],[data-quick-add],[data-scrim],' +
        '[data-close-layers],[data-new-order]'
    );
    if (!t || t.disabled) return;

    if (t.matches('[data-add-to-cart]')) {
      e.preventDefault();
      const id = t.dataset.addToCart;
      if (!CATALOG[id]) return;
      Cart.add(id, 1);
      Meta.addToCart(id, 1);
      flashAdded(t);
      setTimeout(() => Layers.show($('#cart-drawer')), 260);
      return;
    }

    if (t.matches('[data-buy-now]')) {
      e.preventDefault();
      const id = t.dataset.buyNow;
      const p = CATALOG[id];
      if (!p) return;
      if (!Cart.has(id) && id !== PAGE_PRODUCT) {
        Cart.add(id, 1);
        Meta.addToCart(id, 1);
      }
      Meta.lead(t.dataset.cta || 'Buy Now');
      Meta.checkout();
      toast(`${p.name} অর্ডার ফর্মে যোগ হয়েছে`);
      goToOrder();
      return;
    }

    if (t.matches('[data-scroll-order]')) {
      e.preventDefault();
      const preselect = t.dataset.preselect;
      if (preselect && CATALOG[preselect] && !getOrderLines().length) Cart.add(preselect, 1);
      Meta.lead(t.dataset.cta || t.textContent.trim().slice(0, 60));
      goToOrder();
      return;
    }

    if (t.matches('[data-cart-open]')) {
      e.preventDefault();
      Layers.show($('#cart-drawer'));
      return;
    }

    if (t.matches('[data-cart-checkout]')) {
      e.preventDefault();
      Meta.lead('Cart Checkout');
      Meta.checkout();
      goToOrder();
      return;
    }

    if (t.matches('[data-nav-open]')) {
      e.preventDefault();
      Layers.show($('#mobile-nav'));
      return;
    }

    if (t.matches('[data-cart-close],[data-nav-close],[data-scrim],[data-close-layers]')) {
      if (t.tagName !== 'A') e.preventDefault();
      Layers.hide();
      return;
    }

    if (t.matches('[data-qty-inc],[data-qty-dec]')) {
      e.preventDefault();
      const id = t.closest('[data-qty]').dataset.qty;
      const inOrderForm = Boolean(t.closest('[data-order-lines]'));
      const current = Cart.has(id) ? Cart.qty(id) : id === PAGE_PRODUCT ? 1 : 0;
      const next = current + (t.matches('[data-qty-inc]') ? 1 : -1);
      if (next > CONFIG.maxQty) {
        toast(`একটি প্রোডাক্ট একসাথে সর্বোচ্চ ${bn(CONFIG.maxQty)}টি অর্ডার করা যাবে`);
        return;
      }
      if (next < 1) {
        if (id === PAGE_PRODUCT && inOrderForm) return;
        Cart.remove(id);
        return;
      }
      if (!Cart.has(id) && next > current) Meta.addToCart(id, next - current);
      Cart.set(id, next);
      return;
    }

    if (t.matches('[data-remove]')) {
      e.preventDefault();
      const p = CATALOG[t.dataset.remove];
      Cart.remove(t.dataset.remove);
      if (p) toast(`${p.name} সরিয়ে দেওয়া হয়েছে`);
      return;
    }

    if (t.matches('[data-quick-add]')) {
      e.preventDefault();
      const id = t.dataset.quickAdd;
      Cart.add(id, 1);
      Meta.addToCart(id, 1);
      toast(`${CATALOG[id].name} অর্ডারে যোগ হয়েছে`);
      return;
    }

    if (t.matches('[data-new-order]')) {
      e.preventDefault();
      resetOrderForm();
    }
  }

  /* ------------------------------------------------------------------
     Order form (Formspree)
     ------------------------------------------------------------------ */
  const MSG = {
    nameEmpty: 'আপনার নামটা লিখুন, যাতে ডেলিভারির সময় আপনাকে সহজে খুঁজে পাওয়া যায়।',
    nameShort: 'পুরো নামটা লিখুন (কমপক্ষে ৩ অক্ষর)।',
    nameDigits: 'নামের ঘরে কোনো সংখ্যা লিখবেন না।',
    phoneEmpty: 'মোবাইল নম্বরটা দিন, অর্ডার কনফার্ম করতে আমরা একবার কল করব।',
    phoneBad: 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন, যেমন ০১৭১২৩৪৫৬৭৮।',
    district: 'তালিকা থেকে আপনার জেলাটি বেছে নিন।',
    addressEmpty: 'প্রোডাক্ট পৌঁছে দিতে আপনার সম্পূর্ণ ঠিকানাটা লিখুন।',
    addressShort: 'বাসা নম্বর, রোড, এলাকা আর থানা সহ একটু বিস্তারিত লিখুন।',
    noItems: 'আপনার অর্ডারে এখনো কোনো প্রোডাক্ট নেই। অর্ডার সামারি থেকে অন্তত একটি প্রোডাক্ট যোগ করুন।',
    network: `দুঃখিত, এই মুহূর্তে অর্ডারটি পাঠানো যায়নি। ইন্টারনেট কানেকশন দেখে আবার চেষ্টা করুন, অথবা সরাসরি <a href="${CONFIG.whatsapp}" target="_blank" rel="noopener" style="text-decoration:underline;font-weight:600">WhatsApp করুন</a>।`,
  };

  function normalizePhone(value) {
    let d = toEnDigits(value).replace(/\D/g, '');
    if (d.startsWith('880')) d = d.slice(2);
    else if (d.startsWith('88') && d.length === 13) d = d.slice(2);
    if (d.length === 10 && d.startsWith('1')) d = '0' + d;
    return d;
  }

  const RULES = {
    name(v) {
      const s = v.trim();
      if (!s) return MSG.nameEmpty;
      if (s.replace(/\s/g, '').length < 3) return MSG.nameShort;
      if (/\d/.test(toEnDigits(s))) return MSG.nameDigits;
      return '';
    },
    phone(v) {
      if (!toEnDigits(v).replace(/\D/g, '')) return MSG.phoneEmpty;
      return /^01[3-9]\d{8}$/.test(normalizePhone(v)) ? '' : MSG.phoneBad;
    },
    district(v) {
      return v ? '' : MSG.district;
    },
    address(v) {
      const s = v.trim();
      if (!s) return MSG.addressEmpty;
      if (s.length < 12) return MSG.addressShort;
      return '';
    },
  };

  function setFieldState(input, message) {
    const field = input.closest('.field');
    if (!field) return;
    const err = $('.error span', field);
    field.classList.toggle('is-invalid', Boolean(message));
    field.classList.toggle('is-valid', !message && Boolean(input.value.trim()));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (err) err.textContent = message;
  }

  function validateField(input) {
    const rule = RULES[input.name];
    if (!rule) return '';
    const message = rule(input.value);
    setFieldState(input, message);
    return message;
  }

  function showStatus(form, type, html) {
    const box = $('[data-form-status]', form);
    if (!box) return;
    box.className = `form-status form-status--${type} is-on`;
    box.innerHTML = `${icon(type === 'ok' ? 'check' : 'alert')}<span>${html}</span>`;
  }

  function hideStatus(form) {
    const box = $('[data-form-status]', form);
    if (box) box.className = 'form-status';
  }

  function dhakaStamp() {
    const now = new Date(Date.now() + 6 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  }

  function makeOrderId() {
    const rand = new Uint16Array(1);
    (window.crypto || window.msCrypto).getRandomValues(rand);
    return `TF-${dhakaStamp()}-${String(1000 + (rand[0] % 9000))}`;
  }

  function trafficSource() {
    try {
      const src = JSON.parse(sessionStorage.getItem('tf_src') || '{}');
      const parts = Object.entries(src).map(([k, v]) => `${k}=${v}`);
      return parts.length ? parts.join(' | ') : 'direct';
    } catch (err) {
      return 'unknown';
    }
  }

  function captureSource() {
    try {
      const q = new URLSearchParams(location.search);
      const found = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'].forEach((k) => {
        const v = q.get(k);
        if (v) found[k] = v.slice(0, 120);
      });
      if (Object.keys(found).length) {
        sessionStorage.setItem('tf_src', JSON.stringify(found));
      } else if (!sessionStorage.getItem('tf_src') && doc.referrer && !doc.referrer.includes(location.host)) {
        sessionStorage.setItem('tf_src', JSON.stringify({ referrer: doc.referrer.slice(0, 160) }));
      }
    } catch (err) {
      /* storage blocked */
    }
  }

  let orderBusy = false;

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (orderBusy) return;
    hideStatus(form);

    const inputs = ['name', 'phone', 'district', 'address'].map((n) => form.elements[n]);
    let firstInvalid = null;
    inputs.forEach((input) => {
      if (validateField(input) && !firstInvalid) firstInvalid = input;
    });

    const lines = getOrderLines();
    if (!lines.length) {
      showStatus(form, 'err', MSG.noItems);
      $('[data-order-lines]').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      return;
    }

    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      firstInvalid.focus({ preventScroll: true });
      return;
    }

    // honeypot: bots fill hidden fields, people never see them
    if (form.elements._gotcha && form.elements._gotcha.value) {
      showThanks(form, { orderId: makeOrderId(), name: '', phone: '', total: 0 });
      return;
    }

    const btn = $('[data-submit]', form);
    orderBusy = true;
    btn.classList.add('is-busy');
    btn.disabled = true;

    const districtEl = form.elements.district;
    const data = {
      name: form.elements.name.value.trim().replace(/\s+/g, ' '),
      phone: normalizePhone(form.elements.phone.value),
      district: districtEl.value,
      districtEn: (districtEl.selectedOptions[0] && districtEl.selectedOptions[0].dataset.en) || '',
      address: form.elements.address.value.trim(),
    };
    const orderId = makeOrderId();
    const subtotal = sumLines(lines);

    const payload = {
      _subject: `নতুন অর্ডার ${orderId} | ${takaEn(subtotal)} | ${data.name}`,
      'অর্ডার আইডি': orderId,
      'আপনার নাম': data.name,
      'মোবাইল নম্বর': data.phone,
      'আপনার জেলা': `${data.district}${data.districtEn ? ` (${data.districtEn})` : ''}`,
      'আপনার সম্পূর্ণ ঠিকানা': data.address,
      'অর্ডারকৃত প্রোডাক্ট': lines
        .map((l) => {
          const p = CATALOG[l.id];
          return `${p.name} | ${p.en} ${p.size} | ${l.qty} পিস x ${takaEn(p.price)} = ${takaEn(p.price * l.qty)}`;
        })
        .join('\n'),
      'মোট পিস': countLines(lines),
      'ডেলিভারি চার্জ': 'ফ্রি (Free Delivery)',
      'সর্বমোট (ক্যাশ অন ডেলিভারি)': takaEn(subtotal),
      'পেমেন্ট মাধ্যম': 'ক্যাশ অন ডেলিভারি',
      'অর্ডারের পেজ': location.href.split('#')[0],
      'অর্ডারের সময় (ঢাকা)': new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour12: true }),
      'ট্রাফিক সোর্স': trafficSource(),
    };

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 20000) : 0;

    try {
      const res = await fetch(CONFIG.orderEndpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
      });

      if (!res.ok) {
        let detail = '';
        try {
          const json = await res.json();
          detail = (json.errors || []).map((x) => x.message).join(', ');
        } catch (err) {
          detail = '';
        }
        throw new Error(detail || `Formspree HTTP ${res.status}`);
      }

      const [first, ...rest] = data.name.split(' ');
      Meta.track(
        'Purchase',
        { ...Meta.commerce(lines), order_id: orderId },
        { ph: data.phone, fn: first, ln: rest.join(' '), ct: data.districtEn, country: 'bd', external_id: data.phone }
      );

      frozenLines = lines;
      Cart.removeMany(lines.map((l) => l.id));
      showThanks(form, { orderId, name: data.name, phone: data.phone, total: subtotal });
    } catch (err) {
      console.warn('[The Formulate] order submit failed:', err);
      showStatus(form, 'err', MSG.network);
    } finally {
      clearTimeout(timer);
      orderBusy = false;
      btn.classList.remove('is-busy');
      btn.disabled = false;
    }
  }

  function showThanks(form, info) {
    const section = form.closest('#order') || doc;
    const body = $('[data-order-body]', section);
    const thanks = $('[data-thanks]', section);
    if (!thanks) return;
    if (body) body.hidden = true;
    const set = (sel, text) => $$(sel, thanks).forEach((el) => (el.textContent = text));
    set('[data-thanks-name]', info.name ? info.name.split(' ')[0] : '');
    set('[data-thanks-phone]', toBnDigits(info.phone || ''));
    set('[data-thanks-id]', info.orderId);
    set('[data-thanks-total]', taka(info.total));
    thanks.classList.add('is-on');
    thanks.hidden = false;
    thanks.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }

  function resetOrderForm() {
    const section = doc.getElementById('order');
    if (!section) return;
    const form = $('[data-order-form]', section);
    const body = $('[data-order-body]', section);
    const thanks = $('[data-thanks]', section);
    if (form) {
      form.reset();
      $$('.field', form).forEach((f) => f.classList.remove('is-valid', 'is-invalid'));
      hideStatus(form);
    }
    if (thanks) {
      thanks.classList.remove('is-on');
      thanks.hidden = true;
    }
    if (body) body.hidden = false;
    frozenLines = null;
    updateEta();
    renderOrderSummary();
    section.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function updateEta() {
    const form = $('[data-order-form]');
    if (!form) return;
    const d = form.elements.district.value;
    const text = !d
      ? 'জেলা বেছে নিলেই ডেলিভারির আনুমানিক সময় দেখাবে'
      : d === 'ঢাকা'
        ? 'ঢাকার ভেতরে সাধারণত ১ থেকে ২ দিনে পৌঁছে যায়'
        : `${d} জেলায় সাধারণত ২ থেকে ৪ দিনে পৌঁছে যায়`;
    $$('[data-order-eta]').forEach((el) => (el.textContent = text));
  }

  function initOrderForm() {
    const form = $('[data-order-form]');
    if (!form) return;
    form.setAttribute('novalidate', '');

    ['name', 'phone', 'district', 'address'].forEach((n) => {
      const input = form.elements[n];
      if (!input) return;
      input.addEventListener('blur', () => {
        if (input.value.trim() || input.closest('.field').classList.contains('is-invalid')) validateField(input);
        if (n === 'phone' && !RULES.phone(input.value)) input.value = normalizePhone(input.value);
      });
      input.addEventListener(n === 'district' ? 'change' : 'input', () => {
        if (input.closest('.field').classList.contains('is-invalid') || n === 'district') validateField(input);
      });
      input.addEventListener('focus', () => Meta.checkout(), { once: true });
    });

    form.elements.district.addEventListener('change', updateEta);
    form.addEventListener('submit', submitOrder);
    updateEta();
  }

  /* ------------------------------------------------------------------
     Interface motion
     ------------------------------------------------------------------ */
  function initHeader() {
    const header = $('[data-header]');
    const bar = $('[data-progress]');
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      if (header) header.classList.toggle('is-stuck', y > 8);
      if (bar) {
        const max = root.scrollHeight - window.innerHeight;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      }
      ticking = false;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  function initReveal() {
    $$('[data-stagger]').forEach((group) => {
      Array.from(group.children)
        .filter((c) => c.classList.contains('reveal'))
        .forEach((child, i) => child.style.setProperty('--d', `${Math.min(i, 8) * 90}ms`));
    });

    const items = $$('.reveal');
    if (!('IntersectionObserver' in window) || reducedMotion) {
      items.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    items.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const run = (el) => {
      const end = parseFloat(el.dataset.count);
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      const suffix = el.dataset.suffix || '';
      const format = (v) => (decimals ? toBnDigits(v.toFixed(decimals)) : bn(v)) + suffix;
      if (reducedMotion) {
        el.textContent = format(end);
        return;
      }
      const start = performance.now();
      const duration = 1700;
      const step = (now) => {
        const k = Math.min(1, (now - start) / duration);
        el.textContent = format(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          run(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    els.forEach((el) => io.observe(el));
  }

  function initCountdown() {
    const boxes = $$('[data-countdown]');
    if (!boxes.length) return;
    const DAY = 86400000;
    const tick = () => {
      const dhakaNow = Date.now() + 6 * 3600000;
      const left = Math.floor(dhakaNow / DAY) * DAY + DAY - dhakaNow;
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      const s = Math.floor((left % 60000) / 1000);
      const pad = (n) => toBnDigits(String(n).padStart(2, '0'));
      boxes.forEach((box) => {
        const [hh, mm, ss] = $$('b', box);
        if (hh) hh.textContent = pad(h);
        if (mm) mm.textContent = pad(m);
        if (ss) ss.textContent = pad(s);
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  function initGallery() {
    $$('[data-gallery]').forEach((gallery) => {
      const main = $('[data-gallery-main]', gallery);
      const thumbs = $$('[data-gallery-thumb]', gallery);
      thumbs.forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!main || btn.getAttribute('aria-selected') === 'true') return;
          main.style.opacity = '0';
          setTimeout(() => {
            main.src = btn.dataset.src;
            main.alt = btn.dataset.alt || main.alt;
            main.style.opacity = '1';
          }, 180);
          thumbs.forEach((t) => t.setAttribute('aria-selected', String(t === btn)));
        });
      });
      if (main) main.style.transition = 'opacity .25s ease';
    });
  }

  function initBuybar() {
    const bar = $('[data-buybar]');
    if (!bar || !('IntersectionObserver' in window)) return;
    const watched = $$('[data-buybar-hide]');
    const visible = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
      bar.classList.toggle('is-on', visible.size === 0 && window.scrollY > 300);
    });
    watched.forEach((el) => io.observe(el));
    window.addEventListener(
      'scroll',
      () => bar.classList.toggle('is-on', visible.size === 0 && window.scrollY > 300),
      { passive: true }
    );
  }

  function initFaq() {
    $$('.faq').forEach((faq) => {
      const items = $$('details', faq);
      items.forEach((item) => {
        item.addEventListener('toggle', () => {
          if (!item.open) return;
          items.forEach((other) => {
            if (other !== item) other.open = false;
          });
        });
      });
    });
  }

  function initKeyboard() {
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && Layers.open) Layers.hide();
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function boot() {
    captureSource();
    mountChrome();
    Cart.load();
    Cart.subscribe(renderAll);
    renderAll();

    doc.addEventListener('click', onClick);
    window.addEventListener('storage', (e) => {
      if (e.key === CONFIG.cartKey) {
        Cart.load();
        renderAll();
      }
    });

    initOrderForm();
    initHeader();
    initReveal();
    initCounters();
    initCountdown();
    initGallery();
    initBuybar();
    initFaq();
    initKeyboard();
    $$('[data-year]').forEach((el) => (el.textContent = toBnDigits(new Date().getFullYear())));

    // tracking: PageView on every load, ViewContent on product pages
    Meta.track('PageView', {});
    if (PAGE_PRODUCT) {
      const p = CATALOG[PAGE_PRODUCT];
      Meta.track('ViewContent', {
        content_ids: [p.sku],
        content_name: p.en,
        content_type: 'product',
        value: p.price,
        currency: CONFIG.currency,
      });
    }

    if (location.hash === '#order') setTimeout(goToOrder, 300);

    window.TF = { CATALOG, Cart, track: Meta.track.bind(Meta), uuidv4, goToOrder };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
