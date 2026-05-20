// Data layer: Firestore is the single source of truth.
// JSON files in /data are read only by pushAllToFirestore() (one-time migration).
import { db } from "./init.js";
import { supabase, SUPABASE_BUCKET } from "./supabase.js";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const COL = {
  projects: "projects",
  planner: "plannerTasks",
  meta: "meta",
  team: "team",
};

export function dataMode() {
  return "firestore";
}

async function fetchJson(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// --- READS -------------------------------------------------------------------

async function loadProjectsFromFirestore() {
  const snap = await getDocs(collection(db, COL.projects));
  const projects = snap.docs.map((d) => d.data());
  projects.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  return projects;
}

async function loadMetaFromFirestore() {
  const snap = await getDocs(collection(db, COL.meta));
  const found = snap.docs.find((d) => d.id === "dataset");
  return found ? found.data() : null;
}

export async function loadDataset() {
  const [projects, meta] = await Promise.all([
    loadProjectsFromFirestore(),
    loadMetaFromFirestore(),
  ]);
  return {
    metadata: meta || defaultMeta(projects),
    projects,
    risks: [],
  };
}

export async function loadPlanner() {
  const [taskSnap, metaSnap] = await Promise.all([
    getDocs(collection(db, COL.planner)),
    getDocs(collection(db, COL.meta)),
  ]);
  const tasks = taskSnap.docs.map((d) => d.data());
  const metaDoc = metaSnap.docs.find((d) => d.id === "planner");
  const metadata = metaDoc ? metaDoc.data() : {};
  return { tasks, metadata, source: "firestore" };
}

export async function loadTeam() {
  const snap = await getDocs(collection(db, COL.team));
  return snap.docs.map((d) => d.data());
}

export function subscribeTeam(onChange) {
  try {
    return onSnapshot(collection(db, COL.team), (snap) => {
      const team = snap.docs.map((d) => d.data());
      team.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      onChange(team);
    });
  } catch (err) {
    return () => {};
  }
}

// --- REALTIME ----------------------------------------------------------------

export function subscribeProjects(onChange) {
  try {
    return onSnapshot(collection(db, COL.projects), (snap) => {
      const projects = snap.docs.map((d) => d.data());
      projects.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
      onChange(projects);
    });
  } catch (err) {
    console.warn("[data] realtime projects unavailable");
    return () => {};
  }
}

export function subscribePlanner(onChange) {
  try {
    return onSnapshot(collection(db, COL.planner), (snap) => {
      onChange(snap.docs.map((d) => d.data()));
    });
  } catch (err) {
    return () => {};
  }
}

// --- WRITES ------------------------------------------------------------------

export async function saveProject(project) {
  if (!project?.id) throw new Error("project.id required");
  const ref = doc(db, COL.projects, project.id);
  await setDoc(ref, { ...project, _updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteProject(id) {
  await deleteDoc(doc(db, COL.projects, id));
}

export async function savePlannerTask(task) {
  if (!task?.id) throw new Error("task.id required");
  const ref = doc(db, COL.planner, task.id);
  await setDoc(ref, { ...task, _updatedAt: serverTimestamp() }, { merge: true });
}

// Used by the calendar sync so re-running doesn't overwrite user edits made
// to a previously-imported task. Returns { created: true } on first write,
// { created: false } if a task with that id already exists.
export async function createPlannerTaskIfMissing(task) {
  if (!task?.id) throw new Error("task.id required");
  const ref = doc(db, COL.planner, task.id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { created: false };
  await setDoc(ref, { ...task, _updatedAt: serverTimestamp() });
  return { created: true };
}

// Calendar-sync upsert: creates a planner task on first encounter, or merges
// attendees (and refreshes calendar-truth fields like title/time) on subsequent
// syncs by other team members. Returns { created: boolean, attendeeAdded: boolean }.
export async function upsertCalendarTask(task, syncedByTeamId) {
  if (!task?.id) throw new Error("task.id required");
  const allAttendees = [
    ...(syncedByTeamId ? [syncedByTeamId] : []),
    ...(Array.isArray(task.attendees) ? task.attendees : []),
  ].filter(Boolean);
  const uniqueAttendees = [...new Set(allAttendees)];
  const ref = doc(db, COL.planner, task.id);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      ...task,
      attendees: uniqueAttendees,
      ownerId: task.ownerId || syncedByTeamId || null,
      reviewerId: task.reviewerId || syncedByTeamId || null,
      _updatedAt: serverTimestamp(),
    });
    return { created: true, attendeeAdded: true };
  }

  // Existing doc: merge attendees (arrayUnion preserves order-free uniqueness),
  // and refresh only fields that the calendar is authoritative for. Leave
  // ownerId / status / projectId / notes alone so user edits survive.
  await setDoc(
    ref,
    {
      title: task.title,
      weekStart: task.weekStart,
      dueDate: task.dueDate,
      calendarHtmlLink: task.calendarHtmlLink || null,
      hoursEstimate: task.hoursEstimate ?? snap.data().hoursEstimate ?? 0,
      // Calendar is authoritative for actual worked time (past meetings logged).
      hoursActual: task.hoursActual ?? snap.data().hoursActual ?? 0,
      completedAt: task.completedAt ?? snap.data().completedAt ?? null,
      attendees: arrayUnion(...uniqueAttendees),
      source: "calendar",
      _updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  const existingAttendees = snap.data().attendees || [];
  const attendeeAdded = uniqueAttendees.some((a) => !existingAttendees.includes(a));
  return { created: false, attendeeAdded };
}

export async function deletePlannerTask(id) {
  await deleteDoc(doc(db, COL.planner, id));
}

export async function saveTeamMember(member) {
  if (!member?.id) throw new Error("member.id required");
  const ref = doc(db, COL.team, member.id);
  await setDoc(ref, { ...member, _updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteTeamMember(id) {
  await deleteDoc(doc(db, COL.team, id));
}

// --- STORAGE (file uploads) --------------------------------------------------

// Upload a File/Blob to Supabase Storage; returns a public URL.
// The URL is what we persist in Firestore (in the project's `links` array).
// scope is a path prefix like "projects/P-05".
export async function uploadFile(file, scope = "uploads", { onProgress } = {}) {
  if (!file) throw new Error("file required");
  const safe = String(file.name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = Date.now();
  const path = `${scope}/${stamp}-${safe}`;

  onProgress?.(0);
  const { error: uploadErr } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) {
    const err = new Error(uploadErr.message || "Supabase upload failed");
    err.code = uploadErr.statusCode || uploadErr.name || "supabase-upload-error";
    throw err;
  }
  onProgress?.(1);

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("Supabase did not return a public URL");
  return { url, path, name: safe, size: file.size, type: file.type };
}

// --- MIGRATION ---------------------------------------------------------------

export async function pushAllToFirestore({ dataset, planner } = {}) {
  if (!dataset) dataset = await fetchJson("./data/projects.json");
  if (!planner) planner = await fetchJson("./data/weekly-tasks.json").catch(() => ({ tasks: [] }));

  const batch1 = writeBatch(db);
  (dataset.projects || []).forEach((p) => {
    if (!p.id) return;
    batch1.set(doc(db, COL.projects, p.id), { ...p, _updatedAt: serverTimestamp() });
  });
  await batch1.commit();

  if (dataset.metadata) {
    await setDoc(doc(db, COL.meta, "dataset"), { ...dataset.metadata, _updatedAt: serverTimestamp() });
  }

  // Planner tasks
  if (planner?.tasks?.length) {
    const batch2 = writeBatch(db);
    planner.tasks.forEach((t) => {
      if (!t.id) return;
      batch2.set(doc(db, COL.planner, t.id), { ...t, _updatedAt: serverTimestamp() });
    });
    await batch2.commit();
  }

  // Planner metadata (currentWeekStart, workWeekDays, dailyHours, statuses, priorities)
  if (planner?.metadata) {
    const { team: _ignoredTeam, ...plannerMeta } = planner.metadata;
    await setDoc(doc(db, COL.meta, "planner"), { ...plannerMeta, _updatedAt: serverTimestamp() });
  }

  // Team members live in planner.metadata.team in the JSON; fall back to top-level `people`.
  const people = planner?.people?.length
    ? planner.people
    : planner?.metadata?.team || [];
  if (people.length) {
    const batch3 = writeBatch(db);
    people.forEach((person) => {
      const id = person.id || person.email || person.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!id) return;
      batch3.set(doc(db, COL.team, id), { ...person, id, _updatedAt: serverTimestamp() });
    });
    await batch3.commit();
  }

  return {
    projects: (dataset.projects || []).length,
    plannerTasks: (planner?.tasks || []).length,
    teamMembers: people.length,
  };
}

// --- HELPERS -----------------------------------------------------------------

function defaultMeta(projects) {
  return {
    sourceFile: "Firestore",
    generatedAt: new Date().toISOString(),
    projectCount: projects.length,
    workstreams: [...new Set(projects.map((p) => p.workstream).filter(Boolean))].sort(),
    statuses: [...new Set(projects.map((p) => p.status).filter(Boolean))].sort(),
    priorities: [...new Set(projects.map((p) => p.priority).filter(Boolean))].sort(),
  };
}

// Push only planner tasks + team (from /data JSON) to Firestore. Useful when
// projects already seeded but team/planner were missed by an earlier migration.
export async function seedPlannerAndTeam() {
  const planner = await fetchJson("./data/weekly-tasks.json");
  const out = { plannerTasks: 0, teamMembers: 0, plannerMeta: false };

  if (planner?.tasks?.length) {
    const batch = writeBatch(db);
    planner.tasks.forEach((t) => {
      if (!t.id) return;
      batch.set(doc(db, COL.planner, t.id), { ...t, _updatedAt: serverTimestamp() });
    });
    await batch.commit();
    out.plannerTasks = planner.tasks.length;
  }

  if (planner?.metadata) {
    const { team: _t, ...plannerMeta } = planner.metadata;
    await setDoc(doc(db, COL.meta, "planner"), { ...plannerMeta, _updatedAt: serverTimestamp() });
    out.plannerMeta = true;
  }

  const people = planner?.metadata?.team || planner?.people || [];
  if (people.length) {
    const batch = writeBatch(db);
    people.forEach((p) => {
      const id = p.id || p.email || p.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!id) return;
      batch.set(doc(db, COL.team, id), { ...p, id, _updatedAt: serverTimestamp() });
    });
    await batch.commit();
    out.teamMembers = people.length;
  }
  return out;
}

// Expose migration helpers to the browser console.
if (typeof window !== "undefined") {
  window.MU = Object.assign(window.MU || {}, {
    async migrate() {
      try {
        const result = await pushAllToFirestore();
        console.log("[migrate] done:", result);
        return result;
      } catch (err) {
        console.error("[migrate] FAILED", err?.code, err?.message, err);
        throw err;
      }
    },
    async seed() {
      try {
        const result = await seedPlannerAndTeam();
        console.log("[seed] planner+team done:", result);
        return result;
      } catch (err) {
        console.error("[seed] FAILED", err?.code, err?.message, err);
        throw err;
      }
    },
    async counts() {
      const [projects, planner, team, meta] = await Promise.all([
        getDocs(collection(db, COL.projects)),
        getDocs(collection(db, COL.planner)),
        getDocs(collection(db, COL.team)),
        getDocs(collection(db, COL.meta)),
      ]);
      const row = {
        projects: projects.size,
        plannerTasks: planner.size,
        teamMembers: team.size,
        metaDocs: meta.size,
      };
      console.table(row);
      return row;
    },
    dataMode,
  });
}
