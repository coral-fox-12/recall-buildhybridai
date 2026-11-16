// Prompt builders and JSON schemas shared by the real hybrid engine and
// the demo stub engine, so both produce exactly the same output shape.

// Structured output schema for flashcards (supported on-device: JSON).
export const FLASHCARDS_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      description: "8-12 flashcards covering the most important facts in the notes.",
      items: {
        type: "object",
        properties: {
          front: { type: "string", description: "A short question or term." },
          back: { type: "string", description: "The answer or definition, 1-2 sentences." },
          hint: { type: "string", description: "A one-line memory hint (optional)." },
        },
        required: ["front", "back"],
      },
    },
  },
  required: ["cards"],
};

// Structured output schema for the quiz (supported on-device: JSON).
export const QUIZ_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "Exactly 5 multiple-choice questions.",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            description: "Exactly 4 options.",
            items: { type: "string" },
          },
          answerIndex: { type: "integer", description: "Index (0-3) of the correct option." },
          explanation: { type: "string", description: "One sentence explaining why the answer is correct." },
        },
        required: ["question", "options", "answerIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

// Structured output schema for cloud grading of a free-text answer.
export const GRADE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "0-100: how correct and complete the answer is." },
    verdict: { type: "string", description: "One line: what was right, what was missing." },
    correction: { type: "string", description: "The correct answer in 1-2 sentences." },
  },
  required: ["score", "verdict", "correction"],
};

export function flashcardsPrompt(notes) {
  return `You are a study assistant. From the notes below, create 8-12 flashcards as JSON matching the provided schema. Each card: front is a short question or key term, back is the answer or definition in 1-2 sentences. Cover the most important facts, not trivia. If the notes are short, make fewer cards but at least 4.\n\nNOTES:\n${notes}`;
}

export function quizPrompt(notes) {
  return `You are a study assistant. From the notes below, create exactly 5 multiple-choice quiz questions as JSON matching the provided schema. Each question has exactly 4 options and exactly one correct answer. Vary the difficulty: 2 easy, 2 medium, 1 hard. Write a one-sentence explanation for each answer.\n\nNOTES:\n${notes}`;
}

export function gradePrompt(question, answer, notes) {
  return `You are a strict but kind tutor. Grade the student's free-text answer to the question below, using the notes as the source of truth. Return JSON matching the provided schema: score 0-100, a one-line verdict, and the correct answer in 1-2 sentences.\n\nQUESTION: ${question}\nSTUDENT ANSWER: ${answer}\n\nNOTES:\n${notes}`;
}

export function explainPrompt(topic, notes) {
  return `Explain the concept "${topic}" to a student who is seeing it for the first time. Use only the notes below as source material; if the notes do not cover it, say so in one sentence and then give a general explanation. Keep it under 180 words, use a simple analogy, and end with one sentence the student can use to test themselves.\n\nNOTES:\n${notes}`;
}

export function planPrompt(notes, quizSummary) {
  return `You are a study coach. Build a 7-day study plan from the notes below. The student's recent quiz result: ${quizSummary}. Each day: a title, one concrete goal, and 2-3 specific tasks (max 30 minutes total per day). Day 7 is a full review + self-test. Return plain text with one section per day, formatted as "Day N — Title" followed by the goal and tasks.\n\nNOTES:\n${notes}`;
}
