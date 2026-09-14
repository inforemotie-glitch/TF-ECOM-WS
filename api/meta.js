/**
 * The Formulate | Meta Conversions API relay
 * Vercel Serverless Function: POST /api/meta
 *
 * The browser fires fbq('track', eventName, data, { eventID }) and posts the
 * same eventId here. Meta receives both copies and keeps one, so every event
 * is counted exactly once while still surviving ad blockers and iOS limits.
 *
 * Required environment variables (Vercel > Project > Settings > Environment Variables):
 *   META_PIXEL_ID      your Pixel / Dataset ID
 *   META_CAPI_TOKEN    Conversions API access token
 * Optional:
 *   META_TEST_EVENT_CODE  e.g. TEST12345, shows events live in Events Manager > Test Events
 *   ALLOWED_ORIGINS       comma separated list, e.g. https://theformulate.co,https://www.theformulate.co
 */
import crypto from 'node:crypto';

const GRAPH_VERSION = 'v20.0';
const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Lead',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'Contact',
]);

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

/** trim + lowercase, then hash. Empty values are dropped entirely. */
const hashed = (value) => {
  const clean = String(value ?? '').trim().toLowerCase();
  return clean ? sha256(clean) : undefined;
};

/** Meta wants country code + number, digits only: 8801712345678 */
const normalizePhone = (value) => {
  let digits = String(value ?? '')
    .replace(/[০-৯]/g, (d) => BN_DIGITS.indexOf(d))
    .replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
};

/** city: lowercase, letters only, no spaces or punctuation */
const normalizeCity = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

const readBody = (req) => {
  const { body } = req;
  if (!body) return null;
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  try {
    return JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : body);
  } catch {
    return null;
  }
};

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '')).split(',')[0].trim();
  return first || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
};

const toNumber = (v) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

function cleanCustomData(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;

  if (input.currency) out.currency = String(input.currency).slice(0, 3).toUpperCase();
  if (toNumber(input.value) !== undefined) out.value = toNumber(input.value);
  if (Array.isArray(input.content_ids)) out.content_ids = input.content_ids.slice(0, 50).map(String);
  if (input.content_type) out.content_type = String(input.content_type).slice(0, 40);
  if (input.content_name) out.content_name = String(input.content_name).slice(0, 200);
  if (Array.isArray(input.contents)) {
    out.contents = input.contents.slice(0, 50).map((c) => ({
      id: String(c?.id ?? ''),
      quantity: Math.max(1, parseInt(c?.quantity, 10) || 1),
      item_price: toNumber(c?.item_price),
    }));
  }
  if (toNumber(input.num_items) !== undefined) out.num_items = Math.max(0, parseInt(input.num_items, 10));
  if (input.order_id) out.order_id = String(input.order_id).slice(0, 64);
  if (input.cta) out.cta = String(input.cta).slice(0, 80);

  return out;
}

function buildUserData(req, body) {
  const incoming = body.userData && typeof body.userData === 'object' ? body.userData : {};
  const phone = normalizePhone(incoming.ph);

  return {
    client_ip_address: clientIp(req) || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: typeof body.fbp === 'string' && body.fbp.startsWith('fb.') ? body.fbp.slice(0, 200) : undefined,
    fbc: typeof body.fbc === 'string' && body.fbc.startsWith('fb.') ? body.fbc.slice(0, 500) : undefined,
    ph: phone ? sha256(phone) : undefined,
    fn: hashed(incoming.fn),
    ln: hashed(incoming.ln),
    ct: normalizeCity(incoming.ct) ? sha256(normalizeCity(incoming.ct)) : undefined,
    country: hashed(incoming.country),
    external_id: phone ? sha256(phone) : hashed(incoming.external_id),
  };
}

function eventSourceUrl(req, body) {
  const candidate = typeof body.eventSourceUrl === 'string' ? body.eventSourceUrl : req.headers.referer || '';
  return /^https?:\/\//i.test(candidate) ? candidate.slice(0, 1000) : undefined;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  if (!process.env.META_PIXEL_ID || !process.env.META_CAPI_TOKEN) {
    console.error('[meta-capi] META_PIXEL_ID or META_CAPI_TOKEN is not set');
    return res.status(500).json({ ok: false, error: 'Conversions API is not configured on the server' });
  }

  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (allowed.length && origin && !allowed.includes(origin)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  }

  const body = readBody(req);
  if (!body) {
    return res.status(400).json({ ok: false, error: 'Expected a JSON body' });
  }

  const { eventName, eventId } = body;

  if (!ALLOWED_EVENTS.has(eventName)) {
    return res.status(400).json({ ok: false, error: `Unsupported eventName: ${String(eventName).slice(0, 40)}` });
  }

  if (typeof eventId !== 'string' || !eventId.trim() || eventId.length > 128) {
    return res.status(400).json({ ok: false, error: 'A valid eventId string is required for deduplication' });
  }

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: eventSourceUrl(req, body),
    user_data: buildUserData(req, body),
    custom_data: cleanCustomData(body.customData),
  };

  const payload = { data: [event] };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${process.env.META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.META_CAPI_TOKEN}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[meta-capi] Graph API error', response.status, JSON.stringify(result?.error || result));
      return res.status(502).json({
        ok: false,
        eventId,
        error: result?.error?.message || `Graph API responded with ${response.status}`,
        fbtrace_id: result?.error?.fbtrace_id,
      });
    }

    return res.status(200).json({
      ok: true,
      eventId,
      events_received: result.events_received,
      fbtrace_id: result.fbtrace_id,
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    console.error('[meta-capi] request failed', aborted ? 'timeout' : err?.message);
    return res.status(aborted ? 504 : 500).json({ ok: false, eventId, error: aborted ? 'Graph API timeout' : 'Relay failed' });
  } finally {
    clearTimeout(timeout);
  }
}
