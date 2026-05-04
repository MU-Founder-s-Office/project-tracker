# MU Project Tracker

Static dashboard for the Masters' Union project tracker. Renders 29 active projects across NPS Program, Platforms, AI Initiatives, and Strategy workstreams, with an Overview list and a Gantt-style Timeline view.

## Run locally

From the project root:

```bash
python -m http.server 4178
```

Open `http://127.0.0.1:4178/`.

## Layout

```
index.html             # shell + topbar + tab switcher
app.js                 # state, render, theme + zoom toggles, splash
styles.css             # responsive design (mobile bottom-sheet at <=1024px)
data/projects.json     # the source of truth for all project rows
assets/                # PDFs + emailer HTML files linked from project rows
scripts/               # workbook importer + edit-pass scripts (dev-only)
```

## Updating project data

The dashboard reads `data/projects.json` at runtime. To change project fields, edit the JSON or run a script in `scripts/`. Bump the `?v=N` querystring on the `<link>` and `<script>` tags in `index.html` so browsers pick up new CSS/JS.

## Deploying to Netlify

Zip the contents of this folder (excluding `__pycache__` and `scripts/__pycache__`) and drop on `app.netlify.com/drop`, or drag onto the Deploys tab of the existing site to overwrite. All in-app links use relative paths so the same bundle works locally and in production.
