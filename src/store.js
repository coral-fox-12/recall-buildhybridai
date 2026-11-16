// Local persistence for Recall.
//
// Decks, quiz results and the spaced-repetition review queue live in
// localStorage, so the app works fully offline. (When a Firebase project is
// wired up, Firestore sync can be layered on top of this same store — the
// shape is deliberately document-shaped: one doc per deck, one per review
// item.)

const KEY = "recall.v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export const store = {
  get state() {
    return load();
  },

  saveDeck(cards) {
    const s = load();
    s.deck = {
      cards: cards.map((c, i) => ({ id: `c${i}`, ...c, status: "new", ease: 2.5, interval: 0, due: Date.now() })),
      createdAt: Date.now(),
    };
    save(s);
    return s.deck;
  },

  getDeck() {
    return load().deck || null;
  },

  setCardStatus(id, status) {
    const s = load();
    if (!s.deck) return;
    const card = s.deck.cards.find((c) => c.id === id);
    if (!card) return;
    card.status = status;
    // SM-2-lite: "known" stretches the interval, "learning" resets it.
    if (status === "known") {
      card.interval = card.interval === 0 ? 1 : Math.round(card.interval * card.ease);
      card.ease = Math.min(2.8, card.ease + 0.1);
    } else {
      card.interval = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
    }
    card.due = Date.now() + card.interval * 24 * 60 * 60 * 1000;
    save(s);
  },

  dueCards() {
    const s = load();
    if (!s.deck) return [];
    const now = Date.now();
    return s.deck.cards.filter((c) => c.status === "learning" || (c.status === "known" && c.due <= now));
  },

  saveQuiz(questions, score) {
    const s = load();
    s.lastQuiz = { questions, score, at: Date.now() };
    save(s);
  },

  getLastQuiz() {
    return load().lastQuiz || null;
  },

  savePlan(text) {
    const s = load();
    s.plan = { text, at: Date.now() };
    save(s);
  },

  getPlan() {
    return load().plan || null;
  },

  saveNotes(notes) {
    const s = load();
    s.notes = notes;
    save(s);
  },

  getNotes() {
    return load().notes || "";
  },
};
