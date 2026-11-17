// Firebase configuration for Recall.
//
// HOW TO WIRE UP (parent / deploy step, ~5 minutes):
//   1. Create a Firebase project at https://console.firebase.google.com
//   2. Console > AI Services > AI Logic > Get started. Choose the
//      "Gemini Developer API" provider (free tier, no billing).
//   3. Register this web app in the project and paste the config object
//      below (replace the YOUR_* placeholders).
//   4. App Check is enforced by the AI Logic setup. For local development,
//      set appCheckDebug: true — the app sets
//      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true and uses the reCAPTCHA v3
//      provider; copy the debug token printed in the browser console and
//      register it under Firebase console > App Check > Manage debug tokens.
//      (Debug tokens are accepted in #BuildHybridAI submissions.)
//   5. No production keys or secrets may be committed. Keep this file
//      with placeholders in the repo; inject real values at deploy time
//      (e.g. Firebase App Hosting environment config).
//
// DIRECT-KEY ALTERNATIVE (no Firebase project needed): if this file still
// holds placeholders but src/gemini-key.js exists (gitignored, injected at
// deploy time, exports geminiApiKey), the engine calls the Gemini Developer
// API directly with that key and the app runs live. That is how the
// deployed demo currently works — the agent Google account cannot finish
// creation (phone verification), so no Firebase project exists yet.
// NOTE: gemini-2.5-flash is retired for new API keys; the direct engine
// uses gemini-3.8-flash (see src/ai/engine.js).
//
// Until the config is filled in, the app runs in DEMO MODE: a local,
// deterministic stub engine implements the exact same interface as the
// real hybrid engine, so the whole flow (flashcards, quiz, grading, plan)
// is testable offline with zero keys.

export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID",
};

// reCAPTCHA v3 site key for App Check (from the Firebase console).
// Only used when appCheckDebug is true on localhost.
export const recaptchaSiteKey = "YOUR_RECAPTCHA_V3_SITE_KEY";

// Set true on localhost so App Check uses the debug provider.
export const appCheckDebug = true;

// Cloud model used when the on-device model is unavailable or when a
// task explicitly needs the cloud (grading, explanations, planning).
export const cloudModel = "gemini-2.5-flash";

export function isConfigured() {
  return Boolean(
    firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_"),
  );
}
