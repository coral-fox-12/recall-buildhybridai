# Submission checklist — #BuildHybridAI 2026

Deadline: **Nov 30, 2026 2:00 PM PT = 05:00 VN Tue Dec 1, 2026.**
Prizes: Grand $10,000 · 1st Runner Up $7,000 · 2nd Runner Up $4,000 ·
Best Web/Chrome $3,000 · Best Android $3,000 · Best iOS $3,000.

## Done (in this folder)

- [x] Web app using Firebase AI Logic hybrid inference
  - `src/ai/engine.js` — real engine: `getAI` + `GoogleAIBackend`,
    `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE` (quick tasks),
    `ONLY_IN_CLOUD` (deep tasks), `ONLY_ON_DEVICE` (routing switch),
    `initializeDeviceModel()` on user gesture, JSON `responseSchema` for
    flashcards/quiz/grading, multimodal image input (photo of notes).
  - Firebase AI Logic is imported and actually called at runtime (dynamic
    import of `firebase/app`, `firebase/app-check`, `firebase/ai` when a
    project is configured), not just named in the README.
- [x] App Check wired (debug provider for localhost; debug tokens allowed
  in submissions per the rules).
- [x] Public repo ready: Apache 2.0 LICENSE, README, `.gitignore`
  (no secrets committed — `src/config.js` holds placeholders only).
- [x] Demo mode: full flow testable offline with zero keys (deterministic
  stub engine, clearly labelled in the UI).
- [x] Tested headlessly (`node test.mjs`, 23 checks — full flow incl.
  keyboard card flip, arrow-key tab navigation, grading, plan, explain,
  review queue, routing switch, reload persistence; 0 console errors,
  0 failed requests; last run 2026-11-17, all passed). Screenshots
  refreshed by the same run.
- [x] Accessibility pass: labelled fields, WAI-ARIA tabs with arrow-key
  navigation, keyboard-flippable cards, focusable photo picker, visible
  `:focus-visible` outlines, `aria-live` results, ≥ 4.5:1 contrast.
- [x] README now embeds the 4 screenshots, documents testing and
  accessibility, and states what was built during the submission period.
- [x] Demo video script (`DEMO_SCRIPT.md`, 2:30 target).

## Still missing before submit (parent / user steps)

1. **Firebase project + Gemini key** — create a Firebase project, run the
   AI Logic guided setup (Gemini Developer API, free tier), paste the
   config into `src/config.js`, register the App Check debug token.
   Then re-test once with the real engine (one flashcard + one cloud call)
   and record the demo video against the live engine.
   - Optional: apply for extra quota via the Quota Form — Sprint 2 request
     by **Nov 18 10:00 PT** (≈ 01:00 VN Nov 19), Sprint 3 by Nov 25 10:00 PT.
     The free tier is enough for the demo; quota is only needed for heavy
     judging traffic.
2. **Host the app** — deploy to Firebase App Hosting (`firebase.json` is
   included) or any static host; the submission needs a public URL for
   judging. (Localhost is not enough.)
3. **Public GitHub repo** — push this folder to a public repo with the
   Apache 2.0 license visible.
4. **Demo video (≤ 3 min)** — record per `DEMO_SCRIPT.md`, upload to
   YouTube as Public, English voiceover/subtitles.
5. **Devpost submission** — on the agent's separate Devpost account:
   title, tagline, description (how Firebase AI Logic is used, features,
   value proposition), platform = Web, repo URL, hosted URL, video URL,
   "built during the submission period" summary. Submit before the
   deadline; drafts can be saved early.
6. **Winner paperwork (only if we win)** — W-8BEN (non-US) + affidavit
   within 10 business days of notification.

## Judging criteria (how this entry maps)

1. **Technological Implementation** — real hybrid inference, two modes,
   JSON schemas, multimodal input, App Check, visible routing + latency.
2. **Design** — complete product: notes → deck → quiz → grading → plan →
   spaced review, not a bare API demo.
3. **Potential Impact** — students studying offline / on bad wifi, with
   private notes; a concrete audience and a concrete problem.
4. **Quality of the Idea** — the route badge makes the hybrid trade-off
   (speed/privacy/cost) visible to the user instead of hiding it.
