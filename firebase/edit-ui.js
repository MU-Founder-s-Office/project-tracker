// Inline editing layer.
// - Editor state controlled by a body.edit-mode class
// - Only visible/usable when the signed-in user passes isEditor()
// - Saves go through data-layer.saveProject() (Firestore)
// - Other devices see updates via realtime subscriptions in app.js
import { saveProject, deleteProject } from "./data-layer.js";
import { onUserChange, currentEditor } from "./auth-ui.js";

const STATUS_OPTIONS = ["Completed", "On Track", "At Risk", "Paused", "Not Started"];
const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3", "Done"];
const WORKSTREAM_OPTIONS = ["NPS Program", "Platforms", "AI Initiatives", "Strategy"];
const PHASE_OPTIONS_BY_WS = {
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

let editModeEnabled = false;
let toggleEl = null;
const subscribers = new Set();

export function onEditModeChange(fn) {
  subscribers.add(fn);
  fn(editModeEnabled);
  return () => subscribers.delete(fn);
}

export function isEditModeOn() {
  return editModeEnabled && !!currentEditor();
}

function emit() {
  document.body.classList.toggle("edit-mode", isEditModeOn());
  subscribers.forEach((fn) => fn(isEditModeOn()));
}

export function mountEditToggle(container) {
  if (!container || toggleEl) return;
  toggleEl = document.createElement("button");
  toggleEl.id = "editModeToggle";
  toggleEl.type = "button";
  toggleEl.className = "edit-toggle";
  toggleEl.hidden = true;
  toggleEl.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
    </svg>
    <span class="edit-toggle-label">Edit</span>
  `;
  toggleEl.addEventListener("click", () => {
    if (!currentEditor()) return;
    editModeEnabled = !editModeEnabled;
    toggleEl.classList.toggle("is-on", editModeEnabled);
    toggleEl.querySelector(".edit-toggle-label").textContent = editModeEnabled ? "Editing" : "Edit";
    emit();
  });
  container.appendChild(toggleEl);

  onUserChange((user) => {
    const editor = !!user && !!currentEditor();
    toggleEl.hidden = !editor;
    if (!editor && editModeEnabled) {
      editModeEnabled = false;
      toggleEl.classList.remove("is-on");
      toggleEl.querySelector(".edit-toggle-label").textContent = "Edit";
      emit();
    }
  });
}

// ----- Editable field components -----------------------------------------------

function makeSelect(value, options) {
  const sel = document.createElement("select");
  sel.className = "inline-edit-select";
  options.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  });
  return sel;
}

function makeNumber(value, { min = 0, max = 100, step = 5 } = {}) {
  const inp = document.createElement("input");
  inp.type = "number";
  inp.className = "inline-edit-number";
  inp.value = value ?? 0;
  inp.min = min;
  inp.max = max;
  inp.step = step;
  return inp;
}

async function patchProject(project, patch, opts = {}) {
  if (!currentEditor()) return;
  const next = { ...project, ...patch };
  try {
    await saveProject(next);
    flash(opts.flash, "ok");
  } catch (err) {
    console.error("[edit-ui] save failed", err);
    flash(opts.flash, "err");
    alert(`Save failed: ${err?.message || err}`);
  }
}

function flash(el, kind) {
  if (!el) return;
  el.classList.remove("saved", "save-err");
  void el.offsetWidth;
  el.classList.add(kind === "ok" ? "saved" : "save-err");
  setTimeout(() => el.classList.remove("saved", "save-err"), 1200);
}

// Attach inline editors to a freshly-rendered project card.
// `card` is the .project-card root element; `project` is the data row.
export function decorateProjectCard(card, project) {
  if (!isEditModeOn()) return;
  card.classList.add("is-editable");

  // Stop card-level click handler from firing on edit controls
  card.querySelectorAll(".inline-edit-zone").forEach((z) => {
    z.addEventListener("click", (e) => e.stopPropagation());
  });

  // Status
  const statusCell = card.querySelector(".card-status");
  if (statusCell) {
    statusCell.classList.add("inline-edit-zone");
    statusCell.innerHTML = "";
    const sel = makeSelect(project.status, STATUS_OPTIONS);
    sel.addEventListener("change", () => patchProject(project, { status: sel.value }, { flash: statusCell }));
    sel.addEventListener("click", (e) => e.stopPropagation());
    statusCell.appendChild(sel);
  }

  // Priority
  const priorityCell = card.querySelector(".card-priority");
  if (priorityCell) {
    priorityCell.classList.add("inline-edit-zone");
    priorityCell.innerHTML = "";
    const sel = makeSelect(project.priority, PRIORITY_OPTIONS);
    sel.addEventListener("change", () => patchProject(project, { priority: sel.value }, { flash: priorityCell }));
    sel.addEventListener("click", (e) => e.stopPropagation());
    priorityCell.appendChild(sel);
  }

  // Progress (replace the progress bar with a number stepper)
  const progressWrap = card.querySelector(".progress-wrap");
  if (progressWrap) {
    progressWrap.classList.add("inline-edit-zone");
    progressWrap.innerHTML = "";
    const inp = makeNumber(project.progress, { min: 0, max: 100, step: 5 });
    inp.addEventListener("change", () => {
      const val = Math.max(0, Math.min(100, Number(inp.value || 0)));
      patchProject(project, { progress: val }, { flash: progressWrap });
    });
    inp.addEventListener("click", (e) => e.stopPropagation());
    const suffix = document.createElement("span");
    suffix.className = "inline-edit-suffix";
    suffix.textContent = "%";
    progressWrap.appendChild(inp);
    progressWrap.appendChild(suffix);
  }
}

// Decorate the detail panel (when editing a single project)
export function decorateDetailPanel(panel, project) {
  if (!isEditModeOn() || !panel || !project) return;

  // ---- Hero: project name editor + status/priority dropdowns + workstream/phase
  const hero = panel.querySelector(".detail-hero");
  const heroH2 = hero?.querySelector("h2");
  if (heroH2) {
    heroH2.classList.add("inline-edit-zone");
    heroH2.contentEditable = "true";
    heroH2.spellcheck = false;
    heroH2.addEventListener("blur", () => {
      const next = heroH2.textContent.trim();
      if (next && next !== project.project) {
        patchProject(project, { project: next }, { flash: hero });
      }
    });
    heroH2.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        heroH2.blur();
      }
    });
  }

  // Workstream + Phase editor (under the eyebrow line)
  const eyebrow = hero?.querySelector(".detail-eyebrow");
  if (eyebrow) {
    eyebrow.classList.add("inline-edit-zone");
    eyebrow.innerHTML = "";
    const wsSel = makeSelect(project.workstream, WORKSTREAM_OPTIONS);
    wsSel.classList.add("inline-edit-select", "inline-edit-hero");
    const phaseSel = makePhaseSelect(project.workstream, project.phase);
    phaseSel.classList.add("inline-edit-select", "inline-edit-hero");

    wsSel.addEventListener("change", () => {
      const newWs = wsSel.value;
      const phases = PHASE_OPTIONS_BY_WS[newWs] || [];
      const newPhase = phases[0] || "Unassigned";
      patchProject(project, { workstream: newWs, phase: newPhase }, { flash: hero });
    });
    phaseSel.addEventListener("change", () => {
      patchProject(project, { phase: phaseSel.value }, { flash: hero });
    });

    eyebrow.appendChild(wsSel);
    eyebrow.appendChild(document.createTextNode(" · "));
    eyebrow.appendChild(phaseSel);
  }

  // Status + priority dropdowns
  const heroBadges = hero?.querySelector(".badge-row");
  if (heroBadges) {
    heroBadges.innerHTML = "";
    const statusSel = makeSelect(project.status, STATUS_OPTIONS);
    statusSel.classList.add("inline-edit-select", "inline-edit-hero");
    statusSel.addEventListener("change", () => patchProject(project, { status: statusSel.value }, { flash: heroBadges }));

    const prioritySel = makeSelect(project.priority, PRIORITY_OPTIONS);
    prioritySel.classList.add("inline-edit-select", "inline-edit-hero");
    prioritySel.addEventListener("change", () => patchProject(project, { priority: prioritySel.value }, { flash: heroBadges }));

    heroBadges.appendChild(statusSel);
    heroBadges.appendChild(prioritySel);
  }

  // ---- Delivery: start, end, progress
  const detailGrid = panel.querySelector(".detail-section:nth-of-type(1) .detail-grid");
  if (detailGrid) {
    detailGrid.innerHTML = "";
    detailGrid.appendChild(buildDateStat("Start", project, "startDate"));
    detailGrid.appendChild(buildDateStat("End", project, "endDate"));
    detailGrid.appendChild(buildProgressStat(project));
  }

  // ---- Notes (textarea)
  const noteEl = panel.querySelector(".notes-body");
  if (noteEl) {
    const zone = noteEl.parentElement;
    noteEl.classList.add("inline-edit-zone");
    const ta = document.createElement("textarea");
    ta.className = "inline-edit-textarea";
    ta.rows = Math.max(4, (project.notes || "").split("\n").length + 1);
    ta.value = project.notes || "";
    ta.placeholder = "• Type a bullet per line. Lines auto-format on save.";
    ta.addEventListener("blur", () => {
      const next = ta.value.trim();
      if (next !== (project.notes || "")) {
        patchProject(project, { notes: next }, { flash: zone });
      }
    });
    noteEl.replaceWith(ta);
  }

  // ---- Links CRUD
  const linksHeader = [...panel.querySelectorAll(".detail-section h3")].find(
    (h) => h.textContent.trim() === "Links",
  );
  const linksSection = linksHeader?.parentElement;
  if (linksSection) {
    // remove anything after the h3
    [...linksSection.children].forEach((c) => {
      if (c !== linksHeader) c.remove();
    });
    const list = document.createElement("div");
    list.className = "link-edit-list";
    const links = Array.isArray(project.links) ? [...project.links] : [];

    const renderRows = () => {
      list.innerHTML = "";
      links.forEach((link, i) => {
        const row = document.createElement("div");
        row.className = "link-edit-row";
        row.innerHTML = `
          <input type="text" class="inline-edit-text link-label" placeholder="Label" value="${escapeAttr(link.label || "")}" />
          <input type="url" class="inline-edit-text link-url" placeholder="https://..." value="${escapeAttr(link.url || "")}" />
          <button type="button" class="link-remove" aria-label="Remove link">×</button>
        `;
        const labelInp = row.querySelector(".link-label");
        const urlInp = row.querySelector(".link-url");
        const commit = () => {
          links[i] = { label: labelInp.value.trim(), url: urlInp.value.trim() };
          patchProject(project, { links: links.filter((l) => l.url) }, { flash: row });
        };
        labelInp.addEventListener("blur", commit);
        urlInp.addEventListener("blur", commit);
        row.querySelector(".link-remove").addEventListener("click", () => {
          links.splice(i, 1);
          patchProject(project, { links }, { flash: list });
          renderRows();
        });
        list.appendChild(row);
      });
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "link-add";
      addBtn.textContent = "+ Add link";
      addBtn.addEventListener("click", () => {
        links.push({ label: "", url: "" });
        renderRows();
      });
      list.appendChild(addBtn);
    };

    renderRows();
    linksSection.appendChild(list);
  }

  // ---- Danger zone (delete project)
  const deleteWrap = document.createElement("div");
  deleteWrap.className = "detail-section detail-danger";
  deleteWrap.innerHTML = `
    <h3>Danger zone</h3>
    <button type="button" class="danger-btn" id="deleteProjectBtn">Delete ${escapeHTML(project.id)} (${escapeHTML(project.project)})</button>
  `;
  panel.appendChild(deleteWrap);
  deleteWrap.querySelector("#deleteProjectBtn").addEventListener("click", async () => {
    if (!confirm(`Permanently delete ${project.id} (${project.project})? This cannot be undone.`)) return;
    try {
      await deleteProject(project.id);
    } catch (err) {
      alert(`Delete failed: ${err?.message || err}`);
    }
  });
}

// ----- Date + progress stat builders -----------------------------------------

function buildDateStat(label, project, fieldName) {
  const stat = document.createElement("div");
  stat.className = "detail-stat inline-edit-zone";
  stat.innerHTML = `<span>${label}</span>`;
  const inp = document.createElement("input");
  inp.type = "date";
  inp.className = "inline-edit-date";
  inp.value = (project[fieldName] || "").slice(0, 10);
  inp.addEventListener("change", () => {
    const v = inp.value || null;
    const patch = { [fieldName]: v };
    // recompute durationDays
    const s = fieldName === "startDate" ? v : project.startDate;
    const e = fieldName === "endDate" ? v : project.endDate;
    if (s && e) {
      const d = (new Date(e) - new Date(s)) / 86400000 + 1;
      patch.durationDays = Math.max(0, Math.round(d));
    }
    patchProject(project, patch, { flash: stat });
  });
  stat.appendChild(inp);
  return stat;
}

function buildProgressStat(project) {
  const stat = document.createElement("div");
  stat.className = "detail-stat inline-edit-zone";
  stat.innerHTML = `<span>Progress</span>`;
  const inp = makeNumber(project.progress, { min: 0, max: 100, step: 5 });
  inp.addEventListener("change", () => {
    const val = Math.max(0, Math.min(100, Number(inp.value || 0)));
    patchProject(project, { progress: val }, { flash: stat });
  });
  const wrap = document.createElement("span");
  wrap.style.display = "inline-flex";
  wrap.style.alignItems = "baseline";
  wrap.appendChild(inp);
  const suffix = document.createElement("span");
  suffix.className = "inline-edit-suffix";
  suffix.textContent = "%";
  wrap.appendChild(suffix);
  stat.appendChild(wrap);
  return stat;
}

function makePhaseSelect(workstream, currentPhase) {
  const phases = PHASE_OPTIONS_BY_WS[workstream] || ["Unassigned"];
  return makeSelect(currentPhase || phases[0], phases);
}

// ----- Add-new-project modal -------------------------------------------------

export function mountAddProjectButton(container, getProjects) {
  if (!container) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "addProjectBtn";
  btn.className = "edit-add-btn";
  btn.innerHTML = `<span>＋</span> New project`;
  btn.hidden = !isEditModeOn();
  btn.addEventListener("click", () => openAddProjectModal(getProjects));
  container.appendChild(btn);

  onEditModeChange((on) => {
    btn.hidden = !on;
  });
}

function nextProjectId(projects) {
  const nums = projects
    .map((p) => parseInt(String(p.id).replace(/[^0-9]/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `P-${String(max + 1).padStart(2, "0")}`;
}

function openAddProjectModal(getProjects) {
  if (!isEditModeOn()) return;

  const projects = getProjects?.() || [];
  const nextId = nextProjectId(projects);

  // Build datalist options from existing data + the known defaults
  // so user can pick from a list OR type a brand-new workstream/phase.
  const existingWs = [...new Set(projects.map((p) => p.workstream).filter(Boolean))];
  const wsList = [...new Set([...WORKSTREAM_OPTIONS, ...existingWs])];
  const allPhases = [...new Set(projects.map((p) => p.phase).filter(Boolean))];

  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.innerHTML = `
    <div class="edit-modal" role="dialog" aria-labelledby="addProjectTitle">
      <header>
        <h3 id="addProjectTitle">New project · ${nextId}</h3>
        <button type="button" class="edit-modal-close" aria-label="Close">×</button>
      </header>
      <form class="edit-form" id="addProjectForm" novalidate>
        <label>
          <span>Project name</span>
          <input type="text" name="project" required autofocus />
        </label>
        <label>
          <span>Workstream <em class="edit-form-hint">(pick or type new)</em></span>
          <input type="text" name="workstream" list="addWsList" required autocomplete="off" />
          <datalist id="addWsList">
            ${wsList.map((w) => `<option value="${escapeAttr(w)}"></option>`).join("")}
          </datalist>
        </label>
        <label>
          <span>Phase <em class="edit-form-hint">(pick or type new)</em></span>
          <input type="text" name="phase" list="addPhaseList" required autocomplete="off" />
          <datalist id="addPhaseList"></datalist>
        </label>
        <div class="edit-form-row">
          <label>
            <span>Status</span>
            <select name="status">${STATUS_OPTIONS.map((s) => `<option value="${s}"${s === "Not Started" ? " selected" : ""}>${s}</option>`).join("")}</select>
          </label>
          <label>
            <span>Priority</span>
            <select name="priority">${PRIORITY_OPTIONS.map((p) => `<option value="${p}"${p === "P2" ? " selected" : ""}>${p}</option>`).join("")}</select>
          </label>
        </div>
        <div class="edit-form-row">
          <label>
            <span>Start date</span>
            <input type="date" name="startDate" />
          </label>
          <label>
            <span>End date</span>
            <input type="date" name="endDate" />
          </label>
        </div>
        <p class="edit-form-error" id="addProjectErr" hidden></p>
        <footer>
          <button type="button" class="btn-secondary" data-act="cancel">Cancel</button>
          <button type="submit" class="btn-primary">Create ${nextId}</button>
        </footer>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const wsInp = overlay.querySelector('input[name="workstream"]');
  const phaseInp = overlay.querySelector('input[name="phase"]');
  const phaseList = overlay.querySelector("#addPhaseList");
  const errEl = overlay.querySelector("#addProjectErr");
  const submitBtn = overlay.querySelector('button[type="submit"]');

  const refreshPhases = () => {
    const ws = wsInp.value.trim();
    const defaults = PHASE_OPTIONS_BY_WS[ws] || [];
    const fromData = allPhases; // include every phase already in use, regardless of workstream
    const merged = [...new Set([...defaults, ...fromData])];
    phaseList.innerHTML = merged.map((p) => `<option value="${escapeAttr(p)}"></option>`).join("");
  };
  wsInp.addEventListener("input", refreshPhases);
  refreshPhases();

  const close = () => overlay.remove();
  overlay.querySelector(".edit-modal-close").addEventListener("click", close);
  overlay.querySelector('[data-act="cancel"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function showError(message) {
    errEl.textContent = message;
    errEl.hidden = false;
  }
  function hideError() {
    errEl.hidden = true;
    errEl.textContent = "";
  }

  overlay.querySelector("#addProjectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const fd = new FormData(e.target);
    const project = {
      id: nextId,
      project: String(fd.get("project") || "").trim(),
      workstream: String(fd.get("workstream") || "").trim(),
      phase: String(fd.get("phase") || "").trim(),
      status: String(fd.get("status") || "Not Started"),
      priority: String(fd.get("priority") || "P2"),
      startDate: fd.get("startDate") || null,
      endDate: fd.get("endDate") || null,
      progress: 0,
      topRisk: "",
      notes: "",
      references: [],
      links: [],
      rag: "",
      durationDays: 0,
      extraFields: {},
    };

    if (!project.project) return showError("Project name is required.");
    if (!project.workstream) return showError("Workstream is required.");
    if (!project.phase) return showError("Phase is required.");

    if (project.startDate && project.endDate) {
      project.durationDays = Math.max(
        0,
        Math.round((new Date(project.endDate) - new Date(project.startDate)) / 86400000 + 1),
      );
    }

    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Creating…";

    try {
      console.log("[add-project] saving", project);
      await saveProject(project);
      console.log("[add-project] saved OK");
      close();
    } catch (err) {
      console.error("[add-project] save failed", err);
      const code = err?.code ? ` (${err.code})` : "";
      const msg = err?.message || String(err);
      let hint = "";
      if (err?.code === "permission-denied" || /permission/i.test(msg)) {
        hint = " — check that you're signed in with a @mastersunion.org account and that Firestore rules allow editors.";
      } else if (err?.code === "unavailable" || /offline|network/i.test(msg)) {
        hint = " — Firestore is unreachable. Check internet / Firebase console.";
      } else if (/firestore.*not.*enabled|database.*not.*found/i.test(msg)) {
        hint = " — Firestore database hasn't been created in the Firebase console yet.";
      }
      showError(`Create failed${code}: ${msg}${hint}`);
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

function escapeHTML(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function escapeAttr(s) {
  return escapeHTML(s).replaceAll("'", "&#039;");
}
