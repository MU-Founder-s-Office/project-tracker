#!/usr/bin/env node
// Local CLI: pulls this week's data from Firestore, asks Claude to write the
// narrative, assembles a Masters'-Union-styled HTML report, opens it in the
// browser. Key stays on this machine (read from .env, gitignored).
//
// USAGE:
//   node --env-file=.env scripts/weekly-report.mjs
//
// REQUIRES in .env:
//   ANTHROPIC_API_KEY=sk-ant-...
//
// OPTIONAL in .env (defaults shown):
//   FIREBASE_PROJECT_ID=project-tracker-8ac65
//   CLAUDE_MODEL=claude-sonnet-4-6
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "project-tracker-8ac65";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("✗ ANTHROPIC_API_KEY not set. Create a .env file with:");
  console.error("    ANTHROPIC_API_KEY=sk-ant-...");
  console.error("  Then run: node --env-file=.env scripts/weekly-report.mjs");
  process.exit(1);
}

// ----- Firestore REST API ----------------------------------------------------
// Public-read collections only (matches the website's data path). No service
// account needed — falls under whatever read rules are already in place.

function unwrap(value) {
  if (value == null) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(unwrap);
  if ("mapValue" in value) return unwrapFields(value.mapValue.fields || {});
  return null;
}

function unwrapFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = unwrap(v);
  return out;
}

async function fetchCollection(name) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${name}?pageSize=300`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Firestore ${name} fetch failed: ${r.status} ${await r.text()}`);
  }
  const data = await r.json();
  return (data.documents || []).map((d) => unwrapFields(d.fields || {}));
}

// ----- Date helpers ----------------------------------------------------------

function mondayOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtRange(start, end) {
  const s = new Date(start + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = new Date(end + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ----- Claude API ------------------------------------------------------------

async function callClaude({ weekStart, weekEnd, projects, tasks, team, senderName }) {
  const teamById = Object.fromEntries(team.map((m) => [m.id, m]));
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  // Split tasks: calendar-sourced ones are meetings/syncs (Collaboration section),
  // everything else is heads-down work (Key Work section).
  const meetings = tasks.filter((t) => t.source === "calendar");
  const workTasks = tasks.filter((t) => t.source !== "calendar");

  const compact = (t) => ({
    title: t.title,
    project: projectById[t.projectId]?.project || null,
    workstream: projectById[t.projectId]?.workstream || null,
    owner: teamById[t.ownerId]?.name || null,
    status: t.status,
    due: t.dueDate || null,
    hours: t.hoursEstimate || null,
    notes: t.notes ? String(t.notes).slice(0, 300) : "",
  });

  const portfolioBrief = projects
    .filter((p) => !/completed|done/i.test(p.status || ""))
    .map((p) => ({
      id: p.id, name: p.project, workstream: p.workstream,
      status: p.status, progress: p.progress, end: p.endDate,
    }));

  const userPrompt = `You are drafting a polished weekly work summary email that ${senderName || "the sender"} will send to their manager at Masters' Union. Match the tone, structure, and depth of the reference example below.

REFERENCE EXAMPLE (style/format target — do NOT copy content):
"""
Hi [Manager],

Here's a summary of my work and progress for the week of May 3–9. It was a high-collaboration week with meaningful advances across AI Maturity, Transplacement, and cross-functional communication initiatives.

KEY WORK COMPLETED
• Designed and structured the AI Maturity Discussion Guides and Survey framework, covering assessment dimensions aligned to institutional priorities — driving toward a standardized scoring model for internal benchmarking.
• Led the AI Maturity Score definition exercise, collaborating with Priyansh to align on evaluation methodology, rubric design, and rollout approach for the survey across teams.

COLLABORATION & MEETINGS
• Priyansh / Aryan (Wed + Fri): Drove two structured syncs on the Project Tracker status and AI Maturity framework — resolved open design questions and aligned on next steps for the survey rollout.
• EDAF Meeting (Fri, 10am–1:30pm): Participated in the extended institutional review; contributed inputs relevant to the Founder's Office workstreams.

NEXT STEPS / UPCOMING FOCUS
• Finalize and distribute the AI Maturity Survey across target cohorts — tracking completion and preparing an initial data cut for leadership review.
"""

NOTE: The example uses full, prose-style bullets (2-3 sentences each, with context and outcomes), NOT terse one-liners. Match that depth.

THIS WEEK: ${fmtRange(weekStart, weekEnd)}

WORK TASKS (non-meeting items the sender shipped/progressed):
${JSON.stringify(workTasks.map(compact), null, 2)}

MEETINGS / SYNCS (from calendar):
${JSON.stringify(meetings.map(compact), null, 2)}

ACTIVE PROJECT PORTFOLIO (for context — informs Next Steps):
${JSON.stringify(portfolioBrief, null, 2)}

Return ONLY a JSON object with this exact shape, no preamble, no markdown fences:
{
  "intro": "1 sentence opener stating it's the weekly summary for <dates>, followed by 1 sentence characterizing the week's overall theme (e.g. 'high-collaboration week with meaningful advances across X, Y, and Z'). Reference real workstreams from the data.",
  "keyWork": [
    "Full prose bullet (2-3 sentences). Lead with action verb (Designed, Led, Coordinated, Reviewed, Shipped, Drove, etc.). Name the specific project/workstream. Explain what was done AND the outcome or downstream impact. ~30-45 words.",
    "Another full prose bullet in the same style.",
    "..."
  ],
  "collaboration": [
    "Full prose bullet for each meeting/sync. Format: 'Meeting title (day, optional time): What was discussed and what was decided/aligned. ~25-40 words.' Reference real attendees by name when present in the data.",
    "..."
  ],
  "nextSteps": [
    "Full prose bullet for each priority next week. Start with action verb (Finalize, Progress, Continue, Begin, etc.). Reference real upcoming work from the portfolio. ~20-30 words.",
    "..."
  ],
  "closing": "1 short sentence inviting feedback or further discussion. Match the example's tone ('Open to any feedback...' or similar). One line only."
}

CONTENT RULES:
- Use only facts from the provided data. Do not invent meetings, people, or projects.
- If a task has empty 'notes', infer reasonable context from project + workstream but stay factual.
- If meetings array is empty, return collaboration: [] (no fabrication).
- If next-week direction is unclear from data, pull from in-progress projects in the portfolio.
- Write in first person ("I", "we") — this is the sender writing to their manager.
- No emojis. No markdown formatting inside the strings. Plain prose only.`;

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: userPrompt }],
  };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Anthropic API ${r.status}: ${err.slice(0, 400)}`);
  }
  const data = await r.json();
  const text = data.content?.[0]?.text || "";
  // Try to extract JSON even if Claude wraps it in fences.
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude response did not contain JSON: " + text.slice(0, 400));
  return JSON.parse(jsonMatch[0]);
}

// ----- HTML assembly: clean email format -----------------------------------

function renderReport({ weekStart, weekEnd, narrative, senderName, managerName }) {
  const greeting = managerName ? `Hi ${managerName},` : `Hi [Manager/Team],`;
  const sender = senderName || "[Your Name]";
  const subject = `Weekly Work Summary | Founder's Office | ${fmtRange(weekStart, weekEnd)}`;

  const bullet = (text) =>
    `<li style="margin:0 0 12px 0; padding:0; line-height:1.65; color:#1f2328;">${esc(text)}</li>`;
  const keyWork = (narrative.keyWork || []).map(bullet).join("") || `<li style="color:#6b7280; line-height:1.6;">No standalone work items logged for this week.</li>`;
  const collaboration = (narrative.collaboration || []).map(bullet).join("") || `<li style="color:#6b7280; line-height:1.6;">No meetings on the calendar this week.</li>`;
  const nextSteps = (narrative.nextSteps || []).map(bullet).join("") || `<li style="color:#6b7280; line-height:1.6;">To be defined in the next planning session.</li>`;

  const divider = `<div style="font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace; color:#9ca3af; letter-spacing:-1px; margin:28px 0 6px;">────────────────────────────</div>`;
  const sectionHeader = (label) => `<div style="font-family:'Inter','Segoe UI',Arial,sans-serif; font-weight:700; font-size:13px; letter-spacing:0.14em; text-transform:uppercase; color:#0a0a0a; margin:0 0 6px;">${esc(label)}</div>${divider.replace("28px", "0")}`;

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(subject)}</title></head>
<body style="margin:0; background:#f3f4f6; font-family:'Inter','Segoe UI',Arial,sans-serif;">
<div style="position:sticky; top:0; z-index:5; background:#ffffff; border-bottom:1px solid #e5e7eb; padding:14px 20px; display:flex; gap:10px; align-items:center;">
  <div style="margin:0 auto 0 0;">
    <div style="font-size:12px; color:#6b7280; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;">Subject</div>
    <div style="font-size:14px; color:#0a0a0a; font-weight:600; margin-top:2px;">${esc(subject)}</div>
  </div>
  <button id="copySubject" style="font:inherit; font-weight:600; font-size:13px; padding:9px 14px; border-radius:8px; cursor:pointer; border:1px solid #d1d5db; background:#ffffff; color:#374151;">Copy subject</button>
  <button id="openGmail" style="font:inherit; font-weight:600; font-size:13px; padding:9px 14px; border-radius:8px; cursor:pointer; border:1px solid #f7d544; background:#ffffff; color:#7c5e00;">Open Gmail compose</button>
  <button id="copyBtn" style="font:inherit; font-weight:700; font-size:13px; padding:10px 18px; border-radius:8px; cursor:pointer; border:1px solid #f7d544; background:#f7d544; color:#0a0a0a;">Copy email body</button>
</div>

<div id="report" style="max-width:680px; margin:24px auto; background:#ffffff; padding:48px 56px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06); color:#1f2328; font-family:'Inter','Segoe UI',Arial,sans-serif; font-size:15px; line-height:1.65;">

  <p style="margin:0 0 18px 0;">${esc(greeting)}</p>

  <p style="margin:0 0 6px 0;">${esc(narrative.intro || "")}</p>

  ${divider}
  ${sectionHeader("Key Work Completed")}
  <ul style="margin:14px 0 6px 0; padding:0 0 0 22px;">${keyWork}</ul>

  ${divider}
  ${sectionHeader("Collaboration & Meetings")}
  <ul style="margin:14px 0 6px 0; padding:0 0 0 22px;">${collaboration}</ul>

  ${divider}
  ${sectionHeader("Next Steps / Upcoming Focus")}
  <ul style="margin:14px 0 6px 0; padding:0 0 0 22px;">${nextSteps}</ul>

  <p style="margin:32px 0 6px 0;">${esc(narrative.closing || "Open to any feedback or additional context needed. Happy to discuss any of the above in our next sync.")}</p>

  <p style="margin:24px 0 0 0;">Best,<br>${esc(sender)}</p>
</div>

<script>
  const SUBJECT = ${JSON.stringify(subject)};
  document.getElementById("copySubject").addEventListener("click", async () => {
    await navigator.clipboard.writeText(SUBJECT);
    const b = document.getElementById("copySubject"); const o = b.textContent;
    b.textContent = "Copied ✓"; setTimeout(() => { b.textContent = o; }, 1500);
  });
  document.getElementById("openGmail").addEventListener("click", () => {
    window.open("https://mail.google.com/mail/?view=cm&fs=1&su=" + encodeURIComponent(SUBJECT), "_blank");
  });
  document.getElementById("copyBtn").addEventListener("click", async () => {
    const r = document.getElementById("report");
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([r.innerHTML], { type: "text/html" }),
        "text/plain": new Blob([r.innerText], { type: "text/plain" })
      })]);
      const b = document.getElementById("copyBtn"); const o = b.textContent;
      b.textContent = "Copied ✓"; setTimeout(() => { b.textContent = o; }, 1500);
    } catch (e) {
      const range = document.createRange();
      range.selectNode(r);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      alert("Auto-copy blocked. Body selected — press Cmd/Ctrl+C to copy.");
    }
  });
</script>
</body></html>`;
}

// ----- Main ------------------------------------------------------------------

async function main() {
  const weekStart = mondayOf();
  const weekEnd = addDays(weekStart, 6);
  const senderName = process.env.SENDER_NAME || "";
  const managerName = process.env.MANAGER_NAME || "";
  console.log(`▶ Generating weekly report for ${fmtRange(weekStart, weekEnd)}`);

  console.log("  ↳ fetching Firestore data…");
  const [projects, tasksAll, team] = await Promise.all([
    fetchCollection("projects"),
    fetchCollection("plannerTasks"),
    fetchCollection("team"),
  ]);
  const tasks = tasksAll.filter((t) => t.weekStart === weekStart);
  console.log(`     projects: ${projects.length}, tasks this week: ${tasks.length}, team: ${team.length}`);

  console.log(`  ↳ calling Claude (${CLAUDE_MODEL})…`);
  const narrative = await callClaude({ weekStart, weekEnd, projects, tasks, team, senderName });

  console.log("  ↳ rendering HTML…");
  const html = renderReport({ weekStart, weekEnd, narrative, senderName, managerName });

  const outDir = path.join(ROOT, "out");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `weekly-report-${weekStart}.html`);
  await fs.writeFile(outFile, html, "utf8");
  console.log(`✓ Wrote ${path.relative(ROOT, outFile)}`);

  // Open in default browser (macOS).
  execFile("open", [outFile], (err) => {
    if (err) console.log(`  (couldn't auto-open; manually open: ${outFile})`);
  });
}

main().catch((err) => {
  console.error("✗", err.message);
  process.exit(1);
});
