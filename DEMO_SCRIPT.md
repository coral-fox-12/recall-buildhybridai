# Demo video script — Recall (target: 2 min 30 s, max 3 min)

Record in Chrome 139+ on desktop, 1280×720, screen capture + voiceover in
English. Show the app working, not slides. Keep the route badges visible —
they are the point of the entry.

## 0:00–0:20 — The problem + the idea
- (Show a student with notes, or just the app with sample notes loaded.)
- "Students study on planes, in libraries, on bad wifi — and their notes are
  private. Recall turns notes into flashcards, quizzes and a study plan.
  Quick tasks run on your device with Gemini Nano. Deep tasks use Gemini
  Flash in the cloud. One app, one Firebase AI Logic call."

## 0:20–0:55 — On-device flashcards (the hybrid core)
- Click **Load sample notes** (photosynthesis notes appear).
- Click **Flashcards**. Point at the badge: "on-device · Gemini Nano".
- "No network round-trip, no data leaves the device — and it works offline."
  (Optional: toggle wifi off in DevTools and regenerate to prove it.)
- Flip a card, mark one "Still learning".

## 0:55–1:30 — Quiz + cloud grading
- Click **Quiz**, answer 2 questions live (one right, one wrong — the
  explanation appears).
- In the free-text box, type a short answer to Q1, click **Grade my answer**.
  Point at the badge: "cloud · Gemini Flash — grading needs deeper
  reasoning, so this one goes to the cloud."

## 1:30–2:00 — Study plan + explain
- Click **7-day study plan** — scroll through the 7 days.
- Click **Explain a concept**, type "the Calvin cycle", show the answer.
- Open the **Review due** tab: the card marked "Still learning" is there
  on a spaced schedule.

## 2:00–2:30 — How it works (one screen, no slides)
- Show the route panel + the routing switch (Auto / On-device only /
  Cloud only). Flip it to "On-device only" and regenerate a deck.
- Close: "Firebase AI Logic hybrid inference: `PREFER_ON_DEVICE` for the
  quick tasks, `ONLY_IN_CLOUD` for the deep ones. Same code, every device.
  Try it — link in the description."

## Recording notes
- Enable the Nano flag first: `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` → Enabled, restart Chrome.
- If Nano has not downloaded yet, the first call may take a while — run one
  flashcard generation before recording, or record with the cloud fallback
  and note the route badge honestly.
- Captions: YouTube auto-captions + a manual pass (submission must be
  understandable in English).
- Export 1080p, upload to YouTube as Public (unlisted is not enough —
  Devpost needs a public link).
