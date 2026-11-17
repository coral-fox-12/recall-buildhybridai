// Record the Recall demo video (silent screen capture with on-screen
// English captions, following DEMO_SCRIPT.md) in demo mode — no keys.
// Run: node record-demo.mjs   (from this folder)
// Output: demo-video.mp4 (1280x720, ~2:30, H.264)
import { createRequire } from "node:module";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const pw = require("/home/hatch/workspace/makefun/tools/shot/node_modules/playwright-core");
const execFileAsync = promisify(execFile);

const DIR = path.resolve(import.meta.dirname);
const PORT = 8155; // unique port: sibling re-record agents also use 8123/8124 —
// a stale sibling server on a shared port would silently serve the WRONG app.
const CHROME = "/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn("python3", ["-m", "http.server", String(PORT)], {
  cwd: DIR, stdio: "ignore",
});
const stopServer = () => { try { server.kill(); } catch {} };
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(1); });

// Wait for the static server to answer, and VERIFY it serves this app
// (not a stale sibling server on the same port).
for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
    if (res.ok) break;
  } catch {}
  await sleep(500);
}
{
  const html = await (await fetch(`http://127.0.0.1:${PORT}/index.html`)).text();
  if (!html.includes("notes in, knowledge out")) {
    stopServer();
    throw new Error(`WRONG SERVER on port ${PORT}: index.html is not the Recall app — aborting`);
  }
  console.log(`Serving verified: Recall app on port ${PORT}`);
}

const browser = await pw.chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  recordVideo: { dir: DIR, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// Captions are DISABLED for the re-record: narration is a separate audio
// track + an .srt sidecar, nothing is burned into the picture. caption()
// is now a no-op that only logs the beat time (ms since t0) for narration
// timing.
const T0 = Date.now();
async function caption(text) {
  const t = ((Date.now() - T0) / 1000).toFixed(2);
  console.log(`[BEAT ${t}s] ${text}`);
}

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__recallReady === true, null, { timeout: 15000 });
await sleep(1000);

// 0:00 — intro
await caption("Recall — offline-first AI study companion. Notes become flashcards, a quiz and a study plan.");
await sleep(10000);

// 0:20 — sample notes + flashcards
await page.click("#btnSample");
await sleep(2000);
await caption("Quick tasks run on-device with Gemini Nano. Deep tasks use Gemini Flash in the cloud — one Firebase AI Logic call.");
await sleep(3000);
await page.click("#btnCards");
await page.waitForSelector("#deck .card", { timeout: 10000 });
await sleep(3000);
await caption("Flashcards — generated on-device. Nothing leaves your device, and it works offline.");
await sleep(5000);
await page.click("#deck .card >> nth=0"); // flip first card
await sleep(5000);
await page.click("#deck .card >> nth=0 >> button.learning"); // mark Still learning
await sleep(3000);

// 0:55 — quiz + cloud grading
await page.click("#btnQuiz");
await page.waitForSelector(".quiz-q", { timeout: 10000 });
await sleep(2500);
await caption("Quiz — on-device too. Answer two questions live.");
await sleep(3000);
const quiz = await page.evaluate(() => JSON.parse(localStorage.getItem("recall.v1")).lastQuiz.questions);
const q0 = page.locator(".quiz-q").nth(0);
await q0.locator(".opt").nth(quiz[0].answerIndex).click(); // correct
await sleep(4000);
const q1 = page.locator(".quiz-q").nth(1);
const wrongIdx = quiz[1].answerIndex === 0 ? 1 : 0;
await q1.locator(".opt").nth(wrongIdx).click(); // wrong — explanation appears
await sleep(4000);
await page.evaluate(() => document.getElementById("gradeBox").scrollIntoView({ block: "center" }));
await page.fill("#freeA", "Photosynthesis is how green plants turn sunlight, water and carbon dioxide into glucose and oxygen, using chlorophyll in the chloroplasts.");
await sleep(2000);
await page.click("#btnGrade");
await page.waitForSelector("#gradeResult .score", { timeout: 10000 });
await sleep(2000);
await caption("Grading needs deeper reasoning — so this one goes to the cloud, Gemini Flash.");
await sleep(6000);

// 1:30 — study plan
await page.click("#btnPlan");
await page.waitForSelector("#planBox .day", { timeout: 10000 });
await sleep(2500);
await caption("A 7-day study plan, built from your notes and your quiz result.");
await sleep(3000);
for (let i = 0; i < 4; i++) {
  await page.mouse.wheel(0, 350);
  await sleep(2000);
}
await sleep(2000);

// 2:00 — explain
await page.click("#btnExplain");
await page.waitForSelector("#explainTopic", { timeout: 5000 });
await page.fill("#explainTopic", "the Calvin cycle");
await sleep(1500);
await page.click("#btnExplainGo");
await page.waitForSelector("#explainOut p", { timeout: 10000 });
await sleep(2500);
await caption("Ask anything — explained in the cloud.");
await sleep(6000);

// 2:15 — review due
await page.click('.tab[data-tab="review"]');
await page.waitForSelector("#reviewDeck .card", { timeout: 5000 });
await sleep(2500);
await caption("Cards marked “Still learning” come back here on a spaced schedule.");
await sleep(6000);

// 2:30 — routing switch + close
await page.evaluate(() => document.getElementById("routePanel").scrollIntoView({ block: "center" }));
await page.selectOption("#routeMode", "device");
await sleep(2000);
await page.click("#btnCards");
await page.waitForSelector("#deck .card", { timeout: 10000 });
await sleep(2500);
await page.evaluate(() => document.getElementById("deck").scrollIntoView({ block: "start" }));
await sleep(1500);
await caption("Force either path with the routing switch. Firebase AI Logic hybrid inference — same code, every device.");
await sleep(9000);

await caption("");
const engineKind = await page.evaluate(() => window.__recallEngine);
const video = page.video();
await context.close();
await browser.close();
stopServer();

const webmPath = await video.path();
const mp4Path = path.join(DIR, "demo-video-clean.mp4"); // silent intermediate; narration muxed into demo-video.mp4 afterwards
await execFileAsync("ffmpeg", ["-y", "-i", webmPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-an", mp4Path], { timeout: 120000 });
fs.unlinkSync(webmPath);
const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-show_entries", "stream=width,height,codec_name", "-of", "json", mp4Path]);
console.log("VIDEO:", mp4Path);
console.log(stdout);
console.log("PAGE ERRORS:", errors.length ? errors : "none");
console.log("ENGINE:", engineKind);
