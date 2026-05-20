const PHASE_MAP = {
  "P-01": "Phase 1 - Active Survey Execution",
  "P-02": "Phase 1 - Active Survey Execution",
  "P-03": "Phase 1 - Active Survey Execution",
  "P-08": "Phase 1 - Active Survey Execution",
  "P-09": "Phase 1 - Active Survey Execution",
  "P-10": "Phase 1 - Active Survey Execution",
  "P-07": "Phase 2 - Signal Quality & Tooling",
  "P-11": "Phase 2 - Signal Quality & Tooling",
  "P-04": "Phase 3 - Structural Redesign (Critical Path)",
  "P-05": "Phase 3 - Structural Redesign (Critical Path)",
  "P-06": "Phase 4 - Institutional Capability",

  "P-12": "Stream A - Concerns & Resolution",
  "P-13": "Stream A - Concerns & Resolution",
  "P-14": "Stream A - Concerns & Resolution",
  "P-15": "Stream A - Concerns & Resolution",
  "P-16": "Stream B - Finance & Legal",
  "P-17": "Stream C - New Digital Products",
  "P-18": "Stream D - External & Partner Platforms",
  "P-19": "Stream D - External & Partner Platforms",

  "P-22": "Foundation - Horizon Scan",
  "P-29": "Foundation - Horizon Scan",
  "P-20": "Academic & Dashboard",
  "P-24": "Academic & Dashboard",
  "P-21": "Ops AI - Marketing Automation",
  "P-27": "Admissions AI - Prospect Engagement",

  "P-25": "External Positioning",
  "P-26": "Internal Ops",
  "P-28": "Thought Leadership",
  "P-23": "AI Positioning",
};

const WORKSTREAM_ORDER = ["NPS Program", "Platforms", "AI Initiatives", "Strategy"];

const PHASE_ORDER = {
  "NPS Program": [
    "Phase 1 - Active Survey Execution",
    "Phase 2 - Signal Quality & Tooling",
    "Phase 3 - Structural Redesign (Critical Path)",
    "Phase 4 - Institutional Capability",
  ],
  "Platforms": [
    "Stream A - Concerns & Resolution",
    "Stream B - Finance & Legal",
    "Stream C - New Digital Products",
    "Stream D - External & Partner Platforms",
  ],
  "AI Initiatives": [
    "Foundation - Horizon Scan",
    "Academic & Dashboard",
    "Ops AI - Marketing Automation",
    "Admissions AI - Prospect Engagement",
  ],
  "Strategy": [
    "External Positioning",
    "Internal Ops",
    "Thought Leadership",
    "AI Positioning",
  ],
};

const GANTT_START = new Date("2025-12-01T00:00:00Z");
const GANTT_END = new Date("2027-03-31T00:00:00Z");
const GANTT_MONTHS = buildMonthLabels(GANTT_START, GANTT_END);

const PHASE_COLORS = {
  "Phase 1 - Active Survey Execution": "#f59e0b",
  "Phase 2 - Signal Quality & Tooling": "#fb923c",
  "Phase 3 - Structural Redesign (Critical Path)": "#ef4444",
  "Phase 4 - Institutional Capability": "#a78bfa",
  "Stream A - Concerns & Resolution": "#22d3ee",
  "Stream B - Finance & Legal": "#3b82f6",
  "Stream C - New Digital Products": "#818cf8",
  "Stream D - External & Partner Platforms": "#a855f7",
  "Foundation - Horizon Scan": "#facc15",
  "Academic & Dashboard": "#38bdf8",
  "Ops AI - Marketing Automation": "#f97316",
  "Admissions AI - Prospect Engagement": "#34d399",
  "External Positioning": "#f87171",
  "Internal Ops": "#14b8a6",
  "Thought Leadership": "#c084fc",
  "AI Positioning": "#d946ef",
  Unassigned: "#94a3b8",
};

// Gantt project bars are coloured by delivery status (strict Masters' Union
// brand palette: cyan / yellow / orange / grey, with completed in black/white).
const STATUS_COLORS = {
  "on-track": "#39b6d8", // cyan
  "at-risk": "#e38330", // orange
  paused: "#f7d344", // yellow
  "not-started": "#a3a3a3", // grey
};

function statusColor(status) {
  const key = statusClass(status);
  if (key === "completed") {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return dark ? "#ffffff" : "#090909";
  }
  return STATUS_COLORS[key] || "#a3a3a3";
}

const THEME_KEY = "mu-tracker-theme";
const ZOOM_KEY = "mu-tracker-zoom";
const ZOOM_LEVELS = ["year", "quarter", "month"];

const savedZoom = localStorage.getItem(ZOOM_KEY);
const state = {
  dataset: null,
  projects: [],
  selectedId: null,
  view: "overview",
  detailOpen: false,
  zoom: ZOOM_LEVELS.includes(savedZoom) ? savedZoom : "year",
  filters: {
    search: "",
    workstream: "All",
    status: "All",
    priority: "All",
    sort: "phase",
  },
};

const els = {
  searchInput: document.querySelector("#searchInput"),
  workstreamFilter: document.querySelector("#workstreamFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  priorityFilter: document.querySelector("#priorityFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  kpiGrid: document.querySelector("#kpiGrid"),
  resultCount: document.querySelector("#resultCount"),
  projectList: document.querySelector("#projectList"),
  timelineRange: document.querySelector("#timelineRange"),
  timeline: document.querySelector("#timeline"),
  detailPanel: document.querySelector("#detailPanel"),
  tabs: [...document.querySelectorAll(".tab-button")],
  panels: [...document.querySelectorAll(".view-panel")],
  // Planner
  weekLabel: document.querySelector("#weekLabel"),
  weekPrev: document.querySelector("#weekPrev"),
  weekNext: document.querySelector("#weekNext"),
  weekToday: document.querySelector("#weekToday"),
  plannerKpis: document.querySelector("#plannerKpis"),
  plannerBoard: document.querySelector("#plannerBoard"),
  plannerOwnerFilter: document.querySelector("#plannerOwnerFilter"),
  plannerProjectFilter: document.querySelector("#plannerProjectFilter"),
  peopleList: document.querySelector("#peopleList"),
  overdueList: document.querySelector("#overdueList"),
  milestoneList: document.querySelector("#milestoneList"),
  plannerAlertBanner: document.querySelector("#plannerAlertBanner"),
  emailAllOverdue: document.querySelector("#emailAllOverdue"),
  downloadAllICS: document.querySelector("#downloadAllICS"),
  plannerView: document.querySelector("#plannerView"),
  plannerGate: document.querySelector("#plannerGate"),
  plannerGateTitle: document.querySelector("#plannerGateTitle"),
  plannerGateMsg: document.querySelector("#plannerGateMsg"),
  plannerGateBtn: document.querySelector("#plannerGateBtn"),
  plannerSyncBtn: document.querySelector("#plannerSyncBtn"),
};

const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3, Done: 4, "": 5 };

initTheme();
initSplash();
applyZoom();
wireZoom();
wireScrim();
init();

function wireScrim() {
  document.querySelector("#detailScrim")?.addEventListener("click", () => {
    state.detailOpen = false;
    renderDetail();
  });
}

function initSplash() {
  if (sessionStorage.getItem("mu-tracker-splash") === "dismissed") {
    document.body.classList.add("splash-dismissed");
  }
  document.querySelector("#dismissSplash")?.addEventListener("click", () => {
    document.body.classList.add("splash-dismissed");
    sessionStorage.setItem("mu-tracker-splash", "dismissed");
  });
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.dataset.theme = saved;
  const toggle = document.querySelector("#themeToggle");
  toggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    // Gantt bar colours are computed inline at render time (e.g. completed =
    // black in light, white in dark), so re-render to keep them theme-correct.
    render();
  });
}

function applyZoom() {
  ZOOM_LEVELS.forEach((level) => document.body.classList.remove(`zoom-${level}`));
  document.body.classList.add(`zoom-${state.zoom}`);
  document.querySelectorAll(".zoom-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.zoom === state.zoom);
  });
}

function wireZoom() {
  document.querySelectorAll(".zoom-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!ZOOM_LEVELS.includes(btn.dataset.zoom)) return;
      state.zoom = btn.dataset.zoom;
      localStorage.setItem(ZOOM_KEY, state.zoom);
      applyZoom();
    });
  });
}

let EditUI = null;
let DataLayer = null;

// Auth gate: the dashboard is never shown without a signed-in user. The splash
// stays (showing the login) until sign-in, and returns if the user signs out.
function controlSplash(authUi) {
  const splash = document.getElementById("bootSplash");
  if (!splash) return;
  const actions = splash.querySelector(".boot-actions");
  const showLogin = () => { splash.classList.remove("is-hidden"); if (actions) actions.hidden = false; };
  const hide = () => { splash.classList.add("is-hidden"); };

  if (!authUi) { showLogin(); return; } // can't authenticate → stay on the gate

  splash.querySelector("#bootSignIn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try { await authUi.signIn?.(); } catch { /* handled in auth-ui */ }
    btn.disabled = false;
    // A successful sign-in fires onUserChange below, which hides the gate.
  });

  let resolved = false;
  authUi.onUserChange?.((user) => {
    if (user) hide();
    else if (resolved) showLogin(); // signed out (incl. after sign-out) → gate
  });

  // Keep the brand moment, then reveal the login once auth state is known.
  const minDelay = new Promise((r) => setTimeout(r, 1000));
  Promise.all([authUi.authResolved || Promise.resolve(null), minDelay]).then(() => {
    resolved = true;
    if (authUi.getCurrentUser?.()) hide();
    else showLogin();
  });
}

// Collapse the editor action buttons into one header dropdown (declutter).
function mountToolsMenu(authUi) {
  const mount = document.querySelector("#authMount");
  if (!mount || !EditUI) return;

  const wrap = document.createElement("div");
  wrap.className = "tools-menu";
  wrap.hidden = true;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tools-menu-btn";
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  btn.title = "Editor tools";
  btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`;

  const panel = document.createElement("div");
  panel.className = "tools-menu-panel";
  panel.hidden = true;

  wrap.append(btn, panel);
  mount.appendChild(wrap);

  // Mount the editor actions INTO the dropdown panel.
  EditUI.mountEditToggle?.(panel);
  EditUI.mountCalendarSyncButton?.(panel, () => state.projects);
  EditUI.mountScheduleTaskButton?.(panel, () => state.projects, () => Planner.dataset?.metadata?.team || []);
  EditUI.mountWeeklyReportButton?.(panel, () => state.projects);

  const close = () => { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); wrap.classList.remove("open"); };
  const open = () => { panel.hidden = false; btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open"); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); panel.hidden ? open() : close(); });
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Show the menu only when an editor is signed in.
  authUi?.onUserChange?.(() => {
    wrap.hidden = !authUi.currentEditor?.();
    if (wrap.hidden) close();
  });
}

async function init() {
  // Firestore is the only data source. Auth/edit UI mount before data load
  // so the user can sign in and seed an empty database via MU.migrate().
  DataLayer = await import("./firebase/data-layer.js");
  const authUi = await import("./firebase/auth-ui.js").catch(() => null);
  EditUI = await import("./firebase/edit-ui.js").catch(() => null);
  authUi?.mountAuthUI(document.querySelector("#authMount"));
  controlSplash(authUi);
  // Editor actions (Edit / Sync / Schedule / Weekly report) live in a single
  // dropdown to keep the header uncluttered.
  mountToolsMenu(authUi);
  EditUI?.mountAddProjectButton(document.querySelector("#addProjectMount"), () => state.projects);
  EditUI?.onEditModeChange(() => {
    render();
    Team.render();
  });

  try {
    const [dataset, planner] = await Promise.all([
      DataLayer.loadDataset(),
      DataLayer.loadPlanner(),
    ]);

    state.dataset = dataset;
    applyProjects(state.dataset.projects || []);

    // Always give Planner a normalized shape so .metadata.team is safe to read
    // before the team subscription delivers the real list.
    Planner.dataset = {
      tasks: planner?.tasks || [],
      metadata: { ...(planner?.metadata || {}), team: [] },
    };
    // Default to the start of this Sunday–Friday work week so this week's tasks
    // (and freshly-imported calendar events) are visible without navigation.
    Planner.activeWeekStart = sundayOfToday();

    populateFilters();
    wireEvents();
    Planner.init();
    Team.init();
    render();

    // Expose live refs for the console (debug + MU.seedThisWeek helpers).
    if (typeof window !== "undefined" && window.MU) {
      window.MU.Planner = Planner;
      window.MU.state = state;
    }

    let initialTeam = await DataLayer.loadTeam();
    Team.apply(initialTeam);

    // Auto-seed: if an editor is signed in and Firestore is missing the
    // planner/team data, push it from the bundled JSON. Avoids needing
    // a manual MU.migrate() in the console.
    const needsSeed = (!Planner.dataset?.tasks?.length) || (!initialTeam?.length);
    const editorReady = !!(await import("./firebase/auth-ui.js")).currentEditor?.();
    if (needsSeed && editorReady) {
      try {
        console.log("[init] empty planner/team detected — auto-seeding from JSON…");
        const r = await DataLayer.seedPlannerAndTeam();
        console.log("[init] auto-seed done:", r);
        const [reloadedPlanner, reloadedTeam] = await Promise.all([
          DataLayer.loadPlanner(),
          DataLayer.loadTeam(),
        ]);
        Planner.dataset = {
          tasks: reloadedPlanner?.tasks || [],
          metadata: { ...(reloadedPlanner?.metadata || {}), team: reloadedTeam || [] },
        };
        Planner.activeWeekStart = sundayOfToday();
        Planner.initialised = false;
        Planner.init();
        Team.apply(reloadedTeam);
        initialTeam = reloadedTeam;
      } catch (seedErr) {
        console.error("[init] auto-seed failed", seedErr?.code, seedErr?.message, seedErr);
      }
    }

    // Realtime: push Firestore updates straight into the UI
    DataLayer.subscribeProjects((projects) => {
      applyProjects(projects);
      populateFilters();
      render();
    });
    DataLayer.subscribeTeam((team) => {
      Team.apply(team);
    });
    DataLayer.subscribePlanner((tasks) => {
      if (!Planner.dataset) return;
      Planner.dataset.tasks = tasks || [];
      if (state.view === "planner") Planner.render();
    });

    // Keep the planner gate in sync with auth: sign in / out re-renders so the
    // "sign in & sync" prompt appears or clears. No auto-sync on load — the user
    // syncs once via the planner button; the data then persists in Firestore.
    const authMod = await import("./firebase/auth-ui.js");
    authMod.onUserChange((user) => {
      Planner.editor = authMod.currentEditor?.() || null;
      if (state.view === "planner") Planner.render();
    });

    // Calendar sync button asks the planner to refresh after import.
    window.addEventListener("mu:planner-refresh-requested", () => {
      if (state.view === "planner") Planner.render();
    });

    console.log("[init] data source: firestore");
  } catch (error) {
    console.error("[init] failed", error);
    els.projectList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    els.detailPanel.innerHTML = `<div class="detail-empty">Sign in and run <code>await MU.migrate()</code> in the console to seed Firestore.</div>`;
  }
}

// Work week runs Sunday → Friday (6 days). The canonical week key is the most
// recent Sunday on or before a given date. Accepts an ISO date string or Date.
// Existing task data is keyed by Monday; sundayOf() normalises it to the same
// Sunday anchor (Monday's preceding Sunday), so no data migration is needed.
function sundayOf(value) {
  if (!value) return value;
  const base = value instanceof Date ? value : new Date(value + "T00:00:00Z");
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // getUTCDay(): 0 = Sunday
  return d.toISOString().slice(0, 10);
}

function sundayOfToday() {
  return sundayOf(new Date());
}

function applyProjects(rows) {
  state.projects = rows.map((project) => ({
    ...project,
    // Prefer the phase stored on the project (user-set via edit UI),
    // fall back to the static PHASE_MAP, then "Unassigned".
    phase: project.phase || PHASE_MAP[project.id] || "Unassigned",
  }));
  if (!state.selectedId || !state.projects.some((p) => p.id === state.selectedId)) {
    state.selectedId = state.projects[0]?.id || null;
  }
  // Refresh filter dropdowns so new workstreams/phases become filterable
  if (state.dataset) {
    state.dataset.projects = state.projects;
    const meta = state.dataset.metadata || {};
    meta.workstreams = [...new Set(state.projects.map((p) => p.workstream).filter(Boolean))].sort();
    meta.statuses = [...new Set(state.projects.map((p) => p.status).filter(Boolean))].sort();
    meta.priorities = [...new Set(state.projects.map((p) => p.priority).filter(Boolean))].sort();
    state.dataset.metadata = meta;
  }
}

function clearFilters() {
  state.filters = { search: "", workstream: "All", status: "All", priority: "All", sort: "phase" };
  if (els.searchInput) els.searchInput.value = "";
  if (els.workstreamFilter) els.workstreamFilter.value = "All";
  if (els.statusFilter) els.statusFilter.value = "All";
  if (els.priorityFilter) els.priorityFilter.value = "All";
  if (els.sortFilter) els.sortFilter.value = "phase";
  populateFilters();
  render();
}

// Diagnostic helper, run `MU.diagnose()` from DevTools console
if (typeof window !== "undefined") {
  window.MU = Object.assign(window.MU || {}, {
    diagnose() {
      const ws = {};
      state.projects.forEach((p) => {
        ws[p.workstream || "(blank)"] = (ws[p.workstream || "(blank)"] || 0) + 1;
      });
      console.table({
        total: state.projects.length,
        selectedId: state.selectedId,
        view: state.view,
        filters: state.filters,
        editorEmail: window.MU?.dataMode ? "(see auth chip)" : "(unknown)",
      });
      console.log("Projects by workstream:", ws);
      console.log("All project IDs:", state.projects.map((p) => p.id).join(", "));
    },
    clearFilters,
    seedThisWeek,
  });
}

// Console helper: populate the CURRENT week with a realistic spread of tasks for
// every teammate — logged hours (work done), statuses across the whole board,
// and shared tasks (attendees) so the chart cross-maps across people. Run once
// signed in as an editor:  await MU.seedThisWeek()
async function seedThisWeek() {
  if (!DataLayer) return console.warn("[seed] data layer not ready");
  const team = Planner.dataset?.metadata?.team || [];
  if (!team.length) return console.warn("[seed] team not loaded yet");

  const ids = team.map((t) => t.id);
  const id = (i) => ids[i % ids.length];
  const weekStart = sundayOfToday(); // Sunday anchor (Sun–Fri work week)
  const day = (n) => {
    const d = new Date(weekStart + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const projIds = state.projects.map((p) => p.id);
  const proj = (i) => projIds[i % projIds.length] || null;

  // [title, ownerIdx, attendeeIdxs, status, dayOffset, estHours]
  const defs = [
    ["Weekly NPS programme sync", 0, [0, 1, 2, 3], "Done", 0, 1],
    ["T4 NPS survey window planning", 0, [0], "Done", 0, 4],
    ["Mid-term NPS analysis write-up", 2, [2], "Done", 1, 5],
    ["Founder's office stand-up", 1, [0, 1, 2, 3], "Done", 1, 0.5],
    ["Competitor radar refresh", 3, [3], "Done", 2, 4],
    ["Dashboard v3 — build progress", 2, [2, 0], "In Progress", 2, 6],
    ["Signal-quality outlier detector", 1, [1], "In Progress", 2, 5],
    ["Stream-B finance redesign brief", 0, [0, 3], "In Progress", 3, 4],
    ["Admissions AI eval harness", 3, [3, 1], "In Progress", 3, 5],
    ["NPS structure ideation review", 0, [0, 2], "In Review", 3, 2],
    ["Prospect engagement copy review", 3, [3], "In Review", 4, 2],
    ["UG NPS rollout prep", 2, [2], "To Do", 4, 4],
    ["Exec NPS scoping", 1, [1], "To Do", 4, 3],
    ["Thought-leadership draft", 0, [0], "To Do", 5, 3],
    ["Partner platform integration spec", 3, [3, 0], "Blocked", 5, 4],
  ];

  const tasks = defs.map((d, i) => {
    const [title, ownerIdx, attIdxs, status, dayOff, est] = d;
    const done = status === "Done";
    const partial = status === "In Progress" || status === "In Review";
    return {
      id: `seed-${weekStart}-${String(i + 1).padStart(2, "0")}`,
      title,
      weekStart,
      dueDate: day(dayOff),
      projectId: proj(i),
      ownerId: id(ownerIdx),
      reviewerId: id(ownerIdx + 1),
      attendees: [...new Set(attIdxs.map(id))],
      status,
      priority: ["P1", "P2", "P2", "P3"][i % 4],
      milestone: false,
      hoursEstimate: est,
      hoursActual: done ? est : partial ? Math.round(est * 0.6 * 10) / 10 : 0,
      completedAt: done ? day(dayOff) : null,
      qualityScore: done ? Math.round((3.6 + Math.random() * 1.3) * 10) / 10 : null,
      notes: "",
      source: "seed",
    };
  });

  console.log(`[seed] writing ${tasks.length} tasks for week ${weekStart}…`);
  for (const t of tasks) await DataLayer.savePlannerTask(t);
  window.dispatchEvent(new CustomEvent("mu:planner-refresh-requested"));
  console.log(`[seed] done — switch to the Weekly Planner tab.`);
  return { week: weekStart, count: tasks.length };
}

function populateFilters() {
  const workstreams = orderWorkstreams(state.dataset.metadata.workstreams);
  setOptions(els.workstreamFilter, ["All", ...workstreams]);
  setOptions(els.statusFilter, ["All", ...state.dataset.metadata.statuses]);
  setOptions(els.priorityFilter, ["All", ...state.dataset.metadata.priorities]);

  els.sortFilter.innerHTML = `
    <option value="phase">Workstream / Phase</option>
    <option value="priority">Priority first</option>
    <option value="progress">Most progress</option>
    <option value="endDate">End date</option>
    <option value="name">Project name</option>
  `;
}

function setOptions(select, options) {
  const previous = select.value;
  select.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    .join("");
  // Preserve the user's choice if still present, otherwise default to "All"
  if (options.includes(previous)) select.value = previous;
  else if (options.includes("All")) select.value = "All";
}

function wireEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });

  [
    [els.workstreamFilter, "workstream"],
    [els.statusFilter, "status"],
    [els.priorityFilter, "priority"],
    [els.sortFilter, "sort"],
  ].forEach(([element, key]) => {
    element.addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      render();
    });
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      if (state.view === "timeline") state.detailOpen = false;
      render();
    });
  });
}

function render() {
  const filtered = filteredProjects();
  if (!filtered.some((project) => project.id === state.selectedId)) {
    state.selectedId = filtered[0]?.id || state.projects[0]?.id || null;
  }

  renderKpis(filtered);
  renderProjectList(filtered);
  renderTimeline(filtered);
  renderDetail();
  renderView();
}

function renderKpis(projects) {
  const total = projects.length;
  const completed = countBy(projects, "status", "Completed");
  const onTrack = countBy(projects, "status", "On Track");
  const atRisk = countBy(projects, "status", "At Risk");
  const paused = countBy(projects, "status", "Paused");
  const notStarted = countBy(projects, "status", "Not Started");
  const average = total ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total) : 0;
  const linked = projects.filter((project) => project.links?.length).length;

  const kpis = [
    ["Total", total, "Filtered portfolio"],
    ["Completed", completed, `${percent(completed, total)} of view`],
    ["On Track", onTrack, `${percent(onTrack, total)} of view`],
    ["At Risk", atRisk, `${percent(atRisk, total)} of view`],
    ["Paused", paused, `${percent(paused, total)} of view`],
    ["Not Started", notStarted, `${percent(notStarted, total)} of view`],
    ["Avg Done", `${average}%`, `${linked} with links`],
  ];

  els.kpiGrid.innerHTML = kpis
    .map(
      ([label, value, helper]) => `
        <article class="kpi">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
          <small>${escapeHtml(helper)}</small>
        </article>
      `,
    )
    .join("");
}

function renderProjectList(projects) {
  const total = state.projects.length;
  const filtered = projects.length;
  const hidden = total - filtered;
  if (hidden > 0) {
    els.resultCount.innerHTML = `${filtered} of ${total} shown · <a href="#" id="clearFiltersLink" class="result-clear">clear filters</a>`;
    const link = els.resultCount.querySelector("#clearFiltersLink");
    link?.addEventListener("click", (e) => {
      e.preventDefault();
      clearFilters();
    });
  } else {
    els.resultCount.textContent = `${total} project${total === 1 ? "" : "s"}`;
  }

  if (!projects.length) {
    els.projectList.innerHTML = `<div class="empty-state">
      No projects match the current filters.<br>
      <a href="#" id="emptyClearFilters" class="result-clear">Clear filters</a> to see all ${total}.
    </div>`;
    els.projectList.querySelector("#emptyClearFilters")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearFilters();
    });
    return;
  }

  if (state.filters.sort === "phase") {
    els.projectList.innerHTML = renderGroupedProjects(projects);
  } else {
    els.projectList.innerHTML = `<div class="project-rows">${projects.map(projectCard).join("")}</div>`;
  }

  els.projectList.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      if (event.target.closest(".inline-edit-zone, .inline-edit-select, .inline-edit-number")) return;
      state.selectedId = card.dataset.id;
      state.detailOpen = true;
      render();
    });
    // Inline editors (only mounted when edit mode is on AND user is an editor)
    if (EditUI?.isEditModeOn()) {
      const project = state.projects.find((p) => p.id === card.dataset.id);
      if (project) EditUI.decorateProjectCard(card, project);
    }
  });
}

function renderGroupedProjects(projects) {
  const grouped = groupByWorkstreamPhase(projects);
  return grouped
    .map(
      (workstream) => `
        <section class="ws-block">
          <header class="ws-header">
            <h3>${escapeHtml(workstream.name)}</h3>
            <span>${workstream.count} projects</span>
          </header>
          ${workstream.phases
            .map(
              (phase) => `
                <div class="phase-block">
                  <header class="phase-header">
                    <span class="phase-name">${escapeHtml(phase.name)}</span>
                    <span class="phase-count">${phase.projects.length}</span>
                  </header>
                  <div class="project-rows">
                    ${phase.projects.map(projectCard).join("")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function projectCard(project) {
  const link = project.links?.[0];
  return `
    <button class="project-card ${project.id === state.selectedId ? "active" : ""}" type="button" data-id="${escapeHtml(project.id)}">
      <div class="project-title">
        <p class="meta-line">${escapeHtml(project.id)}</p>
        <h3>${escapeHtml(project.project)}</h3>
      </div>
      <div class="card-priority">${badge(project.priority, "priority")}</div>
      <div class="card-status">${badge(project.status)}</div>
      <div class="progress-wrap">
        <div class="progress-label"><span>Progress</span><span>${project.progress}%</span></div>
        <div class="progress-track"><div class="progress-fill ${statusClass(project.status)}" style="width:${clamp(project.progress, 0, 100)}%"></div></div>
        <p class="meta-line">${formatShortDate(project.startDate)} → ${formatShortDate(project.endDate)}</p>
      </div>
      <div class="card-link">
        ${link ? `<a class="open-pill" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Open ↗</a>` : `<span class="open-pill ghost">Details</span>`}
      </div>
    </button>
  `;
}

function renderTimeline(projects) {
  const dated = projects.filter((project) => project.startDate && project.endDate);
  if (!dated.length) {
    els.timeline.innerHTML = `<div class="empty-state">No dated projects in this view.</div>`;
    els.timelineRange.textContent = "";
    return;
  }

  els.timelineRange.textContent = `${formatMonthLabel(GANTT_START)} → ${formatMonthLabel(GANTT_END)}`;

  const grouped = groupByWorkstreamPhase(dated);
  const totalSpan = GANTT_END.getTime() - GANTT_START.getTime();

  // "Today" marker position (only drawn if within the chart window).
  const todayMs = Date.now();
  const todayFraction = (todayMs - GANTT_START.getTime()) / totalSpan;
  const showToday = todayFraction >= 0 && todayFraction <= 1;

  // Portfolio summary for the legend strip.
  const counts = dated.reduce((acc, p) => {
    acc[statusClass(p.status)] = (acc[statusClass(p.status)] || 0) + 1;
    return acc;
  }, {});
  const legendItem = (cls, label) =>
    `<span class="g-legend-item"><i class="g-status-dot ${cls}"></i>${label}<b>${counts[cls] || 0}</b></span>`;

  const monthHeader = GANTT_MONTHS.map(
    (month) => `
      <div class="g-month">
        <span class="g-month-name">${month.label}</span>
        <div class="g-weeks"><span>W1</span><span>W2</span><span>W3</span><span>W4</span></div>
      </div>
    `,
  ).join("");

  let lastWorkstream = null;
  const body = grouped
    .map((workstream) => {
      const phaseBlocks = workstream.phases
        .map((phase) => {
          const span = phaseSpan(phase.projects);
          if (!span) return "";
          const left = ((span.start - GANTT_START.getTime()) / totalSpan) * 100;
          const width = Math.max(((span.end - span.start) / totalSpan) * 100, 0.6);
          const phaseAvg = Math.round(
            phase.projects.reduce((s, p) => s + clamp(p.progress, 0, 100), 0) / phase.projects.length,
          );

          const projectBars = phase.projects
            .map((project) => {
              const start = new Date(project.startDate).getTime();
              const end = new Date(project.endDate).getTime();
              const pl = ((start - GANTT_START.getTime()) / totalSpan) * 100;
              const pw = Math.max(((end - start) / totalSpan) * 100, 0.6);
              const dim = project.status === "Not Started" ? "g-bar-dim" : "";
              const done = clamp(project.progress, 0, 100);
              const barColor = statusColor(project.status);
              const days = project.durationDays ? ` · ${project.durationDays}d` : "";
              const dateRange = `${formatShortDate(start)} → ${formatShortDate(end)}${days}`;
              return `
                <div class="g-row g-project ${project.id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(project.id)}">
                  <div class="g-label g-label-sub">
                    <span class="g-status-dot ${statusClass(project.status)}"></span>
                    <span class="g-sub-text">
                      <span class="g-name" title="${escapeAttribute(project.project)}">${escapeHtml(project.project)}</span>
                      <span class="g-dates">${escapeHtml(dateRange)}</span>
                    </span>
                    <span class="g-meta">${project.progress}%</span>
                  </div>
                  <div class="g-track">
                    ${monthGridLines()}
                    <div class="g-bar g-bar-child ${dim}" style="left:${pl}%;width:${pw}%;--bar-color:${barColor};background:${barColor}26;box-shadow:inset 0 0 0 1px ${barColor}40"
                      title="${escapeAttribute(`${project.id} · ${project.project} · ${project.status} · ${project.progress}% · ${dateRange}`)}">
                      <div class="g-bar-fill" style="width:${done}%"></div>
                    </div>
                  </div>
                </div>
              `;
            })
            .join("");

          const showWs = workstream.name !== lastWorkstream;
          lastWorkstream = workstream.name;

          return `
            <div class="g-row g-phase">
              <div class="g-label g-label-phase">
                ${showWs ? `<span class="g-ws-tag">${escapeHtml(workstream.name)}</span>` : ""}
                <strong>${escapeHtml(phase.name)}</strong>
                <span class="g-meta">${phase.projects.length} projects · ${formatShortDate(span.start)}–${formatShortDate(span.end)} · ${phaseAvg}% avg</span>
              </div>
              <div class="g-track">
                ${monthGridLines()}
                <div class="g-bar g-bar-parent" style="left:${left}%;width:${width}%" title="${escapeAttribute(`${phase.name} · ${phaseAvg}% complete`)}">
                  <div class="g-bar-parent-fill" style="width:${phaseAvg}%"></div>
                </div>
              </div>
            </div>
            ${projectBars}
            <div class="g-row g-spacer"></div>
          `;
        })
        .join("");

      return phaseBlocks;
    })
    .join("");

  els.timeline.innerHTML = `
    <div class="g-legend">
      <span class="g-legend-label">Status</span>
      ${legendItem("completed", "Completed")}
      ${legendItem("on-track", "On track")}
      ${legendItem("at-risk", "At risk")}
      ${legendItem("paused", "Paused")}
      ${legendItem("not-started", "Not started")}
      ${showToday ? `<span class="g-legend-item g-legend-today"><i></i>Today · ${formatShortDate(todayMs)}</span>` : ""}
    </div>
    <div class="g-grid">
      ${showToday ? `<div class="g-today" style="left:calc(280px + (100% - 280px) * ${todayFraction})"><span class="g-today-flag">Today</span></div>` : ""}
      <div class="g-head">
        <div class="g-head-label">Phase / Project</div>
        <div class="g-track">${monthHeader}</div>
      </div>
      <div class="g-body">${body}</div>
    </div>
  `;

  els.timeline.querySelectorAll(".g-project").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedId = row.dataset.id;
      state.detailOpen = true;
      render();
    });
  });
}

function phaseSpan(projects) {
  const starts = projects.filter((p) => p.startDate).map((p) => new Date(p.startDate).getTime());
  const ends = projects.filter((p) => p.endDate).map((p) => new Date(p.endDate).getTime());
  if (!starts.length || !ends.length) return null;
  return { start: Math.min(...starts), end: Math.max(...ends) };
}

function monthGridLines() {
  const cell = `<div class="g-grid-cell"><div class="g-week-cell"></div><div class="g-week-cell"></div><div class="g-week-cell"></div><div class="g-week-cell"></div></div>`;
  return cell.repeat(GANTT_MONTHS.length);
}

function renderDetail() {
  const layout = document.querySelector(".dashboard-layout");
  layout?.classList.toggle("detail-collapsed", !state.detailOpen);
  document.body.classList.toggle("sheet-open", state.detailOpen);

  if (!state.detailOpen) {
    els.detailPanel.innerHTML = "";
    return;
  }

  const project = state.projects.find((item) => item.id === state.selectedId);
  if (!project) {
    els.detailPanel.innerHTML = `
      <button class="detail-close" type="button" aria-label="Close detail panel" data-action="close-detail">×</button>
      <div class="detail-empty">Select a project to expand its details.</div>
    `;
    wireDetailControls();
    return;
  }

  els.detailPanel.innerHTML = `
    <div class="detail-hero">
      <button class="detail-close" type="button" aria-label="Close detail panel" data-action="close-detail">×</button>
      <p class="eyebrow detail-eyebrow">${escapeHtml(project.workstream)} · ${escapeHtml(project.phase)}</p>
      <h2>${escapeHtml(project.project)}</h2>
      <p class="meta-line">${escapeHtml(project.id)}</p>
      <div class="badge-row">
        ${badge(project.status)}
        ${badge(project.priority, "priority")}
      </div>
    </div>

    <div class="detail-section">
      <h3>Delivery</h3>
      <div class="detail-grid">
        ${detailStat("Start", formatShortDate(project.startDate))}
        ${detailStat("End", formatShortDate(project.endDate))}
        ${detailStat("Duration", project.durationDays ? `${project.durationDays} days` : "Not set")}
        ${detailStat("Progress", `${project.progress}%`)}
      </div>
    </div>

    <div class="detail-section">
      <h3>Notes</h3>
      <p class="detail-muted notes-body">${escapeHtml(project.notes || "No notes recorded")}</p>
      ${project.references?.length ? `<div>${project.references.map((ref) => `<span class="reference-chip">${escapeHtml(ref)}</span>`).join("")}</div>` : ""}
    </div>

    <div class="detail-section">
      <h3>Links</h3>
      ${
        project.links?.length
          ? `<div class="link-list">${project.links.map((link) => linkButton(link)).join("")}</div>`
          : `<p class="detail-muted">No external project link is present in the tracker row.</p>`
      }
    </div>
  `;
  wireDetailControls();
  if (EditUI?.isEditModeOn()) {
    EditUI.decorateDetailPanel(els.detailPanel, project);
  }
}

function wireDetailControls() {
  els.detailPanel.querySelectorAll('[data-action="close-detail"]').forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      state.detailOpen = false;
      renderDetail();
    });
  });
}

function renderView() {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === state.view));
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.id === `${state.view}View`));
  document.body.classList.toggle("view-timeline", state.view === "timeline");
  document.body.classList.toggle("view-planner", state.view === "planner");
  if (state.view === "planner") Planner.render();
}

const VALID_VIEWS = ["overview", "timeline", "planner"];
function hashView() {
  const v = (window.location.hash || "").replace("#", "");
  return VALID_VIEWS.includes(v) ? v : null;
}
const startView = hashView();
if (startView) state.view = startView;
window.addEventListener("hashchange", () => {
  const v = hashView();
  if (v && v !== state.view) {
    state.view = v;
    if (v === "timeline") state.detailOpen = false;
    render();
  }
});

function filteredProjects() {
  const { search, workstream, status, priority, sort } = state.filters;
  const items = state.projects.filter((project) => {
    const haystack = [
      project.id,
      project.project,
      project.workstream,
      project.phase,
      project.status,
      project.priority,
      project.notes,
      ...(project.references || []),
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!search || haystack.includes(search)) &&
      (workstream === "All" || project.workstream === workstream) &&
      (status === "All" || project.status === status) &&
      (priority === "All" || project.priority === priority)
    );
  });

  if (sort === "phase") return items;
  return items.sort((a, b) => {
    if (sort === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) || a.project.localeCompare(b.project);
    if (sort === "progress") return b.progress - a.progress || a.project.localeCompare(b.project);
    if (sort === "endDate") return new Date(a.endDate || "2999-01-01") - new Date(b.endDate || "2999-01-01");
    return a.project.localeCompare(b.project);
  });
}

function groupByWorkstreamPhase(projects) {
  const wsBuckets = new Map();
  for (const project of projects) {
    if (!wsBuckets.has(project.workstream)) wsBuckets.set(project.workstream, new Map());
    const phaseBuckets = wsBuckets.get(project.workstream);
    if (!phaseBuckets.has(project.phase)) phaseBuckets.set(project.phase, []);
    phaseBuckets.get(project.phase).push(project);
  }

  return orderWorkstreams([...wsBuckets.keys()]).map((wsName) => {
    const phaseBuckets = wsBuckets.get(wsName);
    const phaseOrder = PHASE_ORDER[wsName] || [];
    const orderedPhases = [
      ...phaseOrder.filter((name) => phaseBuckets.has(name)),
      ...[...phaseBuckets.keys()].filter((name) => !phaseOrder.includes(name)),
    ];
    const phases = orderedPhases.map((name) => ({
      name,
      projects: phaseBuckets.get(name).slice().sort((a, b) => a.id.localeCompare(b.id)),
    }));
    return {
      name: wsName,
      count: phases.reduce((sum, phase) => sum + phase.projects.length, 0),
      phases,
    };
  });
}

function orderWorkstreams(names) {
  const known = WORKSTREAM_ORDER.filter((name) => names.includes(name));
  const extras = names.filter((name) => !WORKSTREAM_ORDER.includes(name));
  return [...known, ...extras];
}

function buildMonthLabels(start, end) {
  const labels = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  while (cursor <= stop) {
    labels.push({
      label: `${cursor.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} '${String(cursor.getUTCFullYear()).slice(2)}`,
      time: cursor.getTime(),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return labels;
}

function detailStat(label, value) {
  return `
    <div class="detail-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not set")}</strong>
    </div>
  `;
}

function linkButton(link) {
  return `
    <a class="link-button" href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">
      <span>${escapeHtml(link.label || "Project Link")}</span>
      <span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
    </a>
  `;
}

function badge(value, extra = "") {
  return `<span class="badge ${statusClass(value)} ${extra}">${escapeHtml(value || "Unspecified")}</span>`;
}

function countBy(projects, key, value) {
  return projects.filter((project) => project[key] === value).length;
}

function percent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function statusClass(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value || 0), min), max);
}

function formatShortDate(value) {
  if (!value) return "Not set";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

/* =========================================================================
 * Weekly Planner — productivity, quality, reminders
 * ========================================================================= */

const PLANNER_STATUSES = ["To Do", "In Progress", "In Review", "Done", "Blocked"];

// ===== TEAM ==================================================================

const Team = {
  members: [],
  els: {
    list: null,
    count: null,
    mount: null,
  },

  init() {
    this.els.list = document.querySelector("#teamList");
    this.els.count = document.querySelector("#teamCount");
    this.els.mount = document.querySelector("#addMemberMount");
    if (EditUI) EditUI.mountAddMemberButton?.(this.els.mount);
  },

  apply(members) {
    this.members = (members || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    // Keep the planner's team metadata in sync so its owner dropdowns refresh
    if (Planner.dataset?.metadata) {
      Planner.dataset.metadata.team = this.members;
      Planner.initialised = false;
      Planner.init();
    }
    this.render();
  },

  render() {
    if (!this.els.list) return;
    this.els.count.textContent = `${this.members.length} member${this.members.length === 1 ? "" : "s"}`;
    if (!this.members.length) {
      this.els.list.innerHTML = `<div class="empty-state">No team members yet. Toggle Edit and click "+ Add member".</div>`;
      return;
    }
    this.els.list.innerHTML = this.members.map((m) => this.memberCard(m)).join("");
    this.els.list.querySelectorAll(".team-card").forEach((card) => {
      const member = this.members.find((m) => m.id === card.dataset.id);
      if (member && EditUI?.isEditModeOn()) {
        EditUI.decorateMemberCard?.(card, member);
      }
    });
  },

  memberCard(m) {
    const initials = (m.avatar || nameInitials(m.name)).slice(0, 2).toUpperCase();
    return `
      <article class="team-card" data-id="${escapeHtml(m.id)}">
        <div class="team-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
        <div class="team-meta">
          <h3 class="team-name">${escapeHtml(m.name || "Unnamed")}</h3>
          <p class="team-role">${escapeHtml(m.role || "—")}</p>
          <p class="team-email">${m.email ? `<a href="mailto:${escapeAttribute(m.email)}">${escapeHtml(m.email)}</a>` : "—"}</p>
        </div>
      </article>
    `;
  },
};

function nameInitials(name) {
  if (!name) return "??";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[parts.length - 1][0] || "");
}

const Planner = {
  dataset: null,
  activeWeekStart: null,
  filters: { ownerId: "All", projectId: "All" },
  initialised: false,

  init() {
    if (this.initialised) return;
    this.initialised = true;
    if (!this.dataset) return;
    this.populateFilters();
    this.wire();
  },

  populateFilters() {
    const owners = ["All", ...this.dataset.metadata.team.map((t) => t.id)];
    els.plannerOwnerFilter.innerHTML = owners
      .map((id) => {
        const label = id === "All" ? "All people" : this.team(id)?.name || id;
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
      })
      .join("");

    const projectIds = ["All", ...new Set(this.dataset.tasks.map((t) => t.projectId).filter(Boolean))];
    els.plannerProjectFilter.innerHTML = projectIds
      .map((id) => {
        const label = id === "All" ? "All projects" : `${id} · ${state.projects.find((p) => p.id === id)?.project || id}`;
        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
      })
      .join("");
  },

  wire() {
    els.weekPrev.addEventListener("click", () => this.shiftWeek(-7));
    els.weekNext.addEventListener("click", () => this.shiftWeek(7));
    els.weekToday.addEventListener("click", () => {
      this.activeWeekStart = sundayOfToday();
      this.render();
    });
    els.plannerOwnerFilter.addEventListener("change", (e) => {
      this.filters.ownerId = e.target.value;
      this.render();
    });
    els.plannerProjectFilter.addEventListener("change", (e) => {
      this.filters.projectId = e.target.value;
      this.render();
    });
    els.emailAllOverdue.addEventListener("click", () => this.emailAllOverdue());
    els.downloadAllICS.addEventListener("click", () => this.downloadAllMilestonesICS());
    els.plannerSyncBtn?.addEventListener("click", (e) => this.syncNow(e.currentTarget));
    els.plannerGateBtn?.addEventListener("click", (e) => this.syncNow(e.currentTarget));
  },

  shiftWeek(days) {
    const next = new Date(this.activeWeekStart + "T00:00:00");
    next.setUTCDate(next.getUTCDate() + days);
    this.activeWeekStart = next.toISOString().slice(0, 10);
    this.render();
  },

  team(id) {
    return this.dataset?.metadata.team.find((t) => t.id === id);
  },

  todayISO() {
    return this.dataset?.metadata.generatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  },

  weekTasks() {
    // Tasks are keyed by Monday in storage; normalise to the Sunday work-week
    // anchor so they match the Sunday–Friday week the planner displays.
    return this.dataset.tasks.filter((t) => sundayOf(t.weekStart) === this.activeWeekStart);
  },

  filteredWeekTasks() {
    return this.weekTasks().filter((t) => {
      if (this.filters.ownerId !== "All" && t.ownerId !== this.filters.ownerId) return false;
      if (this.filters.projectId !== "All" && t.projectId !== this.filters.projectId) return false;
      return true;
    });
  },

  // Calendar is "connected" once the user has synced at least once (flagged in
  // localStorage) or there are calendar-sourced tasks in the dataset.
  isCalendarConnected() {
    if (localStorage.getItem("muCalendarConnected") === "1") return true;
    if (localStorage.getItem("muGoogleConnected") === "1") return true;
    return (this.dataset?.tasks || []).some((t) => t.source === "calendar");
  },

  render() {
    if (!this.dataset) return;
    this.renderWeekLabel();

    // Gate: show nothing but a prompt until the user is signed in AND has
    // synced their Google Calendar at least once.
    const signedIn = !!this.editor;
    const connected = this.isCalendarConnected();
    if (!signedIn || !connected) {
      els.plannerView?.classList.add("is-gated");
      els.plannerGate.hidden = false;
      els.plannerSyncBtn?.toggleAttribute("hidden", !signedIn);
      if (!signedIn) {
        els.plannerGateTitle.textContent = "Sign in to view your planner";
        els.plannerGateMsg.textContent =
          "Sign in with your Masters' Union account (top-right) to see and sync your weekly plan.";
        els.plannerGateBtn.hidden = true;
      } else {
        els.plannerGateTitle.textContent = "Connect your calendar";
        els.plannerGateMsg.textContent =
          "Sync your Google Calendar to populate this week's productivity chart and task board.";
        els.plannerGateBtn.hidden = false;
      }
      return;
    }

    els.plannerView?.classList.remove("is-gated");
    els.plannerGate.hidden = true;
    els.plannerSyncBtn?.removeAttribute("hidden");

    // Reflect the synced state on the button so the user knows the calendar is
    // connected (✓ Synced) — still clickable to pull fresh events.
    if (els.plannerSyncBtn && !els.plannerSyncBtn.disabled) {
      els.plannerSyncBtn.classList.toggle("is-synced", connected);
      els.plannerSyncBtn.innerHTML = connected
        ? `<span class="sync-ico" aria-hidden="true">✓</span> Synced`
        : `<span class="sync-ico" aria-hidden="true">⟳</span> Sync calendar`;
      els.plannerSyncBtn.title = connected
        ? "Calendar synced · click to pull the latest events"
        : "Pull your Google Calendar events into this week";
    }

    this.renderKpis();
    this.renderBanner();
    this.renderPeople();
    this.renderOverdue();
    this.renderMilestones();
    this.renderBoard();
  },

  async syncNow(triggerBtn) {
    const btn = triggerBtn;
    if (btn) { btn.disabled = true; btn.innerHTML = "Syncing…"; }
    try {
      const mod = await import("./firebase/calendar-sync.js");
      const r = await mod.syncCalendar({ projects: state.projects });
      localStorage.setItem("muCalendarConnected", "1");
      console.log("[planner-sync]", r);
    } catch (err) {
      console.error("[planner-sync] failed", err);
      alert(`Calendar sync failed: ${err?.message || err}`);
    } finally {
      // render() rebuilds the sync button into its synced/idle state, so just
      // re-enable and let it repaint (don't restore the stale "Syncing…" html).
      if (btn) btn.disabled = false;
      this.render();
    }
  },

  renderWeekLabel() {
    const start = new Date(this.activeWeekStart + "T00:00:00Z");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 5); // Sunday + 5 = Friday (6-day work week)
    const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
    const yearFmt = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "UTC" });
    const isCurrent = this.activeWeekStart === sundayOfToday();
    els.weekLabel.innerHTML = `
      <strong>${fmt.format(start)} &ndash; ${fmt.format(end)}</strong>
      <span class="week-year">${yearFmt.format(start)}${isCurrent ? " · This week" : ""}</span>
    `;
  },

  renderKpis() {
    const tasks = this.filteredWeekTasks();
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "Done").length;
    const inProgress = tasks.filter((t) => t.status === "In Progress" || t.status === "In Review").length;
    const blocked = tasks.filter((t) => t.status === "Blocked").length;
    const today = this.todayISO();
    const overdue = tasks.filter((t) => t.status !== "Done" && t.dueDate && t.dueDate < today).length;
    const plannedHrs = tasks.reduce((sum, t) => sum + (t.hoursEstimate || 0), 0);
    const loggedHrs = tasks.reduce((sum, t) => sum + (t.hoursActual || 0), 0);
    const utilisation = plannedHrs ? Math.round((loggedHrs / plannedHrs) * 100) : 0;
    const completionRate = total ? Math.round((done / total) * 100) : 0;
    const milestonesDue = tasks.filter((t) => t.milestone).length;

    const ratings = tasks.map((t) => t.qualityScore).filter((s) => typeof s === "number");
    const avgQuality = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";

    const tiles = [
      ["Tasks this week",   total,                   `${done} done · ${inProgress} in flight`],
      ["Completion",        `${completionRate}%`,    `${done} of ${total} closed`],
      ["Overdue",           overdue,                 overdue ? "Action required" : "All on track"],
      ["Blocked",           blocked,                 blocked ? "Unblock today" : "No blockers"],
      ["Hours logged",      `${loggedHrs}h`,         `of ${plannedHrs}h planned (${utilisation}%)`],
      ["Avg quality",       avgQuality === "—" ? "—" : `${avgQuality}/5`, `${ratings.length} reviewed`],
      ["Milestones",        milestonesDue,           "marked this week"],
    ];

    els.plannerKpis.innerHTML = tiles
      .map(
        ([label, value, helper]) => `
          <article class="kpi planner-kpi">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
            <small>${escapeHtml(helper)}</small>
          </article>
        `,
      )
      .join("");
  },

  renderBanner() {
    const today = this.todayISO();
    const tasks = this.weekTasks();
    const overdueCount = tasks.filter((t) => t.status !== "Done" && t.dueDate && t.dueDate < today).length;
    const blockedCount = tasks.filter((t) => t.status === "Blocked").length;
    const milestonesToday = tasks.filter((t) => t.milestone && t.dueDate === today).length;

    const messages = [];
    if (overdueCount) messages.push(`<strong>${overdueCount}</strong> overdue task${overdueCount === 1 ? "" : "s"}`);
    if (blockedCount) messages.push(`<strong>${blockedCount}</strong> blocked`);
    if (milestonesToday) messages.push(`<strong>${milestonesToday}</strong> milestone${milestonesToday === 1 ? "" : "s"} due today`);

    if (!messages.length) {
      els.plannerAlertBanner.hidden = true;
      els.plannerAlertBanner.innerHTML = "";
      return;
    }
    els.plannerAlertBanner.hidden = false;
    els.plannerAlertBanner.innerHTML = `
      <span class="banner-dot" aria-hidden="true"></span>
      <span class="banner-text">Heads-up — ${messages.join(" · ")}. Review the alert panels below.</span>
    `;
  },

  renderPeople() {
    const tasks = this.filteredWeekTasks();
    const team = this.dataset.metadata.team;
    const dailyHrs = this.dataset.metadata.dailyHours || 8;
    const workDays = this.dataset.metadata.workWeekDays || 6;
    const capacity = dailyHrs * workDays;
    const today = this.todayISO();

    const rows = team
      .map((person) => {
        // Cross-map across teammates: a person is credited for any task they
        // own OR attend (shared calendar events list every attendee).
        const mine = tasks.filter(
          (t) =>
            t.ownerId === person.id ||
            (Array.isArray(t.attendees) && t.attendees.includes(person.id)),
        );
        if (!mine.length) return null;
        const planned = mine.reduce((s, t) => s + (t.hoursEstimate || 0), 0);
        const logged = mine.reduce((s, t) => s + (t.hoursActual || 0), 0);
        const done = mine.filter((t) => t.status === "Done").length;
        const overdue = mine.filter((t) => t.status !== "Done" && t.dueDate && t.dueDate < today).length;
        const utilisation = capacity ? Math.round((logged / capacity) * 100) : 0;
        const completion = mine.length ? Math.round((done / mine.length) * 100) : 0;
        const ratings = mine.map((t) => t.qualityScore).filter((s) => typeof s === "number");
        const quality = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
        const productivityClass = utilisation >= 95 ? "is-hot" : utilisation >= 70 ? "is-good" : utilisation >= 40 ? "is-soft" : "is-low";
        return { person, mine, planned, logged, done, overdue, utilisation, completion, quality, productivityClass };
      })
      .filter(Boolean)
      .sort((a, b) => b.utilisation - a.utilisation);

    if (!rows.length) {
      els.peopleList.innerHTML = `<div class="empty-state subtle">No people-assigned tasks this week.</div>`;
      return;
    }

    els.peopleList.innerHTML = rows
      .map(({ person, mine, planned, logged, done, overdue, utilisation, completion, quality, productivityClass }) => `
        <article class="person-row">
          <div class="person-id">
            <span class="avatar">${escapeHtml(person.avatar || person.name.slice(0, 2))}</span>
            <div>
              <strong>${escapeHtml(person.name)}</strong>
              <span class="person-role">${escapeHtml(person.role)}</span>
            </div>
          </div>
          <div class="person-bars">
            <div class="bar-row">
              <span class="bar-label">Productivity</span>
              <div class="bar-track"><div class="bar-fill ${productivityClass}" style="width:${Math.min(utilisation, 100)}%"></div></div>
              <span class="bar-value">${utilisation}%</span>
            </div>
            <div class="bar-row">
              <span class="bar-label">Completion</span>
              <div class="bar-track"><div class="bar-fill is-completion" style="width:${completion}%"></div></div>
              <span class="bar-value">${completion}%</span>
            </div>
          </div>
          <div class="person-meta">
            <span><strong>${Math.round(logged * 10) / 10}h</strong> / ${Math.round(planned * 10) / 10}h planned</span>
            <span>${done}/${mine.length} done${overdue ? ` · <em class="meta-warn">${overdue} overdue</em>` : ""}</span>
            <span>${quality ? `Quality <strong>${quality}/5</strong>` : `<em class="meta-muted">Quality pending</em>`}</span>
          </div>
          <a class="person-mail" href="${escapeAttribute(this.weeklyDigestMailto(person, mine))}" title="Send weekly digest">Email digest</a>
        </article>
      `)
      .join("");
  },

  renderQuality() {
    const all = this.dataset.tasks;
    const team = this.dataset.metadata.team;
    const cutoff = this.weeksAgoISO(4);
    const rows = team
      .map((person) => {
        const reviewed = all.filter((t) => t.ownerId === person.id && typeof t.qualityScore === "number" && t.weekStart >= cutoff);
        if (!reviewed.length) return null;
        const avg = reviewed.reduce((s, t) => s + t.qualityScore, 0) / reviewed.length;
        const milestones = reviewed.filter((t) => t.milestone).length;
        return { person, reviewed, avg, milestones };
      })
      .filter(Boolean)
      .sort((a, b) => b.avg - a.avg);

    if (!rows.length) {
      els.qualityList.innerHTML = `<div class="empty-state subtle">No reviewer ratings recorded yet.</div>`;
      return;
    }

    els.qualityList.innerHTML = rows
      .map(({ person, reviewed, avg, milestones }) => {
        const tone = avg >= 4.5 ? "is-excellent" : avg >= 4 ? "is-good" : avg >= 3 ? "is-soft" : "is-low";
        return `
          <article class="quality-row">
            <div class="quality-id">
              <span class="avatar">${escapeHtml(person.avatar || person.name.slice(0, 2))}</span>
              <div>
                <strong>${escapeHtml(person.name)}</strong>
                <span class="person-role">${reviewed.length} reviewed · ${milestones} milestone${milestones === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div class="quality-score ${tone}">
              <span class="quality-num">${avg.toFixed(1)}</span>
              <span class="quality-stars" aria-hidden="true">${this.renderStars(avg)}</span>
            </div>
          </article>
        `;
      })
      .join("");
  },

  renderStars(score) {
    const full = Math.floor(score);
    const half = score - full >= 0.4 && score - full < 0.9 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "⯨" : "") + "☆".repeat(empty);
  },

  renderOverdue() {
    const today = this.todayISO();
    const list = this.dataset.tasks
      .filter((t) => t.status !== "Done" && t.dueDate && t.dueDate < today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (!list.length) {
      els.overdueList.innerHTML = `<div class="empty-state subtle good">Nothing overdue. ✦</div>`;
      els.emailAllOverdue.disabled = true;
      return;
    }
    els.emailAllOverdue.disabled = false;

    els.overdueList.innerHTML = list
      .map((task) => {
        const owner = this.team(task.ownerId);
        const project = state.projects.find((p) => p.id === task.projectId);
        const daysLate = this.daysBetween(task.dueDate, today);
        const mailto = this.overdueMailto(task);
        return `
          <article class="alert-row alert-overdue">
            <div class="alert-main">
              <div class="alert-title">
                <strong>${escapeHtml(task.title)}</strong>
                <span class="alert-late">${daysLate} day${daysLate === 1 ? "" : "s"} late</span>
              </div>
              <div class="alert-sub">
                ${escapeHtml(task.id)} · ${owner ? escapeHtml(owner.name) : "Unassigned"} · ${project ? escapeHtml(project.project) : "—"} · due ${this.formatDate(task.dueDate)}
              </div>
            </div>
            <div class="alert-actions">
              ${badge(task.status)}
              ${badge(task.priority, "priority")}
              <a class="ghost-btn small" href="${escapeAttribute(mailto)}" title="Email ${owner ? owner.name : "owner"}">Remind</a>
            </div>
          </article>
        `;
      })
      .join("");
  },

  renderMilestones() {
    const today = this.todayISO();
    const horizon = this.daysAheadISO(14);
    const list = this.dataset.tasks
      .filter((t) => t.milestone && t.dueDate && t.dueDate >= today && t.dueDate <= horizon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (!list.length) {
      els.milestoneList.innerHTML = `<div class="empty-state subtle">No milestones in the next 14 days.</div>`;
      els.downloadAllICS.disabled = true;
      return;
    }
    els.downloadAllICS.disabled = false;

    els.milestoneList.innerHTML = list
      .map((task) => {
        const owner = this.team(task.ownerId);
        const project = state.projects.find((p) => p.id === task.projectId);
        const days = this.daysBetween(today, task.dueDate);
        const reminderMail = this.milestoneMailto(task);
        return `
          <article class="alert-row alert-milestone">
            <div class="alert-main">
              <div class="alert-title">
                <strong>${escapeHtml(task.title)}</strong>
                <span class="alert-soon">${days === 0 ? "Today" : `in ${days} day${days === 1 ? "" : "s"}`}</span>
              </div>
              <div class="alert-sub">
                ${escapeHtml(task.id)} · ${owner ? escapeHtml(owner.name) : "Unassigned"} · ${project ? escapeHtml(project.project) : "—"} · ${this.formatDate(task.dueDate)}
              </div>
            </div>
            <div class="alert-actions">
              <a class="ghost-btn small" href="${escapeAttribute(reminderMail)}" title="Send reminder email">Remind</a>
              <button class="ghost-btn small" type="button" data-task-id="${escapeHtml(task.id)}" data-action="ics">.ics</button>
            </div>
          </article>
        `;
      })
      .join("");

    els.milestoneList.querySelectorAll('[data-action="ics"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const task = this.dataset.tasks.find((t) => t.id === btn.dataset.taskId);
        if (task) this.downloadICS([task]);
      });
    });
  },

  renderBoard() {
    const tasks = this.filteredWeekTasks();
    const today = this.todayISO();

    const crossTeam = this.crossTeamPanelHtml(tasks);

    const board = PLANNER_STATUSES.map((status) => {
      const colTasks = tasks.filter((t) => t.status === status).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      return `
        <section class="board-col board-${statusClass(status)}">
          <header class="board-col-head">
            <span class="board-col-name">${escapeHtml(status)}</span>
            <span class="board-col-count">${colTasks.length}</span>
          </header>
          <div class="board-col-body">
            ${colTasks.map((t) => this.taskCard(t, today)).join("") || `<div class="board-empty">—</div>`}
          </div>
        </section>
      `;
    }).join("");

    els.plannerBoard.innerHTML = crossTeam + board;
  },

  // Lists meetings/tasks this week where 2+ team members are attendees, plus
  // a frequency tally of who's collaborating with whom. Surfaces only when
  // there's at least one shared item, so it stays out of the way otherwise.
  crossTeamPanelHtml(tasks) {
    const shared = tasks.filter((t) => Array.isArray(t.attendees) && t.attendees.length >= 2);
    if (!shared.length) return "";

    // Pair frequency map for collaboration "depth"
    const pairs = new Map();
    shared.forEach((t) => {
      const ids = [...new Set(t.attendees)].sort();
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = `${ids[i]}|${ids[j]}`;
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
      }
    });
    const pairItems = [...pairs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([key, count]) => {
        const [a, b] = key.split("|");
        const ta = this.team(a); const tb = this.team(b);
        if (!ta || !tb) return null;
        return `<span class="cross-pair"><span class="avatar avatar-sm">${escapeHtml(ta.avatar || ta.name.slice(0,2))}</span><span class="avatar avatar-sm">${escapeHtml(tb.avatar || tb.name.slice(0,2))}</span><span class="cross-pair-label">${escapeHtml(ta.name.split(" ")[0])} × ${escapeHtml(tb.name.split(" ")[0])}</span><span class="cross-pair-count">${count}</span></span>`;
      })
      .filter(Boolean);
    // When we have all 4 slots filled, drop a divider after the 2nd pair to
    // visually group "top 2" from the rest.
    const topPairs =
      pairItems.length >= 4
        ? [...pairItems.slice(0, 2), `<span class="cross-pair-divider" aria-hidden="true"></span>`, ...pairItems.slice(2)].join("")
        : pairItems.join("");

    const items = shared
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
      .slice(0, 6)
      .map((t) => {
        const names = (t.attendees || []).map((id) => this.team(id)?.name?.split(" ")[0]).filter(Boolean);
        const project = state.projects.find((p) => p.id === t.projectId);
        return `<li class="cross-item">
          <div class="cross-item-title">${escapeHtml(t.title)}</div>
          <div class="cross-item-meta">${escapeHtml(names.join(", "))}${project ? ` · ${escapeHtml(project.project)}` : ""} · ${escapeHtml(this.formatDate(t.dueDate))}</div>
        </li>`;
      })
      .join("");

    return `
      <section class="cross-team-panel">
        <header class="cross-team-head">
          <span class="cross-team-eyebrow">Cross-Team Collaborations</span>
          <span class="cross-team-count">${shared.length} shared this week</span>
        </header>
        ${topPairs ? `<div class="cross-pairs">${topPairs}</div>` : ""}
        <ul class="cross-list">${items}</ul>
      </section>
    `;
  },

  taskCard(task, today) {
    const project = state.projects.find((p) => p.id === task.projectId);
    const isCalendar = task.source === "calendar";
    const overdue = task.status !== "Done" && task.dueDate && task.dueDate < today;
    const dueSoon = task.status !== "Done" && task.dueDate && !overdue && this.daysBetween(today, task.dueDate) <= 1;
    const hoursDelta = (task.hoursActual || 0) - (task.hoursEstimate || 0);
    const hoursTone = hoursDelta > 1 ? "over" : hoursDelta < -1 ? "under" : "even";

    // Attendees: prefer the calendar-populated array; fall back to ownerId for
    // non-calendar tasks. Filter to known team members so we render real avatars.
    const attendeeIds = (Array.isArray(task.attendees) && task.attendees.length
      ? task.attendees
      : [task.ownerId]).filter(Boolean);
    const attendees = attendeeIds.map((id) => this.team(id)).filter(Boolean);
    const isShared = attendees.length > 1;
    const avatarsHtml = attendees.slice(0, 3).map((a) =>
      `<span class="avatar avatar-sm" title="${escapeHtml(a.name)}">${escapeHtml(a.avatar || a.name.slice(0,2))}</span>`
    ).join("");
    const moreCount = attendees.length - 3;
    const ownerLabel = isShared
      ? `${attendees.length} attendees`
      : escapeHtml(attendees[0]?.name || "Unassigned");

    return `
      <article class="task-card ${overdue ? "is-overdue" : ""} ${dueSoon ? "is-due-soon" : ""} ${isShared ? "is-shared" : ""}">
        ${task.milestone ? `<span class="task-milestone" title="Milestone">◆ Milestone</span>` : ""}
        ${isShared ? `<span class="task-shared-tag" title="Cross-team collaboration">⇄ Shared</span>` : ""}
        <div class="task-card-head">
          ${isCalendar
            ? `<span class="task-id task-id-cal" title="Synced from Google Calendar">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9h17"/><path d="M8 3.5v3M16 3.5v3"/></svg>
                 Calendar
               </span>`
            : `<span class="task-id">${escapeHtml(task.id)}</span>`}
          ${badge(task.priority, "priority")}
        </div>
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <p class="task-project">${project ? escapeHtml(project.project) : escapeHtml(task.projectId || "—")}</p>
        <div class="task-meta">
          <span class="task-owner">
            <span class="avatar-stack">
              ${avatarsHtml}
              ${moreCount > 0 ? `<span class="avatar avatar-sm avatar-more">+${moreCount}</span>` : ""}
            </span>
            ${ownerLabel}
          </span>
          <span class="task-due ${overdue ? "is-overdue" : dueSoon ? "is-due-soon" : ""}">
            Due ${this.formatDate(task.dueDate)}
          </span>
        </div>
        <div class="task-foot">
          <span class="hours hours-${hoursTone}">${task.hoursActual || 0}h / ${task.hoursEstimate || 0}h</span>
          ${
            isCalendar
              ? `<span class="task-quality muted">Meeting</span>`
              : typeof task.qualityScore === "number"
                ? `<span class="task-quality">★ ${task.qualityScore.toFixed(1)}</span>`
                : `<span class="task-quality muted">Quality —</span>`
          }
        </div>
        ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ""}
      </article>
    `;
  },

  /* ---------- Reminders & calendar ---------- */

  overdueMailto(task) {
    const owner = this.team(task.ownerId);
    if (!owner) return "#";
    const reviewer = this.team(task.reviewerId);
    const project = state.projects.find((p) => p.id === task.projectId);
    const subject = `[Action] Overdue: ${task.title} (${task.id})`;
    const body = [
      `Hello ${owner.name.split(" ")[0]},`,
      ``,
      `The following task is past its due date and needs attention today:`,
      ``,
      `• Task: ${task.title} (${task.id})`,
      `• Project: ${project ? `${project.id} — ${project.project}` : task.projectId || "—"}`,
      `• Due: ${this.formatDate(task.dueDate)}`,
      `• Status: ${task.status} · Priority: ${task.priority}`,
      `• Notes: ${task.notes || "—"}`,
      ``,
      `Please update the status or share a revised commit by end of day.`,
      ``,
      `— Masters' Union Project Tracker`,
    ].join("\n");
    const cc = reviewer ? `&cc=${encodeURIComponent(reviewer.email)}` : "";
    return `mailto:${owner.email}?subject=${encodeURIComponent(subject)}${cc}&body=${encodeURIComponent(body)}`;
  },

  milestoneMailto(task) {
    const owner = this.team(task.ownerId);
    if (!owner) return "#";
    const project = state.projects.find((p) => p.id === task.projectId);
    const subject = `[Milestone] ${task.title} — ${this.formatDate(task.dueDate)}`;
    const body = [
      `Hello ${owner.name.split(" ")[0]},`,
      ``,
      `Reminder for an upcoming milestone:`,
      ``,
      `• ${task.title} (${task.id})`,
      `• Project: ${project ? `${project.id} — ${project.project}` : task.projectId || "—"}`,
      `• Due: ${this.formatDate(task.dueDate)}`,
      `• Priority: ${task.priority}`,
      ``,
      `Please confirm readiness and flag risks at least 48 hours in advance.`,
      ``,
      `— Masters' Union Project Tracker`,
    ].join("\n");
    return `mailto:${owner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  weeklyDigestMailto(person, tasks) {
    const lines = tasks
      .slice()
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
      .map((t) => `• [${t.status}] ${t.title} (${t.id}) — due ${this.formatDate(t.dueDate)}`);
    const subject = `[Weekly Digest] ${person.name.split(" ")[0]} — week of ${this.formatDate(this.activeWeekStart)}`;
    const body = [
      `Hello ${person.name.split(" ")[0]},`,
      ``,
      `Here is your plan for the week:`,
      ``,
      ...lines,
      ``,
      `Please log hours and update statuses by end of day Friday.`,
      ``,
      `— Masters' Union Project Tracker`,
    ].join("\n");
    return `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  emailAllOverdue() {
    const today = this.todayISO();
    const overdue = this.dataset.tasks.filter((t) => t.status !== "Done" && t.dueDate && t.dueDate < today);
    if (!overdue.length) return;
    const ownerIds = [...new Set(overdue.map((t) => t.ownerId))];
    const tos = ownerIds.map((id) => this.team(id)?.email).filter(Boolean);
    const subject = `[Action] ${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} across the team`;
    const lines = overdue.map((t) => {
      const owner = this.team(t.ownerId);
      return `• ${t.title} (${t.id}) — owner ${owner?.name || "?"} — due ${this.formatDate(t.dueDate)}`;
    });
    const body = [
      `Team,`,
      ``,
      `The following tasks are past their due date as of ${this.formatDate(today)}:`,
      ``,
      ...lines,
      ``,
      `Please refresh statuses or escalate by end of day.`,
      ``,
      `— Masters' Union Project Tracker`,
    ].join("\n");
    window.location.href = `mailto:${tos.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },

  downloadAllMilestonesICS() {
    const today = this.todayISO();
    const horizon = this.daysAheadISO(14);
    const tasks = this.dataset.tasks.filter((t) => t.milestone && t.dueDate && t.dueDate >= today && t.dueDate <= horizon);
    if (tasks.length) this.downloadICS(tasks);
  },

  downloadICS(tasks) {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Masters' Union//Project Tracker//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];
    tasks.forEach((task) => {
      const dt = (task.dueDate || "").replace(/-/g, "");
      if (!dt) return;
      const owner = this.team(task.ownerId);
      const project = state.projects.find((p) => p.id === task.projectId);
      const desc = [
        `Task: ${task.title} (${task.id})`,
        `Project: ${project ? `${project.id} — ${project.project}` : task.projectId || "—"}`,
        `Owner: ${owner?.name || "Unassigned"}`,
        `Priority: ${task.priority}`,
        task.notes ? `Notes: ${task.notes}` : null,
      ].filter(Boolean).join("\\n");
      const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${task.id}@projects.mastersunion.org`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dt}`,
        `DTEND;VALUE=DATE:${dt}`,
        `SUMMARY:[Milestone] ${task.title}`,
        `DESCRIPTION:${desc}`,
        owner ? `ORGANIZER;CN=${owner.name}:mailto:${owner.email}` : "",
        owner ? `ATTENDEE;CN=${owner.name};RSVP=TRUE:mailto:${owner.email}` : "",
        "BEGIN:VALARM",
        "TRIGGER:-P2D",
        "ACTION:DISPLAY",
        `DESCRIPTION:Milestone reminder — ${task.title}`,
        "END:VALARM",
        "END:VEVENT",
      );
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.filter(Boolean).join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tasks.length === 1 ? `mu-milestone-${tasks[0].id}.ics` : `mu-milestones-${this.activeWeekStart}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /* ---------- helpers ---------- */

  weeksAgoISO(weeks) {
    const d = new Date(this.todayISO() + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - weeks * 7);
    return d.toISOString().slice(0, 10);
  },

  daysAheadISO(days) {
    const d = new Date(this.todayISO() + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  },

  daysBetween(fromISO, toISO) {
    const a = new Date(fromISO + "T00:00:00Z").getTime();
    const b = new Date(toISO + "T00:00:00Z").getTime();
    return Math.round((b - a) / 86400000);
  },

  formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
  },
};
