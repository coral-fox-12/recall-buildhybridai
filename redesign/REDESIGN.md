# Recall redesign — "the card catalogue"

Live: https://recall-buildhybridai.surge.sh (same URL)
Repo: https://github.com/coral-fox-12/recall-buildhybridai

## Before (audit, screenshots `before-1440.png` / `before-390.png`)

- Indigo→violet gradient topbar (`#1e1b4b → #4f46e5 → #7c3aed`), blue
  primary buttons, blue tab underline — the default AI-app palette.
- `system-ui` everywhere at one weight; no display face, no hierarchy.
- Brain emoji logo + emoji on every generate button and every empty state
  (🗂️ ❓ 🗓️ 💡 📷 🔁), emoji favicon.
- Identical rounded white cards (14px radius, soft shadow) in one column.
- The engine status was a dark pill floating on the gradient.

## After (screenshots `after-1440.png` / `after-390.png`, live)

- **Identity:** a library card catalogue / study desk. Warm paper `#f6f2e7`,
  ink `#221c15`, hairline rules, **one accent — oxblood `#7c2230`**.
  No blue, no gradients, no shadows, no rounded corners anywhere.
- **Type (self-hosted, zero external requests):** Newsreader (serif display,
  incl. italic) for the masthead and section heads + IBM Plex Mono for
  kickers, labels, buttons, route tags and numbers + system sans for body.
  `fonts/` holds 6 woff2 files (~370 KB).
- **Layout:** double-rule masthead — oxblood "R" lettermark, mono kicker
  ("Build with Hybrid AI 2026 · Firebase AI Logic"), big Newsreader
  "Recall — *notes in, knowledge out*", deck copy; right side is a bordered
  "ENGINE" record box with the live status (same IDs, same demo-mode text).
  Numbered sections (01 Notes / 02 Generate), hairline-ruled panels,
  ink generate buttons with mono index numbers 01–04 and bordered route
  tags (on-device green / cloud slate, muted and functional only).
- **Copy:** unchanged where it was already specific (route panel, empty
  states, footer verbatim). Empty states lost the big emoji and gained a
  small mono kicker ("Empty deck", "No quiz yet", …). No banned marketing
  words anywhere; no new claims or numbers.
- **Presentation only:** every element ID, link, heading, sample flow and
  the full app logic are unchanged; `src/app.js` only had its three
  button-label resets rewritten to the new markup (no emoji). Favicon is
  now an oxblood square with a serif R.

## Verification

- `node test.mjs` (full flow: flashcards, quiz, grading, plan, explain,
  review, persistence, keyboard nav): **23/23 PASS, 0 console errors,
  0 failed requests, 0 app-recorded JS errors** — run locally before and
  after deploy.
- Live smoke (`redesign/smoke.cjs` against the Surge URL): engine demo
  mode, 5 flashcards generated, 5 quiz questions, card flips — **5/5 PASS,
  no console errors, no failed requests**.
- Live screenshots at 1440px and 390px confirm the redesign landed; one
  real bug found in review (empty tab-count badges rendered as hollow
  boxes) was fixed with `.tab .count:empty { display: none; }` and
  re-verified live.
- Deployed with `surge --project . --domain recall-buildhybridai.surge.sh`
  (`.surgeignore` keeps `redesign/` and `node_modules/` out of the deploy).

## Files changed

- `index.html` — masthead, logo, favicon, button labels, empty states
- `styles.css` — full rewrite
- `src/app.js` — 3 button-label resets (same IDs, same text, no emoji)
- `fonts/` (new) — 6 self-hosted woff2 files
- `.surgeignore` (new)
- `README.md` — design description + fonts/ in the structure list
- `redesign/` (new) — before/after + local screenshots, `getfonts.cjs`,
  `local-shot.cjs`, `smoke.cjs`, this file

## Follow-up for the parent (not done here)

- The demo video (`demo-video.mp4`) was recorded against the old UI — it
  needs re-recording against the new design before the 01/12 Devpost
  submission. Same for any screenshots taken from the old site.
- The real Firebase project + Gemini key wiring (per DEPLOY.md) is still
  pending; the site still runs in demo mode, exactly as before.
