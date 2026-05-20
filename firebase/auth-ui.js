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

// Separate provider used when we need to additionally request Google Calendar
// read access (incremental authorization). Kept separate so the basic sign-in
// flow doesn't ask for the calendar scope until the user actually clicks
// "Sync calendar".
const calendarProvider = new GoogleAuthProvider();
calendarProvider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN, prompt: "consent" });
// calendar.events grants read + write so we can both pull events AND create
// new ones (scheduling tasks straight into Google Calendar from the platform).
calendarProvider.addScope("https://www.googleapis.com/auth/calendar.events");

const listeners = new Set();
let currentUser = null;
let calendarAccessToken = null;

export function getCalendarAccessToken() {
  return calendarAccessToken;
}

// Trigger a popup that asks for Google Calendar read access and returns a
// short-lived OAuth access token. Token is kept in memory only.
export async function requestCalendarAccessToken() {
  const result = await signInWithPopup(auth, calendarProvider);
  if (!isEditor(result.user)) {
    await signOut(auth);
    throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sync calendar.`);
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) throw new Error("No Google access token returned from sign-in.");
  calendarAccessToken = token;
  return token;
}

// Gmail compose (incremental authorization, separate from sign-in).
const gmailProvider = new GoogleAuthProvider();
gmailProvider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN, prompt: "consent" });
gmailProvider.addScope("https://www.googleapis.com/auth/gmail.compose");

let gmailAccessToken = null;

export function getGmailAccessToken() {
  return gmailAccessToken;
}

export async function requestGmailAccessToken() {
  const result = await signInWithPopup(auth, gmailProvider);
  if (!isEditor(result.user)) {
    await signOut(auth);
    throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can create Gmail drafts.`);
  }
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) throw new Error("No Gmail access token returned from sign-in.");
  gmailAccessToken = token;
  return token;
}

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
  });
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
