// Hybrid AI engine for Recall.
//
// One interface, two implementations:
//   - RealEngine: Firebase AI Logic (firebase/ai, SDK v12.5.0+) with hybrid
//     inference. Quick single-turn tasks use InferenceMode.PREFER_ON_DEVICE
//     (Gemini Nano in Chrome via the Prompt API, falling back to Gemini Flash
//     in the cloud); deep tasks use ONLY_IN_CLOUD (Gemini Flash).
//   - DemoEngine: deterministic local stub with the exact same interface,
//     used when no Firebase project is configured, so the whole app is
//     testable offline with zero keys. The UI always labels which engine
//     answered, so a demo answer is never mistaken for a real one.
//
// Route reporting: for the real engine the route is determined by checking
// Chrome's Prompt API availability (LanguageModel.availability()): when it
// reports "available", a PREFER_ON_DEVICE model runs on-device; otherwise
// the SDK falls back to the cloud model. Latency is measured per call.

import {
  firebaseConfig,
  recaptchaSiteKey,
  appCheckDebug,
  cloudModel,
  isConfigured,
} from "../config.js";
import {
  FLASHCARDS_SCHEMA,
  QUIZ_SCHEMA,
  GRADE_SCHEMA,
  flashcardsPrompt,
  quizPrompt,
  gradePrompt,
  explainPrompt,
  planPrompt,
} from "./prompts.js";

// ---------------------------------------------------------------------------
// Small deterministic helpers (shared by the demo engine)
// ---------------------------------------------------------------------------

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function contentWords(text) {
  const stop = new Set(
    "a an the is are was were be been being of to in on for with by and or as at from it its this that these those which who whom he she they we you i have has had do does did will would can could should may might not no if then than so such into over under after before between through during each other more most some any all both".split(" "),
  );
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.has(w));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripJsonFence(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

// ---------------------------------------------------------------------------
// Demo engine (no Firebase project needed)
// ---------------------------------------------------------------------------

class DemoEngine {
  constructor() {
    this.kind = "demo";
    this.onDeviceAvailable = false;
  }

  async init() {
    return { mode: "demo", onDeviceAvailable: false };
  }

  _definitionalCards(notes) {
    const sentences = splitSentences(notes);
    const cards = [];
    // Skip generic subjects ("The first stage…") — they make weak cards.
    const GENERIC = /^the (first|second|third|last|next|main|overall) (stage|step|part|phase)\b/i;
    for (const s of sentences) {
      const m = s.match(/^([A-Z][A-Za-z0-9'’\- ]{2,40}?)\s+(is|are|refers to|means)\b(.*)$/);
      if (m && !GENERIC.test(m[1].trim())) {
        const term = m[1].trim();
        cards.push({
          front: `What is ${term}?`,
          back: s,
          hint: `Think: ${term.toLowerCase()}`,
        });
      }
    }
    return { sentences, cards };
  }

  async generateFlashcards(notes, image) {
    const t0 = performance.now();
    const { sentences, cards } = this._definitionalCards(notes);
    const out = cards.slice(0, 10);
    if (out.length < 4) {
      for (const s of sentences) {
        if (out.length >= 8) break;
        const words = s.split(" ");
        const head = words.slice(0, 8).join(" ");
        if (!out.some((c) => c.back === s)) {
          out.push({ front: `Explain: ${head}…`, back: s, hint: "Say it in your own words." });
        }
      }
    }
    await sleep(380 + (hashStr(notes) % 320));
    return {
      cards: out.slice(0, 10),
      route: "demo",
      latencyMs: Math.round(performance.now() - t0),
      model: "demo-stub (no Firebase project configured)" + (image ? " — photo noted, text used" : ""),
    };
  }

  async generateQuiz(notes) {
    const t0 = performance.now();
    const { sentences } = this._definitionalCards(notes);
    const rng = mulberry32(hashStr(notes));
    const terms = [];
    const GENERIC = /^the (first|second|third|last|next|main|overall) (stage|step|part|phase)\b/i;
    for (const s of sentences) {
      const m = s.match(/^([A-Z][A-Za-z0-9'’\- ]{2,40}?)\s+(is|are|refers to|means)\b/);
      if (m && !GENERIC.test(m[1].trim())) terms.push(m[1].trim());
    }
    const pool = sentences.filter((s) => terms.some((t) => s.includes(t)));
    const picked = [...pool].sort(() => rng() - 0.5).slice(0, 5);
    const questions = picked.map((s) => {
      const term = terms.find((t) => s.includes(t));
      const blanked = s.replace(term, "_____");
      const distractors = terms.filter((t) => t !== term).sort(() => rng() - 0.5).slice(0, 3);
      const options = [...distractors, term].sort(() => rng() - 0.5);
      return {
        question: `Fill in the blank: ${blanked}`,
        options,
        answerIndex: options.indexOf(term),
        explanation: s,
      };
    });
    while (questions.length < 5 && sentences.length > 0) {
      const s = sentences[questions.length % sentences.length];
      questions.push({
        question: "Which statement is true according to your notes?",
        options: [s, "None of the above", "All of the above", "Not stated in the notes"],
        answerIndex: 0,
        explanation: s,
      });
    }
    await sleep(420 + (hashStr(notes) % 380));
    return {
      questions: questions.slice(0, 5),
      route: "demo",
      latencyMs: Math.round(performance.now() - t0),
      model: "demo-stub (no Firebase project configured)",
    };
  }

  async gradeAnswer(question, answer, notes) {
    const t0 = performance.now();
    const { sentences } = this._definitionalCards(notes);
    // Score by overlap with the best-matching reference sentence (the
    // correct answer), not with the question words.
    const answerWords = contentWords(answer);
    const ranked = sentences
      .map((s) => {
        const ref = contentWords(s);
        const hit = ref.filter((w) => answerWords.includes(w)).length;
        return { s, ref, hit, ratio: hit / Math.max(1, ref.length) };
      })
      .sort((a, b) => b.ratio - a.ratio);
    const best = ranked[0];
    const score = best
      ? Math.max(0, Math.min(100, Math.round(15 + 85 * best.ratio)))
      : 20;
    await sleep(300 + (hashStr(answer) % 300));
    return {
      score,
      verdict:
        score >= 80
          ? "Strong answer — you covered the key points."
          : score >= 50
            ? "Partly right — the core idea is there, but key details are missing."
            : "Not quite — compare your answer with the correction below.",
      correction: best ? best.s : "See your notes for the correct answer.",
      route: "demo",
      latencyMs: Math.round(performance.now() - t0),
      model: "demo-stub (no Firebase project configured)",
    };
  }

  async explain(topic, notes) {
    const t0 = performance.now();
    const sentences = splitSentences(notes);
    const hits = sentences.filter((s) => s.toLowerCase().includes(topic.toLowerCase()));
    const used = hits.length ? hits : sentences.slice(0, 3);
    const text =
      `Think of ${topic} like a kitchen: the notes describe the ingredients and the steps, and once you see the recipe the whole dish makes sense.\n\n` +
      used.slice(0, 3).join(" ") +
      `\n\nTest yourself: close your notes and explain ${topic} in one sentence, then check it against the text above.`;
    await sleep(350 + (hashStr(topic) % 300));
    return {
      text,
      route: "demo",
      latencyMs: Math.round(performance.now() - t0),
      model: "demo-stub (no Firebase project configured)",
    };
  }

  async studyPlan(notes, quizSummary) {
    const t0 = performance.now();
    const { cards } = this._definitionalCards(notes);
    const n = Math.max(4, cards.length);
    const days = [
      ["Read & map", `Read all ${n} key ideas and say each one aloud in your own words.`, "Make the flashcard deck; star the 3 hardest cards."],
      ["First quiz", "Take the 5-question quiz without looking at your notes.", "Write down every question you missed and why."],
      ["Attack the weak cards", "Drill only the cards you marked 'Still learning'.", "Rewrite each weak answer from memory, then check."],
      ["Explain it out loud", "Pick 3 concepts and explain each to an imaginary friend.", "Use the cloud Explainer for any concept that still feels fuzzy."],
      ["Mixed review", "Shuffle the deck and review all cards once.", "Retake the quiz; aim for 5/5."],
      ["Timed self-test", "Set a 10-minute timer and write everything you remember.", "Compare with your notes and patch the gaps."],
      ["Full review", "One final pass: flashcards, quiz, and the 3 hardest ideas.", "Rest — your brain consolidates while you sleep."],
    ];
    const text = days
      .map(([title, goal, task], i) => `Day ${i + 1} — ${title}\nGoal: ${goal}\nTasks: ${task} (≤ 30 min)`)
      .join("\n\n");
    await sleep(400 + (hashStr(notes) % 300));
    return {
      text: `Based on your notes (${n} key ideas) and your quiz result (${quizSummary}).\n\n${text}`,
      route: "demo",
      latencyMs: Math.round(performance.now() - t0),
      model: "demo-stub (no Firebase project configured)",
    };
  }
}

// ---------------------------------------------------------------------------
// Real engine: Firebase AI Logic, hybrid inference
// ---------------------------------------------------------------------------

class RealEngine {
  constructor() {
    this.kind = "real";
    this.onDeviceAvailable = null;
    this.routeMode = "auto";
    this._deviceModelReady = false;
    this._modelCache = new Map();
  }

  async init() {
    const { initializeApp } = await import("firebase/app");
    const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
    const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } =
      await import("firebase/ai");

    this._getGenerativeModel = getGenerativeModel;
    this._InferenceMode = InferenceMode;

    const app = initializeApp(firebaseConfig);

    // App Check is enforced by the AI Logic console setup. On localhost we
    // use the debug provider (the contest rules explicitly allow debug
    // tokens in submissions).
    if (appCheckDebug) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      if (recaptchaSiteKey && !recaptchaSiteKey.startsWith("YOUR_")) {
        initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey) });
      }
    }

    this._ai = getAI(app, { backend: new GoogleAIBackend() });

    // Probe on-device availability via the Chrome Prompt API.
    try {
      const availability = await window.LanguageModel?.availability?.();
      this.onDeviceAvailable = availability === "available";
    } catch {
      this.onDeviceAvailable = false;
    }
    return { mode: "real", onDeviceAvailable: this.onDeviceAvailable };
  }

  // getGenerativeModel accepts generationConfig (responseMimeType +
  // responseSchema) at creation time; one instance per (mode, schema).
  _model(mode, schema) {
    const key = `${mode}:${schema ? schema.required?.[0] ?? "json" : "text"}`;
    if (this._modelCache.has(key)) return this._modelCache.get(key);
    const opts = { model: cloudModel, mode: this._InferenceMode[mode] };
    if (schema) {
      opts.generationConfig = { responseMimeType: "application/json", responseSchema: schema };
    }
    const m = this._getGenerativeModel(this._ai, opts);
    this._modelCache.set(key, m);
    return m;
  }

  // initializeDeviceModel() must run on a user gesture, before the first
  // on-device call. Safe to call repeatedly; it no-ops after the first run.
  async _ensureDeviceModel() {
    if (this._deviceModelReady) return;
    try {
      const m = this._model("PREFER_ON_DEVICE", null);
      m.initializeDeviceModel((v) => {
        window.dispatchEvent(
          new CustomEvent("recall:device-model-progress", { detail: v }),
        );
      });
      this._deviceModelReady = true;
    } catch (e) {
      // Download is best-effort; PREFER_ON_DEVICE falls back to cloud.
      console.warn("[Recall] initializeDeviceModel failed, will fall back to cloud:", e);
    }
  }

  // Quick tasks: auto => PREFER_ON_DEVICE; device => ONLY_ON_DEVICE;
  // cloud => ONLY_IN_CLOUD. Deep tasks always use ONLY_IN_CLOUD.
  _modeFor(task) {
    if (task === "deep") return "ONLY_IN_CLOUD";
    if (this.routeMode === "cloud") return "ONLY_IN_CLOUD";
    if (this.routeMode === "device") return "ONLY_ON_DEVICE";
    return "PREFER_ON_DEVICE";
  }

  _routeFor(mode) {
    if (mode === "ONLY_IN_CLOUD") return "cloud";
    if (mode === "ONLY_ON_DEVICE") return "on-device";
    return this.onDeviceAvailable ? "on-device" : "cloud";
  }

  _modelName(mode) {
    if (mode === "ONLY_IN_CLOUD") return `${cloudModel} (cloud)`;
    if (mode === "ONLY_ON_DEVICE") return "Gemini Nano (on-device)";
    return this.onDeviceAvailable
      ? "Gemini Nano (on-device)"
      : `${cloudModel} (cloud fallback)`;
  }

  async _generate(model, prompt, image) {
    const t0 = performance.now();
    // Multimodal input: a photo of handwritten notes goes to the model as a
    // second part (JPEG/PNG — supported by on-device Nano too).
    const input = image
      ? [prompt, { inlineData: { mimeType: image.mimeType, data: image.dataUrl.split(",")[1] } }]
      : prompt;
    const result = await model.generateContent(input);
    return { text: stripJsonFence(result.response.text()), latencyMs: Math.round(performance.now() - t0) };
  }

  async generateFlashcards(notes, image) {
    await this._ensureDeviceModel();
    const mode = this._modeFor("quick");
    const model = this._model(mode, FLASHCARDS_SCHEMA);
    const prompt = flashcardsPrompt(notes) + (image ? "\nA photo of handwritten notes is attached — use it together with the text above." : "");
    const { text, latencyMs } = await this._generate(model, prompt, image);
    const data = JSON.parse(text);
    return { cards: data.cards ?? [], route: this._routeFor(mode), latencyMs, model: this._modelName(mode) };
  }

  async generateQuiz(notes) {
    await this._ensureDeviceModel();
    const mode = this._modeFor("quick");
    const model = this._model(mode, QUIZ_SCHEMA);
    const { text, latencyMs } = await this._generate(model, quizPrompt(notes));
    const data = JSON.parse(text);
    return { questions: data.questions ?? [], route: this._routeFor(mode), latencyMs, model: this._modelName(mode) };
  }

  async gradeAnswer(question, answer, notes) {
    const mode = "ONLY_IN_CLOUD";
    const model = this._model(mode, GRADE_SCHEMA);
    const { text, latencyMs } = await this._generate(model, gradePrompt(question, answer, notes));
    const data = JSON.parse(text);
    return { ...data, route: "cloud", latencyMs, model: `${cloudModel} (cloud)` };
  }

  async explain(topic, notes) {
    const mode = "ONLY_IN_CLOUD";
    const model = this._model(mode, null);
    const { text, latencyMs } = await this._generate(model, explainPrompt(topic, notes));
    return { text, route: "cloud", latencyMs, model: `${cloudModel} (cloud)` };
  }

  async studyPlan(notes, quizSummary) {
    const mode = "ONLY_IN_CLOUD";
    const model = this._model(mode, null);
    const { text, latencyMs } = await this._generate(model, planPrompt(notes, quizSummary));
    return { text, route: "cloud", latencyMs, model: `${cloudModel} (cloud)` };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createEngine() {
  if (!isConfigured()) {
    const demo = new DemoEngine();
    await demo.init();
    return demo;
  }
  const real = new RealEngine();
  await real.init();
  return real;
}
