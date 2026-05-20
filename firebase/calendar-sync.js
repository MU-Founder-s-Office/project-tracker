// Google Calendar → planner-task sync, cross-team aware.
//
// Task ID is derived from the meeting's iCalUID (shared across all attendees'
// calendars), not the per-calendar event ID. So when teammate A and teammate B
// both attend the same meeting, syncing both calendars yields ONE task with
// attendees: [A, B] — not two separate tasks.
//
// First sync per session is triggered automatically after login (see app.js).
// Re-runs are idempotent.
import { upsertCalendarTask, loadTeam } from "./data-layer.js";
import {
  currentEditor,
  getCalendarAccessToken,
  requestCalendarAccessToken,
} from "./auth-ui.js";

const DEFAULT_START_DATE = "2026-04-20"; // history window per product spec

const STOPWORDS = new Set([
  "the","and","for","with","from","this","that","your","our","my",
  "are","was","were","will","have","has","had","into","onto","over",
  "review","sync","meeting","call","standup","standups","weekly","daily","catch","catchup",
  "team","intro","kickoff","check","check-in","checkin",
]);

function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

export function matchEventToProject(event, projects) {
  const title = event.summary || "";
  const desc = event.description || "";
  const haystack = `${title} ${desc}`;

  for (const p of projects) {
    if (!p?.id) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRe(p.id)}([^a-z0-9]|$)`, "i");
    if (re.test(haystack)) return { project: p, score: 999, reason: "id" };
  }

  const eventTokens = new Set(tokenize(title));
  if (!eventTokens.size) return null;

  let best = null;
  for (const p of projects) {
    const projTokens = tokenize(p.project || "");
    if (!projTokens.length) continue;
    let score = 0;
    projTokens.forEach((t) => {
      if (eventTokens.has(t)) score++;
    });
    if (score > 0 && (!best || score > best.score)) {
      best = { project: p, score, reason: "keyword" };
    }
  }
  return best && best.score >= 1 ? best : null;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Work week starts on Sunday (Sunday–Friday, 6 days). Bucket each event under
// the most recent Sunday on or before its date.
function weekStartOf(yyyyMmDd) {
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // getUTCDay(): 0 = Sunday
  return d.toISOString().slice(0, 10);
}

function eventDateInfo(event) {
  const startRaw = event.start?.dateTime || event.start?.date;
  const endRaw = event.end?.dateTime || event.end?.date;
  if (!startRaw) return null;
  const startDate = startRaw.slice(0, 10);
  const endDate = (endRaw || startRaw).slice(0, 10);
  let hours = 0;
  if (event.start?.dateTime && event.end?.dateTime) {
    hours = Math.max(0, (new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 3600000);
  }
  return { startDate, endDate, hours: Math.round(hours * 10) / 10 };
}

function teamIdFromEmail(email, team) {
  if (!email) return null;
  const m = team.find((p) => (p.email || "").toLowerCase() === email.toLowerCase());
  return m?.id || null;
}

async function fetchEvents(token, timeMin, timeMax) {
  // Paginate in case the window contains > 250 events (e.g. multi-week history).
  let items = [];
  let pageToken = undefined;
  do {
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`Calendar API ${r.status}: ${body.slice(0, 300)}`);
    }
    const data = await r.json();
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

export async function syncCalendar({
  startDate = DEFAULT_START_DATE,
  daysForward = 7,
  projects = [],
  silent = false,
} = {}) {
  const user = currentEditor();
  if (!user) throw new Error("Sign in as an editor to sync calendar.");

  let token = getCalendarAccessToken();
  if (!token) token = await requestCalendarAccessToken();

  const now = new Date();
  const timeMin = new Date(startDate + "T00:00:00Z").toISOString();
  const timeMax = new Date(now.getTime() + daysForward * 86400000).toISOString();

  const [events, team] = await Promise.all([
    fetchEvents(token, timeMin, timeMax),
    loadTeam(),
  ]);

  const myTeamId = teamIdFromEmail(user.email, team);
  if (!silent && !myTeamId) {
    console.warn("[calendar-sync] your email isn't in the team — attendee tracking will list you as 'unassigned'.");
  }

  let created = 0;
  let merged = 0;
  let matchedToProject = 0;
  let skipped = 0;

  for (const ev of events) {
    if (!ev.iCalUID && !ev.id) continue;
    if (ev.status === "cancelled") continue;
    if (!ev.summary) { skipped++; continue; }
    const me = (ev.attendees || []).find((a) => a.self);
    if (me?.responseStatus === "declined") { skipped++; continue; }

    const info = eventDateInfo(ev);
    if (!info) { skipped++; continue; }

    // Match attendees to team members by email; always include current user.
    const eventAttendeeIds = (ev.attendees || [])
      .map((a) => teamIdFromEmail(a.email, team))
      .filter(Boolean);
    const attendees = [...new Set([
      ...(myTeamId ? [myTeamId] : []),
      ...eventAttendeeIds,
    ])];

    const match = matchEventToProject(ev, projects);
    // iCalUID is identical across attendees' calendars — perfect dedup key.
    const stableKey = ev.iCalUID || ev.id;
    const taskId = `cal-${stableKey.replace(/[^A-Za-z0-9_-]/g, "_")}`;

    // A meeting that has already ended counts as work done: log its duration as
    // actual hours and mark it Done. Future meetings stay planned ("To Do").
    const endMs = new Date(ev.end?.dateTime || ev.end?.date || info.endDate).getTime();
    const ended = Number.isFinite(endMs) && endMs < now.getTime();
    const plannedHours = info.hours || 1;

    const taskBase = {
      id: taskId,
      title: ev.summary,
      weekStart: weekStartOf(info.startDate),
      dueDate: info.endDate,
      projectId: match?.project?.id || null,
      attendees,
      ownerId: myTeamId || "unassigned",
      reviewerId: myTeamId || "unassigned",
      status: ended ? "Done" : "To Do",
      completedAt: ended ? info.endDate : null,
      priority: "P2",
      milestone: false,
      hoursEstimate: plannedHours,
      hoursActual: ended ? plannedHours : 0,
      notes: ev.description ? String(ev.description).slice(0, 600) : "",
      source: "calendar",
      calendarEventId: ev.id,
      iCalUID: ev.iCalUID || null,
      calendarHtmlLink: ev.htmlLink || null,
      matchReason: match?.reason || "unmatched",
    };

    try {
      const r = await upsertCalendarTask(taskBase, myTeamId);
      if (r.created) {
        created++;
        if (match) matchedToProject++;
      } else if (r.attendeeAdded) {
        merged++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn("[calendar-sync] failed for", ev.id, err);
    }
  }

  return { fetched: events.length, created, merged, matchedToProject, skipped, windowStart: startDate, windowEnd: timeMax.slice(0, 10) };
}

// Create an event directly in the signed-in user's Google Calendar. Attendees
// (teammate emails) are invited, so the same event shows up on their calendars
// and is cross-mapped into ONE shared task on the next sync (dedup by iCalUID).
export async function createCalendarEvent({
  summary,
  startISO,
  endISO,
  attendeeEmails = [],
  description = "",
} = {}) {
  const user = currentEditor();
  if (!user) throw new Error("Sign in as an editor to schedule tasks.");
  if (!summary || !startISO || !endISO) throw new Error("summary, startISO and endISO are required.");

  let token = getCalendarAccessToken();
  if (!token) token = await requestCalendarAccessToken();

  const body = {
    summary,
    description,
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    attendees: attendeeEmails.filter(Boolean).map((email) => ({ email })),
  };

  const r = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`Calendar create ${r.status}: ${detail.slice(0, 300)}`);
  }
  return r.json();
}
