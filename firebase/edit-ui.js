// Inline editing layer.
// - Editor state controlled by a body.edit-mode class
// - Only visible/usable when the signed-in user passes isEditor()
// - Saves go through data-layer.saveProject() (Firestore)
// - Other devices see updates via realtime subscriptions in app.js
import { saveProject, deleteProject, saveTeamMember, deleteTeamMember, uploadFile } from "./data-layer.js";
import { onUserChange, currentEditor } from "./auth-ui.js";
import { syncCalendar, createCalendarEvent } from "./calendar-sync.js";
import { createWeeklyReportDraft } from "./weekly-report.js";

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
      const actions = document.createElement("div");
      actions.className = "link-actions";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "link-add";
      addBtn.textContent = "+ Add link";
      addBtn.addEventListener("click", () => {
        links.push({ label: "", url: "" });
        renderRows();
      });
      actions.appendChild(addBtn);

      const uploadCtl = buildUploadButton(project, (nextLinks) => {
        // Rebuild the local list from the saved set so the row UI reflects the upload
        links.length = 0;
        nextLinks.forEach((l) => links.push(l));
        renderRows();
      });
      actions.appendChild(uploadCtl);

      list.appendChild(actions);
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

// ----- Team CRUD -------------------------------------------------------------

export function mountAddMemberButton(container) {
  if (!container || container.querySelector("#addMemberBtn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "addMemberBtn";
  btn.className = "edit-add-btn";
  btn.innerHTML = `<span>＋</span> Add member`;
  btn.hidden = !isEditModeOn();
  btn.addEventListener("click", openAddMemberModal);
  container.appendChild(btn);
  onEditModeChange((on) => { btn.hidden = !on; });
}

export function decorateMemberCard(card, member) {
  if (!isEditModeOn()) return;
  card.classList.add("is-editable");

  const nameEl = card.querySelector(".team-name");
  const roleEl = card.querySelector(".team-role");
  const emailEl = card.querySelector(".team-email");

  const replace = (oldEl, type, value, key) => {
    const input = document.createElement("input");
    input.type = type;
    input.value = value ?? "";
    input.className = "inline-edit-text team-edit-input";
    input.placeholder = key === "name" ? "Name" : key === "role" ? "Role" : "email@mastersunion.org";
    input.addEventListener("blur", async () => {
      const next = input.value.trim();
      if (next === (member[key] || "")) return;
      try {
        await saveTeamMember({ ...member, [key]: next });
      } catch (err) {
        alert(`Save failed: ${err?.message || err}`);
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    });
    oldEl.replaceWith(input);
  };

  if (nameEl) replace(nameEl, "text", member.name, "name");
  if (roleEl) replace(roleEl, "text", member.role, "role");
  if (emailEl) replace(emailEl, "email", member.email, "email");

  // Delete button
  const del = document.createElement("button");
  del.type = "button";
  del.className = "team-card-delete";
  del.title = "Delete member";
  del.innerHTML = "×";
  del.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${member.name || member.id} from the team?`)) return;
    try {
      await deleteTeamMember(member.id);
    } catch (err) {
      alert(`Delete failed: ${err?.message || err}`);
    }
  });
  card.appendChild(del);
}

function memberIdFrom(name, email) {
  if (email) return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return String(name || "member").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36).slice(-4);
}

function avatarFrom(name) {
  if (!name) return "??";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
}

function openAddMemberModal() {
  if (!isEditModeOn()) return;

  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.innerHTML = `
    <div class="edit-modal" role="dialog" aria-labelledby="addMemberTitle">
      <header>
        <h3 id="addMemberTitle">Add team member</h3>
        <button type="button" class="edit-modal-close" aria-label="Close">×</button>
      </header>
      <form class="edit-form" id="addMemberForm" novalidate>
        <label>
          <span>Full name</span>
          <input type="text" name="name" required autofocus />
        </label>
        <label>
          <span>Role</span>
          <input type="text" name="role" placeholder="e.g. Product Associate" />
        </label>
        <label>
          <span>Email</span>
          <input type="email" name="email" placeholder="firstname.lastname@mastersunion.org" />
        </label>
        <p class="edit-form-hint">Email is used to match the Google sign-in so this person can edit.</p>
        <p class="edit-form-error" id="addMemberErr" hidden></p>
        <footer>
          <button type="button" class="btn-secondary" data-act="cancel">Cancel</button>
          <button type="submit" class="btn-primary">Add member</button>
        </footer>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector(".edit-modal-close").addEventListener("click", close);
  overlay.querySelector('[data-act="cancel"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  const errEl = overlay.querySelector("#addMemberErr");
  const submitBtn = overlay.querySelector('button[type="submit"]');

  overlay.querySelector("#addMemberForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const fd = new FormData(e.target);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const role = String(fd.get("role") || "").trim();
    if (!name) {
      errEl.textContent = "Name is required.";
      errEl.hidden = false;
      return;
    }
    const member = {
      id: memberIdFrom(name, email),
      name,
      email,
      role,
      avatar: avatarFrom(name),
    };
    submitBtn.disabled = true;
    const orig = submitBtn.textContent;
    submitBtn.textContent = "Adding…";
    try {
      await saveTeamMember(member);
      close();
    } catch (err) {
      errEl.textContent = `Add failed: ${err?.code ? `(${err.code}) ` : ""}${err?.message || err}`;
      errEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = orig;
    }
  });
}

// ----- File upload (Storage) -------------------------------------------------

// Returns a button element wired to open the file picker, upload to Storage,
// and append the result to the project's links array.
export function buildUploadButton(project, onSaved) {
  const wrap = document.createElement("div");
  wrap.className = "link-upload";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "link-upload-btn";
  btn.innerHTML = `<span>↑</span> Upload file`;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt";
  input.style.display = "none";

  const status = document.createElement("span");
  status.className = "link-upload-status";

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    btn.disabled = true;
    status.textContent = `Uploading ${file.name}…`;
    try {
      const scope = `projects/${project.id || "misc"}`;
      const uploaded = await uploadFile(file, scope);
      const links = Array.isArray(project.links) ? [...project.links] : [];
      links.push({
        label: (file.name || uploaded.name).replace(/\.[a-z0-9]+$/i, ""),
        url: uploaded.url,
        fileName: file.name || uploaded.name,
        storagePath: uploaded.path,
        size: uploaded.size,
        contentType: uploaded.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentEditor()?.email || null,
        source: "supabase",
      });
      await saveProject({ ...project, links });
      status.textContent = "Uploaded ✓";
      setTimeout(() => (status.textContent = ""), 1500);
      onSaved?.(links);
    } catch (err) {
      console.error("[upload] failed", err);
      status.textContent = `Failed: ${err?.code || ""} ${err?.message || err}`;
      status.classList.add("err");
      setTimeout(() => { status.textContent = ""; status.classList.remove("err"); }, 5000);
    } finally {
      btn.disabled = false;
      input.value = "";
    }
  });

  wrap.appendChild(btn);
  wrap.appendChild(input);
  wrap.appendChild(status);
  return wrap;
}

// ----- Calendar sync + Weekly report toolbar buttons -------------------------

function makeToolbarBtn({ id, label, icon, title }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = id;
  btn.className = "edit-toolbar-btn";
  btn.title = title || label;
  btn.innerHTML = `<span aria-hidden="true">${icon}</span><span class="edit-toolbar-label">${label}</span>`;
  return btn;
}

export function mountScheduleTaskButton(container, getProjects, getTeam) {
  if (!container || container.querySelector("#scheduleTaskBtn")) return;
  const btn = makeToolbarBtn({
    id: "scheduleTaskBtn",
    label: "Schedule task",
    icon: "🗓",
    title: "Create a task as a Google Calendar event (optionally with teammates)",
  });
  btn.hidden = !currentEditor();
  btn.addEventListener("click", () => openScheduleTaskModal(getProjects, getTeam));
  container.appendChild(btn);
  onUserChange(() => { btn.hidden = !currentEditor(); });
}

function openScheduleTaskModal(getProjects, getTeam) {
  if (!currentEditor()) return;
  const projects = getProjects?.() || [];
  const team = getTeam?.() || [];

  // Default: today, next round hour, 1h long.
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const startHour = String(Math.min(now.getHours() + 1, 18)).padStart(2, "0");

  const overlay = document.createElement("div");
  overlay.className = "edit-modal-overlay";
  overlay.innerHTML = `
    <div class="edit-modal" role="dialog" aria-labelledby="schedTitle">
      <header>
        <h3 id="schedTitle">Schedule a task</h3>
        <button type="button" class="edit-modal-close" aria-label="Close">×</button>
      </header>
      <form class="edit-form" id="schedForm" novalidate>
        <label>
          <span>Task / meeting title</span>
          <input type="text" name="title" required autofocus placeholder="e.g. NPS dashboard review" />
        </label>
        <div class="edit-form-row">
          <label>
            <span>Date</span>
            <input type="date" name="date" value="${dateStr}" required />
          </label>
          <label>
            <span>Start</span>
            <input type="time" name="start" value="${startHour}:00" required />
          </label>
          <label>
            <span>Hours</span>
            <input type="number" name="hours" value="1" min="0.25" step="0.25" required />
          </label>
        </div>
        <label>
          <span>Project <em class="edit-form-hint">(optional)</em></span>
          <select name="projectId">
            <option value="">— None —</option>
            ${projects
              .map((p) => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.id)} · ${escapeAttr(p.project)}</option>`)
              .join("")}
          </select>
        </label>
        <fieldset class="sched-attendees">
          <legend>Attendees <em class="edit-form-hint">(invites teammates; shared across calendars)</em></legend>
          <div class="sched-attendee-grid">
            ${team
              .filter((m) => m.email)
              .map(
                (m) => `
              <label class="sched-attendee">
                <input type="checkbox" name="attendee" value="${escapeAttr(m.email)}" />
                <span>${escapeAttr(m.name)}</span>
              </label>`,
              )
              .join("")}
          </div>
        </fieldset>
        <p class="edit-form-error" id="schedErr" hidden></p>
        <footer>
          <button type="button" class="btn-secondary" data-act="cancel">Cancel</button>
          <button type="submit" class="btn-primary">Add to Google Calendar</button>
        </footer>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const errEl = overlay.querySelector("#schedErr");
  const submitBtn = overlay.querySelector('button[type="submit"]');
  const close = () => overlay.remove();
  overlay.querySelector(".edit-modal-close").addEventListener("click", close);
  overlay.querySelector('[data-act="cancel"]').addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("#schedForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const fd = new FormData(e.target);
    const title = String(fd.get("title") || "").trim();
    const date = fd.get("date");
    const start = fd.get("start");
    const hours = parseFloat(fd.get("hours")) || 1;
    const attendeeEmails = fd.getAll("attendee");

    if (!title) { errEl.textContent = "Title is required."; errEl.hidden = false; return; }
    if (!date || !start) { errEl.textContent = "Date and start time are required."; errEl.hidden = false; return; }

    // Build local-time ISO strings with the browser's UTC offset so Google
    // stores the wall-clock time the user picked.
    const startLocal = new Date(`${date}T${start}:00`);
    const endLocal = new Date(startLocal.getTime() + hours * 3600000);
    const toIso = (d) => {
      const off = -d.getTimezoneOffset();
      const sign = off >= 0 ? "+" : "-";
      const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
      return d.getFullYear() +
        "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
        "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00" +
        sign + pad(off / 60) + ":" + pad(off % 60);
    };

    submitBtn.disabled = true;
    const orig = submitBtn.textContent;
    submitBtn.textContent = "Scheduling…";
    try {
      await createCalendarEvent({
        summary: title,
        startISO: toIso(startLocal),
        endISO: toIso(endLocal),
        attendeeEmails,
        description: `Scheduled from Project Tracker.`,
      });
      // Pull it straight back in so it lands on the planner board + chart.
      await syncCalendar({ projects });
      window.dispatchEvent(new CustomEvent("mu:planner-refresh-requested"));
      close();
    } catch (err) {
      console.error("[schedule-task] failed", err);
      errEl.textContent = `Could not schedule: ${err?.message || err}`;
      errEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = orig;
    }
  });
}

export function mountCalendarSyncButton(container, getProjects) {
  if (!container || container.querySelector("#calSyncBtn")) return;
  const btn = makeToolbarBtn({
    id: "calSyncBtn",
    label: "Sync calendar",
    icon: "📅",
    title: "Pull Google Calendar events into the planner",
  });
  btn.hidden = !currentEditor();
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const orig = btn.querySelector(".edit-toolbar-label").textContent;
    btn.querySelector(".edit-toolbar-label").textContent = "Syncing…";
    try {
      const projects = getProjects?.() || [];
      const r = await syncCalendar({ projects });
      const msg = `Calendar sync done.\nFetched: ${r.fetched}\nNew tasks created: ${r.created}\nMatched to projects: ${r.matchedToProject}\nSkipped (already imported): ${r.skipped}\n\nSwitch to the Weekly Planner tab to see them.`;
      console.log("[calendar-sync]", r);
      // Pull fresh tasks + force planner re-render so newly-imported tasks
      // are immediately visible on the weekly board.
      window.dispatchEvent(new CustomEvent("mu:planner-refresh-requested"));
      alert(msg);
    } catch (err) {
      console.error("[calendar-sync] failed", err);
      alert(`Calendar sync failed: ${err?.message || err}`);
    } finally {
      btn.disabled = false;
      btn.querySelector(".edit-toolbar-label").textContent = orig;
    }
  });
  container.appendChild(btn);
  onUserChange((user) => { btn.hidden = !user || !currentEditor(); });
}

export function mountWeeklyReportButton(container, getProjects) {
  if (!container || container.querySelector("#weeklyReportBtn")) return;
  const btn = makeToolbarBtn({
    id: "weeklyReportBtn",
    label: "Weekly report",
    icon: "📊",
    title: "Generate this week's progress report as a Gmail draft",
  });
  btn.hidden = !currentEditor();
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const labelEl = btn.querySelector(".edit-toolbar-label");
    const orig = labelEl.textContent;
    labelEl.textContent = "Creating draft…";
    try {
      const projects = getProjects?.() || [];
      const r = await createWeeklyReportDraft({ projects, user: currentEditor() });
      console.log("[weekly-report] draft created", r);
      // Gmail opened in a new tab; show a quick confirmation in case the
      // popup got blocked.
      labelEl.textContent = "Draft created ✓";
      setTimeout(() => { labelEl.textContent = orig; }, 1800);
    } catch (err) {
      console.error("[weekly-report] failed", err);
      labelEl.textContent = orig;
      alert(`Could not create draft: ${err?.message || err}`);
    } finally {
      btn.disabled = false;
    }
  });
  container.appendChild(btn);
  onUserChange((user) => { btn.hidden = !user || !currentEditor(); });
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
