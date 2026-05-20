// Builds the email-style weekly report (matches the CLI script's format) and
// creates it as a Gmail compose draft via the Gmail API. The draft opens in
// a new Gmail tab so the user can review and hit Send.
//
// Note: this is the *template-driven* version that runs in the browser. For a
// Claude-narrated version with richer prose, run the CLI:
//   node --env-file=.env scripts/weekly-report.mjs
import { loadPlanner, loadTeam } from "./data-layer.js";
import {
  currentEditor,
  getGmailAccessToken,
  requestGmailAccessToken,
} from "./auth-ui.js";

// ----- Date helpers ----------------------------------------------------------

function mondayOf(today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
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
function fmtRange(start, end) {
  const s = new Date(start + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const e = new Date(end + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${s} – ${e}`;
}
function fmtShort(iso) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ----- Template-driven sentence builders -------------------------------------

function buildIntro(weekTasks, projects) {
  if (!weekTasks.length) {
    return "Here's the weekly summary. Light week on logged activity — focus shifts to next week's milestones.";
  }
  const workstreams = [
    ...new Set(
      weekTasks
        .map((t) => projects.find((p) => p.id === t.projectId)?.workstream)
        .filter(Boolean),
    ),
  ];
  const wsClause = workstreams.length
    ? `with progress across ${workstreams.slice(0, 3).join(", ")}${workstreams.length > 3 ? ", and others" : ""}`
    : "covering a mix of project work and cross-functional syncs";
  return `Here's a summary of my work and progress for the week. It was an active week ${wsClause}.`;
}

function workBullet(task, projects) {
  const proj = projects.find((p) => p.id === task.projectId);
  const projName = proj?.project || (task.projectId ? task.projectId : "standalone initiative");
  const statusClause =
    /done|completed/i.test(task.status || "") ? "Completed and ready for review."
    : /in review/i.test(task.status || "") ? "In review; awaiting sign-off."
    : /in progress/i.test(task.status || "") ? "Currently in progress; continuing into next week."
    : /blocked/i.test(task.status || "") ? "Currently blocked — flagged for escalation."
    : "Logged this week with active follow-through planned.";
  const dueClause = task.dueDate ? ` Target close: ${fmtShort(task.dueDate)}.` : "";
  const notesClause = task.notes ? ` ${String(task.notes).split("\n")[0].slice(0, 200)}` : "";
  return `${task.title} (${projName}). ${statusClause}${dueClause}${notesClause}`;
}

function meetingBullet(task, projects) {
  const proj = projects.find((p) => p.id === task.projectId);
  const projHint = proj ? ` Tied to ${proj.project}.` : "";
  const when = task.dueDate ? ` (${fmtShort(task.dueDate)})` : "";
  const summary = task.notes ? ` ${String(task.notes).split("\n")[0].slice(0, 200)}` : "";
  return `${task.title}${when}: discussion and alignment session.${projHint}${summary}`;
}

function nextStepBullet(task, projects) {
  const proj = projects.find((p) => p.id === task.projectId);
  const projName = proj?.project || task.projectId || "ongoing work";
  const verb = /blocked/i.test(task.status || "") ? "Unblock and progress"
             : /in progress|in review/i.test(task.status || "") ? "Continue progressing"
             : "Pick up";
  const due = task.dueDate ? ` (target ${fmtShort(task.dueDate)})` : "";
  return `${verb} ${task.title} on ${projName}${due}.`;
}

// ----- Email HTML assembly ---------------------------------------------------

function buildEmailHtml({ weekStart, weekEnd, tasks, projects, senderName, managerName }) {
  const greeting = managerName ? `Hi ${managerName},` : "Hi [Manager/Team],";

  const meetings = tasks.filter((t) => t.source === "calendar");
  const workTasks = tasks.filter((t) => t.source !== "calendar");
  const intro = buildIntro(tasks, projects);

  const inFlight = workTasks
    .filter((t) => /in progress|in review|blocked|to do/i.test(t.status || "") || !t.status);
  const nextSources = inFlight.length ? inFlight : workTasks.slice(0, 3);

  const keyWork = workTasks.map((t) => workBullet(t, projects));
  const collaboration = meetings.map((t) => meetingBullet(t, projects));
  const nextSteps = nextSources.slice(0, 4).map((t) => nextStepBullet(t, projects));

  const bullet = (text) => `<li style="margin:0 0 12px 0; padding:0; line-height:1.65; color:#1f2328;">${esc(text)}</li>`;
  const keyWorkHtml = keyWork.map(bullet).join("") || `<li style="color:#6b7280; line-height:1.6;">No standalone work items logged for this week.</li>`;
  const collabHtml = collaboration.map(bullet).join("") || `<li style="color:#6b7280; line-height:1.6;">No meetings on the calendar this week.</li>`;
  const nextHtml = nextSteps.map(bullet).join("") || `<li style="color:#6b7280; line-height:1.6;">To be defined in the next planning session.</li>`;

  // Bold-minimal email styling (inline styles required for email clients).
  const divider = `<div style="height:1px; background:#e5e5e5; margin:28px 0;"></div>`;
  const header = (label) => `<div style="font-family:'DM Sans','Segoe UI',Arial,sans-serif; font-weight:700; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#090909; margin:0 0 14px; padding-bottom:8px; border-bottom:2px solid #E38330; display:inline-block;">${esc(label)}</div>`;

  const masthead = `<div style="border-left:4px solid #E38330; padding-left:16px; margin:0 0 30px;">
    <div style="font-family:'DM Sans','Segoe UI',Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:0.26em; text-transform:uppercase; color:#E38330; margin:0 0 4px;">Masters&rsquo; Union</div>
    <div style="font-family:'Fraunces',Georgia,serif; font-size:26px; font-weight:500; letter-spacing:-0.02em; color:#090909; line-height:1.05;">Weekly Work Summary</div>
    <div style="font-family:'Inter','Segoe UI',Arial,sans-serif; font-size:13px; font-weight:600; color:#71717a; margin-top:6px;">${esc(fmtRange(weekStart, weekEnd))}</div>
  </div>`;

  const html = `<div style="max-width:680px; margin:0 auto; background:#ffffff; padding:36px 40px; color:#1f2328; font-family:'Inter','Segoe UI',Arial,sans-serif; font-size:15px; line-height:1.65;">
  ${masthead}
  <p style="margin:0 0 18px 0;">${esc(greeting)}</p>
  <p style="margin:0 0 6px 0;">${esc(intro)}</p>
  ${divider}
  ${header("Key Work Completed")}
  <ul style="margin:0 0 6px 0; padding:0 0 0 22px;">${keyWorkHtml}</ul>
  ${divider}
  ${header("Collaboration & Meetings")}
  <ul style="margin:0 0 6px 0; padding:0 0 0 22px;">${collabHtml}</ul>
  ${divider}
  ${header("Next Steps / Upcoming Focus")}
  <ul style="margin:0 0 6px 0; padding:0 0 0 22px;">${nextHtml}</ul>
  <p style="margin:32px 0 6px 0;">Open to any feedback or additional context needed. Happy to discuss any of the above in our next sync.</p>
  <p style="margin:24px 0 0 0;">Best,<br>${esc(senderName || "")}</p>
</div>`;

  const subject = `Weekly Work Summary | Founder's Office | ${fmtRange(weekStart, weekEnd)}`;
  return { html, subject };
}

// ----- Gmail draft creation --------------------------------------------------

function utf8ToBase64Url(s) {
  // Encode as UTF-8 → base64 → URL-safe
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createGmailDraft({ subject, htmlBody, to = "", fromName = "" }) {
  let token = getGmailAccessToken();
  if (!token) token = await requestGmailAccessToken();

  const fromLine = fromName ? `From: ${fromName}\r\n` : "";
  const mime =
    fromLine +
    `To: ${to}\r\n` +
    `Subject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=utf-8\r\n` +
    `\r\n` +
    htmlBody;

  const raw = utf8ToBase64Url(mime);

  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    const err = new Error(`Gmail draft API ${r.status}: ${body.slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// ----- Entry point used by the dashboard button -----------------------------

export async function createWeeklyReportDraft({ projects = [], user = null } = {}) {
  const editor = user || currentEditor();
  const senderName = editor?.displayName || "";

  const weekStart = mondayOf();
  const weekEnd = addDays(weekStart, 6);
  const [{ tasks }] = await Promise.all([loadPlanner(), loadTeam()]);
  const weekTasks = (tasks || []).filter((t) => t.weekStart === weekStart);

  const { html, subject } = buildEmailHtml({
    weekStart,
    weekEnd,
    tasks: weekTasks,
    projects,
    senderName,
    managerName: "",
  });

  const draft = await createGmailDraft({ subject, htmlBody: html });

  // Open the draft directly in Gmail so the user can review/send.
  const draftId = draft?.id;
  const url = draftId
    ? `https://mail.google.com/mail/u/0/#drafts?compose=${encodeURIComponent(draft.message?.threadId || draftId)}`
    : "https://mail.google.com/mail/u/0/#drafts";
  window.open(url, "_blank", "noopener");

  return { draft, subject, weekStart, weekEnd, taskCount: weekTasks.length };
}
