# Deploy Recall to Cloudflare Pages (free tier)

Status: **prepared, not deployed** — no Cloudflare account/token exists
yet on this machine (checked `~/workspace/makefun/`: no Cloudflare
credentials; no `~/.wrangler` config; wrangler CLI not installed).
A separate browser task is creating the Cloudflare account. Once it
reports an API token, run the steps below — no code change needed.

## What is ready in this folder

- `wrangler.toml` — Pages project `recall-buildhybridai`, output dir `.`
  (pure static site, no build step).
- `_headers` — cache rules (immutable for .js/.css, no-cache for .html)
  + basic security headers.
- The app itself needs nothing at deploy time: `src/config.js` still
  holds `YOUR_*` placeholders, so the deployed site runs in **demo mode**
  (same as the demo video). Wiring the real Firebase project comes later
  via `src/config.js` — never commit real keys; inject at deploy time.

## Deploy (once the token exists)

```bash
cd ~/workspace/devpost/buildhybridai-2026

# 1. Install wrangler (one time)
npm install -g wrangler

# 2. Log in with the Cloudflare account (browser OAuth), or set a token:
#    CLOUDFLARE_API_TOKEN=<token from the browser task>
#    CLOUDFLARE_ACCOUNT_ID=<account id>
#    Never paste the token into a file in this repo.

# 3. Deploy the folder as-is (no build)
npx wrangler pages deploy . --project-name recall-buildhybridai

# First deploy prints a URL like:
#   https://recall-buildhybridai.pages.dev
```

## Verify after deploy

```bash
curl -sI https://recall-buildhybridai.pages.dev/ | head -5
# expect HTTP 200, content-type text/html
# open the URL in a browser: demo-mode badge must show, sample notes →
# flashcards → quiz → plan must all work with 0 console errors.
```

## Alternative (if Cloudflare is blocked)

Firebase App Hosting — `firebase.json` is already in this folder
(`firebase deploy --only apphosting` after `firebase login` + linking the
Firebase project). Same static files, same demo mode.

## Notes

- Free tier limits are far above what judging traffic needs
  (100k requests/day, unlimited bandwidth on Pages).
- The demo video (`demo-video.mp4`) was recorded against the local static
  server; the deployed site serves the identical files.
