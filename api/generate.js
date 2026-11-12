// Vercel Edge Function — proxies Anthropic API calls.
// Holds the server-side API key and rate-limits demo usage per IP.
// If client sends an "x-byok-key" header (bring-your-own-key), uses that
// instead of the server key and skips rate limiting.

export const config = { runtime: 'edge' };

const DAILY_DEMO_LIMIT = 10;

// Only these models may be called with the server key, and output is capped.
const ALLOWED_MODELS = new Set(['claude-haiku-4-5-20251001', 'claude-sonnet-4-6']);
const MAX_TOKENS_CAP = 4000;

// Per-IP daily counter via Upstash Redis REST API.
// If env vars are not configured, rate limiting is disabled (useful for first deploys).
async function checkDemoRateLimit(ip) {
  const baseUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return { ok: true, remaining: -1, configured: false };

  const today = new Date().toISOString().slice(0, 10);
  const key = `gen:${ip}:${today}`;
  const headers = { Authorization: `Bearer ${token}` };

  // If the KV/Upstash store is unreachable or misconfigured, don't crash the whole
  // function. Let the request through (cost is still bounded by the model
  // whitelist and max_tokens cap below) and log so it shows up in Vercel logs.
  let count;
  try {
    const incrRes = await fetch(`${baseUrl}/incr/${encodeURIComponent(key)}`, { headers });
    const incrJson = await incrRes.json();
    if (!incrRes.ok || typeof incrJson.result !== 'number') {
      throw new Error(`KV incr failed: ${incrRes.status} ${JSON.stringify(incrJson).slice(0, 200)}`);
    }
    count = incrJson.result;
    if (count === 1) {
      // Set expiry to 26 hours so it cleans up reliably after the calendar day rolls
      await fetch(`${baseUrl}/expire/${encodeURIComponent(key)}/93600`, { headers });
    }
  } catch (err) {
    console.error('Rate limit check failed, allowing request:', err?.message || err);
    return { ok: true, remaining: -1, configured: false };
  }

  return {
    ok: count <= DAILY_DEMO_LIMIT,
    remaining: Math.max(0, DAILY_DEMO_LIMIT - count),
    configured: true,
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const byokKey = req.headers.get('x-byok-key');
  const adminBypass = req.headers.get('x-admin-bypass');
  const adminToken = process.env.ADMIN_BYPASS_TOKEN;
  const isAdmin = adminToken && adminBypass && adminBypass === adminToken;

  let apiKey;
  let demoRemaining = null;

  if (byokKey) {
    apiKey = byokKey;
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'server_misconfigured',
          message: 'The proxy is missing ANTHROPIC_API_KEY. Set it in Vercel project settings.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
      const limit = await checkDemoRateLimit(ip);
      if (!limit.ok) {
        return new Response(
          JSON.stringify({
            error: 'demo_limit',
            message: 'Daily demo limit reached. To continue using the app today, enter your own Anthropic API key — it stays in your browser only.',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
      demoRemaining = limit.remaining;
    }
  }

  let body = await req.text();

  // When using the server key, only allow the app's own models and output size.
  if (!byokKey) {
    let parsed;
    try { parsed = JSON.parse(body); } catch (e) {
      return new Response(JSON.stringify({ error: 'bad_request', message: 'Invalid JSON body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!ALLOWED_MODELS.has(parsed.model)) {
      return new Response(JSON.stringify({ error: 'bad_request', message: 'Model not allowed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    parsed.max_tokens = Math.min(Number(parsed.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
    body = JSON.stringify(parsed);
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    },
    body,
  });

  const responseHeaders = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream',
  });
  if (demoRemaining !== null) responseHeaders.set('x-demo-remaining', String(demoRemaining));

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
