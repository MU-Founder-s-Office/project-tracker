// Inline editing layer.
// - Editor state controlled by a body.edit-mode class
// - Only visible/usable when the signed-in user passes isEditor()
// - Saves go through data-layer.saveProject() (Firestore)
// - Other devices see updates via realtime subscriptions in app.js
import { saveProject, deleteProject } from "./data-layer.js";
import { onUserChange, currentEditor } from "./auth-ui.js";

const STATUS_OPTIONS = ["Completed", "On Track", "At Risk", "Paused", "Not Started"];
const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3", "Done"];

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

  // Status badge in hero
  const heroBadges = panel.querySelector(".detail-hero .badge-row");
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

  // Delete button at the bottom of the panel
  const deleteWrap = document.createElement("div");
  deleteWrap.className = "detail-section detail-danger";
  deleteWrap.innerHTML = `
    <h3>Danger zone</h3>
    <button type="button" class="danger-btn" id="deleteProjectBtn">Delete ${project.id} (${project.project})</button>
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
