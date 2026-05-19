// Auth UI: sign-in / sign-out + an editor-state pub/sub other modules can listen to.
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { auth, isEditor, ALLOWED_EMAIL_DOMAIN } from "./init.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });

const listeners = new Set();
let currentUser = null;

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
