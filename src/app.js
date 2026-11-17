// Recall — UI controller.
// Wires the hybrid engine (real Firebase AI Logic or demo stub) to the page.

import { createEngine } from "./ai/engine.js";
import { store } from "./store.js";
import { SAMPLE_NOTES } from "./demo-data.js";

const $ = (id) => document.getElementById(id);

window.__recallErrors = [];
window.addEventListener("error", (e) => window.__recallErrors.push(String(e.message || e.error)));
window.addEventListener("unhandledrejection", (e) => window.__recallErrors.push(String(e.reason)));

let engine = null;
let attachedImage = null; // { name, dataUrl, mimeType }
let currentQuiz = null;

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3500);
}

function routeBadge(route) {
  const cls = route === "on-device" ? "on" : route === "cloud" ? "cloud" : "demo";
  const label = route === "on-device" ? "on-device · Gemini Nano" : route === "cloud" ? "cloud · Gemini Flash" : "demo mode";
  return `<span class="route-tag ${cls}">${label}</span>`;
}

function setLastCall(action, res) {
  $("lastCall").textContent =
    `${action} · ${res.route === "demo" ? "demo stub" : res.route} · ${res.latencyMs} ms · ${res.model}`;
}

function setBusy(btn, busy, label) {
  btn.disabled = busy;
  if (label !== undefined) btn.textContent = label;
}

function notesText() {
  return $("notesInput").value.trim();
}

function requireNotes() {
  if (notesText().length < 40) {
    toast("Paste some notes first (or load the sample notes).");
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Engine status
// ---------------------------------------------------------------------------

function renderEngineStatus(info) {
  const el = $("engineStatus");
  const label = $("engineLabel");
  if (info.mode === "demo") {
    el.className = "engine-status demo";
    label.textContent = "Demo mode — no Firebase project yet (stub engine)";
  } else if (info.onDeviceAvailable) {
    el.className = "engine-status ready";
    label.textContent = "Live — Gemini Nano on-device ready · Flash fallback";
  } else {
    el.className = "engine-status ready";
    label.textContent = "Live — cloud Gemini Flash (Nano not available on this device)";
  }
}

function renderNet() {
  $("netStatus").textContent = navigator.onLine ? "● online" : "● offline — on-device still works";
}
window.addEventListener("online", renderNet);
window.addEventListener("offline", renderNet);

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

function renderDeck() {
  const deck = store.getDeck();
  const box = $("deck");
  box.innerHTML = "";
  $("emptyCards").style.display = deck && deck.cards.length ? "none" : "";
  $("countCards").textContent = deck ? `(${deck.cards.length})` : "";
  if (!deck) return;
  for (const card of deck.cards) {
    const div = document.createElement("div");
    div.className = "card";
    // Flashcards are keyboard-operable: focusable, Enter/Space flips.
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.setAttribute("aria-expanded", "false");
    div.setAttribute("aria-label", `Flashcard: ${card.front} Press Enter to flip.`);
    div.innerHTML = `
      <div class="front">${escapeHtml(card.front)}</div>
      <div class="back">${escapeHtml(card.back)}${card.hint ? `<br><i>Hint: ${escapeHtml(card.hint)}</i>` : ""}</div>
      <div class="meta">
        <span class="route-tag ${card.status === "known" ? "on" : card.status === "learning" ? "demo" : "new"}">${card.status === "new" ? "new" : card.status}</span>
        <span class="actions">
          <button class="btn small known" type="button">✓ I know this</button>
          <button class="btn small learning" type="button">↻ Still learning</button>
        </span>
      </div>`;
    const flip = () => {
      div.classList.toggle("flipped");
      div.setAttribute("aria-expanded", String(div.classList.contains("flipped")));
    };
    div.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      flip();
    });
    div.addEventListener("keydown", (e) => {
      // Ignore keys pressed on the inner action buttons.
      if (e.target !== div) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });
    div.querySelector(".known").addEventListener("click", () => {
      store.setCardStatus(card.id, "known");
      renderDeck();
      renderReview();
    });
    div.querySelector(".learning").addEventListener("click", () => {
      store.setCardStatus(card.id, "learning");
      renderDeck();
      renderReview();
    });
    box.appendChild(div);
  }
}

function renderReview() {
  const due = store.dueCards();
  $("countReview").textContent = due.length ? `(${due.length})` : "";
  $("emptyReview").style.display = due.length ? "none" : "";
  const box = $("reviewDeck");
  box.innerHTML = "";
  for (const card of due) {
    const div = document.createElement("div");
    div.className = "card";
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.setAttribute("aria-expanded", "false");
    div.setAttribute("aria-label", `Flashcard: ${card.front} Press Enter to flip.`);
    div.innerHTML = `<div class="front">${escapeHtml(card.front)}</div><div class="back">${escapeHtml(card.back)}</div>`;
    const flip = () => {
      div.classList.toggle("flipped");
      div.setAttribute("aria-expanded", String(div.classList.contains("flipped")));
    };
    div.addEventListener("click", flip);
    div.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });
    box.appendChild(div);
  }
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

function renderQuiz() {
  const last = store.getLastQuiz();
  const box = $("quizBox");
  box.innerHTML = "";
  $("emptyQuiz").style.display = last && last.questions.length ? "none" : "";
  $("gradeBox").hidden = !(last && last.questions.length);
  $("countQuiz").textContent = last ? `(${last.questions.length})` : "";
  if (!last) {
    currentQuiz = null;
    return;
  }
  currentQuiz = last;
  let correct = 0;
  const score = document.createElement("p");
  score.className = "quiz-score";
  box.appendChild(score);
  const updateScore = () => {
    score.textContent = `Score: ${correct}/${last.questions.length} correct`;
  };
  updateScore();

  const freeQ = $("freeQ");
  freeQ.innerHTML = "";
  last.questions.forEach((q, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Q${i + 1}: ${q.question.slice(0, 80)}…`;
    freeQ.appendChild(opt);

    const div = document.createElement("div");
    div.className = "quiz-q";
    div.innerHTML = `<h4>Q${i + 1}. ${escapeHtml(q.question)}</h4><div class="opts"></div><p class="why">${escapeHtml(q.explanation || "")}</p>`;
    const opts = div.querySelector(".opts");
    q.options.forEach((o, j) => {
      const b = document.createElement("button");
      b.className = "opt";
      b.type = "button";
      b.textContent = o;
      b.addEventListener("click", () => {
        if (div.classList.contains("answered")) return;
        div.classList.add("answered");
        const ok = j === q.answerIndex;
        if (ok) correct += 1;
        b.classList.add(ok ? "correct" : "wrong");
        opts.querySelectorAll(".opt").forEach((el, k) => {
          el.disabled = true;
          if (k === q.answerIndex) el.classList.add("correct");
        });
        updateScore();
        store.saveQuiz(last.questions, { correct, total: last.questions.length });
      });
      opts.appendChild(b);
    });
    box.appendChild(div);
  });
}

// ---------------------------------------------------------------------------
// Study plan
// ---------------------------------------------------------------------------

function renderPlan() {
  const plan = store.getPlan();
  $("emptyPlan").style.display = plan ? "none" : "";
  const box = $("planBox");
  box.innerHTML = "";
  if (!plan) return;
  const days = plan.text.split(/\n\s*\n/).filter(Boolean);
  for (const day of days) {
    const lines = day.split("\n").filter(Boolean);
    if (lines.length < 2 && !/^day \d/i.test(lines[0] || "")) {
      const p = document.createElement("p");
      p.textContent = day;
      p.style.cssText = "color:var(--muted);font-size:13.5px";
      box.appendChild(p);
      continue;
    }
    const div = document.createElement("div");
    div.className = "day";
    const title = lines[0] || "";
    const rest = lines.slice(1);
    div.innerHTML = `<h4>${escapeHtml(title)}</h4>` + rest.map((l) => `<p class="${/^goal/i.test(l) ? "goal" : ""}">${escapeHtml(l)}</p>`).join("");
    box.appendChild(div);
  }
}

// ---------------------------------------------------------------------------
// Explain
// ---------------------------------------------------------------------------

function showExplainPrompt() {
  const box = $("explainBox");
  box.hidden = false;
  $("explainTitle").textContent = "Explain a concept";
  $("explainBody").innerHTML = `
    <label for="explainTopic" style="font-size:13px;font-weight:600">Which concept?</label>
    <input id="explainTopic" type="text" placeholder="e.g. the Calvin cycle" style="width:100%;margin:6px 0 10px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;font:inherit">
    <button id="btnExplainGo" class="btn primary" type="button">Explain it <span class="route-tag cloud">cloud</span></button>
    <div id="explainOut" style="margin-top:12px" aria-live="polite"></div>`;
  const input = $("explainTopic");
  input.focus();
  $("btnExplainGo").addEventListener("click", async () => {
    const topic = input.value.trim();
    if (!topic) {
      toast("Type a concept first.");
      return;
    }
    const btn = $("btnExplainGo");
    setBusy(btn, true, "Explaining…");
    try {
      const res = await engine.explain(topic, notesText());
      setLastCall("Explain", res);
      $("explainOut").innerHTML =
        `<div class="badge-line">${routeBadge(res.route)} · ${res.latencyMs} ms · ${escapeHtml(res.model)}</div>` +
        res.text.split("\n").filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    } catch (e) {
      toast(`Explain failed: ${e.message}`);
    } finally {
      setBusy(btn, false);
      btn.innerHTML = 'Explain it <span class="route-tag cloud">cloud</span>';
    }
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function runCards() {
  if (!requireNotes()) return;
  const btn = $("btnCards");
  setBusy(btn, true, "Building flashcards…");
  try {
    const res = await engine.generateFlashcards(notesText(), attachedImage);
    store.saveDeck(res.cards);
    setLastCall("Flashcards", res);
    renderDeck();
    renderReview();
    switchTab("cards");
    toast(`Deck ready — ${res.cards.length} cards (${res.route === "demo" ? "demo stub" : res.route}, ${res.latencyMs} ms).`);
  } catch (e) {
    toast(`Flashcards failed: ${e.message}`);
  } finally {
    setBusy(btn, false);
    btn.innerHTML = '<span class="gen-no">01</span><span class="gen-label">Flashcards</span> <span class="route-tag on">on-device</span>';
  }
}

async function runQuiz() {
  if (!requireNotes()) return;
  const btn = $("btnQuiz");
  setBusy(btn, true, "Writing quiz…");
  try {
    const res = await engine.generateQuiz(notesText());
    store.saveQuiz(res.questions, null);
    setLastCall("Quiz", res);
    renderQuiz();
    switchTab("quiz");
    toast(`Quiz ready — 5 questions (${res.route === "demo" ? "demo stub" : res.route}, ${res.latencyMs} ms).`);
  } catch (e) {
    toast(`Quiz failed: ${e.message}`);
  } finally {
    setBusy(btn, false);
    btn.innerHTML = '<span class="gen-no">02</span><span class="gen-label">Quiz (5 questions)</span> <span class="route-tag on">on-device</span>';
  }
}

async function runPlan() {
  if (!requireNotes()) return;
  const btn = $("btnPlan");
  setBusy(btn, true, "Planning…");
  try {
    const last = store.getLastQuiz();
    const summary = last
      ? last.score
        ? `${last.score.correct}/${last.score.total} on the last quiz`
        : "quiz generated, not taken yet"
      : "no quiz taken yet";
    const res = await engine.studyPlan(notesText(), summary);
    store.savePlan(res.text);
    setLastCall("Study plan", res);
    renderPlan();
    switchTab("plan");
    toast(`Plan ready (${res.route === "demo" ? "demo stub" : res.route}, ${res.latencyMs} ms).`);
  } catch (e) {
    toast(`Study plan failed: ${e.message}`);
  } finally {
    setBusy(btn, false);
    btn.innerHTML = '<span class="gen-no">03</span><span class="gen-label">7-day study plan</span> <span class="route-tag cloud">cloud</span>';
  }
}

async function runGrade() {
  if (!currentQuiz) return;
  const q = currentQuiz.questions[Number($("freeQ").value)];
  const answer = $("freeA").value.trim();
  if (answer.length < 3) {
    toast("Write your answer first.");
    return;
  }
  const btn = $("btnGrade");
  setBusy(btn, true, "Grading…");
  try {
    const res = await engine.gradeAnswer(q.question, answer, notesText());
    setLastCall("Grading", res);
    $("gradeResult").innerHTML = `
      <div class="badge-line">${routeBadge(res.route)} · ${res.latencyMs} ms · ${escapeHtml(res.model)}</div>
      <p class="score">${res.score}/100</p>
      <p><b>Verdict:</b> ${escapeHtml(res.verdict)}</p>
      <p><b>Correct answer:</b> ${escapeHtml(res.correction)}</p>`;
  } catch (e) {
    toast(`Grading failed: ${e.message}`);
  } finally {
    setBusy(btn, false);
    btn.innerHTML = 'Grade my answer <span class="route-tag cloud">cloud</span>';
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function switchTab(name, { focus = false } = {}) {
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
    t.tabIndex = active ? 0 : -1;
    if (active && focus) t.focus();
  });
  document.querySelectorAll(".tab-page").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function boot() {
  // Restore saved state.
  const savedNotes = store.getNotes();
  if (savedNotes) $("notesInput").value = savedNotes;
  renderDeck();
  renderQuiz();
  renderPlan();
  renderReview();
  renderNet();

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => switchTab(t.dataset.tab)),
  );
  // Arrow-key tab navigation (WAI-ARIA tabs pattern): Left/Right move
  // between tabs, Home/End jump to the first/last tab.
  const tablist = document.querySelector(".tabs");
  tablist.addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll(".tab")];
    const i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    let next = null;
    if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
    else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      switchTab(next.dataset.tab, { focus: true });
    }
  });
  $("btnSample").addEventListener("click", () => {
    $("notesInput").value = SAMPLE_NOTES;
    store.saveNotes(SAMPLE_NOTES);
    toast("Sample notes loaded — try Flashcards.");
  });
  $("btnClear").addEventListener("click", () => {
    $("notesInput").value = "";
    attachedImage = null;
    $("imgNote").hidden = true;
    store.saveNotes("");
  });
  $("notesInput").addEventListener("input", (e) => store.saveNotes(e.target.value));
  $("notesImage").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      attachedImage = { name: file.name, dataUrl: reader.result, mimeType: file.type };
      $("imgName").textContent = file.name;
      $("imgNote").hidden = false;
      toast("Photo attached — the on-device model reads it with your notes.");
    };
    reader.readAsDataURL(file);
  });
  $("btnCards").addEventListener("click", runCards);
  $("btnQuiz").addEventListener("click", runQuiz);
  $("btnPlan").addEventListener("click", runPlan);
  $("btnExplain").addEventListener("click", () => {
    if (!requireNotes()) return;
    showExplainPrompt();
  });
  $("btnGrade").addEventListener("click", runGrade);
  $("routeMode").addEventListener("change", (e) => {
    if (engine) engine.routeMode = e.target.value;
    toast(`Routing: ${e.target.selectedOptions[0].textContent}`);
  });
  window.addEventListener("recall:device-model-progress", (e) => {
    $("lastCall").textContent = `Downloading on-device model… ${Math.round(e.detail * 100)}%`;
  });

  try {
    engine = await createEngine();
    renderEngineStatus({ mode: engine.kind, onDeviceAvailable: engine.onDeviceAvailable });
    window.__recallEngine = engine.kind;
  } catch (e) {
    window.__recallErrors.push(`engine init failed: ${e.message}`);
    const el = $("engineStatus");
    el.className = "engine-status error";
    $("engineLabel").textContent = "Engine failed to start — see console";
  }
  window.__recallReady = true;
}

boot();
