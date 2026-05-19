// Data layer: try Firestore first (with realtime sync), fall back to JSON files
// when Firestore isn't enabled or the project collection is empty.
import { db, storage } from "./init.js";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

const COL = {
  projects: "projects",
  planner: "plannerTasks",
  meta: "meta",
  team: "team",
};

let mode = "unknown"; // "firestore" | "fallback" | "unknown"

export function dataMode() {
  return mode;
}

async function fetchJson(path) {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

// --- READS -------------------------------------------------------------------

async function loadProjectsFromFirestore() {
  const snap = await getDocs(collection(db, COL.projects));
  if (snap.empty) return null;
  const projects = snap.docs.map((d) => d.data());
  projects.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  return projects;
}

async function loadMetaFromFirestore() {
  const ref = doc(db, COL.meta, "dataset");
  const snap = await getDocs(collection(db, COL.meta));
  const found = snap.docs.find((d) => d.id === "dataset");
  return found ? found.data() : null;
}

export async function loadDataset() {
  // Try Firestore first
  try {
    const [projects, meta] = await Promise.all([
      loadProjectsFromFirestore(),
      loadMetaFromFirestore(),
    ]);
    if (projects && projects.length) {
      mode = "firestore";
      return {
        metadata: meta || defaultMeta(projects),
        projects,
        risks: [],
      };
    }
  } catch (err) {
    console.warn("[data] Firestore unavailable, falling back to JSON.", err?.code || err?.message);
  }

  // Fallback to bundled JSON
  mode = "fallback";
  return fetchJson("./data/projects.json");
}

export async function loadPlanner() {
  // Try Firestore
  try {
    const snap = await getDocs(collection(db, COL.planner));
    if (!snap.empty) {
      const tasks = snap.docs.map((d) => d.data());
      return { tasks, source: "firestore" };
    }
  } catch (err) {
    console.warn("[data] Firestore planner unavailable, falling back to JSON.");
  }
  try {
    const json = await fetchJson("./data/weekly-tasks.json");
    return { ...json, source: "fallback" };
  } catch (err) {
    console.warn("[data] No weekly-tasks.json either.", err?.message);
    return { tasks: [], people: [], source: "empty" };
  }
}

export async function loadTeam() {
  try {
    const snap = await getDocs(collection(db, COL.team));
    if (snap.empty) {
      // Fallback to JSON team if Firestore team is empty
      const planner = await fetchJson("./data/weekly-tasks.json").catch(() => null);
      return planner?.metadata?.team || [];
    }
    return snap.docs.map((d) => d.data());
  } catch (err) {
    const planner = await fetchJson("./data/weekly-tasks.json").catch(() => null);
    return planner?.metadata?.team || [];
  }
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

// Upload a File/Blob to Firebase Storage; returns a public download URL.
// scope is a path prefix like "projects/P-05".
export async function uploadFile(file, scope = "uploads", { onProgress } = {}) {
  if (!file) throw new Error("file required");
  const safe = String(file.name || "file")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stamp = Date.now();
  const path = `${scope}/${stamp}-${safe}`;
  const ref = storageRef(storage, path);
  // simple upload; for big files use uploadBytesResumable
  onProgress?.(0);
  await uploadBytes(ref, file, { contentType: file.type || "application/octet-stream" });
  onProgress?.(1);
  const url = await getDownloadURL(ref);
  return { url, path, name: safe, size: file.size, type: file.type };
}

// --- MIGRATION ---------------------------------------------------------------

export async function pushAllToFirestore({ dataset, planner } = {}) {
  if (!dataset) dataset = await fetchJson("./data/projects.json");
  if (!planner) planner = await fetchJson("./data/weekly-tasks.json").catch(() => ({ tasks: [], people: [] }));

  const batch1 = writeBatch(db);
  (dataset.projects || []).forEach((p) => {
    if (!p.id) return;
    batch1.set(doc(db, COL.projects, p.id), { ...p, _updatedAt: serverTimestamp() });
  });
  await batch1.commit();

  if (dataset.metadata) {
    await setDoc(doc(db, COL.meta, "dataset"), { ...dataset.metadata, _updatedAt: serverTimestamp() });
  }

  if (planner?.tasks?.length) {
    const batch2 = writeBatch(db);
    planner.tasks.forEach((t) => {
      if (!t.id) return;
      batch2.set(doc(db, COL.planner, t.id), { ...t, _updatedAt: serverTimestamp() });
    });
    await batch2.commit();
  }

  if (planner?.people?.length) {
    const batch3 = writeBatch(db);
    planner.people.forEach((person) => {
      const id = person.id || person.email || person.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!id) return;
      batch3.set(doc(db, COL.team, id), { ...person, id, _updatedAt: serverTimestamp() });
    });
    await batch3.commit();
  }

  return {
    projects: (dataset.projects || []).length,
    plannerTasks: (planner?.tasks || []).length,
    teamMembers: (planner?.people || []).length,
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

// Expose migration to the browser console for one-time use:
//   window.MU.migrate()   -> pushes JSON files to Firestore
if (typeof window !== "undefined") {
  window.MU = Object.assign(window.MU || {}, {
    async migrate() {
      const result = await pushAllToFirestore();
      console.log("[migrate] done:", result);
      return result;
    },
    dataMode,
  });
}
