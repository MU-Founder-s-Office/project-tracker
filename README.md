# MU Project Tracker

Live dashboard for the Masters' Union project portfolio. Three tabs:

- **Overview** — 29 projects grouped by workstream/phase, with inline edits (Phase 2+)
- **Timeline** — month-grid Gantt with Year / Quarter / Month zoom
- **Weekly Planner** — productivity scoreboard, quality scoreboard, milestones, reminders

Built as a static site (HTML / CSS / vanilla JS) backed by Firebase Firestore for live editing and Google Auth for editor access.

---

## Run locally

Using Node/npm:
```bash
npm install   # first run only — installs http-server
npm run dev
```

Or using Python:
```bash
python -m http.server 4178
```

Open `http://localhost:4178/` — use `localhost`, not `127.0.0.1`, or Google sign-in fails with `auth/unauthorized-domain`.

The dashboard tries Firestore first, then falls back to the JSON snapshots in `data/` if Firestore isn't reachable or hasn't been seeded yet. So it works without Firebase enabled — you just won't be able to edit.

---

## Layout

```
index.html              # shell + topbar (auth chip slot, theme, tabs)
app.js                  # state, render, theme + zoom + splash + planner
styles.css              # responsive design (mobile bottom-sheet at <=1024px)
data/projects.json      # snapshot of project data (also seeds Firestore)
data/weekly-tasks.json  # snapshot of planner data
firebase/init.js        # Firebase app + auth + db instances (config is public)
firebase/auth-ui.js     # Google sign-in chip in the topbar
firebase/data-layer.js  # Firestore reads/writes + JSON fallback + migration
assets/                 # PDFs + emailer HTML files linked from project rows
scripts/                # workbook importer + edit-pass scripts (dev-only)
.github/workflows/      # GitHub Pages auto-deploy
```

---

## Editing (Phase 2 onward)

1. Click **Sign in** in the top-right of the dashboard.
2. Use a Google account on the `@mastersunion.org` domain.
3. Once signed in, the chip shows your avatar and `EDITOR` role; inline edit controls appear on every editable field.

Read access is open to anyone with the URL. Writes require the email-domain check on the client + Firestore security rules on the server.

---

## Firebase setup (one-time, ~5 min)

The dashboard is already wired to Firebase project `project-tracker-8ac65`. You need to enable three things in the Firebase console before editing works:

1. **Firestore Database**
   - Console → Build → Firestore Database → Create database
   - Choose a location (e.g. `asia-south1` for Mumbai)
   - Start in production mode (we provide secure rules below)

2. **Authentication — Google sign-in**
   - Build → Authentication → Get started
   - Sign-in method → Google → Enable, set support email, Save
   - Settings → Authorized domains → add the production domain(s):
     `mu-founder-s-office.github.io`, your Netlify URL, `127.0.0.1`, `localhost`

3. **Firestore security rules** (paste into Rules tab):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isEditor() {
         return request.auth != null
             && request.auth.token.email is string
             && request.auth.token.email.matches('.*@mastersunion[.]org$');
       }
       match /{collection}/{doc} {
         allow read: if true;
         allow write: if isEditor();
       }
     }
   }
   ```

3a. **Storage setup** (needed for file uploads on project Links)
   - Build → Storage → Get started → default bucket
   - Rules tab, paste:

   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       function isEditor() {
         return request.auth != null
             && request.auth.token.email is string
             && request.auth.token.email.matches('.*@mastersunion[.]org$');
       }
       match /{allPaths=**} {
         allow read: if true;
         allow write: if isEditor();
       }
     }
   }
   ```

4. **Seed Firestore from the existing JSON** (one-time):
   - Open the dashboard, sign in as an editor
   - Open browser DevTools console
   - Run `await MU.migrate()`
   - Confirms `{ projects: 29, plannerTasks: N, teamMembers: N }`. From this point on, Firestore is the source of truth and the JSON snapshots become backups.

---

## Deploying

GitHub Actions auto-deploys to GitHub Pages on every push to `main`. The Netlify zip workflow still works too — `data/`, `assets/`, `firebase/`, and the three root files are the deployable set.

---

## Updating project data

- **Once Firestore is seeded:** edit inline through the dashboard (Phase 2+).
- **Before Firestore is seeded:** edit `data/projects.json` directly or run a script in `scripts/`. Bump the `?v=N` querystring on the `<link>` and `<script>` tags in `index.html` so browsers pick up new CSS/JS.
