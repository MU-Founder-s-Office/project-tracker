// Firebase initialization — loaded via CDN ESM (no build step needed).
// Web API keys are public by design; security is enforced by Firestore rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyAMCqMCJz5NqGWsXrJ9ac89_oidPuxFnbY",
  authDomain: "project-tracker-8ac65.firebaseapp.com",
  projectId: "project-tracker-8ac65",
  storageBucket: "project-tracker-8ac65.firebasestorage.app",
  messagingSenderId: "1084712397661",
  appId: "1:1084712397661:web:0c7ad001c4543bed9216b4",
};

// Restrict editing to this email domain (read is open).
export const ALLOWED_EMAIL_DOMAIN = "mastersunion.org";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Keep the user signed in across sessions/reloads so they only sign in once.
// Prefer IndexedDB (survives longer, resists storage eviction) and fall back
// to localStorage. Set before any sign-in call so the popup result persists.
export const authReady = setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch((err) => console.warn("[auth] could not set persistence", err));

let db;
try {
  // Offline persistence so the dashboard works on flaky connections.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (err) {
  // initializeFirestore throws if called twice; fall back to the singleton.
  db = getFirestore(app);
}
export { db };

export function isEditor(user) {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
