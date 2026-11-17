// Headless test for Recall (live direct-Gemini mode — src/gemini-key.js
// must exist; the engine calls the real Gemini API, so Chromium needs
// internet: run with RECALL_PROXY=1 plus the local forward proxy on
// 127.0.0.1:18080, see below).
// Runs the full user flow in Chromium and fails on any console error,
// page error, or failed request. Also refreshes screenshots/*.png.
// Run: node test.mjs   (from this folder)
// Exit code 0 = all checks passed.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const pw = require("/home/hatch/workspace/makefun/tools/shot/node_modules/playwright-core");

const DIR = path.resolve(import.meta.dirname);
const PORT = 8124;
const CHROME = "/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

const server = spawn("python3", ["-m", "http.server", String(PORT)], {
  cwd: DIR, stdio: "ignore",
});
const stopServer = () => { try { server.kill(); } catch {} };
process.on("exit", stopServer);
process.on("SIGINT", () => { stopServer(); process.exit(1); });

for (let i = 0; i < 30; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
    if (res.ok) break;
  } catch {}
  await sleep(500);
}

const browser = await pw.chromium.launch({
  executablePath: CHROME,
  headless: true,
  // The VM egress proxy needs credentials Chromium mishandles; route it
  // through the unauthenticated local forward proxy (127.0.0.1:18080)
  // when RECALL_PROXY=1 so the live Gemini calls can reach the internet.
  // The forward proxy MITM-re-signs TLS with its own CA, which Chromium
  // rejects (ERR_CERT_AUTHORITY_INVALID) — ignore cert errors ONLY in
  // this proxied test run. Real browsers on the live site see Google's
  // valid certificate and do not need this.
  args: ["--no-sandbox", "--disable-dev-shm-usage",
    ...(process.env.RECALL_PROXY ? ["--proxy-server=http://127.0.0.1:18080", "--ignore-certificate-errors"] : [])],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e}`));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("requestfailed", (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) failedRequests.push(`${r.url()} :: HTTP ${r.status()}`); });

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__recallReady === true, null, { timeout: 15000 });
  check("page loads and app boots", true);
  check("engine is direct Gemini (live key, no Firebase project)", await page.evaluate(() => window.__recallEngine === "direct"));
  check("engine status labels live mode", (await page.textContent("#engineLabel")).includes("Live"));

  // --- Accessibility basics on load ---
  check("notes textarea has a label", await page.evaluate(() => {
    const el = document.getElementById("notesInput");
    return el.getAttribute("aria-label") === "Your study notes"
      || !!document.querySelector(`label[for="notesInput"]`);
  }));
  check("tabs carry aria-selected / aria-controls", await page.evaluate(() => {
    const tabs = [...document.querySelectorAll(".tab")];
    return tabs.every((t) => t.getAttribute("aria-selected") !== null && !!t.getAttribute("aria-controls"))
      && document.querySelectorAll('[role="tabpanel"]').length === 4;
  }));
  check("photo input is keyboard-focusable (not display:none)", await page.evaluate(async () => {
    const el = document.getElementById("notesImage");
    el.focus();
    return document.activeElement === el;
  }));

  // --- Flashcards ---
  await page.click("#btnSample");
  await page.click("#btnCards");
  await page.waitForSelector("#deck .card", { timeout: 60000 });
  const cardCount = await page.locator("#deck .card").count();
  check("flashcards generated (≥4)", cardCount >= 4, `${cardCount} cards`);
  await page.screenshot({ path: path.join(DIR, "screenshots/01-flashcards.png") });

  // Keyboard flip: focus first card, press Enter, it flips and reports it.
  await page.locator("#deck .card").nth(0).focus();
  await page.keyboard.press("Enter");
  check("card flips via keyboard (Enter)", await page.evaluate(() => {
    const c = document.querySelector("#deck .card");
    return c.classList.contains("flipped") && c.getAttribute("aria-expanded") === "true";
  }));
  check("card has button role + flip label", await page.evaluate(() => {
    const c = document.querySelector("#deck .card");
    return c.getAttribute("role") === "button" && (c.getAttribute("aria-label") || "").includes("Press Enter to flip");
  }));
  await page.locator("#deck .card").nth(0).locator("button.learning").click();
  check("mark 'Still learning' updates review count", (await page.textContent("#countReview")).includes("1"));

  // --- Quiz ---
  await page.click("#btnQuiz");
  await page.waitForSelector(".quiz-q", { timeout: 60000 });
  const quiz = await page.evaluate(() => JSON.parse(localStorage.getItem("recall.v1")).lastQuiz.questions);
  check("quiz has exactly 5 questions", quiz.length === 5);
  const q0 = page.locator(".quiz-q").nth(0);
  await q0.locator(".opt").nth(quiz[0].answerIndex).click();
  const q1 = page.locator(".quiz-q").nth(1);
  await q1.locator(".opt").nth(quiz[1].answerIndex === 0 ? 1 : 0).click();
  check("quiz score updates (1/5 after 1 right, 1 wrong)", (await page.textContent(".quiz-score")).includes("1/5"));
  check("explanation appears after answering", await page.evaluate(() => {
    const q = document.querySelectorAll(".quiz-q")[1];
    return q.classList.contains("answered") && getComputedStyle(q.querySelector(".why")).display !== "none";
  }));
  await page.screenshot({ path: path.join(DIR, "screenshots/02-quiz.png") });

  // --- Cloud grading (demo stub) ---
  await page.fill("#freeA", "Photosynthesis is how green plants turn sunlight, water and carbon dioxide into glucose and oxygen, using chlorophyll in the chloroplasts.");
  await page.click("#btnGrade");
  await page.waitForSelector("#gradeResult .score", { timeout: 60000 });
  const grade = Number((await page.textContent("#gradeResult .score")).replace("/100", ""));
  check("free-text grading returns a score", grade > 50, `score ${grade}/100`);

  // --- Study plan ---
  await page.click("#btnPlan");
  await page.waitForSelector("#planBox .day", { timeout: 60000 });
  const dayCount = await page.locator("#planBox .day").count();
  check("7-day plan rendered", dayCount === 7, `${dayCount} days`);
  await page.screenshot({ path: path.join(DIR, "screenshots/03-plan.png") });

  // --- Explain ---
  await page.click("#btnExplain");
  await page.waitForSelector("#explainTopic", { timeout: 5000 });
  await page.fill("#explainTopic", "the Calvin cycle");
  await page.click("#btnExplainGo");
  await page.waitForSelector("#explainOut p", { timeout: 60000 });
  check("explain returns text", (await page.textContent("#explainOut")).length > 100);
  await page.screenshot({ path: path.join(DIR, "screenshots/04-explain.png") });

  // --- Review tab + arrow-key tab navigation ---
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector("#reviewDeck .card", { timeout: 5000 });
  check("review tab shows the 'Still learning' card", (await page.locator("#reviewDeck .card").count()) === 1);
  await page.locator("#tabbtn-review").focus();
  await page.keyboard.press("ArrowRight"); // wraps to Flashcards tab
  check("ArrowRight moves focus to next tab (wraps)", await page.evaluate(() =>
    document.activeElement.id === "tabbtn-cards"
    && document.getElementById("tabbtn-cards").getAttribute("aria-selected") === "true"));

  // --- Routing switch: force on-device, regenerate (direct engine still answers via cloud) ---
  await page.selectOption("#routeMode", "device");
  const lastCallBefore = await page.textContent("#lastCall");
  await page.click("#btnCards");
  // The deck already has cards from the first generation, so waiting for
  // "#deck .card" would pass on the stale deck while the new call is
  // still in flight — and the reload below would abort it
  // (net::ERR_ABORTED). Wait for the call to actually finish by watching
  // #lastCall change.
  await page.waitForFunction((prev) => document.getElementById("lastCall").textContent !== prev, lastCallBefore, { timeout: 60000 });
  check("routing switch to on-device-only still generates", (await page.locator("#deck .card").count()) >= 4);

  // --- Persistence across reload ---
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__recallReady === true, null, { timeout: 15000 });
  check("deck + notes persist after reload (localStorage)", await page.evaluate(() =>
    document.querySelectorAll("#deck .card").length >= 4
    && document.getElementById("notesInput").value.length > 40));

  // --- Zero-error gate ---
  check("0 console errors / page errors", consoleErrors.length === 0, consoleErrors.join(" | ") || "none");
  check("0 failed requests (HTTP ≥400 or network failure)", failedRequests.length === 0, failedRequests.join(" | ") || "none");
  check("0 app-recorded JS errors (window.__recallErrors)", await page.evaluate(() => window.__recallErrors.length === 0));
} catch (e) {
  failures.push(`exception: ${e.message}`);
  console.log("EXCEPTION:", e);
} finally {
  await browser.close();
  stopServer();
}

console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED: ${failures.join("; ")}`);
process.exit(failures.length === 0 ? 0 : 1);
