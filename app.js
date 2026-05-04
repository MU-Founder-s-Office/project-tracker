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

async function init() {
  try {
    const response = await fetch("./data/projects.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load data: ${response.status}`);
    state.dataset = await response.json();
    state.projects = (state.dataset.projects || []).map((project) => ({
      ...project,
      phase: PHASE_MAP[project.id] || "Unassigned",
    }));
    state.selectedId = state.projects[0]?.id || null;

    populateFilters();
    wireEvents();
    render();
  } catch (error) {
    els.projectList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    els.detailPanel.innerHTML = `<div class="detail-empty">Run the workbook importer, then refresh this page.</div>`;
  }
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
  select.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    .join("");
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
  els.resultCount.textContent = `${projects.length} shown`;
  if (!projects.length) {
    els.projectList.innerHTML = `<div class="empty-state">No projects match the current filters.</div>`;
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
      state.selectedId = card.dataset.id;
      state.detailOpen = true;
      render();
    });
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
          const color = PHASE_COLORS[phase.name] || "#94a3b8";
          const left = ((span.start - GANTT_START.getTime()) / totalSpan) * 100;
          const width = Math.max(((span.end - span.start) / totalSpan) * 100, 0.6);

          const projectBars = phase.projects
            .map((project) => {
              const start = new Date(project.startDate).getTime();
              const end = new Date(project.endDate).getTime();
              const pl = ((start - GANTT_START.getTime()) / totalSpan) * 100;
              const pw = Math.max(((end - start) / totalSpan) * 100, 0.6);
              const dim = project.status === "Not Started" ? "g-bar-dim" : "";
              const done = clamp(project.progress, 0, 100);
              return `
                <div class="g-row g-project ${project.id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(project.id)}">
                  <div class="g-label g-label-sub">
                    <span class="g-status-dot ${statusClass(project.status)}"></span>
                    <span class="g-name" title="${escapeAttribute(project.project)}">${escapeHtml(project.project)}</span>
                    <span class="g-meta">${project.progress}%</span>
                  </div>
                  <div class="g-track">
                    ${monthGridLines()}
                    <div class="g-bar g-bar-child ${dim}" style="left:${pl}%;width:${pw}%;background:${color};box-shadow:0 0 0 1px ${color}33"
                      title="${escapeAttribute(`${project.id} · ${project.project} · ${project.status} · ${project.progress}%`)}">
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
                <strong style="color:${color}">${escapeHtml(phase.name)}</strong>
                <span class="g-meta">${phase.projects.length} projects</span>
              </div>
              <div class="g-track">
                ${monthGridLines()}
                <div class="g-bar g-bar-parent" style="left:${left}%;width:${width}%;background:${color}"></div>
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
    <div class="g-grid">
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
}

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
