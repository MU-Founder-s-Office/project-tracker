// Auth UI: sign-in / sign-out + an editor-state pub/sub other modules can listen to.
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { auth, authReady, isEditor, ALLOWED_EMAIL_DOMAIN } from "./init.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });

// ONE combined provider for the extra Google scopes the app needs:
// Calendar (read + write, for sync + scheduling) AND Gmail compose (for the
// weekly report / email digests). Requesting this once grants BOTH, so the
// user authorises a single time instead of separately for calendar and email.
// No forced "prompt: consent" — once granted, Google returns the token without
// re-showing the consent screen.
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.addScope("https://www.googleapis.com/auth/gmail.compose");

const listeners = new Set();
let currentUser = null;
let googleAccessToken = null;
const TOKEN_KEY = "muGoogleToken";
const CONNECTED_KEY = "muGoogleConnected";

export function isGoogleConnected() {
  try { return localStorage.getItem(CONNECTED_KEY) === "1"; } catch { return false; }
}

// Reuse a still-valid token from this session so a returning user doesn't have
// to re-trigger the OAuth popup again and again within ~the token's lifetime.
function readCachedToken() {
  if (googleAccessToken) return googleAccessToken;
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw);
    if (token && exp && Date.now() < exp) {
      googleAccessToken = token;
      return token;
    }
  } catch { /* ignore */ }
  return null;
}

// Single popup that grants Calendar + Gmail and returns a short-lived token,
// cached in memory + sessionStorage. Both calendar-sync and gmail reuse it.
export async function requestGoogleAccessToken() {
  const cached = readCachedToken();
  if (cached) return cached;
  const result = await signInWithPopup(auth, googleProvider);
  if (!isEditor(result.user)) {
    await signOut(auth);
    throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can connect Google.`);
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) throw new Error("No Google access token returned from sign-in.");
  googleAccessToken = token;
  // Google access tokens last ~1h; cache for 55m within this browser session.
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, exp: Date.now() + 55 * 60 * 1000 }));
    localStorage.setItem(CONNECTED_KEY, "1");
  } catch { /* ignore */ }
  return token;
}

// Back-compat aliases: calendar-sync and weekly-report call these names, but
// they now resolve to the SAME combined token (one grant covers both).
export function getCalendarAccessToken() { return readCachedToken(); }
export function getGmailAccessToken() { return readCachedToken(); }
export const requestCalendarAccessToken = requestGoogleAccessToken;
export const requestGmailAccessToken = requestGoogleAccessToken;

export function onUserChange(fn) {
  listeners.add(fn);
  fn(currentUser);
  return () => listeners.delete(fn);
}

function emit(user) {
  currentUser = user;
  listeners.forEach((fn) => fn(user));
}

export function currentEditor() {
  return isEditor(currentUser) ? currentUser : null;
}

export function getCurrentUser() {
  return currentUser;
}

// Resolves once Firebase has restored (or confirmed the absence of) a session,
// so the splash can decide between "signed in → dashboard" and "show login".
let resolveAuthResolved;
export const authResolved = new Promise((res) => { resolveAuthResolved = res; });

// Public sign-in trigger (used by the splash login button and the auth chip).
export async function signIn() {
  return doSignIn();
}

async function doSignIn() {
  try {
    await authReady;
    const result = await signInWithPopup(auth, provider);
    if (!isEditor(result.user)) {
      await signOut(auth);
      alert(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in to edit.`);
    }
  } catch (err) {
    if (err?.code !== "auth/popup-closed-by-user") {
      console.error("[auth] sign-in failed", err);
      alert(`Sign-in failed: ${err?.message || err}`);
    }
  }
}

async function doSignOut() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("[auth] sign-out failed", err);
  }
}

export function mountAuthUI(container) {
  if (!container) return;

  const wrap = document.createElement("div");
  wrap.className = "auth-chip";
  container.appendChild(wrap);

  function render(user) {
    wrap.innerHTML = "";
    if (!user) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "auth-btn auth-signin";
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/>
          <path fill="currentColor" d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.7 19.7 8.1 22 12 22z"/>
          <path fill="currentColor" d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3.1C2.4 8.9 2 10.4 2 12s.4 3.1 1.1 4.5l3.3-2.6z"/>
          <path fill="currentColor" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/>
        </svg>
        Sign in
      `;
      btn.addEventListener("click", doSignIn);
      wrap.appendChild(btn);
      return;
    }

    const allowed = isEditor(user);
    const photo = user.photoURL
      ? `<img src="${user.photoURL}" alt="" class="auth-avatar" referrerpolicy="no-referrer" />`
      : `<span class="auth-avatar auth-avatar-fallback">${(user.email || "?").charAt(0).toUpperCase()}</span>`;

    const chip = document.createElement("div");
    chip.className = `auth-user ${allowed ? "is-editor" : "is-reader"}`;
    chip.innerHTML = `
      ${photo}
      <div class="auth-meta">
        <span class="auth-name">${escapeHTML(user.displayName || user.email)}</span>
        <span class="auth-role">${allowed ? "Editor" : "Read only"}</span>
      </div>
    `;
    chip.title = user.email || "";
    chip.addEventListener("click", () => {
      if (confirm(`Sign out ${user.email}?`)) doSignOut();
    });
    wrap.appendChild(chip);
  }

  onAuthStateChanged(auth, (user) => {
    emit(user);
    render(user);
    resolveAuthResolved?.(user); // first call = auth state known
  });
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
