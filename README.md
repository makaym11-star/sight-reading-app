# Sight Reading Practice App

A browser-based piano sight reading practice tool. Generates original MusicXML exercises via the Anthropic API and renders them inline using OpenSheetMusicDisplay.

## Architecture

- `sight_reading_1.html` — single-file frontend (HTML + CSS + JS)
- `api/generate.js` — Vercel Edge Function that proxies Anthropic API calls. Holds the server API key and rate-limits demo usage per IP.
- `vercel.json` — routes `/` to the HTML file
- `package.json` — minimal manifest for Vercel project detection

## Local development

Open `sight_reading_1.html` directly in a browser. In local file mode, the app requires a personal Anthropic API key (stored in browser localStorage). Enter your key when the banner prompts you.

## Deploying to Vercel

1. Push this folder to a GitHub repo
2. Import the repo at https://vercel.com/new
3. In **Project Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
4. (Recommended) Add Vercel KV for demo rate limiting:
   - **Storage → Create → KV** (free Hobby tier)
   - Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`
   - Without KV, the proxy still works but doesn't enforce a daily limit
5. Deploy

After deploy you'll get a URL like `https://sight-reading-app.vercel.app`. Anyone visiting it gets 5 free generations per day (per IP). After the limit, they're prompted to enter their own API key to continue.

## Cost protection

- **Vercel KV rate limit** — 10 generations per IP per day (configurable via `DAILY_DEMO_LIMIT` in `api/generate.js`)
- **Anthropic spend cap** — set a monthly maximum in your Anthropic Console for an absolute ceiling
- **Per-call cost** — each generation costs roughly $0.001–$0.01 depending on model and exercise length

## Updating

```bash
git add sight_reading_1.html
git commit -m "describe what changed"
git push
```

Vercel auto-deploys on push. Live URL updates within ~60 seconds.
