/* =====================================================================
   app.js  ·  Mi Turno  ·  núcleo, vistas y personalización
   (El reproductor de gym vive en gym.js, cargado después.)
===================================================================== */
"use strict";

/* ---------- Persistencia ---------- */
const store = (() => {
  let mem = {}, ok = true;
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); } catch (e) { ok = false; }
  return {
    get(k) { try { return ok ? localStorage.getItem(k) : mem[k]; } catch (e) { return mem[k]; } },
    set(k, v) { try { ok ? localStorage.setItem(k, v) : (mem[k] = v); } catch (e) { mem[k] = v; } try { if (typeof window !== "undefined" && window.__onWrite) window.__onWrite(k); } catch (e2) {} }
  };
})();

/* ---------- Config editable ---------- */
function loadCfg() {
  let c; try { c = JSON.parse(store.get("mt_cfg")); } catch (e) { c = null; }
  if (!c || !c.identities) c = JSON.parse(JSON.stringify(DEFAULT_CFG));
  c.settings = c.settings || {}; if (!c.settings.userName) c.settings.userName = DEFAULT_USER_NAME;
  if (!c.settings.mealView) c.settings.mealView = "menu";
  if (!c.settings.notif) c.settings.notif = JSON.parse(JSON.stringify(DEFAULT_CFG.settings.notif));
  c.identities = c.identities || []; c.habits = c.habits || []; c.commitments = c.commitments || [];
  c.metrics = c.metrics || [];
  if (!c.meals) c.meals = JSON.parse(JSON.stringify(DEFAULT_CFG.meals));
  c.meals.menu = c.meals.menu || [];
  c.meals.fichas = c.meals.fichas || JSON.parse(JSON.stringify(DEFAULT_CFG.meals.fichas));
  c.meals.fichas.categories = c.meals.fichas.categories || [];
  c.meals.fichas.catalog = c.meals.fichas.catalog || {};
  c.meals.fichas.innegociables = c.meals.fichas.innegociables || [];
  c.routines = c.routines || [];
  c.exercises = c.exercises || [];
  c.exDismissed = c.exDismissed || [];
  if (!c.activities) c.activities = JSON.parse(JSON.stringify(DEFAULT_CFG.activities));
  return c;
}
let CFG = loadCfg();
function saveCfg() { store.set("mt_cfg", JSON.stringify(CFG)); }
function getIdn(id) { return CFG.identities.find(i => i.id === id) || { id: null, label: "Sin meta", raw: "#8A8F9C", icon: "target", why: "", quotes: [] }; }
function getAct(id) { return CFG.activities.find(a => a.id === id) || { id: null, name: "Actividad", type: "class", icon: "dumbbell", color: "#8A8F9C" }; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

/* ---------- Íconos / texto ---------- */
function icon(name, extra) { return `<svg class="icon ${extra || ""}" viewBox="0 0 24 24"><path d="${ICONS[name] || ""}"/></svg>`; }
function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

/* ---------- Fechas ---------- */
function toKey(dt) { return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
function today() { return toKey(new Date()); }
function addDays(key, n) { const dt = new Date(key + "T00:00:00"); dt.setDate(dt.getDate() + n); return toKey(dt); }
function fmtDate(d) { return new Date(d + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }); }
function fmtShort(d) { return new Date(d + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function weekdayIdx(key) { return (new Date(key + "T00:00:00").getDay() + 6) % 7; }

/* ---------- Estado ---------- */
function loadLog() { try { return JSON.parse(store.get("mt_log") || "{}"); } catch (e) { return {}; } }
function saveLog() { store.set("mt_log", JSON.stringify(LOG)); }
function loadTasks() { try { return JSON.parse(store.get("mt_tasks") || "[]"); } catch (e) { return []; } }
function saveTasks() { store.set("mt_tasks", JSON.stringify(TASKS)); }
function loadWorkouts() { try { return JSON.parse(store.get("mt_workouts") || "[]"); } catch (e) { return []; } }
function saveWorkouts() { store.set("mt_workouts", JSON.stringify(WORKOUTS)); }
/* ---------- Negocio (clave `mt_biz`) ----------
   Almacén propio, aparte de CFG: son datos, no configuración. Los
   contenedores vacíos (leads, metrics, mvals, ideas, focus, reviews) existen
   desde ya para que la siguiente entrega agregue comportamiento sin migrar
   nada. Viene VACÍO a propósito: el repo es público. */
const DEFAULT_BIZ = { projects: [], leads: [], done: [], metrics: [], mvals: {}, ideas: [], focus: [], reviews: {} };
function loadBiz() {
  let b; try { b = JSON.parse(store.get("mt_biz")); } catch (e) { b = null; }
  if (!b || typeof b !== "object" || Array.isArray(b)) b = {};
  /* Tolerante a un objeto parcial: una instalación vieja, un respaldo de
     antes de esta versión o un JSON a medias no deben romper la sección. */
  const arr = k => { b[k] = Array.isArray(b[k]) ? b[k] : []; };
  const obj = k => { b[k] = (b[k] && typeof b[k] === "object" && !Array.isArray(b[k])) ? b[k] : {}; };
  ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(arr);
  ["mvals", "reviews"].forEach(obj);
  return b;
}
function saveBiz() { store.set("mt_biz", JSON.stringify(BIZ)); }

let LOG = loadLog(), TASKS = loadTasks(), WORKOUTS = loadWorkouts(), BIZ = loadBiz();
let VIEW = "hoy";
/* Vista a la que vuelve el engrane cuando ya estás dentro de Ajustes.
   Ajustes salió de la barra inferior: no gasta un lugar fijo por algo que
   se abre una vez por semana. */
let LASTVIEW = "hoy";
/* Día que se está viendo en Hoy. Arranca siempre en hoy y NO se persiste:
   abrir la app siempre te para en el día de hoy. Nunca apunta al futuro. */
let VDAY = today();
let PROG = store.get("mt_prog") || "semana"; // semana | mes | bitacora
let CALYM = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();
const COLLAPSE = { h_next: true, w_hist: false, w_rec: true, w_ex: true, w_rt: true, w_act: true, p_met: true };
const DEFAULT_HOY_ORDER = ["review", "hab", "com", "biz", "gym", "meal", "metric", "task", "next", "sleep", "mood", "journal"];
let HOY_ORDER = (() => {
  let o; try { o = JSON.parse(store.get("mt_hoyOrder")); } catch (e) { o = null; }
  if (!Array.isArray(o)) o = DEFAULT_HOY_ORDER.slice();
  o = o.filter(k => DEFAULT_HOY_ORDER.includes(k));
  DEFAULT_HOY_ORDER.forEach(k => { if (!o.includes(k)) o.push(k); });
  return o;
})();
function saveHoyOrder() { store.set("mt_hoyOrder", JSON.stringify(HOY_ORDER)); }

function day(d) {
  if (!LOG[d]) LOG[d] = {};
  const l = LOG[d];
  l.habits = l.habits || {}; l.commitments = l.commitments || {}; l.notes = l.notes || {};
  l.menuDone = l.menuDone || {}; l.fichas = l.fichas || {}; l.inneg = l.inneg || {}; l.metrics = l.metrics || {};
  if (l.sleep === undefined) l.sleep = null; if (l.mood === undefined) l.mood = null; if (l.journal === undefined) l.journal = "";
  return l;
}

/* ---------- Puntos ----------
   Las métricas NO suman puntos a propósito: son medición, no cumplimiento.
   Meterlas al puntaje distorsionaría el historial congelado. */
function mealWeight() { return CFG.meals.menu.length || CFG.meals.fichas.categories.length || 0; }
function mealScore(d) {
  const l = LOG[d]; if (!l) return 0;
  const M = CFG.meals;
  if (CFG.settings.mealView === "fichas") {
    const f = M.fichas; const tot = f.categories.reduce((a, c) => a + c.quota, 0);
    if (!tot) return 0;
    const don = f.categories.reduce((a, c) => a + Math.min((l.fichas && l.fichas[c.id]) || 0, c.quota), 0);
    return (don / tot) * mealWeight();
  }
  if (!M.menu.length) return 0;
  return M.menu.filter(m => l.menuDone && l.menuDone[m.id]).length / M.menu.length * mealWeight();
}
function maxPts() { return CFG.habits.length + CFG.commitments.length + mealWeight(); }
/* Puntaje crudo de un día a partir de sus propias marcas. Una sola
   definición de la fórmula: la usan pointsFor y recalcDay. */
function rawPoints(d) {
  const l = LOG[d]; if (!l) return 0;
  return Object.values(l.habits || {}).filter(Boolean).length
    + Object.values(l.commitments || {}).filter(Boolean).length + mealScore(d);
}
function pointsFor(d) {
  const l = LOG[d]; if (!l) return 0;
  if (l.frozen) return l.pts || 0; // día pasado: puntaje fijo, inmune a cambios de config
  return rawPoints(d);
}
/* Editar un día pasado a propósito SÍ debe mover su puntaje. El congelado
   existe para que un cambio de config no reescriba el historial, no para
   impedir una corrección. Recalcula SOLO pts, con la misma fórmula que
   pointsFor. En un día no congelado no hace nada: ahí pointsFor ya calcula
   en vivo. Quien llama es responsable de saveLog().

   OJO con `max`: es el denominador que regía ESE día, no el de hoy. Si se
   pisa con maxPts() y mientras tanto se borraron hábitos, el denominador
   encoge mientras las marcas viejas siguen en LOG[d].habits y el día pasa a
   leerse 3/2 = 150%. Por eso max solo puede CRECER, y nunca queda por
   debajo de los puntos del propio día. */
function recalcDay(d) {
  const l = LOG[d];
  if (!l || !l.frozen) return;
  l.pts = rawPoints(d);
  l.max = Math.max(l.max || maxPts(), l.pts);
}
/* Denominador de un día. Nunca por debajo de sus propios puntos: así ninguna
   vista puede pintar más de 100%, ni siquiera con historiales que ya quedaron
   torcidos por la versión anterior de recalcDay. */
function maxFor(d) {
  const l = LOG[d];
  const base = (l && l.frozen) ? (l.max || maxPts()) : maxPts();
  return Math.max(base, pointsFor(d));
}
/* Congela el puntaje de todos los días ya pasados usando la config actual.
   Se llama al abrir la app y antes de cualquier cambio que afecte el puntaje,
   para que el historial nunca se altere retroactivamente. */
function freezePastDays() {
  const t = today(); let changed = false;
  for (const k in LOG) {
    if (k < t && LOG[k] && !LOG[k].frozen) { LOG[k].pts = pointsFor(k); LOG[k].max = maxPts(); LOG[k].frozen = true; changed = true; }
  }
  if (changed) saveLog();
}
/* Racha de días consecutivos. kind: "commitments" (default) o "habits".
   Si hoy aún no está marcado, la racha se mide desde ayer: el día en curso
   no rompe nada hasta que termine. */
function streak(id, kind, asOf) {
  const K = kind || "commitments";
  let d = asOf || today();
  if (!(LOG[d] && LOG[d][K] && LOG[d][K][id])) d = addDays(d, -1);
  let s = 0;
  while (LOG[d] && LOG[d][K] && LOG[d][K][id] === true) { s++; d = addDays(d, -1); }
  return s;
}
/* Hábitos ordenados por hora (los que no tienen hora van al final).
   Así la lista de Hoy se lee como el día, de arriba abajo. */
function habitsSorted() {
  return CFG.habits.slice().sort((a, b) => {
    const ta = a.time || "", tb = b.time || "";
    if (ta && tb) return ta.localeCompare(tb);
    if (ta) return -1; if (tb) return 1;
    return 0;
  });
}

/* ========================= CATÁLOGO DE EJERCICIOS =========================
   Un ejercicio es un ID estable (`CFG.exercises[] = {id, name, aliases[]}`),
   NO su nombre. Antes se agregaba por el texto, así que "Press de pecho" y
   "Press pecho" partían el historial en dos y cada importación de rutina
   podía fragmentarlo más. Ahora el nombre es solo la etiqueta: se puede
   renombrar sin perder nada, y los nombres alternativos viven en `aliases`. */

/* Clave de comparación: sin acentos, sin mayúsculas, sin puntuación y con
   los espacios colapsados. Es lo que decide si dos textos son "el mismo
   nombre" al resolver o al importar. */
function exKey(s) {
  return (s == null ? "" : String(s))
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function exById(id) { return (CFG.exercises || []).find(x => x.id === id) || null; }
/* Resuelve un nombre contra el nombre canónico Y todos los alias. */
function exFind(name) {
  const k = exKey(name); if (!k) return null;
  return (CFG.exercises || []).find(x => exKey(x.name) === k || (x.aliases || []).some(a => exKey(a) === k)) || null;
}
function findOrCreateExercise(name) {
  const nm = (name == null ? "" : String(name)).trim() || "Ejercicio";
  const hit = exFind(nm);
  if (hit) return hit;
  const ex = { id: uid("ex"), name: nm, aliases: [] };
  CFG.exercises.push(ex);
  return ex;
}
function addAlias(ex, name) {
  const k = exKey(name);
  if (!ex || !k || k === exKey(ex.name)) return;
  ex.aliases = ex.aliases || [];
  if (!ex.aliases.some(a => exKey(a) === k)) ex.aliases.push(String(name).trim());
}
/* Acepta un id del catálogo o un nombre suelto (compatibilidad con llamadas viejas). */
function toExId(idOrName) {
  if (!idOrName) return null;
  if (exById(idOrName)) return idOrName;
  const e = exFind(idOrName);
  return e ? e.id : null;
}
/* El id de una serie. Las series nuevas lo traen; las heredadas se resuelven
   por nombre para que el historial viejo siga contando. */
function setExId(s) {
  if (!s) return null;
  if (s.exId) return s.exId;
  const e = exFind(s.exName);
  return e ? e.id : null;
}
function exName(id, fallback) { const e = exById(id); return e ? e.name : (fallback || "Ejercicio"); }

/* ---------- Migración (idempotente, solo agrega) ----------
   Construye el catálogo a partir de las rutinas Y de todo el historial, y
   rellena `exId`. NUNCA borra `exName`, ni reescribe una serie, ni tira un
   entreno: correrla dos veces no cambia nada la segunda vez. */
function migrateExercises() {
  CFG.exercises = CFG.exercises || [];
  CFG.exDismissed = CFG.exDismissed || [];
  let cfgDirty = false, wDirty = false;
  (CFG.routines || []).forEach(r => (r.exercises || []).forEach(e => {
    if (e.exId && exById(e.exId)) return;
    e.exId = findOrCreateExercise(e.name).id;
    cfgDirty = true;
  }));
  (WORKOUTS || []).forEach(w => (w.sets || []).forEach(s => {
    if (s.exId && exById(s.exId)) return;
    s.exId = findOrCreateExercise(s.exName).id;   // exName se conserva intacto
    wDirty = true; cfgDirty = true;
  }));
  if (cfgDirty) saveCfg();
  if (wDirty) saveWorkouts();
  return { entries: CFG.exercises.length, cfgDirty, wDirty };
}

/* ---------- Analítica de workouts (agrega por exId) ---------- */
function lastPerf(idOrName) {
  const id = toExId(idOrName); if (!id) return null;
  for (let i = WORKOUTS.length - 1; i >= 0; i--) {
    const w = WORKOUTS[i]; if (!w.sets) continue;
    const hit = w.sets.filter(s => setExId(s) === id && (s.weight || s.reps));
    if (hit.length) { const s = hit[hit.length - 1]; return { weight: s.weight, reps: s.reps, date: w.date }; }
  }
  return null;
}
function exercisePR(idOrName) {
  const id = toExId(idOrName); if (!id) return null;
  let best = null;
  WORKOUTS.forEach(w => (w.sets || []).forEach(s => {
    if (setExId(s) !== id) return;
    const wt = parseFloat(s.weight); if (isNaN(wt)) return;
    if (!best || wt > best.weight) best = { weight: wt, reps: s.reps, date: w.date };
  }));
  return best;
}
/* Entradas del catálogo con al menos una serie con peso registrado. */
function allLoggedExercises() {
  const ids = {};
  WORKOUTS.forEach(w => (w.sets || []).forEach(s => {
    if (!s.weight || isNaN(parseFloat(s.weight))) return;
    const id = setExId(s); if (id) ids[id] = true;
  }));
  return (CFG.exercises || []).filter(e => ids[e.id]);
}
/* Todas las series de un ejercicio, agrupadas por sesión, más reciente primero. */
function exSessions(id) {
  const out = [];
  WORKOUTS.forEach(w => {
    const hit = (w.sets || []).filter(s => setExId(s) === id);
    if (hit.length) out.push({ w, sets: hit });
  });
  return out.sort((a, b) => b.w.date.localeCompare(a.w.date));
}
/* Mejor peso por sesión, en orden cronológico: la línea de progresión. */
function exProgress(id) {
  return exSessions(id).slice().reverse().map(g => {
    let best = null;
    g.sets.forEach(s => { const v = parseFloat(s.weight); if (!isNaN(v) && (best === null || v > best)) best = v; });
    return { date: g.w.date, weight: best };
  }).filter(p => p.weight !== null);
}

/* ---------- Detección de posibles duplicados ----------
   Deliberadamente conservadora: NUNCA fusiona sola, solo propone, y prefiere
   callarse antes que llenar la pantalla de pares que no son. Dos señales, y
   basta con que una dispare:
     1. Solape de tokens (Jaccard >= 0.7) sobre las palabras normalizadas, sin
        conectores ("de", "la", "con"...) y con el plural recortado. Atrapa
        "Press de pecho" == "Press pecho", "Curl bíceps" == "Curl de bíceps"
        y "Sentadilla" == "Sentadillas", incluso con las palabras en otro
        orden.
     2. Errata: mismo número de palabras y, alineadas una a una, a lo más UN
        carácter de diferencia en total ("Press banca" vs "Press banka").

   Lo que NO se usa: distancia de edición sobre la cadena completa. Sobre
   nombres largos es engañosa — "Enfriamiento · Estiramientos (PUSH)" y
   "... (PULL)" se parecen en un 94% carácter a carácter y son ejercicios
   distintos. La señal buena ahí es la palabra que cambia, no el porcentaje:
   por tokens dan 0.5 y quedan fuera. Mismo caso con "Remo en máquina
   (apoyado)" vs "... pesado" y con "Activación de pierna" vs "de cadera". */
const EX_STOP = ["de", "del", "la", "el", "los", "las", "con", "en", "a", "y", "para", "por"];
function exTokens(name) {
  return exKey(name).split(" ").filter(t => t && EX_STOP.indexOf(t) < 0).map(t => {
    if (t.length > 5 && /es$/.test(t)) return t.slice(0, -2);
    if (t.length > 4 && /s$/.test(t)) return t.slice(0, -1);
    return t;
  });
}
function jaccard(a, b) {
  const A = a.filter((v, i) => a.indexOf(v) === i), B = b.filter((v, i) => b.indexOf(v) === i);
  if (!A.length || !B.length) return 0;
  const inter = A.filter(t => B.indexOf(t) >= 0).length;
  return inter / (A.length + B.length - inter);
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = []; for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
function levSim(a, b) {
  const m = Math.max(a.length, b.length);
  return m ? 1 - levenshtein(a, b) / m : 0;
}
/* Señal 2: misma cantidad de palabras y, alineadas por posición, a lo más un
   carácter de diferencia en total. Es la errata de dedo, no el ejercicio
   distinto: "push" vs "pull" son 2 y quedan fuera. */
function typoClose(a, b) {
  const A = exTokens(a), B = exTokens(b);
  if (!A.length || A.length !== B.length) return false;
  let d = 0;
  for (let i = 0; i < A.length; i++) {
    d += levenshtein(A[i], B[i]);
    if (d > 1) return false;
  }
  return true;
}
/* Puntaje entre dos entradas: el mejor entre todas sus combinaciones de
   nombre y alias, para que un alias también delate el duplicado. */
function exSimilarity(a, b) {
  const na = [a.name].concat(a.aliases || []), nb = [b.name].concat(b.aliases || []);
  let best = 0;
  na.forEach(x => nb.forEach(y => {
    const j = jaccard(exTokens(x), exTokens(y));
    let sc = 0;
    if (j >= 0.7) sc = j;
    else if (typoClose(x, y)) sc = Math.max(0.85, levSim(exKey(x), exKey(y)));
    if (sc > best) best = sc;
  }));
  return best;
}
function dupPairKey(a, b) { return [a, b].sort().join("|"); }
function dupCandidates() {
  const ex = CFG.exercises || [], out = [], skip = CFG.exDismissed || [];
  for (let i = 0; i < ex.length; i++) {
    for (let j = i + 1; j < ex.length; j++) {
      if (skip.indexOf(dupPairKey(ex[i].id, ex[j].id)) >= 0) continue;
      const sc = exSimilarity(ex[i], ex[j]);
      if (sc > 0) out.push({ a: ex[i], b: ex[j], score: sc });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

/* ---------- Fusionar y renombrar ----------
   Fusionar no borra historial: el nombre perdedor sobrevive como alias y
   todas sus series y rutinas pasan al id que se queda. */
function mergeExercises(keepId, dropId) {
  const keep = exById(keepId), drop = exById(dropId);
  if (!keep || !drop || keep.id === drop.id) return false;
  addAlias(keep, drop.name);
  (drop.aliases || []).forEach(a => addAlias(keep, a));
  WORKOUTS.forEach(w => (w.sets || []).forEach(s => { if (s.exId === drop.id) s.exId = keep.id; }));
  (CFG.routines || []).forEach(r => (r.exercises || []).forEach(e => { if (e.exId === drop.id) e.exId = keep.id; }));
  CFG.exercises = CFG.exercises.filter(x => x.id !== drop.id);
  CFG.exDismissed = (CFG.exDismissed || []).filter(k => k.indexOf(drop.id) < 0);
  saveCfg(); saveWorkouts();
  return true;
}
/* Renombrar NO toca el historial: se agrega por id, no por texto. El nombre
   viejo queda como alias para que una importación con el nombre anterior
   siga cayendo en el mismo ejercicio. */
function renameExercise(id, newName, keepOld) {
  const ex = exById(id); if (!ex) return false;
  const nm = (newName == null ? "" : String(newName)).trim();
  if (!nm) return false;
  const clash = exFind(nm);
  if (clash && clash.id !== id) return "clash";
  /* Primero se renombra y DESPUÉS se guarda el alias: addAlias ignora un
     nombre igual al canónico, así que hacerlo al revés perdía el viejo. */
  const prev = ex.name;
  ex.name = nm;
  if (keepOld !== false) addAlias(ex, prev);
  saveCfg();
  return true;
}
function delExerciseAlias(id, alias) {
  const ex = exById(id); if (!ex) return;
  ex.aliases = (ex.aliases || []).filter(a => a !== alias);
  saveCfg();
}
function workoutsInRange(from, to) { return WORKOUTS.filter(w => w.date >= from && w.date <= to); }
function hasWorkout(d) { return WORKOUTS.some(w => w.date === d); }

/* ---------- Render ---------- */
const app = document.getElementById("app");
function render() {
  ({ hoy: renderHoy, progreso: renderProgreso, workouts: renderWorkouts, negocio: renderNegocio, metas: renderMetas, ajustes: renderAjustes }[VIEW] || renderHoy)();
}
function header(title, sub, dayKey) {
  const d = dayKey || today();
  /* Solo Hoy pasa dayKey, así que el modo "día pasado" no toca a las demás vistas. */
  const past = !!dayKey && dayKey !== today();
  const pct = Math.round(pointsFor(d) / (maxFor(d) || 1) * 100) || 0;
  const c = 2 * Math.PI * 26;
  /* El engrane vive en el header, no en la barra: está en todas las vistas.
     Dentro de Ajustes el mismo control se vuelve una X que regresa a donde
     estabas. Convive con el anillo y con el estado de día pasado de Hoy. */
  const inAj = VIEW === "ajustes";
  const gear = `<button class="hd-gear${inAj ? " on" : ""}" onclick="openAjustes()" aria-label="${inAj ? "Cerrar ajustes" : "Ajustes"}">${icon(inAj ? "close" : "sliders")}</button>`;
  return `<div class="hd"><div><div class="greet">${sub || ("Hola, " + esc(CFG.settings.userName))}</div><div class="date${past ? " past" : ""}">${title}</div>${past ? `<button class="chip todaychip" onclick="goToday()">${icon("chevright")}Hoy</button>` : ""}</div>
    <div class="hd-r">${gear}
    <div class="ring"><svg width="62" height="62"><circle cx="31" cy="31" r="26" stroke="var(--line)" stroke-width="6" fill="none"/>
      <circle cx="31" cy="31" r="26" stroke="var(--ok)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg>
      <div class="val">${pct}%</div></div></div></div>`;
}
function sec(id, title, meta, body, iconName, iconColor) {
  const ic = iconName ? `<span style="color:${iconColor || "var(--muted)"};display:flex">${icon(iconName)}</span>` : "";
  return `<div class="sec ${COLLAPSE[id] ? "collapsed" : ""}"><div class="sec-h" onclick="toggleSec('${id}')"><div class="t">${ic}${title}</div>
      <div class="meta">${meta || ""}<span class="chev">${icon("chevron")}</span></div></div><div class="sec-b">${body}</div></div>`;
}

/* ========================= HOY ========================= */
function habitRow(h, d) {
  const l = day(d), done = !!l.habits[h.id], idn = getIdn(h.idn), note = l.notes[h.id];
  const s = (d === today()) ? streak(h.id, "habits") : 0;
  const sub = `${h.time ? `<span class="hhm">${esc(h.time)}</span>` : ""}<span style="color:${idn.raw}">${esc(idn.label)}</span>`;
  return `<div class="row ${done ? "done" : ""}"><div class="mark" style="${done ? `background:${idn.raw};border-color:${idn.raw}` : ""}" onclick="toggleHabit('${d}','${h.id}')">${icon("check")}</div>
    <div class="body" onclick="toggleHabit('${d}','${h.id}')"><div class="name">${esc(h.name)}</div><div class="sub">${sub}</div></div>
    ${s >= 2 ? `<span class="streak hot mini">${icon("flame")}${s}</span>` : ""}
    <button class="note-btn ${note ? "has" : ""}" onclick="openNote('${d}','${h.id}')">${icon(note ? "edit" : "plus")}</button></div>`;
}
function commitmentRow(c, d) {
  const l = day(d), done = !!l.commitments[c.id], idn = getIdn(c.idn), s = streak(c.id, "commitments", d);
  return `<div class="row ${done ? "done" : ""}"><div class="mark" style="${done ? "background:var(--ok);border-color:var(--ok)" : ""}" onclick="toggleCommit('${d}','${c.id}')">${icon("check")}</div>
    <div class="body" onclick="toggleCommit('${d}','${c.id}')"><div class="name">${esc(c.name)}</div><div class="sub"><span style="color:${idn.raw}">${esc(idn.label)}</span></div></div>
    <span class="streak ${s > 0 ? "hot" : "zero"}">${icon("flame")}${s}</span></div>`;
}
function taskRow(t) {
  const idn = t.idn ? getIdn(t.idn) : null;
  return `<div class="row ${t.done ? "done" : ""}"><div class="mark" style="${t.done ? "background:var(--text);border-color:var(--text)" : ""}" onclick="toggleTask('${t.id}')">${icon("check")}</div>
    <div class="body" onclick="toggleTask('${t.id}')"><div class="name">${esc(t.text)}</div>
      ${t.time || idn ? `<div class="sub">${t.time ? esc(t.time) : ""}${idn ? `<span style="color:${idn.raw}">${esc(idn.label)}</span>` : ""}</div>` : ""}</div>
    <button class="note-btn" onclick="delTask('${t.id}')">${icon("trash")}</button></div>`;
}
function moodColor(n) { return n <= 3 ? "#EF4444" : n <= 6 ? "#F59E0B" : "#22C55E"; }

/* ---------- Navegación de día ----------
   El día se cambia DESLIZANDO sobre el contenido de Hoy (el gesto vive en
   reorder.js, junto al resto de gestos de la pestaña). La fecha aparece una
   sola vez, en el header: si no es hoy va teñida y con un chip "Hoy".
   El futuro no se navega: no se registra lo que todavía no pasó. */
function viewDay() { const t = today(); if (!VDAY || VDAY > t) VDAY = t; return VDAY; }
function setVDay(d) { const t = today(); VDAY = (!d || d > t) ? t : d; }
function goDay(n) {
  const from = viewDay();
  setVDay(addDays(from, n));
  if (VDAY === from) return bounceHoy();   // topó en hoy: rebote, no redibujo
  render(); slideHoy(n);
}
function goToday() { if (viewDay() === today()) return; VDAY = today(); render(); slideHoy(1); }
/* Desde el calendario / la bitácora: pararse en ese día y saltar a Hoy. */
function editDay(ds) { setVDay(ds); VIEW = "hoy"; closeModal(); buildNav(); render(); }
/* Un deslizamiento corto para que el cambio de día se lea como movimiento y
   no como un redibujo. n < 0 = día anterior: entra por la izquierda. */
function slideHoy(n) {
  const el = document.getElementById("hoylist"); if (!el) return;
  const cls = n < 0 ? "slide-prev" : "slide-next";
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 260);
}
/* Rebote al topar en hoy: que se sienta intencional, no roto. */
function bounceHoy() {
  const el = document.getElementById("hoylist"); if (!el) return;
  el.classList.remove("bounce-end");
  void el.offsetWidth;                     // reinicia la animación
  el.classList.add("bounce-end");
  setTimeout(() => el.classList.remove("bounce-end"), 300);
}
/* Pista de "desliza", una sola vez por dispositivo. Se apaga con el primer
   swipe. `mt_swipeHint` es preferencia local: NO va en BACKUP_KEYS. */
function swipeHintPending() { return !store.get("mt_swipeHint"); }
function dismissSwipeHint() { if (swipeHintPending()) store.set("mt_swipeHint", "1"); }

function renderHoy() {
  const d = viewDay(), isT = d === today(), l = day(d), B = {};
  const doneH = CFG.habits.filter(x => l.habits[x.id]).length;
  B.hab = sec("h_hab", isT ? "Hábitos de hoy" : "Hábitos del día", `${doneH}/${CFG.habits.length}`,
    (CFG.habits.length ? habitsSorted().map(x => habitRow(x, d)).join("") : `<div class="empty">Aún no tienes hábitos</div>`)
    + `<button class="addbtn" onclick="openEditHabit()">${icon("plus")} Agregar hábito</button>`, "check", "var(--ok)");
  B.review = reviewSection(d);
  B.metric = metricsSection(d);
  const doneC = CFG.commitments.filter(x => l.commitments[x.id]).length;
  B.com = sec("h_com", "Compromisos", `${doneC}/${CFG.commitments.length}`,
    `<div class="empty" style="padding:6px 6px 10px;text-align:left">${isT ? "Marca lo que hoy lograste NO hacer. Cada día limpio suma a tu racha." : "Marca lo que ese día lograste NO hacer."}</div>`
    + CFG.commitments.map(x => commitmentRow(x, d)).join("")
    + `<button class="addbtn" onclick="openEditCommit()">${icon("plus")} Agregar compromiso</button>`, "flame", "var(--ok)");
  B.biz = bizSection(d);
  B.gym = gymCardHoy(d);
  B.meal = mealsSection(d);
  const tt = TASKS.filter(t => t.date === d);
  B.task = sec("h_task", isT ? "Tareas de hoy" : "Tareas del día", `${tt.filter(t => t.done).length}/${tt.length}`,
    (tt.length ? tt.map(taskRow).join("") : `<div class="empty">${isT ? "Sin tareas para hoy" : "Sin tareas ese día"}</div>`)
    + `<button class="addbtn" onclick="openTask('${d}')">${icon("plus")} Agregar tarea</button>`, "clock", "var(--muted)");
  /* "Próximas" solo tiene sentido parado en hoy: mirando el pasado, lo que
     viene después ya no es "próximo", es historia o es hoy. */
  if (isT) {
    const up = TASKS.filter(t => t.date > d && t.date <= addDays(d, 30) && !t.done).sort((a, b) => a.date.localeCompare(b.date));
    if (up.length) B.next = sec("h_next", "Próximas", String(up.length),
      up.slice(0, 8).map(t => `<div class="row"><span class="datechip">${fmtShort(t.date)}</span><div class="body"><div class="name">${esc(t.text)}${t.time ? ` <span style="color:var(--muted2)">· ${esc(t.time)}</span>` : ""}</div></div></div>`).join("")
      + `<button class="addbtn" onclick="VIEW='progreso';PROG='mes';buildNav();render()">${icon("calendar")} Ver calendario</button>`, "calendar", "var(--muted)");
  }
  B.sleep = sec("h_sleep", "Sueño", l.sleep || "—",
    `<div class="chips">${SLEEP_RANGES.map(s => `<div class="chip ${l.sleep === s ? "on" : ""}" style="${l.sleep === s ? "background:var(--ciber);border-color:var(--ciber)" : ""}" onclick="setSleep('${d}','${s}')">${s}</div>`).join("")}</div>`, "moon", "var(--ciber)");
  B.mood = sec("h_mood", isT ? "¿Cómo me sentí hoy?" : "¿Cómo me sentí?", l.mood ? `${l.mood}/10` : "—",
    `<div class="mood">${[1,2,3,4,5,6,7,8,9,10].map(n => `<b class="${l.mood === n ? "on" : ""}" style="${l.mood === n ? `background:${moodColor(n)}` : ""}" onclick="setMood('${d}',${n})">${n}</b>`).join("")}</div>`, "productividad", "var(--productividad)");
  B.journal = sec("h_journal", "Bitácora del día", l.journal ? "Escrita" : "",
    `<textarea placeholder="${isT ? "Escribe cómo te fue hoy... (opcional)" : "Escribe cómo te fue ese día... (opcional)"}" onchange="setJournal('${d}',this.value)">${esc(l.journal)}</textarea>`, "book", "var(--lectura)");
  const list = HOY_ORDER.filter(k => B[k]).map(k => `<div class="dsec" data-key="${k}">${B[k]}</div>`).join("");
  const hint = swipeHintPending()
    ? `<div class="swipehint">${icon("chevleft")}Desliza para ver otro día${icon("chevright")}</div>` : "";
  app.innerHTML = header(cap(fmtDate(d)), isT ? null : "Estás editando otro día", d)
    + hint + `<div class="hoylist" id="hoylist">${list}</div>`;
  if (typeof initReorderHoy === "function") initReorderHoy();
}

/* ---------- Tarjeta de Workouts en Hoy ---------- */
function todayRoutine() {
  const ov = safeJSON(store.get("mt_todayRoutine"));
  if (ov && ov.date === today()) { const r = CFG.routines.find(x => x.id === ov.routineId); if (r) return r; }
  const wd = WEEKDAYS[weekdayIdx(today())];
  return CFG.routines.find(r => (r.days || []).includes(wd)) || null;
}
function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function gymCardHoy(d) {
  /* Día pasado: solo lectura. No se "inicia" una rutina de ayer; lo único
     que tiene sentido es ver lo que sí se registró. */
  if (d !== today()) {
    const past = WORKOUTS.filter(w => w.date === d);
    if (!past.length) return sec("h_gym", "Workouts", "—",
      `<div class="empty" style="padding:6px 6px 10px;text-align:left">Ese día no registraste entrenamiento.</div>`, "dumbbell", "var(--cuerpo)");
    const body = past.map(w => {
      const a = getAct(w.activityId);
      return `<div class="row"><span class="idi" style="background:${a.color}22;color:${a.color}">${icon(a.icon)}</span>
        <div class="body" onclick="openWorkoutDetail('${w.id}')"><div class="name">${esc(w.name)}</div><div class="sub">${workoutSummary(w)}</div></div></div>`;
    }).join("");
    return sec("h_gym", "Workouts", String(past.length), body, "dumbbell", "var(--cuerpo)");
  }
  const act = getActiveWorkout();
  if (act) {
    const r = CFG.routines.find(x => x.id === act.rid), n = r ? r.exercises.length : 0;
    const body = `<div class="gymrow"><div><div class="name">En curso · ${esc(r ? r.name : "Entreno")}</div><div class="sub">Ejercicio ${act.ei + 1}/${n} · serie ${act.si}</div></div>
      <button class="startbtn" onclick="resumeWorkout()">${icon("play")} Reanudar</button></div>
      <div class="gymlinks"><button onclick="openActiveOptions()">Opciones del entreno</button></div>`;
    return sec("h_gym", "Workouts", "En curso", body, "dumbbell", "var(--cuerpo)");
  }
  const doneT = WORKOUTS.filter(w => w.date === d);
  const r = todayRoutine();
  if (doneT.length) {
    const vol = doneT.reduce((a, w) => a + (w.volume || 0), 0);
    let body = `<div class="gymrow"><div><div class="name" style="color:var(--ok)">Ya entrenaste hoy</div><div class="sub">${esc(doneT.map(w => w.name).join(", "))}${vol ? " · " + Math.round(vol) + " " + ((CFG.settings && CFG.settings.unit) || "kg") + " vol" : ""}</div></div><span style="color:var(--ok);display:flex">${icon("check")}</span></div>`;
    if (r && !doneT.some(w => w.routineId === r.id)) body += `<div class="gymlinks"><button onclick="startWorkout('${r.id}')">${icon("play")} Iniciar ${esc(r.name)}</button></div>`;
    return sec("h_gym", "Workouts", `${doneT.length} hoy`, body, "dumbbell", "var(--cuerpo)");
  }
  if (r) {
    const body = `<div class="gymrow"><div><div class="name">${esc(r.name)}</div><div class="sub">${r.exercises.length} ejercicios · fuerza</div></div>
      <button class="startbtn" onclick="startWorkout('${r.id}')">${icon("play")} Iniciar</button></div>`;
    return sec("h_gym", "Workouts", "Hoy toca", body, "dumbbell", "var(--cuerpo)");
  }
  const classes = CFG.activities.filter(a => a.type === "class");
  const body = `<div class="empty" style="padding:6px 6px 10px;text-align:left">Hoy no tienes rutina de fuerza. Registra otra actividad o descansa.</div>
    <div class="gymlinks">${classes.length ? classes.map(a => `<button style="border-color:${a.color}44" onclick="openLogSession('${a.id}')">${esc(a.name)}</button>`).join("") : `<button onclick="VIEW='workouts';buildNav();render()">Ir a Workouts</button>`}</div>`;
  return sec("h_gym", "Workouts", "Descanso", body, "dumbbell", "var(--cuerpo)");
}

/* ========================= COMIDAS ========================= */
function setMealView(v) { freezePastDays(); CFG.settings.mealView = v; saveCfg(); render(); }
function mealsSection(d) {
  const view = CFG.settings.mealView;
  const body = view === "menu" ? mealsMenu(d) : mealsFichas(d);
  const frac = mealWeight() ? mealScore(d) / mealWeight() : 0;
  return sec("h_meal", "Comidas", `${Math.round(frac * 100)}%`, body, "meal", "var(--cuerpo)");
}
function mealsMenu(d) {
  const l = day(d);
  return (CFG.meals.menu.length ? CFG.meals.menu.map(m => {
    const on = !!l.menuDone[m.id];
    return `<div class="row ${on ? "done" : ""}"><div class="mark" style="${on ? "background:var(--cuerpo);border-color:var(--cuerpo)" : ""}" onclick="toggleMenu('${d}','${m.id}')">${icon("check")}</div>
      <div class="body" onclick="toggleMenu('${d}','${m.id}')"><div class="name">${esc(m.name)}</div>${m.desc ? `<div class="sub">${esc(m.desc)}</div>` : ""}</div></div>`;
  }).join("") : `<div class="empty">Configura tus comidas en Ajustes</div>`)
    + `<button class="addbtn" onclick="VIEW='ajustes';buildNav();render()">${icon("sliders")} Configurar comidas</button>`;
}
function mealsFichas(d) {
  const l = day(d), f = CFG.meals.fichas; let out = "";
  if (!f.categories.length) out = `<div class="empty">Configura tus fichas en Ajustes</div>`;
  f.categories.forEach(c => {
    const cnt = l.fichas[c.id] || 0; let pills = "";
    for (let i = 0; i < c.quota; i++) pills += `<span class="ficha ${i < cnt ? "on" : ""}" style="${i < cnt ? `background:${c.color};border-color:${c.color}` : ""}" onclick="setFicha('${d}','${c.id}',${i + 1})"></span>`;
    out += `<div class="ficat"><div class="ficat-h"><span class="fname" style="color:${c.color}">${esc(c.name)}</span><span class="fcount">${cnt}/${c.quota}</span></div>
      <div class="fichas">${pills}</div><button class="reflink" onclick="openCatalog('${c.id}')">ver opciones</button></div>`;
  });
  if (f.innegociables.length) {
    out += `<div class="subhead2">Innegociables</div>` + f.innegociables.map(n => {
      const on = !!l.inneg[n.id];
      return `<div class="row ${on ? "done" : ""}"><div class="mark" style="${on ? "background:var(--ok);border-color:var(--ok)" : ""}" onclick="toggleInneg('${d}','${n.id}')">${icon("check")}</div><div class="body" onclick="toggleInneg('${d}','${n.id}')"><div class="name">${esc(n.name)}</div></div></div>`;
    }).join("");
  }
  return out + `<button class="addbtn" onclick="VIEW='ajustes';buildNav();render()">${icon("sliders")} Configurar fichas</button>`;
}
function toggleMenu(d, id) { const l = day(d); l.menuDone[id] = !l.menuDone[id]; recalcDay(d); saveLog(); render(); }
function setFicha(d, cid, n) { const l = day(d); const cur = l.fichas[cid] || 0; l.fichas[cid] = (cur >= n) ? n - 1 : n; recalcDay(d); saveLog(); render(); }
function toggleInneg(d, id) { const l = day(d); l.inneg[id] = !l.inneg[id]; recalcDay(d); saveLog(); render(); }
function openCatalog(cid) {
  const c = CFG.meals.fichas.categories.find(x => x.id === cid) || { name: "", color: "#888" };
  const list = (CFG.meals.fichas.catalog[cid] || []);
  sheet(`<h3 style="color:${c.color}">${esc(c.name)}</h3><div class="mm">Cada ficha equivale a una de estas opciones</div>
    ${list.length ? list.map(o => `<div class="catrow"><div><b>${esc(o.food)}</b>${o.note ? ` <span style="color:var(--muted2)">· ${esc(o.note)}</span>` : ""}</div><span class="amt">${esc(o.amount)}</span></div>`).join("") : `<div class="empty">Sin opciones. Edítalas en Ajustes.</div>`}
    <button class="btn g" onclick="closeModal()">Cerrar</button>`);
}

/* ========================= MÉTRICAS =========================
   Números que registras cada día (peso, horas de estudio, pantalla...).
   No suman puntos: son medición, no cumplimiento. */
/* Con separadores de miles: los números del negocio son grandes (45,000 MXN)
   y sin separar no se leen de un vistazo. Los diarios (82.5 kg) no cambian. */
function fmtNum(v, unit) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Math.round(Number(v) * 100) / 100;
  const txt = isNaN(n) ? "—" : n.toLocaleString("es-MX", { maximumFractionDigits: 2 });
  return txt + (unit ? `<i>${esc(unit)}</i>` : "");
}
function metricVals(id, dates) {
  return dates.map(d => {
    const l = LOG[d]; const v = l && l.metrics ? l.metrics[id] : undefined;
    return (v === undefined || v === null || v === "") ? null : Number(v);
  });
}
function lastNDates(n, endKey) {
  const end = endKey || today(), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}
function metricAvg(id, n, endKey) {
  const vals = metricVals(id, lastNDates(n, endKey)).filter(v => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function metricRow(m, d) {
  const l = day(d), v = l.metrics[m.id], idn = getIdn(m.idn);
  const has = !(v === undefined || v === null || v === "");
  const avg = metricAvg(m.id, 7, d);
  const bits = [];
  if (avg !== null) bits.push(`prom 7d ${fmtNum(avg, m.unit)}`);
  if (m.target) bits.push(`meta ${esc(m.target)}`);
  return `<div class="row" onclick="openMetric('${d}','${m.id}')">
    <span class="dotc" style="background:${idn.raw}"></span>
    <div class="body"><div class="name">${esc(m.name)}</div>${bits.length ? `<div class="sub">${bits.join(" · ")}</div>` : ""}</div>
    <span class="mval ${has ? "on" : ""}">${fmtNum(v, m.unit)}</span></div>`;
}
function metricsSection(d) {
  if (!CFG.metrics.length) return null;
  const l = day(d);
  const done = CFG.metrics.filter(m => { const v = l.metrics[m.id]; return !(v === undefined || v === null || v === ""); }).length;
  return sec("h_met", "Métricas", `${done}/${CFG.metrics.length}`,
    CFG.metrics.map(m => metricRow(m, d)).join(""), "chart", "var(--ciber)");
}
function openMetric(d, id) {
  const m = CFG.metrics.find(x => x.id === id); if (!m) return;
  const l = day(d), v = l.metrics[id];
  const has = !(v === undefined || v === null || v === "");
  const avg = metricAvg(id, 7, d);
  sheet(`<h3>${esc(m.name)}</h3><div class="mm">${cap(fmtDate(d))}${avg !== null ? ` · promedio 7 días ${fmtNum(avg, m.unit).replace(/<\/?i>/g, "")}` : ""}</div>
    <div class="lbl">Valor${m.unit ? " (" + esc(m.unit) + ")" : ""}</div>
    <input id="mvVal" class="field" type="number" inputmode="decimal" step="any" value="${has ? esc(v) : ""}" placeholder="${m.target ? "Meta: " + esc(m.target) : "Escribe el número"}">
    <button class="btn p" onclick="saveMetricVal('${d}','${id}')">Guardar</button>
    ${has ? `<button class="btn g" onclick="clearMetricVal('${d}','${id}')">Quitar valor</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
  const el = document.getElementById("mvVal"); if (el) { el.focus(); el.select(); }
}
function saveMetricVal(d, id) {
  const raw = document.getElementById("mvVal").value.trim();
  const l = day(d);
  if (raw === "" || isNaN(Number(raw))) delete l.metrics[id]; else l.metrics[id] = Number(raw);
  recalcDay(d); saveLog(); closeModal(); render();
}
function clearMetricVal(d, id) { const l = day(d); delete l.metrics[id]; recalcDay(d); saveLog(); closeModal(); render(); }

/* ========================= REVISIÓN SEMANAL =========================
   Aparece el domingo y sigue disponible el lunes por si se pasó. Los otros
   cinco días la tarjeta no existe. Siempre se escribe sobre el domingo que
   cerró la semana, así que el lunes edita el mismo registro, no uno nuevo. */
function reviewDateFor(d) {
  const wd = weekdayIdx(d);
  if (wd === 6) return d;        // domingo: la semana que termina hoy
  if (wd === 0) return addDays(d, -1); // lunes: la semana que cerró ayer
  return null;
}
function isReviewDay(d) { return reviewDateFor(d) !== null; }
function weekStatsFor(d) {
  const wd = []; for (let i = 6; i >= 0; i--) wd.push(addDays(d, -i));
  const pts = wd.reduce((a, x) => a + pointsFor(x), 0);
  const max = wd.reduce((a, x) => a + maxFor(x), 0);
  return { wd, pct: max ? Math.round(pts / max * 100) : 0, workouts: wd.filter(hasWorkout).length };
}
function reviewSection(d) {
  const rd = reviewDateFor(d);
  if (!rd) return null;
  const late = rd !== d;
  const l = day(rd), r = l.review || { worked: "", failed: "", change: "" };
  const st = weekStatsFor(rd);
  const mets = CFG.metrics.map(m => {
    const a = metricAvg(m.id, 7, rd), b = metricAvg(m.id, 7, addDays(rd, -7));
    if (a === null) return "";
    const diff = (b === null) ? null : a - b;
    const col = diff === null ? "var(--muted2)" : (diff > 0 ? "var(--ok)" : diff < 0 ? "var(--cuerpo)" : "var(--muted2)");
    return `<div class="catrow"><span>${esc(m.name)}</span><span class="amt">${fmtNum(a, m.unit)}${diff !== null ? ` <b style="color:${col}">${diff > 0 ? "+" : ""}${Math.round(diff * 100) / 100}</b>` : ""}</span></div>`;
  }).join("");
  const done = hasReview(l);
  const body = `${late ? `<div class="empty" style="text-align:left;padding:2px 2px 10px">La semana que cerró ayer. Hoy es tu último día para escribirla.</div>` : ""}
    <div class="statrow"><div class="stat"><b>${st.pct}%</b><span>de la semana</span></div><div class="stat"><b>${st.workouts}</b><span>entrenos</span></div></div>
    ${mets ? `<div class="subhead2">Tus números</div>${mets}` : ""}
    <div class="lbl">¿Qué funcionó?</div><textarea id="rvW" placeholder="Lo que sí salió">${esc(r.worked)}</textarea>
    <div class="lbl">¿Qué falló, y por qué? (causa, no "me dio flojera")</div><textarea id="rvF" placeholder="El mecanismo, no el juicio">${esc(r.failed)}</textarea>
    <div class="lbl">Un solo cambio para la próxima semana</div><textarea id="rvC" placeholder="Uno. Cambiar cinco cosas destruye el sistema.">${esc(r.change)}</textarea>
    <button class="btn p" onclick="saveReview('${rd}')">Guardar revisión</button>`;
  return sec("h_rev", "Revisión de la semana", done ? "Escrita" : (late ? "Último día" : "Domingo"), body, "calendar", "var(--lectura)");
}
function saveReview(d) {
  const l = day(d);
  l.review = {
    worked: (document.getElementById("rvW") || {}).value || "",
    failed: (document.getElementById("rvF") || {}).value || "",
    change: (document.getElementById("rvC") || {}).value || ""
  };
  saveLog(); render();
}

/* ========================= PROGRESO ========================= */
function setProg(p) { PROG = p; store.set("mt_prog", p); render(); }
function monthNav(label) { return `<div class="mnav"><button onclick="calPrev()">${icon("chevleft")}</button><b>${label}</b><button onclick="calNext()">${icon("chevright")}</button></div>`; }
function calPrev() { CALYM.m--; if (CALYM.m < 0) { CALYM.m = 11; CALYM.y--; } render(); }
function calNext() { CALYM.m++; if (CALYM.m > 11) { CALYM.m = 0; CALYM.y++; } render(); }
function monthLabel(y, m) { return cap(new Date(y, m, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" })); }
function weekDates() {
  const now = new Date(), dow = (now.getDay() + 6) % 7, mon = new Date(now); mon.setDate(now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return toKey(x); });
}
function weekRows(list, kind) {
  const wd = weekDates();
  return list.map(h => {
    const idn = getIdn(h.idn);
    const cells = wd.map(d => {
      const map = kind === "habit" ? (LOG[d] && LOG[d].habits) : (LOG[d] && LOG[d].commitments);
      const on = !!(map && map[h.id]), isT = d === today();
      const col = kind === "habit" ? idn.raw : "#22C55E", fn = kind === "habit" ? "toggleHabit" : "toggleCommit";
      return `<td><div class="cell ${on ? "on" : ""} ${isT ? "today" : ""}" style="${on ? `background:${col}` : ""}" onclick="${fn}('${d}','${h.id}');render();"></div></td>`;
    }).join("");
    return `<tr><td class="hn">${esc(h.name)}</td>${cells}</tr>`;
  }).join("");
}
function unifiedMonth() {
  const y = CALYM.y, m = CALYM.m, days = new Date(y, m + 1, 0).getDate(), dows = ["L","M","M","J","V","S","D"];
  const head = `<div class="mgrid">${dows.map(x => `<div style="text-align:center;color:var(--muted);font-size:11px;font-weight:600">${x}</div>`).join("")}</div>`;
  const first = (new Date(y, m, 1).getDay() + 6) % 7; let g = ""; for (let i = 0; i < first; i++) g += `<div></div>`;
  for (let dn = 1; dn <= days; dn++) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
    const p = pointsFor(ds), mp = maxFor(ds), isT = ds === today(), bg = p > 0 ? `rgba(34,197,94,${0.14 + (p / mp) * 0.86})` : "var(--card2)";
    const nt = TASKS.filter(t => t.date === ds).length, nw = hasWorkout(ds);
    let dots = ""; if (nt) dots += `<span class="cdot" style="background:var(--text)"></span>`; if (nw) dots += `<span class="cdot" style="background:var(--cuerpo)"></span>`;
    g += `<div class="mday ${isT ? "today" : ""}" style="background:${bg}" onclick="openDay('${ds}')"><span class="n">${dn}</span><span class="dots">${dots}</span></div>`;
  }
  return monthNav(monthLabel(y, m)) + head + `<div class="mgrid">${g}</div>`
    + `<div class="leyenda"><span>Verde = puntos</span><span><span class="cdot" style="background:var(--text)"></span> tareas</span><span><span class="cdot" style="background:var(--cuerpo)"></span> workout</span></div>`;
}
function renderProgreso() {
  let out = header("Progreso", "Tu semana, tu mes y tu bitácora")
    + `<div class="seg"><button class="${PROG === "semana" ? "on" : ""}" onclick="setProg('semana')">Semana</button><button class="${PROG === "mes" ? "on" : ""}" onclick="setProg('mes')">Mes</button><button class="${PROG === "bitacora" ? "on" : ""}" onclick="setProg('bitacora')">Bitácora</button></div>`;
  if (PROG === "semana") {
    const wd = weekDates(), names = ["L","M","M","J","V","S","D"];
    const head = `<thead><tr><th></th>${wd.map((d, i) => `<th>${names[i]}<br><span style="color:var(--muted2)">${d.slice(8)}</span></th>`).join("")}</tr></thead>`;
    const rows = (CFG.habits.length ? `<tr><td class="subhead" colspan="8">Hábitos</td></tr>${weekRows(habitsSorted(), "habit")}` : "")
      + (CFG.commitments.length ? `<tr><td class="subhead" colspan="8">Compromisos</td></tr>${weekRows(CFG.commitments, "commit")}` : "");
    out += sec("p_grid", "Hábitos × 7 días", "", `<table class="grid">${head}<tbody>${rows}</tbody></table>`, "grid");
    out += sec("p_chart", "Línea de progreso semanal", "", `<canvas id="chart" width="600" height="200" style="width:100%;height:auto;margin-top:8px"></canvas>`, "chart", "var(--ok)");
    out += metricsProgreso(wd);
    app.innerHTML = out;
    drawChart(wd.map(pointsFor), (new Date().getDay() + 6) % 7);
    drawMetricSparks(wd);
  } else if (PROG === "mes") {
    const y = CALYM.y, m = CALYM.m, days = new Date(y, m + 1, 0).getDate(), vals = [], mdates = [];
    for (let dn = 1; dn <= days; dn++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(dn).padStart(2, "0")}`;
      mdates.push(ds); vals.push(pointsFor(ds));
    }
    out += sec("p_cal", "Calendario", "", unifiedMonth(), "calendar", "var(--ok)");
    out += sec("p_chart", "Línea de progreso del mes", "", `<canvas id="chart" width="600" height="200" style="width:100%;height:auto;margin-top:8px"></canvas>`, "chart", "var(--ok)");
    out += metricsProgreso(mdates);
    app.innerHTML = out;
    const tdy = (today().slice(0, 7) === `${y}-${String(m + 1).padStart(2, "0")}`) ? new Date().getDate() - 1 : days - 1;
    drawChart(vals, tdy);
    drawMetricSparks(mdates);
  } else { out += bitacoraList(); app.innerHTML = out; }
}
/* Tendencia de métricas: una fila por métrica con promedio, cambio vs. el
   periodo anterior y una línea chiquita. Sección colapsada por defecto
   para no meter ruido a quien no usa métricas. */
function metricsProgreso(dates) {
  if (!CFG.metrics.length) return "";
  const body = CFG.metrics.map(m => {
    const vals = metricVals(m.id, dates), got = vals.filter(v => v !== null);
    const avg = got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
    const prev = metricVals(m.id, dates.map(d => addDays(d, -dates.length))).filter(v => v !== null);
    const pavg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
    const diff = (avg !== null && pavg !== null) ? Math.round((avg - pavg) * 100) / 100 : null;
    const idn = getIdn(m.idn);
    return `<div class="metrow">
      <div class="metrow-h"><span class="dotc" style="background:${idn.raw}"></span>
        <b>${esc(m.name)}</b>
        <span class="amt">${avg === null ? "sin datos" : "prom " + fmtNum(avg, m.unit)}${diff !== null ? ` <i style="color:${diff > 0 ? "var(--ok)" : diff < 0 ? "var(--cuerpo)" : "var(--muted2)"}">${diff > 0 ? "+" : ""}${diff}</i>` : ""}</span></div>
      <canvas class="spark" id="sp_${m.id}" width="600" height="90"></canvas></div>`;
  }).join("");
  return sec("p_met", "Métricas", String(CFG.metrics.length), body, "chart", "var(--ciber)");
}
function drawMetricSparks(dates) {
  CFG.metrics.forEach(m => {
    const cv = document.getElementById("sp_" + m.id); if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const vals = metricVals(m.id, dates), got = vals.filter(v => v !== null);
    const W = cv.width, H = cv.height, pad = 12;
    ctx.clearRect(0, 0, W, H);
    if (!got.length) return;
    let lo = Math.min.apply(null, got), hi = Math.max.apply(null, got);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    const col = getIdn(m.idn).raw;
    const xs = i => vals.length > 1 ? pad + (W - 2 * pad) * (i / (vals.length - 1)) : W / 2;
    const ys = v => H - pad - (H - 2 * pad) * ((v - lo) / (hi - lo));
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath();
    let started = false;
    vals.forEach((v, i) => { if (v === null) return; const x = xs(i), y = ys(v); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
    ctx.stroke(); ctx.fillStyle = col;
    vals.forEach((v, i) => { if (v === null) return; ctx.beginPath(); ctx.arc(xs(i), ys(v), 3, 0, 7); ctx.fill(); });
  });
}
function drawChart(vals, todayIdx) {
  const cv = document.getElementById("chart"); if (!cv) return;
  const ctx = cv.getContext("2d"); if (!ctx) return;
  const W = cv.width, H = cv.height, pad = 24, n = vals.length, mp = maxPts();
  ctx.clearRect(0, 0, W, H);
  const xs = i => n > 1 ? pad + (W - 2 * pad) * (i / (n - 1)) : W / 2, ys = v => H - pad - (H - 2 * pad) * (v / mp);
  ctx.strokeStyle = "#262A35"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
  ctx.strokeStyle = "#22C55E"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath();
  let started = false;
  vals.forEach((v, i) => { if (i > todayIdx) return; const x = xs(i), yv = ys(v); if (!started) { ctx.moveTo(x, yv); started = true; } else ctx.lineTo(x, yv); });
  ctx.stroke(); ctx.fillStyle = "#22C55E";
  vals.forEach((v, i) => { if (i > todayIdx) return; ctx.beginPath(); ctx.arc(xs(i), ys(v), 3.5, 0, 7); ctx.fill(); });
}
function hasReview(l) { return !!(l && l.review && (l.review.worked || l.review.failed || l.review.change)); }
function bitacoraList() {
  /* Los domingos con revisión de negocio también entran, aunque ese día no
     haya nota ni mood en LOG. */
  const set = {};
  Object.keys(LOG).forEach(d => { if (LOG[d].journal || LOG[d].mood || hasReview(LOG[d])) set[d] = true; });
  Object.keys(BIZ.reviews || {}).forEach(d => { if (hasBizReview(d)) set[d] = true; });
  const days = Object.keys(set).sort().reverse();
  return days.length ? days.map(d => {
    const l = LOG[d] || { review: null, journal: "", mood: null, sleep: null }, r = (l.review) || {};
    const br = BIZ.reviews[d];
    const bizrev = hasBizReview(d) ? `<div class="revblock">
      <div class="subhead2" style="padding-top:4px">Revisión del negocio</div>
      ${br.moved ? `<div class="revq">Qué se movió</div><div class="reva">${esc(br.moved)}</div>` : ""}
      ${br.stuck ? `<div class="revq">Qué está atorado</div><div class="reva">${esc(br.stuck)}</div>` : ""}
      ${br.focus ? `<div class="revq">El foco de la semana</div><div class="reva">${esc(br.focus)}</div>` : ""}</div>` : "";
    const rev = hasReview(l) ? `<div class="revblock">
      <div class="subhead2" style="padding-top:4px">Revisión de la semana</div>
      ${r.worked ? `<div class="revq">Qué funcionó</div><div class="reva">${esc(r.worked)}</div>` : ""}
      ${r.failed ? `<div class="revq">Qué falló y por qué</div><div class="reva">${esc(r.failed)}</div>` : ""}
      ${r.change ? `<div class="revq">El cambio</div><div class="reva">${esc(r.change)}</div>` : ""}</div>` : "";
    return `<div class="sec"><div class="sec-b" style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="text-transform:capitalize;cursor:pointer" onclick="openDay('${d}')">${fmtDate(d)}</b>
      ${l.mood ? `<span class="streak" style="background:${moodColor(l.mood)};color:#0E0F13;border:none">${l.mood}/10</span>` : ""}</div>
      ${l.journal ? `<div class="sel" style="font-size:14px;color:var(--muted)">${esc(l.journal)}</div>` : ((rev || bizrev) ? "" : `<div class="empty">Sin nota</div>`)}
      ${rev}${bizrev}
      <div class="sub" style="margin-top:8px;font-size:12px;color:var(--muted2)">${Math.round(pointsFor(d))} puntos${l.sleep ? " · " + l.sleep + " de sueño" : ""}</div></div></div>`;
  }).join("") : `<div class="empty" style="padding:40px">Tu bitácora aparecerá aquí conforme escribas cada día.</div>`;
}

/* ---------- Detalle de día (tareas + bitácora) ---------- */
function openDay(ds) {
  const l = day(ds);
  const tt = TASKS.filter(t => t.date === ds);
  const ww = WORKOUTS.filter(w => w.date === ds);
  sheet(`<h3 style="text-transform:capitalize">${fmtDate(ds)}</h3><div class="mm">${Math.round(pointsFor(ds))} puntos${l.sleep ? " · " + l.sleep : ""}</div>
    ${ds <= today() ? `<button class="btn g" style="display:flex;align-items:center;justify-content:center;gap:8px" onclick="editDay('${ds}')">${icon("edit")} Editar este día</button>` : ""}
    <div class="lbl">Tareas</div>
    ${tt.length ? tt.map(t => `<div class="row ${t.done ? "done" : ""}"><div class="mark" style="${t.done ? "background:var(--text);border-color:var(--text)" : ""}" onclick="toggleTask('${t.id}');refreshDay('${ds}')">${icon("check")}</div><div class="body"><div class="name">${esc(t.text)}</div>${t.time ? `<div class="sub">${esc(t.time)}</div>` : ""}</div><button class="note-btn" onclick="delTask('${t.id}');refreshDay('${ds}')">${icon("trash")}</button></div>`).join("") : `<div class="empty">Sin tareas</div>`}
    <button class="addbtn" onclick="openTask('${ds}')">${icon("plus")} Agregar tarea</button>
    ${ww.length ? `<div class="lbl">Workouts</div>` + ww.map(w => `<div class="row"><span class="idi" style="background:${getAct(w.activityId).color}22;color:${getAct(w.activityId).color}">${icon(getAct(w.activityId).icon)}</span><div class="body" onclick="openWorkoutDetail('${w.id}')"><div class="name">${esc(w.name)}</div><div class="sub">${workoutSummary(w)}</div></div></div>`).join("") : ""}
    <div class="lbl">Bitácora</div><textarea id="dayj" placeholder="Nota del día...">${esc(l.journal)}</textarea>
    <button class="btn p" onclick="saveDayJournal('${ds}')">Guardar</button>
    <button class="btn g" onclick="confirmClearDay('${ds}')" style="color:var(--bad)">Borrar progreso de este día</button>
    <button class="btn g" onclick="closeModal()">Cerrar</button>`);
}
function confirmClearDay(ds) {
  sheet(`<h3>Borrar progreso del día</h3><div class="mm">Se pondrá en cero el progreso (hábitos, compromisos y comidas) de ${cap(fmtDate(ds))}. Tu bitácora, sueño y mood se conservan.</div>
    <button class="btn p" style="background:var(--bad)" onclick="clearDayProgress('${ds}')">Sí, borrar progreso</button>
    <button class="btn g" onclick="openDay('${ds}')">Cancelar</button>`);
}
function clearDayProgress(ds) {
  const l = LOG[ds]; if (l) { l.habits = {}; l.commitments = {}; l.menuDone = {}; l.fichas = {}; l.inneg = {}; delete l.frozen; delete l.pts; delete l.max; saveLog(); }
  closeModal(); render();
}
function refreshDay(ds) { openDay(ds); }
function saveDayJournal(ds) { const l = day(ds); l.journal = document.getElementById("dayj").value; saveLog(); closeModal(); render(); }

/* ========================= WORKOUTS ========================= */
function fmtDur(sec) { const m = Math.round((sec || 0) / 60); return m + " min"; }
function workoutSummary(w) {
  const a = getAct(w.activityId);
  if (a.type === "strength" || w.sets) {
    const s = (w.sets || []).length, u = w.unit || (CFG.settings && CFG.settings.unit) || "kg";
    return `${s} series · ${fmtDur(w.duration)}${w.volume ? " · " + Math.round(w.volume) + " " + u + " vol" : ""}`;
  }
  return `${w.duration || 0} min${w.intensity ? " · intensidad " + w.intensity + "/10" : ""}`;
}
function renderWorkouts() {
  let out = header("Workouts", "Tu entrenamiento, medido");
  // Hero de hoy
  const act = getActiveWorkout(), r = todayRoutine();
  out += `<div class="hero"><div class="hero-top"><span class="hero-tag">${icon("dumbbell")} ${act ? "En curso" : "Hoy"}</span></div>`;
  if (act) {
    const ar = CFG.routines.find(x => x.id === act.rid);
    out += `<div class="hero-title">${esc(ar ? ar.name : "Entreno")}</div><div class="hero-sub">Ejercicio ${act.ei + 1}/${ar ? ar.exercises.length : "?"} · serie ${act.si} · sin terminar</div>
      <button class="hero-cta" onclick="resumeWorkout()">${icon("play")} Reanudar</button>
      <button class="hero-link" onclick="openActiveOptions()">Opciones del entreno</button>`;
  } else if (r) out += `<div class="hero-title">${esc(r.name)}</div><div class="hero-sub">${r.exercises.length} ejercicios · fuerza</div>
      <button class="hero-cta" onclick="startWorkout('${r.id}')">${icon("play")} Iniciar rutina</button>
      <button class="hero-link" onclick="openPickRoutine()">Cambiar rutina</button>`;
  else out += `<div class="hero-title">Sin rutina de fuerza hoy</div><div class="hero-sub">Elige una o registra otra actividad</div>
      <button class="hero-cta" onclick="openPickRoutine()">${icon("dumbbell")} Elegir rutina</button>`;
  out += `</div>`;
  // Registro rápido de clases
  const classes = CFG.activities.filter(a => a.type === "class");
  if (classes.length) out += `<div class="quicklog">${classes.map(a => `<button style="border-color:${a.color}44" onclick="openLogSession('${a.id}')"><span style="color:${a.color}">${icon(a.icon)}</span>${esc(a.name)}</button>`).join("")}</div>`;
  // Tira semanal del split
  out += sec("w_week", "Tu semana", "", weeklyStrip(), "calendar", "var(--cuerpo)");
  // Unidad de peso
  const U = (CFG.settings && CFG.settings.unit) || "kg";
  out += `<div class="unitrow"><span>Unidad de peso</span><div class="seg small unitseg"><button class="${U === "kg" ? "on" : ""}" onclick="setWeightUnit('kg')">kg</button><button class="${U === "lb" ? "on" : ""}" onclick="setWeightUnit('lb')">lb</button></div></div>`;
  // Stats
  const wd = weekDates(), sem = new Set(workoutsInRange(wd[0], wd[6]).map(w => w.date)).size;
  const ym = today().slice(0, 7), mes = new Set(WORKOUTS.filter(w => w.date.slice(0, 7) === ym).map(w => w.date)).size;
  const vol = workoutsInRange(wd[0], wd[6]).reduce((a, w) => a + (w.volume || 0), 0);
  out += sec("w_stats", "Resumen", "", `<div class="statrow"><div class="stat"><b>${sem}</b><span>días esta semana</span></div><div class="stat"><b>${mes}</b><span>este mes</span></div><div class="stat"><b>${Math.round(vol / 1000 * 10) / 10 || 0}k</b><span>vol. semana (kg)</span></div></div>`, "chart", "var(--ok)");
  // Historial
  const hist = WORKOUTS.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  out += sec("w_hist", "Historial", String(WORKOUTS.length), hist.length ? hist.map(w => {
    const a = getAct(w.activityId);
    return `<div class="row" onclick="openWorkoutDetail('${w.id}')"><span class="idi" style="background:${a.color}22;color:${a.color}">${icon(a.icon)}</span>
      <div class="body"><div class="name">${esc(w.name)}</div><div class="sub">${cap(fmtShort(w.date))} · ${workoutSummary(w)}</div></div><span class="chev">${icon("chevron")}</span></div>`;
  }).join("") : `<div class="empty">Aún no registras entrenamientos. ¡Inicia una rutina o registra una clase!</div>`, "clock", "var(--muted)");
  // Posibles duplicados del catálogo (nunca se fusiona solo: aquí se confirma)
  out += dupPrompt();
  // Records
  const U2 = (CFG.settings && CFG.settings.unit) || "kg";
  const exs = allLoggedExercises();
  out += sec("w_rec", "Records", String(exs.length), exs.length ? exs.map(e => {
    const pr = exercisePR(e.id);
    return `<div class="row" onclick="openExerciseDetail('${e.id}')"><span class="idi" style="background:#F59E0B22;color:#F59E0B">${icon("trophy")}</span>
      <div class="body"><div class="name">${esc(e.name)}</div><div class="sub">${pr ? pr.weight + " " + U2 + " × " + esc(pr.reps) : "—"}</div></div><span class="chev">${icon("chevron")}</span></div>`;
  }).join("") : `<div class="empty">Tus records aparecerán al registrar pesos.</div>`, "trophy", "var(--lectura)");
  // Catálogo completo de ejercicios
  const cat = (CFG.exercises || []).slice().sort((a, b) => a.name.localeCompare(b.name, "es"));
  out += sec("w_ex", "Ejercicios", String(cat.length), cat.length ? cat.map(e => {
    const pr = exercisePR(e.id), ns = exSessions(e.id).length;
    const bits = [ns ? ns + (ns === 1 ? " sesión" : " sesiones") : "sin registros"];
    if (pr) bits.push("PR " + pr.weight + " " + U2);
    if ((e.aliases || []).length) bits.push((e.aliases.length === 1 ? "1 alias" : e.aliases.length + " alias"));
    return `<div class="row" onclick="openExerciseDetail('${e.id}')"><span class="idi" style="background:#FF5A3C22;color:var(--cuerpo)">${icon("dumbbell")}</span>
      <div class="body"><div class="name">${esc(e.name)}</div><div class="sub">${bits.join(" · ")}</div></div><span class="chev">${icon("chevron")}</span></div>`;
  }).join("") : `<div class="empty">Tu catálogo se llena solo al registrar o importar rutinas.</div>`, "list", "var(--cuerpo)");
  // Rutinas
  const list = CFG.routines.length ? CFG.routines.map(r2 => `<div class="row"><span class="idi" style="background:#FF5A3C22;color:var(--cuerpo)">${icon("dumbbell")}</span>
    <div class="body" onclick="openRoutineEditor('${r2.id}')"><div class="name">${esc(r2.name)}</div><div class="sub">${r2.exercises.length} ejercicios${r2.days && r2.days.length ? " · " + r2.days.join(", ") : ""}</div></div>
    <button class="startbtn" onclick="startWorkout('${r2.id}')">${icon("play")}</button></div>`).join("") : `<div class="empty">Ninguna rutina aún</div>`;
  out += sec("w_rt", "Rutinas de fuerza", String(CFG.routines.length), list
    + `<button class="addbtn" onclick="openRoutineEditor()">${icon("plus")} Nueva rutina</button><button class="addbtn" onclick="openImportJSON()">${icon("upload")} Importar JSON</button>`, "dumbbell", "var(--cuerpo)");
  // Actividades
  out += sec("w_act", "Actividades", String(CFG.activities.length),
    CFG.activities.map(a => `<div class="row" onclick="openEditActivity('${a.id}')"><span class="idi" style="background:${a.color}22;color:${a.color}">${icon(a.icon)}</span><div class="body"><div class="name">${esc(a.name)}</div><div class="sub">${a.type === "strength" ? "Fuerza (con rutinas)" : "Clase / sesión"}</div></div><button class="note-btn">${icon("edit")}</button></div>`).join("")
    + `<button class="addbtn" onclick="openEditActivity()">${icon("plus")} Nueva actividad</button>`, "sliders", "var(--muted)");
  app.innerHTML = out;
}
/* ---------- Posibles duplicados ----------
   Se propone, nunca se fusiona solo: cada par lo confirma o lo rechaza el
   usuario. Un rechazo se guarda en CFG.exDismissed y no vuelve a salir. */
let _dupHidden = false;
function hideDupPrompt() { _dupHidden = true; render(); }
function rejectDupPair(a, b) {
  CFG.exDismissed = CFG.exDismissed || [];
  const k = dupPairKey(a, b);
  if (CFG.exDismissed.indexOf(k) < 0) CFG.exDismissed.push(k);
  saveCfg(); render();
}
function dupPrompt() {
  if (_dupHidden) return "";
  const cands = dupCandidates();
  if (!cands.length) return "";
  const rows = cands.slice(0, 6).map(c => `<div class="duprow">
    <div class="dupnames"><b>${esc(c.a.name)}</b><span>y</span><b>${esc(c.b.name)}</b></div>
    <div class="dupacts">
      <button class="dupok" onclick="openMergeChoice('${c.a.id}','${c.b.id}')">Es el mismo</button>
      <button class="dupno" onclick="rejectDupPair('${c.a.id}','${c.b.id}')">Son distintos</button>
    </div></div>`).join("");
  const body = `<div class="empty" style="text-align:left;padding:2px 6px 10px">Estos ejercicios se parecen. Si son el mismo, únelos y su historial se junta. Nada se borra.</div>
    ${rows}${cands.length > 6 ? `<div class="empty" style="padding:6px">y ${cands.length - 6} más</div>` : ""}
    <button class="addbtn" onclick="hideDupPrompt()">Ahora no</button>`;
  return sec("w_dup", "Posibles duplicados", String(cands.length), body, "list", "var(--lectura)");
}
function openMergeChoice(aId, bId) {
  const a = exById(aId), b = exById(bId);
  if (!a || !b) return render();
  const na = exSessions(aId).length, nb = exSessions(bId).length;
  sheet(`<h3>¿Cuál nombre se queda?</h3><div class="mm">El otro queda como alias y todo su historial se une. No se borra ningún entreno.</div>
    <button class="btn p" onclick="doMerge('${aId}','${bId}')">${esc(a.name)} <span style="opacity:.6">· ${na} ${na === 1 ? "sesión" : "sesiones"}</span></button>
    <button class="btn p" onclick="doMerge('${bId}','${aId}')">${esc(b.name)} <span style="opacity:.6">· ${nb} ${nb === 1 ? "sesión" : "sesiones"}</span></button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function doMerge(keepId, dropId) { mergeExercises(keepId, dropId); closeModal(); render(); }

/* ---------- Detalle de un ejercicio ---------- */
function openExerciseDetail(id) {
  const e = exById(id); if (!e) return;
  const U = (CFG.settings && CFG.settings.unit) || "kg";
  const pr = exercisePR(id), lp = lastPerf(id), groups = exSessions(id), prog = exProgress(id);
  const stats = `<div class="statrow">
    <div class="stat"><b>${pr ? pr.weight + " " + U : "—"}</b><span>PR${pr ? " × " + esc(pr.reps) : ""}</span></div>
    <div class="stat"><b>${groups.length}</b><span>${groups.length === 1 ? "sesión" : "sesiones"}</span></div></div>
    ${pr ? `<div class="mm" style="margin-top:6px">Tu mejor marca fue el ${cap(fmtDate(pr.date))}.</div>` : ""}
    ${lp ? `<div class="mm">Última vez: ${esc(lp.weight) || "—"} ${U} × ${esc(lp.reps) || "—"} · ${cap(fmtShort(lp.date))}</div>` : ""}`;
  const chart = prog.length > 1
    ? `<div class="lbl">Progresión</div><canvas id="exchart" width="600" height="180" style="width:100%;height:auto"></canvas>`
    : "";
  const hist = groups.length ? groups.map(g => `<div class="lbl">${cap(fmtDate(g.w.date))}</div>`
    + g.sets.map((s, i) => `<div class="catrow"><span>Serie ${i + 1}</span><span class="amt">${s.weight ? esc(s.weight) + " " + (g.w.unit || U) : "—"} × ${esc(s.reps) || "—"}</span></div>`).join("")).join("")
    : `<div class="empty">Sin series registradas todavía</div>`;
  const alias = (e.aliases || []).length
    ? `<div class="lbl">También conocido como</div><div class="chips" style="padding:0">${e.aliases.map(a => `<div class="chip">${esc(a)}</div>`).join("")}</div>`
    : "";
  sheet(`<span class="idi" style="width:44px;height:44px;background:#FF5A3C22;color:var(--cuerpo);display:flex;align-items:center;justify-content:center;border-radius:12px">${icon("dumbbell")}</span>
    <h3 style="margin-top:8px">${esc(e.name)}</h3>
    ${stats}${alias}${chart}
    <div class="lbl">Historial</div>${hist}
    <button class="btn g" onclick="openRenameExercise('${id}')">${icon("edit")} Renombrar</button>
    <button class="btn g" onclick="openMergePick('${id}')">Unir con otro ejercicio</button>
    <button class="btn g" onclick="closeModal()">Cerrar</button>`);
  if (prog.length > 1) drawExProgress(prog);
}
/* Línea de progresión: mejor peso por sesión. Mismo lenguaje visual que las
   chispas de métricas (escala automática entre mínimo y máximo). */
function drawExProgress(pts) {
  const cv = document.getElementById("exchart"); if (!cv) return;
  const ctx = cv.getContext("2d"); if (!ctx) return;
  const W = cv.width, H = cv.height, pad = 16;
  ctx.clearRect(0, 0, W, H);
  const vals = pts.map(p => p.weight);
  let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (hi === lo) { hi = lo + 1; lo = lo - 1; }
  const xs = i => pts.length > 1 ? pad + (W - 2 * pad) * (i / (pts.length - 1)) : W / 2;
  const ys = v => H - pad - (H - 2 * pad) * ((v - lo) / (hi - lo));
  ctx.strokeStyle = "#262A35"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
  ctx.strokeStyle = "#FF5A3C"; ctx.lineWidth = 3; ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach((p, i) => { const x = xs(i), y = ys(p.weight); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = "#FF5A3C";
  pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(xs(i), ys(p.weight), 3.5, 0, 7); ctx.fill(); });
}
function openRenameExercise(id) {
  const e = exById(id); if (!e) return;
  sheet(`<h3>Renombrar ejercicio</h3><div class="mm">El historial no se toca: se agrega por id, no por nombre. El nombre anterior queda como alias.</div>
    <div class="lbl">Nombre</div><input id="exNm" class="field" value="${esc(e.name)}">
    <div id="exMsg" style="font-size:13px;margin-top:8px"></div>
    <button class="btn p" onclick="saveRenameExercise('${id}')">Guardar</button>
    <button class="btn g" onclick="openExerciseDetail('${id}')">Cancelar</button>`);
}
function saveRenameExercise(id) {
  const v = document.getElementById("exNm").value;
  const res = renameExercise(id, v);
  const msg = document.getElementById("exMsg");
  if (res === "clash") { if (msg) msg.innerHTML = `<span style="color:var(--bad)">Ya existe otro ejercicio con ese nombre. Únelos en vez de repetirlo.</span>`; return; }
  if (!res) { if (msg) msg.innerHTML = `<span style="color:var(--bad)">Ponle un nombre.</span>`; return; }
  openExerciseDetail(id); render();
}
function openMergePick(id) {
  const e = exById(id); if (!e) return;
  const others = (CFG.exercises || []).filter(x => x.id !== id).sort((a, b) => a.name.localeCompare(b.name, "es"));
  sheet(`<h3>Unir "${esc(e.name)}" con...</h3><div class="mm">Elige el otro ejercicio. Después decides cuál nombre se queda.</div>
    ${others.length ? others.map(o => `<div class="row" onclick="openMergeChoice('${id}','${o.id}')"><span class="idi" style="background:#FF5A3C22;color:var(--cuerpo)">${icon("dumbbell")}</span>
      <div class="body"><div class="name">${esc(o.name)}</div><div class="sub">${exSessions(o.id).length} sesiones</div></div></div>`).join("") : `<div class="empty">No hay otro ejercicio en el catálogo</div>`}
    <button class="btn g" onclick="openExerciseDetail('${id}')">Cancelar</button>`);
}

function weeklyStrip() {
  const wd = weekDates(), names = ["L","M","M","J","V","S","D"];
  return `<div class="wstrip">${wd.map((d, i) => {
    const wds = WEEKDAYS[i];
    const r = CFG.routines.find(rr => (rr.days || []).includes(wds));
    const done = hasWorkout(d), isT = d === today();
    return `<div class="wday ${isT ? "today" : ""} ${done ? "done" : ""}" onclick="openDay('${d}')">
      <span class="wd-n">${names[i]}</span>
      <span class="wd-ic">${done ? icon("check") : (r ? icon("dumbbell") : "")}</span>
      <span class="wd-r">${r ? esc(r.name.split(" ")[0]) : "—"}</span></div>`;
  }).join("")}</div>`;
}
function openWorkoutDetail(id) {
  const w = WORKOUTS.find(x => x.id === id); if (!w) return;
  const a = getAct(w.activityId);
  let body;
  if (w.sets && w.sets.length) {
    /* Se agrupa por exId: si esa sesión registró dos grafías del mismo
       ejercicio, ahora salen juntas y con el nombre canónico. */
    const byEx = {}, order = [];
    w.sets.forEach(s => {
      const k = setExId(s) || exKey(s.exName) || "?";
      if (!byEx[k]) { byEx[k] = { name: exName(setExId(s), s.exName), sets: [] }; order.push(k); }
      byEx[k].sets.push(s);
    });
    const wu = w.unit || (CFG.settings && CFG.settings.unit) || "kg";
    body = order.map(k => `<div class="lbl">${esc(byEx[k].name)}</div>` + byEx[k].sets.map((s, i) => `<div class="catrow"><span>Serie ${i + 1}</span><span class="amt">${s.weight ? s.weight + " " + wu : "—"} × ${esc(s.reps) || "—"}</span></div>`).join("")).join("");
  } else {
    body = `<div class="catrow"><span>Duración</span><span class="amt">${w.duration || 0} min</span></div>${w.intensity ? `<div class="catrow"><span>Intensidad</span><span class="amt">${w.intensity}/10</span></div>` : ""}${w.notes ? `<div class="lbl">Notas</div><div class="sel" style="font-size:14px;color:var(--muted)">${esc(w.notes)}</div>` : ""}`;
  }
  sheet(`<span class="idi" style="width:44px;height:44px;background:${a.color}22;color:${a.color};display:flex;align-items:center;justify-content:center;border-radius:12px">${icon(a.icon)}</span>
    <h3 style="margin-top:8px">${esc(w.name)}</h3><div class="mm">${cap(fmtDate(w.date))} · ${workoutSummary(w)}</div>
    ${body}<button class="btn g" onclick="delWorkout('${w.id}')" style="color:var(--bad)">Borrar registro</button><button class="btn g" onclick="closeModal()">Cerrar</button>`);
}
function delWorkout(id) { WORKOUTS = WORKOUTS.filter(w => w.id !== id); saveWorkouts(); closeModal(); render(); }

/* ---------- Registrar sesión de clase ---------- */
let _sInt = null;
function openLogSession(actId, dateStr) {
  const a = getAct(actId); _sInt = null;
  const dd = dateStr || today();
  sheet(`<span class="idi" style="width:44px;height:44px;background:${a.color}22;color:${a.color};display:flex;align-items:center;justify-content:center;border-radius:12px">${icon(a.icon)}</span>
    <h3 style="margin-top:8px">Registrar ${esc(a.name)}</h3><div class="mm">${cap(fmtDate(dd))}</div>
    <div class="lbl">Duración (min)</div><input id="sDur" class="field" type="number" min="0" placeholder="60" inputmode="numeric">
    <div class="lbl">Intensidad</div><div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(i => `<b onclick="pickIntensity(this,${i})">${i}</b>`).join("")}</div>
    <div class="lbl">Notas (opcional)</div><textarea id="sNote" placeholder="Cómo estuvo, técnicas, sparring..."></textarea>
    <button class="btn p" onclick="saveSession('${actId}','${dd}')">Guardar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function pickIntensity(el, i) { _sInt = i; document.querySelectorAll(".scale b").forEach(b => b.classList.remove("on")); el.classList.add("on"); }
function saveSession(actId, dd) {
  const a = getAct(actId);
  const dur = parseInt(document.getElementById("sDur").value) || 0;
  WORKOUTS.push({ id: uid("w"), date: dd, activityId: actId, type: "class", name: a.name, duration: dur, intensity: _sInt, notes: document.getElementById("sNote").value.trim() });
  _sInt = null; saveWorkouts(); closeModal(); render();
}

/* ---------- Editar actividad ---------- */
let _aColor = null, _aIcon = null, _aType = null;
const ACT_ICONS = ["dumbbell", "boxing", "run", "bike", "flame", "heart", "target"];
function openEditActivity(id) {
  const editing = !!id, it = editing ? getAct(id) : { name: "", type: "class", icon: "boxing", color: PALETTE[7] };
  _aColor = it.color; _aIcon = it.icon; _aType = it.type;
  sheet(`<h3>${editing ? "Editar actividad" : "Nueva actividad"}</h3><div class="mm">Un deporte o tipo de entrenamiento a seguir</div>
    <div class="lbl">Nombre</div><input id="aName" class="field" value="${esc(it.name)}" placeholder="Kickboxing">
    <div class="lbl">Tipo</div><div class="seg small"><button class="${it.type === "strength" ? "on" : ""}" onclick="pickAType('strength',this)">Fuerza (rutinas)</button><button class="${it.type === "class" ? "on" : ""}" onclick="pickAType('class',this)">Clase / sesión</button></div>
    <div class="lbl">Color</div><div class="swatches" id="aColors">${PALETTE.map(c => `<span class="sw ${c === it.color ? "on" : ""}" style="background:${c}" onclick="pickAColor('${c}')"></span>`).join("")}</div>
    <div class="lbl">Ícono</div><div class="iconpick" id="aIcons">${ACT_ICONS.map(nm => `<span class="ip ${nm === it.icon ? "on" : ""}" data-i="${nm}" onclick="pickAIcon('${nm}')" style="${nm === it.icon ? `color:${it.color};border-color:${it.color}` : ""}">${icon(nm)}</span>`).join("")}</div>
    <button class="btn p" onclick="saveActivity('${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delActivity('${id}')" style="color:var(--bad)">Borrar actividad</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function pickAType(t, el) { _aType = t; el.parentNode.querySelectorAll("button").forEach(b => b.classList.remove("on")); el.classList.add("on"); }
function pickAColor(c) { _aColor = c; document.querySelectorAll("#aColors .sw").forEach(s => s.classList.toggle("on", rgbToHex(s.style.background) === c.toLowerCase())); document.querySelectorAll("#aIcons .ip.on").forEach(s => { s.style.color = c; s.style.borderColor = c; }); }
function pickAIcon(nm) { _aIcon = nm; document.querySelectorAll("#aIcons .ip").forEach(s => { s.classList.remove("on"); s.style.color = ""; s.style.borderColor = ""; }); const el = document.querySelector(`#aIcons .ip[data-i="${nm}"]`); if (el) { el.classList.add("on"); el.style.color = _aColor; el.style.borderColor = _aColor; } }
function saveActivity(id) {
  const name = document.getElementById("aName").value.trim(); if (!name) return;
  if (id) Object.assign(getAct(id), { name, type: _aType, icon: _aIcon, color: _aColor });
  else CFG.activities.push({ id: uid("act"), name, type: _aType, icon: _aIcon, color: _aColor });
  saveCfg(); closeModal(); render();
}
function delActivity(id) { CFG.activities = CFG.activities.filter(a => a.id !== id); saveCfg(); closeModal(); render(); }

/* ========================= METAS ========================= */
function renderMetas() {
  const l = day(today());
  let out = header("Mis metas", "¿Quién quiero llegar a ser?");
  out += CFG.identities.map(id => {
    const hs = CFG.habits.filter(h => h.idn === id.id), cs = CFG.commitments.filter(c => c.idn === id.id);
    const total = hs.length + cs.length, done = hs.filter(h => l.habits[h.id]).length + cs.filter(c => l.commitments[c.id]).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    return `<div class="gcard" style="background:linear-gradient(135deg, ${id.raw}22, var(--card))" onclick="openGoal('${id.id}')">
      <div class="top"><span class="gicon" style="background:${id.raw}22;color:${id.raw}">${icon(id.icon)}</span><div class="gt">${esc(id.label)}</div></div>
      <div class="gw">${esc(id.why)}</div><div class="gbar"><i style="width:${pct}%;background:${id.raw}"></i></div>
      <div class="gpct"><span>${done}/${total} hoy</span><span style="color:${id.raw}">${pct}%</span></div></div>`;
  }).join("");
  out += `<button class="addbtn" onclick="openEditIdentity()">${icon("plus")} Nueva meta</button>`;
  app.innerHTML = out;
}

/* ========================= AJUSTES ========================= */
function manageRow(item, kind) {
  const idn = getIdn(item.idn);
  const left = kind === "identity" ? `<span class="idi" style="background:${item.raw}22;color:${item.raw}">${icon(item.icon)}</span>` : `<span class="dotc" style="background:${idn.raw}"></span>`;
  const name = kind === "identity" ? item.label : item.name;
  const fn = kind === "identity" ? "openEditIdentity" : (kind === "habit" ? "openEditHabit" : "openEditCommit");
  return `<div class="row" onclick="${fn}('${item.id}')">${left}<div class="body"><div class="name">${esc(name)}</div>${kind !== "identity" ? `<div class="sub"><span style="color:${idn.raw}">${esc(idn.label)}</span></div>` : ""}</div><button class="note-btn">${icon("edit")}</button></div>`;
}
function renderAjustes() {
  const mv = CFG.settings.mealView;
  let out = header("Ajustes", "Personaliza tu app");
  out += sec("a_profile", "Perfil", "", `<div class="lbl" style="margin-top:2px">Tu nombre</div><input class="field" value="${esc(CFG.settings.userName)}" onchange="setUserName(this.value)">`, "sliders", "var(--muted)");
  out += sec("a_id", "Identidades / Metas", String(CFG.identities.length),
    CFG.identities.map(i => manageRow(i, "identity")).join("") + `<button class="addbtn" onclick="openEditIdentity()">${icon("plus")} Nueva meta</button>`, "target", "var(--ingresos)");
  out += sec("a_hab", "Hábitos", String(CFG.habits.length),
    (CFG.habits.map(i => manageRow(i, "habit")).join("") || `<div class="empty">Ninguno</div>`) + `<button class="addbtn" onclick="openEditHabit()">${icon("plus")} Nuevo hábito</button>`, "check", "var(--ok)");
  out += sec("a_com", "Compromisos", String(CFG.commitments.length),
    (CFG.commitments.map(i => manageRow(i, "commit")).join("") || `<div class="empty">Ninguno</div>`) + `<button class="addbtn" onclick="openEditCommit()">${icon("plus")} Nuevo compromiso</button>`, "flame", "var(--ok)");
  out += sec("a_met", "Métricas", String(CFG.metrics.length),
    (CFG.metrics.map(m => {
      const idn = getIdn(m.idn);
      return `<div class="row" onclick="openEditMetric('${m.id}')"><span class="dotc" style="background:${idn.raw}"></span><div class="body"><div class="name">${esc(m.name)}</div><div class="sub">${m.unit ? esc(m.unit) : "sin unidad"}${m.target ? " · meta " + esc(m.target) : ""}</div></div><button class="note-btn">${icon("edit")}</button></div>`;
    }).join("") || `<div class="empty">Ninguna. Sirven para registrar números: peso, horas de estudio, pantalla.</div>`)
    + `<button class="addbtn" onclick="openEditMetric()">${icon("plus")} Nueva métrica</button>`, "chart", "var(--ciber)");
  let mealsBody = `<div class="lbl" style="margin-top:2px">Sistema de comidas (solo se muestra el que elijas)</div>
    <div class="seg small"><button class="${mv === "menu" ? "on" : ""}" onclick="setMealView('menu')">Menú</button><button class="${mv === "fichas" ? "on" : ""}" onclick="setMealView('fichas')">Fichas</button></div>`;
  if (mv === "menu") {
    mealsBody += `<div class="subhead2">Comidas del menú</div>`
      + (CFG.meals.menu.map(m => `<div class="row" onclick="openEditMeal('${m.id}')"><span class="idi" style="background:#FF5A3C22;color:var(--cuerpo)">${icon("meal")}</span><div class="body"><div class="name">${esc(m.name)}</div>${m.desc ? `<div class="sub">${esc(m.desc)}</div>` : ""}</div><button class="note-btn">${icon("edit")}</button></div>`).join("") || `<div class="empty">Ninguna</div>`)
      + `<button class="addbtn" onclick="openEditMeal()">${icon("plus")} Nueva comida</button>`;
  } else {
    mealsBody += `<div class="subhead2">Categorías de fichas</div>`
      + (CFG.meals.fichas.categories.map(c => `<div class="row" onclick="openEditCat('${c.id}')"><span class="dotc" style="background:${c.color}"></span><div class="body"><div class="name">${esc(c.name)}</div><div class="sub">${c.quota} fichas/día · ${(CFG.meals.fichas.catalog[c.id] || []).length} opciones</div></div><button class="note-btn">${icon("edit")}</button></div>`).join("") || `<div class="empty">Ninguna</div>`)
      + `<button class="addbtn" onclick="openEditCat()">${icon("plus")} Nueva categoría</button>`
      + `<div class="subhead2">Innegociables</div>`
      + (CFG.meals.fichas.innegociables.map(n => `<div class="row" onclick="openEditInneg('${n.id}')"><span class="dotc" style="background:var(--ok)"></span><div class="body"><div class="name">${esc(n.name)}</div></div><button class="note-btn">${icon("edit")}</button></div>`).join("") || `<div class="empty">Ninguno</div>`)
      + `<button class="addbtn" onclick="openEditInneg()">${icon("plus")} Nuevo innegociable</button>`;
  }
  mealsBody += `<div style="height:6px"></div><button class="addbtn" onclick="openImportMeals()">${icon("upload")} Importar comidas (JSON)</button><button class="addbtn" onclick="exportMeals()">${icon("download")} Exportar comidas (JSON)</button>`;
  out += sec("a_meals", "Comidas", mv === "menu" ? "Menú" : "Fichas", mealsBody, "meal", "var(--cuerpo)");
  out += sec("a_data", "Datos y respaldo", "",
    `<div class="subhead2" style="padding-top:2px">Plan</div>
     <div class="empty" style="text-align:left;padding:0 2px 8px">Metas, hábitos, compromisos y métricas en un solo JSON. No toca tu historial.</div>
     <button class="addbtn" onclick="openImportPlan()">${icon("upload")} Importar plan (JSON)</button>
     <button class="addbtn" onclick="exportPlan()">${icon("download")} Exportar plan (JSON)</button>
     <div class="subhead2">Respaldo completo</div>
     <div class="empty" style="text-align:left;padding:0 2px 8px">Un archivo con TODOS tus datos (config, historial, tareas y entrenos). Guárdalo por si cambias de dispositivo o de dominio.</div>
     <button class="addbtn" onclick="exportAllData()">${icon("download")} Descargar respaldo</button>
     <button class="addbtn" onclick="openImportData()">${icon("upload")} Restaurar respaldo</button>`, "sliders", "var(--muted)");
  if (typeof cloudSection === "function") out += cloudSection();
  if (typeof notifSection === "function") out += notifSection();
  app.innerHTML = out;
}
function setUserName(v) { CFG.settings.userName = v.trim() || "tú"; saveCfg(); }

/* ---------- Acciones día ---------- */
function toggleSec(id) { if (window._justDragged) { window._justDragged = false; return; } COLLAPSE[id] = !COLLAPSE[id]; render(); }
function toggleHabit(d, id) { const l = day(d); l.habits[id] = !l.habits[id]; recalcDay(d); saveLog(); render(); }
function toggleCommit(d, id) { const l = day(d); l.commitments[id] = !l.commitments[id]; recalcDay(d); saveLog(); render(); }
function setSleep(d, s) { const l = day(d); l.sleep = l.sleep === s ? null : s; recalcDay(d); saveLog(); render(); }
function setMood(d, n) { const l = day(d); l.mood = l.mood === n ? null : n; recalcDay(d); saveLog(); render(); }
function setJournal(d, v) { const l = day(d); l.journal = v; recalcDay(d); saveLog(); }
function toggleTask(id) { const t = TASKS.find(x => x.id === id); if (t) { t.done = !t.done; saveTasks(); render(); } }
function delTask(id) { TASKS = TASKS.filter(x => x.id !== id); saveTasks(); render(); }

/* ---------- Modales ---------- */
const modal = document.getElementById("modal");
function closeModal() { modal.innerHTML = ""; }
function sheet(inner) { modal.innerHTML = `<div class="ov" onclick="if(event.target===this)closeModal()"><div class="sheet">${inner}</div></div>`; }

let _emo = null;
function openNote(d, hid) {
  const l = day(d), n = l.notes[hid] || { note: "", emotion: null }, h = CFG.habits.find(x => x.id === hid) || { name: "" };
  _emo = n.emotion;
  sheet(`<h3>${esc(h.name)}</h3><div class="mm">Nota y emoción (opcional)</div>
    <textarea id="ntxt" placeholder="¿Cómo te fue con esto hoy?">${esc(n.note)}</textarea>
    <div class="lbl">¿Cómo te sentiste? (1–10)</div><div class="scale">${[1,2,3,4,5,6,7,8,9,10].map(i => `<b class="${n.emotion === i ? "on" : ""}" onclick="pickEmo(this,${i})">${i}</b>`).join("")}</div>
    <button class="btn p" onclick="saveNote('${d}','${hid}')">Guardar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function pickEmo(el, i) { _emo = i; document.querySelectorAll(".scale b").forEach(b => b.classList.remove("on")); el.classList.add("on"); }
function saveNote(d, hid) { const l = day(d); l.notes[hid] = { note: document.getElementById("ntxt").value, emotion: _emo }; _emo = null; saveLog(); closeModal(); render(); }

let _tidn = null, _taskDate = null;
function openTask(prefill) {
  _tidn = null; _taskDate = prefill || today();
  sheet(`<h3>Nueva tarea</h3><div class="mm">Ponle hora si es una cita o evento</div>
    <textarea id="ttxt" placeholder="Ej: mandar correo / dentista..." style="min-height:60px"></textarea>
    <div class="lbl">¿Para qué día?</div>
    <div class="chips" id="dchips"><div class="chip" data-d="${today()}" onclick="pickDate('${today()}')">Hoy</div><div class="chip" data-d="${addDays(today(),1)}" onclick="pickDate('${addDays(today(),1)}')">Mañana</div>
      <input type="date" id="tdate" class="field" style="width:auto;padding:8px 10px" value="${_taskDate}" onchange="pickDateInput(this.value)"></div>
    <div class="lbl">Hora (opcional)</div><input id="ttime" class="field" placeholder="9:15 am">
    <div class="lbl">¿Conectada a una meta? (opcional)</div><div class="chips" id="pickidn" style="padding:0">${idnChips(null)}</div>
    <button class="btn p" onclick="saveTask()">Agregar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
  highlightDate();
}
function pickDate(d) { _taskDate = d; const el = document.getElementById("tdate"); if (el) el.value = d; highlightDate(); }
function pickDateInput(v) { if (v) { _taskDate = v; highlightDate(); } }
function highlightDate() { document.querySelectorAll("#dchips .chip").forEach(c => { const on = c.dataset.d === _taskDate; c.classList.toggle("on", on); c.style.background = on ? "var(--ingresos)" : ""; c.style.borderColor = on ? "var(--ingresos)" : ""; c.style.color = on ? "#fff" : ""; }); }
function idnChips(sel) { return CFG.identities.map(i => `<div class="chip" data-id="${i.id}" onclick="pickIdn(this,'${i.id}')" style="${sel === i.id ? `background:${i.raw};color:#fff;border-color:${i.raw}` : ""}">${esc(i.label)}</div>`).join(""); }
function pickIdn(el, id) { _tidn = _tidn === id ? null : id; document.querySelectorAll("#pickidn .chip").forEach(c => { c.style.background = ""; c.style.color = ""; c.style.borderColor = ""; }); if (_tidn) { el.style.background = getIdn(id).raw; el.style.color = "#fff"; el.style.borderColor = getIdn(id).raw; } }
function saveTask() { const text = document.getElementById("ttxt").value.trim(); if (!text) return closeModal(); TASKS.push({ id: uid("t"), text, time: document.getElementById("ttime").value.trim(), idn: _tidn, done: false, date: _taskDate || today() }); _tidn = null; saveTasks(); closeModal(); render(); }

/* ---------- Fotos por meta (vision board, en IndexedDB) ---------- */
let _photoDB = null;
function photoDB() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej("sin indexedDB");
    if (_photoDB) return res(_photoDB);
    const r = indexedDB.open("miturno", 1);
    r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains("photos")) { const s = db.createObjectStore("photos", { keyPath: "id", autoIncrement: true }); s.createIndex("idn", "idn", { unique: false }); } };
    r.onsuccess = e => { _photoDB = e.target.result; res(_photoDB); };
    r.onerror = e => rej(e);
  });
}
function idbGetPhotos(idn) {
  return photoDB().then(db => new Promise((res, rej) => {
    const idx = db.transaction("photos", "readonly").objectStore("photos").index("idn").getAll(idn);
    idx.onsuccess = () => res(idx.result || []); idx.onerror = () => rej(idx.error);
  }));
}
function idbAddPhoto(idn, dataUrl) {
  return photoDB().then(db => new Promise((res, rej) => {
    const rq = db.transaction("photos", "readwrite").objectStore("photos").add({ idn, dataUrl });
    rq.onsuccess = () => res(); rq.onerror = () => rej(rq.error);
  }));
}
function idbDelPhoto(id) {
  return photoDB().then(db => new Promise((res, rej) => {
    const rq = db.transaction("photos", "readwrite").objectStore("photos").delete(id);
    rq.onsuccess = () => res(); rq.onerror = () => rej(rq.error);
  }));
}
function compressImage(file, cb) {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 1100; let w = img.width, h = img.height;
    if (w > h && w > max) { h = Math.round(h * max / w); w = max; } else if (h > max) { w = Math.round(w * max / h); h = max; }
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    try { cb(c.toDataURL("image/jpeg", 0.82)); } catch (e) { cb(null); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); cb(null); };
  img.src = url;
}
function idbUpdatePhoto(pid, caption) {
  return photoDB().then(db => new Promise((res, rej) => {
    const st = db.transaction("photos", "readwrite").objectStore("photos");
    const g = st.get(pid);
    g.onsuccess = () => { const rec = g.result; if (!rec) return res(); rec.caption = caption; const p = st.put(rec); p.onsuccess = () => res(); p.onerror = () => rej(p.error); };
    g.onerror = () => rej(g.error);
  }));
}
function loadGoalPhotos(id) {
  const box = document.getElementById("vboard"); if (!box) return;
  const g = getIdn(id);
  idbGetPhotos(id).then(list => {
    if (!list.length) { box.innerHTML = `<div class="vempty"><span style="color:${g.raw}">${icon("star")}</span><b>Tu tablero está en blanco</b><span>Agrega imágenes de la vida que estás construyendo. Cada una cuenta parte de tu historia.</span></div>`; return; }
    box.innerHTML = list.map((p, i) => `<figure class="vcard ${i % 5 === 0 ? "wide" : ""}" onclick="openPhoto(${p.id},'${id}')" style="--acc:${g.raw}">
      <img src="${p.dataUrl}" alt="">
      <figcaption>${p.caption ? esc(p.caption) : `<span class="vcap-empty">Toca para contar su historia</span>`}</figcaption>
    </figure>`).join("");
  }).catch(() => { box.innerHTML = `<div class="vempty"><span>Las fotos se guardan en este dispositivo.</span></div>`; });
}
function addGoalPhoto(id, input) {
  const f = input.files && input.files[0]; if (!f) return;
  const box = document.getElementById("vboard"); if (box) box.innerHTML = `<div class="vempty"><span>Procesando imagen...</span></div>`;
  compressImage(f, dataUrl => { if (!dataUrl) return loadGoalPhotos(id); idbAddPhoto(id, dataUrl).then(() => loadGoalPhotos(id)).catch(() => loadGoalPhotos(id)); });
  input.value = "";
}
function delGoalPhoto(pid, id) { idbDelPhoto(pid).then(() => { closePhoto(); loadGoalPhotos(id); }).catch(() => loadGoalPhotos(id)); }
function openPhoto(pid, id) {
  idbGetPhotos(id).then(list => {
    const p = list.find(x => x.id === pid); if (!p) return;
    const g = getIdn(id);
    const lay = document.getElementById("vlayer"); if (!lay) return;
    lay.innerHTML = `<div class="vfull" onclick="if(event.target===this)closePhoto()">
      <div class="vfull-inner">
        <img src="${p.dataUrl}" alt="">
        <div class="vfull-cap"><input id="vcap" value="${esc(p.caption)}" placeholder="¿Qué representa esta imagen?" style="border-color:${g.raw}55">
          <div class="vfull-btns"><button onclick="savePhotoCaption(${pid},'${id}')" style="background:${g.raw}">Guardar</button>
            <button onclick="delGoalPhoto(${pid},'${id}')" class="danger">Borrar</button>
            <button onclick="closePhoto()">Cerrar</button></div></div>
      </div></div>`;
  });
}
function savePhotoCaption(pid, id) {
  const el = document.getElementById("vcap"); const cap = el ? el.value.trim() : "";
  idbUpdatePhoto(pid, cap).then(() => { closePhoto(); loadGoalPhotos(id); }).catch(() => closePhoto());
}
function closePhoto() { const lay = document.getElementById("vlayer"); if (lay) lay.innerHTML = ""; }

/* Consistencia de una identidad en los últimos 30 días */
function idnConsistency(id) {
  const hs = CFG.habits.filter(h => h.idn === id), cs = CFG.commitments.filter(c => c.idn === id);
  const total = hs.length + cs.length; if (!total) return null;
  let sum = 0, days = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(today(), -i), l = LOG[d]; if (!l) continue;
    const done = hs.filter(h => l.habits && l.habits[h.id]).length + cs.filter(c => l.commitments && l.commitments[c.id]).length;
    sum += done / total; days++;
  }
  return days ? Math.round(sum / days * 100) : 0;
}

function openGoal(id) {
  const g = getIdn(id), l = day(today());
  const hs = CFG.habits.filter(h => h.idn === id), cs = CFG.commitments.filter(c => c.idn === id);
  const total = hs.length + cs.length;
  const done = hs.filter(h => l.habits[h.id]).length + cs.filter(c => l.commitments[c.id]).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const cons = idnConsistency(id);
  const bestStreak = cs.length ? Math.max(...cs.map(c => streak(c.id))) : 0;
  const c0 = 2 * Math.PI * 30;
  const quotes = g.quotes || [];
  modal.innerHTML = `<div class="goalview" style="--acc:${g.raw}">
    <div class="gv-scroll">
      <div class="gv-hero">
        <button class="gv-close" onclick="closeModal()">${icon("close")}</button>
        <div class="gv-glow"></div>
        <div class="gv-badge">${icon(g.icon)}</div>
        <div class="gv-eyebrow">Estoy construyendo a</div>
        <h1 class="gv-title">${esc(g.label)}</h1>
        <div class="gv-ring">
          <svg width="72" height="72"><circle cx="36" cy="36" r="30" stroke="rgba(255,255,255,.12)" stroke-width="5" fill="none"/>
          <circle cx="36" cy="36" r="30" stroke="${g.raw}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${c0}" stroke-dashoffset="${c0 * (1 - pct / 100)}" transform="rotate(-90 36 36)"/></svg>
          <span>${pct}%</span></div>
        <div class="gv-stats">
          <div><b>${done}/${total}</b><span>hoy</span></div>
          ${cons !== null ? `<div><b>${cons}%</b><span>últimos 30 días</span></div>` : ""}
          ${bestStreak ? `<div><b>${bestStreak}</b><span>días de racha</span></div>` : ""}
        </div>
      </div>

      ${g.why ? `<section class="gv-sec"><div class="gv-label">Mi para qué</div><blockquote class="gv-why">${esc(g.why)}</blockquote></section>` : ""}

      ${quotes.length ? `<section class="gv-sec"><div class="gv-label">Recordatorios</div>
        <div class="gv-quotes">${quotes.map(q => `<div class="gv-quote"><span class="gv-qmark">"</span>${esc(q)}</div>`).join("")}</div></section>` : ""}

      <section class="gv-sec"><div class="gv-label">Vision board</div>
        <div id="vboard" class="vgrid"><div class="vempty"><span>Cargando...</span></div></div>
        <label class="gv-addphoto">${icon("plus")} Agregar imagen<input type="file" accept="image/*" style="display:none" onchange="addGoalPhoto('${id}',this)"></label>
      </section>

      ${total ? `<section class="gv-sec"><div class="gv-label">Lo que vota por esta identidad</div>
        <div class="gv-votes">${hs.map(h => `<span class="gv-vote ${l.habits[h.id] ? "on" : ""}">${l.habits[h.id] ? icon("check") : ""}${esc(h.name)}</span>`).join("")}
        ${cs.map(c => `<span class="gv-vote ${l.commitments[c.id] ? "on" : ""}">${l.commitments[c.id] ? icon("check") : ""}${esc(c.name)}</span>`).join("")}</div></section>` : ""}

      <div class="gv-actions">
        <button class="gv-btn primary" onclick="openEditIdentity('${id}')">Editar meta</button>
        <button class="gv-btn" onclick="closeModal()">Cerrar</button>
      </div>
    </div>
    <div id="vlayer"></div>
  </div>`;
  loadGoalPhotos(id);
}

let _eColor = null, _eIcon = null;
function openEditIdentity(id) {
  const editing = !!id, it = editing ? getIdn(id) : { label: "", icon: ICON_CHOICES[0], raw: PALETTE[0], why: "", quotes: [] };
  _eColor = it.raw; _eIcon = it.icon;
  sheet(`<h3>${editing ? "Editar meta" : "Nueva meta"}</h3><div class="mm">Una identidad que quieres construir</div>
    <div class="lbl">Nombre</div><input id="eName" class="field" value="${esc(it.label)}" placeholder="El que...">
    <div class="lbl">Color</div><div class="swatches" id="eColors">${PALETTE.map(c => `<span class="sw ${c === it.raw ? "on" : ""}" style="background:${c}" onclick="pickColor('${c}')"></span>`).join("")}</div>
    <div class="lbl">Ícono</div><div class="iconpick" id="eIcons">${ICON_CHOICES.map(nm => `<span class="ip ${nm === it.icon ? "on" : ""}" data-i="${nm}" onclick="pickIcon('${nm}')" style="${nm === it.icon ? `color:${it.raw};border-color:${it.raw}` : ""}">${icon(nm)}</span>`).join("")}</div>
    <div class="lbl">Mi para qué</div><textarea id="eWhy" placeholder="¿Por qué importa?">${esc(it.why)}</textarea>
    <div class="lbl">Frases (una por línea)</div><textarea id="eQuotes" placeholder="Aún no somos quien queremos llegar a ser">${esc((it.quotes || []).join("\n"))}</textarea>
    <button class="btn p" onclick="saveIdentity('${editing ? id : ""}')">${editing ? "Guardar" : "Crear meta"}</button>
    ${editing ? `<button class="btn g" onclick="delIdentity('${id}')" style="color:var(--bad)">Borrar meta</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function pickColor(c) { _eColor = c; document.querySelectorAll("#eColors .sw").forEach(s => s.classList.toggle("on", rgbToHex(s.style.background) === c.toLowerCase())); document.querySelectorAll("#eIcons .ip.on").forEach(s => { s.style.color = c; s.style.borderColor = c; }); }
function pickIcon(nm) { _eIcon = nm; document.querySelectorAll("#eIcons .ip").forEach(s => { s.classList.remove("on"); s.style.color = ""; s.style.borderColor = ""; }); const el = document.querySelector(`#eIcons .ip[data-i="${nm}"]`); if (el) { el.classList.add("on"); el.style.color = _eColor; el.style.borderColor = _eColor; } }
function rgbToHex(rgb) { const m = rgb.match(/\d+/g); if (!m) return rgb; return "#" + m.slice(0, 3).map(x => (+x).toString(16).padStart(2, "0")).join(""); }
function saveIdentity(id) {
  const label = document.getElementById("eName").value.trim(); if (!label) return;
  const why = document.getElementById("eWhy").value.trim(), quotes = document.getElementById("eQuotes").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (id) Object.assign(CFG.identities.find(i => i.id === id), { label, why, quotes, raw: _eColor, icon: _eIcon });
  else CFG.identities.push({ id: uid("id"), label, why, quotes, raw: _eColor, icon: _eIcon });
  saveCfg(); closeModal(); render();
}
function delIdentity(id) { CFG.identities = CFG.identities.filter(i => i.id !== id); CFG.habits.forEach(h => { if (h.idn === id) h.idn = null; }); CFG.commitments.forEach(c => { if (c.idn === id) c.idn = null; }); saveCfg(); closeModal(); render(); }

function itemEditor(kind, id) {
  const list = kind === "habit" ? CFG.habits : CFG.commitments;
  const editing = !!id, it = editing ? list.find(x => x.id === id) : { name: "", idn: null, time: "" };
  _tidn = it.idn; const title = kind === "habit" ? "hábito" : "compromiso";
  sheet(`<h3>${editing ? "Editar " + title : "Nuevo " + title}</h3><div class="mm">${kind === "habit" ? "Algo que quieres hacer" : "Algo que quieres dejar (lleva racha)"}</div>
    <div class="lbl">Nombre</div><input id="iName" class="field" value="${esc(it.name)}" placeholder="${kind === "habit" ? "Ej: Leer 20 minutos" : "Ej: Sin azúcar"}">
    ${kind === "habit" ? `<div class="lbl">Hora (opcional · ordena tu lista de hoy)</div><input id="iTime" class="field" type="time" value="${esc(it.time || "")}">` : ""}
    ${CFG.identities.length ? `<div class="lbl">¿Conectado a una meta? (opcional)</div><div class="chips" id="pickidn" style="padding:0">${idnChips(it.idn)}</div>` : ""}
    <button class="btn p" onclick="saveItem('${kind}','${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delItem('${kind}','${id}')" style="color:var(--bad)">Borrar</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function openEditHabit(id) { itemEditor("habit", id); }
function openEditCommit(id) { itemEditor("commit", id); }
function saveItem(kind, id) {
  const name = document.getElementById("iName").value.trim(); if (!name) return;
  freezePastDays();
  const tEl = document.getElementById("iTime"), time = tEl ? tEl.value : "";
  const list = kind === "habit" ? CFG.habits : CFG.commitments;
  if (id) { const it = list.find(x => x.id === id); it.name = name; it.idn = _tidn; if (kind === "habit") it.time = time; }
  else { const nu = { id: uid(kind), name, idn: _tidn }; if (kind === "habit") nu.time = time; list.push(nu); }
  _tidn = null; saveCfg(); closeModal(); render();
}
function delItem(kind, id) { freezePastDays(); if (kind === "habit") CFG.habits = CFG.habits.filter(x => x.id !== id); else CFG.commitments = CFG.commitments.filter(x => x.id !== id); saveCfg(); closeModal(); render(); }

/* ---------- Métricas (editor) ---------- */
function openEditMetric(id) {
  const editing = !!id, it = editing ? CFG.metrics.find(x => x.id === id) : { name: "", unit: "", target: "", idn: null };
  _tidn = it.idn;
  sheet(`<h3>${editing ? "Editar métrica" : "Nueva métrica"}</h3><div class="mm">Un número que registras cada día. No suma puntos: sirve para ver tendencias.</div>
    <div class="lbl">Nombre</div><input id="qName" class="field" value="${esc(it.name)}" placeholder="Ej: Peso, Horas de estudio, Pantalla">
    <div class="lbl">Unidad (opcional)</div><input id="qUnit" class="field" value="${esc(it.unit || "")}" placeholder="kg · h · min">
    <div class="lbl">Meta (opcional · solo se muestra como referencia)</div><input id="qTarget" class="field" value="${esc(it.target || "")}" placeholder="Ej: 6.5">
    ${CFG.identities.length ? `<div class="lbl">¿Conectada a una meta? (opcional)</div><div class="chips" id="pickidn" style="padding:0">${idnChips(it.idn)}</div>` : ""}
    <button class="btn p" onclick="saveMetric('${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delMetric('${id}')" style="color:var(--bad)">Borrar</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function saveMetric(id) {
  const name = document.getElementById("qName").value.trim(); if (!name) return;
  const unit = document.getElementById("qUnit").value.trim();
  const target = document.getElementById("qTarget").value.trim();
  if (id) { const it = CFG.metrics.find(x => x.id === id); it.name = name; it.unit = unit; it.target = target; it.idn = _tidn; }
  else CFG.metrics.push({ id: uid("q"), name, unit, target, idn: _tidn });
  _tidn = null; saveCfg(); closeModal(); render();
}
function delMetric(id) { CFG.metrics = CFG.metrics.filter(x => x.id !== id); saveCfg(); closeModal(); render(); }

/* ---------- Comidas (menú) ---------- */
function openEditMeal(id) {
  const editing = !!id, it = editing ? CFG.meals.menu.find(m => m.id === id) : { name: "", desc: "" };
  sheet(`<h3>${editing ? "Editar comida" : "Nueva comida"}</h3>
    <div class="lbl">Nombre</div><input id="mName" class="field" value="${esc(it.name)}" placeholder="Desayuno">
    <div class="lbl">Menú / descripción (opcional)</div><textarea id="mDesc" placeholder="Qué lleva esta comida">${esc(it.desc)}</textarea>
    <button class="btn p" onclick="saveMeal('${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delMeal('${id}')" style="color:var(--bad)">Borrar</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function saveMeal(id) { const name = document.getElementById("mName").value.trim(); if (!name) return; freezePastDays(); const desc = document.getElementById("mDesc").value.trim(); if (id) { const it = CFG.meals.menu.find(m => m.id === id); it.name = name; it.desc = desc; } else CFG.meals.menu.push({ id: uid("m"), name, desc }); saveCfg(); closeModal(); render(); }
function delMeal(id) { freezePastDays(); CFG.meals.menu = CFG.meals.menu.filter(m => m.id !== id); saveCfg(); closeModal(); render(); }

/* ---------- Comidas (fichas + opciones) ---------- */
function openEditCat(id) {
  const editing = !!id, it = editing ? CFG.meals.fichas.categories.find(c => c.id === id) : { name: "", color: PALETTE[0], quota: 3 };
  _eColor = it.color;
  const foods = editing ? (CFG.meals.fichas.catalog[id] || []) : [];
  const foodList = editing
    ? `<div class="subhead2">Opciones (cada ficha equivale a una)</div>`
      + (foods.length ? foods.map((o, i) => `<div class="row" onclick="openEditFood('${id}',${i})"><span class="dotc" style="background:${it.color}"></span><div class="body"><div class="name">${esc(o.food)}</div><div class="sub">${esc(o.amount)}${o.note ? " · " + esc(o.note) : ""}</div></div><button class="note-btn">${icon("edit")}</button></div>`).join("") : `<div class="empty">Sin opciones</div>`)
      + `<button class="addbtn" onclick="openEditFood('${id}')">${icon("plus")} Agregar opción</button>`
    : `<div class="empty" style="text-align:left;padding:8px 2px">Guarda la categoría primero para agregarle sus opciones.</div>`;
  sheet(`<h3>${editing ? "Editar categoría" : "Nueva categoría de fichas"}</h3>
    <div class="lbl">Nombre</div><input id="cName" class="field" value="${esc(it.name)}" placeholder="Proteína">
    <div class="lbl">Fichas por día</div><input id="cQuota" class="field" type="number" min="1" value="${it.quota}">
    <div class="lbl">Color</div><div class="swatches" id="eColors">${PALETTE.map(c => `<span class="sw ${c === it.color ? "on" : ""}" style="background:${c}" onclick="pickColorCat('${c}')"></span>`).join("")}</div>
    ${foodList}
    <button class="btn p" onclick="saveCat('${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delCat('${id}')" style="color:var(--bad)">Borrar categoría</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function pickColorCat(c) { _eColor = c; document.querySelectorAll("#eColors .sw").forEach(s => s.classList.toggle("on", rgbToHex(s.style.background) === c.toLowerCase())); }
function saveCat(id) {
  const name = document.getElementById("cName").value.trim(); if (!name) return;
  freezePastDays();
  const quota = Math.max(1, parseInt(document.getElementById("cQuota").value) || 1);
  if (id) { const it = CFG.meals.fichas.categories.find(c => c.id === id); it.name = name; it.quota = quota; it.color = _eColor; }
  else { const nid = uid("cat"); CFG.meals.fichas.categories.push({ id: nid, name, quota, color: _eColor }); CFG.meals.fichas.catalog[nid] = []; }
  saveCfg(); closeModal(); render();
}
function delCat(id) { freezePastDays(); CFG.meals.fichas.categories = CFG.meals.fichas.categories.filter(c => c.id !== id); delete CFG.meals.fichas.catalog[id]; saveCfg(); closeModal(); render(); }
function openEditFood(cid, idx) {
  const editing = idx != null, list = CFG.meals.fichas.catalog[cid] || (CFG.meals.fichas.catalog[cid] = []);
  const it = editing ? list[idx] : { food: "", amount: "", note: "" };
  sheet(`<h3>${editing ? "Editar opción" : "Nueva opción"}</h3>
    <div class="lbl">Alimento</div><input id="fFood" class="field" value="${esc(it.food)}" placeholder="Pechuga de pollo">
    <div class="lbl">Cantidad</div><input id="fAmt" class="field" value="${esc(it.amount)}" placeholder="175 g">
    <div class="lbl">Nota (opcional)</div><input id="fNote" class="field" value="${esc(it.note)}" placeholder="Magra">
    <button class="btn p" onclick="saveFood('${cid}',${editing ? idx : -1})">${editing ? "Guardar" : "Agregar"}</button>
    ${editing ? `<button class="btn g" onclick="delFood('${cid}',${idx})" style="color:var(--bad)">Borrar</button>` : ""}<button class="btn g" onclick="openEditCat('${cid}')">Volver</button>`);
}
function saveFood(cid, idx) {
  const food = document.getElementById("fFood").value.trim(); if (!food) return openEditCat(cid);
  const o = { food, amount: document.getElementById("fAmt").value.trim(), note: document.getElementById("fNote").value.trim() };
  const list = CFG.meals.fichas.catalog[cid] || (CFG.meals.fichas.catalog[cid] = []);
  if (idx >= 0) list[idx] = o; else list.push(o);
  saveCfg(); openEditCat(cid);
}
function delFood(cid, idx) { CFG.meals.fichas.catalog[cid].splice(idx, 1); saveCfg(); openEditCat(cid); }
function openEditInneg(id) {
  const editing = !!id, it = editing ? CFG.meals.fichas.innegociables.find(n => n.id === id) : { name: "" };
  sheet(`<h3>${editing ? "Editar innegociable" : "Nuevo innegociable"}</h3>
    <div class="lbl">Nombre</div><input id="nName" class="field" value="${esc(it.name)}" placeholder="Kefir (1 taza)">
    <button class="btn p" onclick="saveInneg('${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delInneg('${id}')" style="color:var(--bad)">Borrar</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function saveInneg(id) { const name = document.getElementById("nName").value.trim(); if (!name) return; if (id) CFG.meals.fichas.innegociables.find(n => n.id === id).name = name; else CFG.meals.fichas.innegociables.push({ id: uid("in"), name }); saveCfg(); closeModal(); render(); }
function delInneg(id) { CFG.meals.fichas.innegociables = CFG.meals.fichas.innegociables.filter(n => n.id !== id); saveCfg(); closeModal(); render(); }

/* ---------- Comidas por JSON ---------- */
/* ---------- Plan: metas, hábitos, compromisos y métricas (JSON) ----------
   Mismo patrón que la importación de comidas y rutinas. */
function openImportPlan() {
  sheet(`<h3>Importar plan (JSON)</h3><div class="mm">Reemplaza tus metas, hábitos, compromisos y métricas. No toca tu historial, tus comidas ni tus rutinas.</div>
    <textarea id="pjson" placeholder='{"identities":[{"label":"Mi cuerpo","icon":"cuerpo","color":"#FF5A3C"}],"habits":[{"name":"Despertar 5:15","time":"05:15","idn":"Mi cuerpo"}],"commitments":[{"name":"Sin azúcar"}],"metrics":[{"name":"Peso","unit":"kg"}]}' style="min-height:170px;font-family:monospace;font-size:12px"></textarea>
    <div id="pmsg" style="font-size:13px;margin-top:8px"></div>
    <button class="btn p" onclick="importPlan()">Importar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function importPlan() {
  const msg = document.getElementById("pmsg");
  let d; try { d = JSON.parse(document.getElementById("pjson").value); } catch (e) { msg.innerHTML = `<span style="color:var(--bad)">JSON inválido: ${esc(e.message)}</span>`; return; }
  const ids = [], byName = {};
  (d.identities || []).forEach(i => {
    const id = uid("idn");
    const it = { id, label: (i.label || i.name || "Meta").toString(), icon: ICONS[i.icon] ? i.icon : "target",
      raw: (i.color || i.raw || PALETTE[ids.length % PALETTE.length]).toString(),
      why: (i.why || "").toString(), quotes: Array.isArray(i.quotes) ? i.quotes.map(q => q.toString()) : [] };
    ids.push(it); byName[it.label.toLowerCase()] = id; byName[(i.id || "").toString().toLowerCase()] = id;
  });
  const link = v => { if (!v) return null; return byName[v.toString().toLowerCase()] || null; };
  const habits = (d.habits || []).map(h => ({ id: uid("habit"), name: (h.name || "Hábito").toString(), time: (h.time || "").toString(), idn: link(h.idn) }));
  const commitments = (d.commitments || []).map(c => ({ id: uid("commit"), name: (c.name || (typeof c === "string" ? c : "Compromiso")).toString(), idn: link(c.idn) }));
  const metrics = (d.metrics || []).map(m => ({ id: uid("q"), name: (m.name || "Métrica").toString(), unit: (m.unit || "").toString(), target: (m.target || "").toString(), idn: link(m.idn) }));
  if (!ids.length && !habits.length && !commitments.length && !metrics.length) { msg.innerHTML = `<span style="color:var(--bad)">No encontré identities, habits, commitments ni metrics.</span>`; return; }
  freezePastDays();
  if (ids.length) CFG.identities = ids;
  if (d.habits) CFG.habits = habits;
  if (d.commitments) CFG.commitments = commitments;
  if (d.metrics) CFG.metrics = metrics;
  saveCfg(); closeModal(); render();
}
function exportPlan() {
  const nameOf = id => { const i = CFG.identities.find(x => x.id === id); return i ? i.label : null; };
  const clean = {
    identities: CFG.identities.map(i => ({ label: i.label, icon: i.icon, color: i.raw, why: i.why, quotes: i.quotes })),
    habits: CFG.habits.map(h => ({ name: h.name, time: h.time || "", idn: nameOf(h.idn) })),
    commitments: CFG.commitments.map(c => ({ name: c.name, idn: nameOf(c.idn) })),
    metrics: CFG.metrics.map(m => ({ name: m.name, unit: m.unit, target: m.target, idn: nameOf(m.idn) }))
  };
  sheet(`<h3>Exportar plan</h3><div class="mm">Copia este JSON para respaldarlo o editarlo</div>
    <textarea style="min-height:220px;font-family:monospace;font-size:12px" onclick="this.select()">${esc(JSON.stringify(clean, null, 2))}</textarea>
    <button class="btn g" onclick="render();closeModal()">Cerrar</button>`);
}

function openImportMeals() {
  sheet(`<h3>Importar comidas (JSON)</h3><div class="mm">Reemplaza tu configuración de comidas. Revisa la guía (COMIDAS-como-importar-json).</div>
    <textarea id="mjson" placeholder='{"system":"fichas","fichas":{"categories":[{"name":"Proteína","quota":3,"foods":[{"food":"Pollo","amount":"175 g"}]}]}}' style="min-height:170px;font-family:monospace;font-size:12px"></textarea>
    <div id="mmsg" style="font-size:13px;margin-top:8px"></div>
    <button class="btn p" onclick="importMeals()">Importar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function importMeals() {
  const msg = document.getElementById("mmsg");
  let d; try { d = JSON.parse(document.getElementById("mjson").value); } catch (e) { msg.innerHTML = `<span style="color:var(--bad)">JSON inválido: ${esc(e.message)}</span>`; return; }
  const meals = { menu: [], fichas: { categories: [], catalog: {}, innegociables: [] } };
  (d.menu || []).forEach(m => meals.menu.push({ id: uid("m"), name: (m.name || "Comida").toString(), desc: (m.desc || "").toString() }));
  const f = d.fichas || {};
  (f.categories || []).forEach(c => {
    const cid = uid("cat");
    meals.fichas.categories.push({ id: cid, name: (c.name || "Categoría").toString(), quota: Math.max(1, parseInt(c.quota) || 1), color: (c.color || PALETTE[0]).toString() });
    meals.fichas.catalog[cid] = (c.foods || []).map(o => ({ food: (o.food || "").toString(), amount: (o.amount || "").toString(), note: (o.note || "").toString() }));
  });
  (f.innegociables || []).forEach(n => meals.fichas.innegociables.push({ id: uid("in"), name: (typeof n === "string" ? n : n.name || "").toString() }));
  freezePastDays();
  CFG.meals = meals;
  if (d.system === "menu" || d.system === "fichas") CFG.settings.mealView = d.system;
  saveCfg(); closeModal(); render();
}
function exportMeals() {
  const f = CFG.meals.fichas;
  const clean = { system: CFG.settings.mealView, menu: CFG.meals.menu.map(m => ({ name: m.name, desc: m.desc })),
    fichas: { categories: f.categories.map(c => ({ name: c.name, quota: c.quota, color: c.color, foods: (f.catalog[c.id] || []).map(o => ({ food: o.food, amount: o.amount, note: o.note })) })), innegociables: f.innegociables.map(n => ({ name: n.name })) } };
  sheet(`<h3>Exportar comidas</h3><div class="mm">Copia este JSON para respaldarlo o editarlo</div>
    <textarea style="min-height:220px;font-family:monospace;font-size:12px" onclick="this.select()">${esc(JSON.stringify(clean, null, 2))}</textarea>
    <button class="btn g" onclick="render();closeModal()">Cerrar</button>`);
}

/* ---------- Respaldo (exportar / importar todos los datos) ---------- */
/* mt_biz VA AQUÍ. Sin esta línea la sección de Negocio queda fuera del
   respaldo y fuera de la sincronización con Supabase (sync.js recorre esta
   misma lista), y se perdería en silencio al cambiar de dispositivo. */
const BACKUP_KEYS = ["mt_cfg", "mt_log", "mt_tasks", "mt_workouts", "mt_prog", "mt_hoyOrder", "mt_todayRoutine", "mt_activeWorkout", "mt_biz", "mt_focusRun"];
function buildBackup() {
  const data = {};
  BACKUP_KEYS.forEach(k => { const v = store.get(k); if (v != null) data[k] = v; });
  return { app: "mi-turno", version: 1, date: new Date().toISOString(), data };
}
function exportAllData() {
  const json = JSON.stringify(buildBackup(), null, 2);
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mi-turno-respaldo-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    sheet(`<h3>Copia tu respaldo</h3><div class="mm">Copia y guarda este texto en un archivo .json</div>
      <textarea style="min-height:220px;font-family:monospace;font-size:12px" onclick="this.select()">${esc(json)}</textarea>
      <button class="btn g" onclick="closeModal()">Cerrar</button>`);
  }
}
function openImportData() {
  sheet(`<h3>Restaurar respaldo</h3><div class="mm">Reemplazará TODOS tus datos actuales con los del respaldo. Esto no se puede deshacer.</div>
    <div class="lbl">Elige el archivo .json</div>
    <input type="file" accept="application/json,.json" id="bkfile" class="field" onchange="importFromFile(this)">
    <div class="lbl">O pega el contenido del respaldo</div>
    <textarea id="bkpaste" placeholder="{ &quot;app&quot;: &quot;mi-turno&quot;, ... }" style="min-height:120px;font-family:monospace;font-size:12px"></textarea>
    <div id="bkmsg" style="font-size:13px;margin-top:8px"></div>
    <button class="btn p" onclick="importFromPaste()">Restaurar</button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function applyBackup(text) {
  const msg = document.getElementById("bkmsg");
  let o; try { o = JSON.parse(text); } catch (e) { if (msg) msg.innerHTML = `<span style="color:var(--bad)">Archivo inválido: ${esc(e.message)}</span>`; return false; }
  if (!o || o.app !== "mi-turno" || !o.data) { if (msg) msg.innerHTML = `<span style="color:var(--bad)">Este no es un respaldo de Mi Turno.</span>`; return false; }
  BACKUP_KEYS.forEach(k => { if (k in o.data) store.set(k, o.data[k]); });
  return true;
}
function refreshState() {
  CFG = loadCfg(); LOG = loadLog(); TASKS = loadTasks(); WORKOUTS = loadWorkouts(); BIZ = loadBiz();
  migrateExercises();   // un respaldo viejo puede venir sin catálogo
  PROG = store.get("mt_prog") || "semana";
  HOY_ORDER = (() => { let o; try { o = JSON.parse(store.get("mt_hoyOrder")); } catch (e) { o = null; } if (!Array.isArray(o)) o = DEFAULT_HOY_ORDER.slice(); o = o.filter(k => DEFAULT_HOY_ORDER.includes(k)); DEFAULT_HOY_ORDER.forEach(k => { if (!o.includes(k)) o.push(k); }); return o; })();
  buildNav(); render();
}
function reloadApp() { try { location.reload(); } catch (e) { refreshState(); } }
function importFromPaste() { if (applyBackup(document.getElementById("bkpaste").value)) reloadApp(); }
function importFromFile(input) {
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => { if (applyBackup(e.target.result)) reloadApp(); };
  r.readAsText(f);
}

/* ========================= NEGOCIO =========================
   La idea central: cada proyecto tiene UNA sola próxima acción. No una lista
   de tareas por proyecto — un solo paso concreto. Eso es lo que mata la
   parálisis de "¿y ahora qué hago?". Un proyecto sin próxima acción es un
   proyecto detenido, así que la tarjeta lo reclama en vez de disimularlo. */
const BIZ_STATUS = ["activo", "pausado", "terminado"];
const BIZ_STALE_DAYS = 14;   // dos semanas sin tocarlo = está estancado

function bizProject(id) { return BIZ.projects.find(p => p.id === id) || null; }
function touchProject(p) { p.updatedAt = Date.now(); }
function daysSince(ts) { return ts ? Math.floor((Date.now() - ts) / 86400000) : null; }
function agoLabel(ts) {
  const d = daysSince(ts);
  if (d === null) return "sin actividad";
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return "hace " + d + " días";
  const m = Math.floor(d / 30);
  return m === 1 ? "hace 1 mes" : "hace " + m + " meses";
}
function isStale(p) { const d = daysSince(p.updatedAt); return p.status === "activo" && d !== null && d >= BIZ_STALE_DAYS; }
/* Estado de la fecha de la próxima acción. Las fechas son "YYYY-MM-DD", así
   que comparar como texto alcanza. */
function dueState(p) {
  if (!p.nextAction || !p.nextActionDue) return null;
  const t = today();
  if (p.nextActionDue < t) return "vencida";
  if (p.nextActionDue === t) return "hoy";
  return "futura";
}
/* Orden de atención (menor = más arriba): lo vencido, lo de hoy, los
   proyectos sin próxima acción escrita (no se avanza lo que no está
   definido), los estancados, y al final el resto. A igualdad, primero el
   que lleva más tiempo sin tocarse. */
function projectRank(p) {
  const ds = dueState(p);
  if (ds === "vencida") return 0;
  if (ds === "hoy") return 1;
  if (!p.nextAction) return 2;
  if (isStale(p)) return 3;
  return 4;
}
function byAttention(a, b) {
  const r = projectRank(a) - projectRank(b);
  if (r) return r;
  return (a.updatedAt || 0) - (b.updatedAt || 0);
}
function activeProjects() { return BIZ.projects.filter(p => p.status === "activo").sort(byAttention); }

function dueChip(p) {
  const ds = dueState(p);
  if (!ds) return "";
  const cls = ds === "vencida" ? " venc" : (ds === "hoy" ? " hoy" : "");
  const txt = ds === "vencida" ? "Vencida · " + fmtShort(p.nextActionDue)
            : ds === "hoy" ? "Para hoy" : "Para el " + fmtShort(p.nextActionDue);
  return `<span class="bizdue${cls}">${txt}</span>`;
}
/* El bloque de próxima acción: lo más importante de la tarjeta. Si no hay,
   ocupa el mismo espacio pero en ámbar reclamando que la definas. */
function nextActionBlock(p) {
  if (!p.nextAction) {
    return `<div class="bizna nag" onclick="event.stopPropagation();openNextAction('${p.id}')">
      <div class="lbl2">Próxima acción</div>
      <div class="txt">${icon("plus")} Define el siguiente paso</div></div>`;
  }
  const stale = isStale(p) ? `<span class="bizdue bizstale">${icon("clock")}${agoLabel(p.updatedAt)}</span>` : "";
  return `<div class="bizna">
    <div class="lbl2">Próxima acción</div>
    <div class="txt">${esc(p.nextAction)}</div>
    <div class="foot">${dueChip(p)}${stale}
      <button class="done" onclick="event.stopPropagation();completeNextAction('${p.id}')">${icon("check")}Listo</button></div></div>`;
}
function projectCard(p) {
  const st = isStale(p);
  return `<div class="gcard" style="background:linear-gradient(135deg, ${p.color}22, var(--card))" onclick="openBizProject('${p.id}')">
    <div class="top"><span class="gicon" style="background:${p.color}22;color:${p.color}">${icon("ingresos")}</span>
      <div style="flex:1;min-width:0"><div class="gt">${esc(p.name)}</div>
        <div class="bizmeta"><span class="dot" style="background:${p.color}"></span>${esc(p.status)}
          <span class="${st ? "bizstale" : ""}">· ${agoLabel(p.updatedAt)}</span></div></div></div>
    ${p.why ? `<div class="gw">${esc(p.why)}</div>` : ""}
    ${nextActionBlock(p)}</div>`;
}

/* ---------- Números del negocio: vista ---------- */
function bizMetricCard(m) {
  const pk = periodKey(m.period), v = bizMval(m.id, pk), prev = bizMval(m.id, prevPeriodKey(m.period));
  const diff = (v !== null && prev !== null) ? v - prev : null;
  const col = diff === null ? "var(--muted2)" : (diff > 0 ? "var(--ok)" : diff < 0 ? "var(--cuerpo)" : "var(--muted2)");
  const tgt = Number(m.target);
  const pct = (v !== null && tgt > 0) ? Math.max(0, Math.min(100, Math.round(v / tgt * 100))) : null;
  return `<div class="sec"><div class="sec-b" style="padding:14px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">
      <div style="min-width:0"><div class="gt">${esc(m.name)}</div>
        <div class="bizmeta">${esc(periodLabel(m.period, pk))}${diff !== null ? ` · <b style="color:${col}">${diff > 0 ? "+" : ""}${Math.round(diff * 100) / 100}</b> vs. anterior` : ""}</div></div>
      <span class="mval ${v !== null ? "on" : ""}">${fmtNum(v, m.unit)}</span></div>
    ${pct !== null ? `<div class="gbar"><i style="width:${pct}%;background:var(--ingresos)"></i></div>
      <div class="gpct"><span>${pct}% de la meta</span><span>${fmtNum(tgt, m.unit)}</span></div>` : ""}
    <canvas class="spark" id="bsp_${m.id}" width="600" height="80" style="margin-top:10px"></canvas>
    <div class="gymlinks"><button onclick="openBizMval('${m.id}')">${icon("plus")} Capturar</button><button onclick="openBizMetric('${m.id}')">${icon("edit")} Editar</button></div>
  </div></div>`;
}
function drawBizSparks() {
  BIZ.metrics.forEach(m => {
    const cv = document.getElementById("bsp_" + m.id); if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const vals = bizMvals(m.id, m.period, 8), got = vals.filter(v => v !== null);
    const W = cv.width, H = cv.height, pad = 10;
    ctx.clearRect(0, 0, W, H);
    if (!got.length) return;
    let lo = Math.min.apply(null, got), hi = Math.max.apply(null, got);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    const xs = i => vals.length > 1 ? pad + (W - 2 * pad) * (i / (vals.length - 1)) : W / 2;
    const ys = v => H - pad - (H - 2 * pad) * ((v - lo) / (hi - lo));
    ctx.strokeStyle = "#10B981"; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.beginPath();
    let started = false;
    vals.forEach((v, i) => { if (v === null) return; const x = xs(i), y = ys(v); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); });
    ctx.stroke(); ctx.fillStyle = "#10B981";
    vals.forEach((v, i) => { if (v === null) return; ctx.beginPath(); ctx.arc(xs(i), ys(v), 3, 0, 7); ctx.fill(); });
  });
}
function numerosView() {
  if (!BIZ.metrics.length) {
    return `<div class="hero" style="background:linear-gradient(140deg, #10B98133, var(--card) 70%)">
      <div class="hero-top"><span class="hero-tag" style="color:var(--ingresos);background:#10B98122">${icon("chart")} Números</span></div>
      <div class="hero-title">Mide lo que sí mueves</div>
      <div class="hero-sub">Ingreso del mes, clientes activos, ahorro para la visa. Cada número lleva su unidad y se lee solo: MXN y USD nunca se suman entre sí.</div>
      <button class="hero-cta" style="background:var(--ingresos)" onclick="openBizMetric()">${icon("plus")} Nuevo número</button></div>`;
  }
  return BIZ.metrics.map(bizMetricCard).join("")
    + `<button class="addbtn" onclick="openBizMetric()">${icon("plus")} Nuevo número</button>`;
}
/* Capturar: arranca en el periodo ACTUAL, así que normalmente son dos taps. */
function openBizMval(id, pk) {
  const m = bizMetric(id); if (!m) return;
  const key = pk || periodKey(m.period), v = bizMval(id, key);
  const ps = lastNPeriods(m.period, 4).reverse();
  sheet(`<h3>${esc(m.name)}</h3><div class="mm">${esc(periodLabel(m.period, key))}${m.unit ? " · en " + esc(m.unit) : ""}</div>
    <div class="lbl">Valor</div>
    <input id="bmVal" class="field" type="number" inputmode="decimal" step="any" value="${v === null ? "" : esc(v)}" placeholder="${m.target ? "Meta: " + esc(m.target) : "Escribe el número"}">
    <div class="lbl">Periodo</div><div class="chips" style="padding:0">${ps.map(k => `<div class="chip ${k === key ? "on" : ""}" style="${k === key ? "background:var(--ingresos);border-color:var(--ingresos);color:#0E0F13" : ""}" onclick="openBizMval('${id}','${k}')">${esc(periodLabel(m.period, k))}</div>`).join("")}</div>
    <button class="btn p" onclick="saveBizMval('${id}','${key}')">Guardar</button>
    ${v !== null ? `<button class="btn g" onclick="clearBizMval('${id}','${key}')">Quitar valor</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
  const el = document.getElementById("bmVal"); if (el) { el.focus(); el.select(); }
}
function saveBizMval(id, pk) {
  const raw = (document.getElementById("bmVal").value || "").trim();
  setBizMval(id, pk, (raw === "" || isNaN(Number(raw))) ? null : Number(raw));
  closeModal(); render();
}
function clearBizMval(id, pk) { setBizMval(id, pk, null); closeModal(); render(); }
let _bmPeriod = "mes";
function pickBmPeriod(p) { _bmPeriod = p; document.querySelectorAll("#bmPeriod button").forEach(b => b.classList.toggle("on", b.dataset.p === p)); }
function openBizMetric(id) {
  const editing = !!id, m = editing ? bizMetric(id) : null;
  if (editing && !m) return render();
  const v = m || { name: "", unit: "", target: "", period: "mes" };
  _bmPeriod = v.period;
  sheet(`<h3>${editing ? "Editar número" : "Nuevo número"}</h3>
    <div class="mm">La unidad no es cosmética: es lo que evita sumar pesos con dólares.</div>
    <div class="lbl">Nombre</div><input id="bnName" class="field" value="${esc(v.name)}" placeholder="Ingreso freelance">
    <div class="row2"><div><div class="lbl">Unidad</div><input id="bnUnit" class="field" value="${esc(v.unit)}" placeholder="MXN, USD, clientes..."></div>
      <div><div class="lbl">Meta (opcional)</div><input id="bnTarget" class="field" type="number" inputmode="decimal" step="any" value="${esc(v.target === 0 || v.target ? v.target : "")}"></div></div>
    <div class="lbl">Cada cuánto</div><div class="seg small" id="bmPeriod">${BIZ_PERIODS.map(p => `<button data-p="${p}" class="${p === v.period ? "on" : ""}" onclick="pickBmPeriod('${p}')">${cap(p === "semana" ? "semanal" : "mensual")}</button>`).join("")}</div>
    <button class="btn p" onclick="saveBizMetric('${editing ? id : ""}')">${editing ? "Guardar" : "Crear número"}</button>
    ${editing ? `<button class="btn g" style="color:var(--bad)" onclick="confirmDelBizMetric('${id}')">Borrar número</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function saveBizMetric(id) {
  const name = document.getElementById("bnName").value.trim(); if (!name) return;
  const t = (document.getElementById("bnTarget").value || "").trim();
  const data = {
    name: name, unit: document.getElementById("bnUnit").value.trim(),
    target: (t === "" || isNaN(Number(t))) ? "" : Number(t),
    period: BIZ_PERIODS.indexOf(_bmPeriod) >= 0 ? _bmPeriod : "mes"
  };
  const m = id ? bizMetric(id) : null;
  if (m) Object.assign(m, data);
  else BIZ.metrics.push(Object.assign({ id: uid("bm") }, data));
  saveBiz(); closeModal(); render();
}
function confirmDelBizMetric(id) {
  const m = bizMetric(id); if (!m) return;
  sheet(`<h3>¿Borrar "${esc(m.name)}"?</h3><div class="mm">Se borra el número y todo su histórico. Esto no se puede deshacer.</div>
    <button class="btn p" style="background:var(--bad)" onclick="delBizMetric('${id}')">Sí, borrar</button>
    <button class="btn g" onclick="openBizMetric('${id}')">Cancelar</button>`);
}
function delBizMetric(id) { BIZ.metrics = BIZ.metrics.filter(m => m.id !== id); delete BIZ.mvals[id]; saveBiz(); closeModal(); render(); }

/* ---------- Ideas: vista ---------- */
function ideaRow(i) {
  const p = i.projectId ? bizProject(i.projectId) : null;
  const desc = i.status === "descartada";
  return `<div class="row" style="${desc ? "opacity:.45" : ""}" onclick="openPromoteIdea('${i.id}')">
    <span class="dotc" style="background:${desc ? "var(--muted2)" : i.status === "guardada" ? "var(--ingresos)" : "var(--lectura)"}"></span>
    <div class="body"><div class="name" style="${desc ? "text-decoration:line-through" : ""}">${esc(i.text)}</div>
      <div class="sub">${esc(i.status)} · ${agoLabel(i.ts)}${p ? " · " + esc(p.name) : ""}</div></div>
    <span class="chev">${icon("chevron")}</span></div>`;
}
function ideasView() {
  const all = ideasSorted(), inbox = all.filter(i => i.status === "inbox");
  const captura = `<div class="sec"><div class="sec-b" style="padding:14px">
    <div class="lbl" style="margin-top:0">Captura rápida</div>
    <input id="ideaIn" class="field" placeholder="Escribe la idea y presiona Enter" onkeydown="if(event.key==='Enter'){event.preventDefault();captureIdea();}">
    <button class="addbtn" onclick="captureIdea()">${icon("plus")} Capturar</button></div></div>`;
  if (!all.length) {
    return captura + `<div class="empty" style="padding:30px">Todo lo que se te ocurra, aquí. Sacarlo de la cabeza es lo que evita que te secuestre el día.</div>`;
  }
  const guardadas = all.filter(i => i.status === "guardada"), desc = all.filter(i => i.status === "descartada");
  let out = captura;
  out += sec("n_inbox", "Bandeja", String(inbox.length),
    inbox.length ? inbox.map(ideaRow).join("") : `<div class="empty">Bandeja vacía. Bien.</div>`, "list", "var(--lectura)");
  if (guardadas.length) out += sec("n_guard", "Guardadas", String(guardadas.length), guardadas.map(ideaRow).join(""), "star", "var(--ingresos)");
  if (desc.length) out += sec("n_desc", "Descartadas", String(desc.length),
    `<div class="empty" style="text-align:left;padding:2px 6px 8px">No se borran: si alguna vuelve a tener sentido, tócala y guárdala.</div>`
    + desc.map(ideaRow).join(""), "trash", "var(--muted2)");
  return out;
}

/* ---------- Foco: tarjeta del cronómetro ---------- */
function focusCard() {
  const r = getFocusRun();
  const ps = BIZ.projects.filter(p => p.status === "activo");
  if (r) {
    const p = bizProject(r.projectId);
    return `<div class="hero" style="background:linear-gradient(140deg, ${p.color}44, var(--card) 70%)">
      <div class="hero-top"><span class="hero-tag" style="color:${p.color};background:${p.color}22">${icon("timer2")} Foco en curso</span></div>
      <div class="hero-title" id="focusTime">${fmtClock(focusElapsed(r))}</div>
      <div class="hero-sub">${esc(p.name)} · sigue corriendo aunque cierres la app</div>
      <button class="hero-cta" style="background:${p.color}" onclick="stopFocus()">${icon("check")} Terminar y guardar</button>
      <button class="hero-link" onclick="discardFocus()">Descartar esta sesión</button></div>`;
  }
  if (!ps.length) return "";
  const hoy = focusSeconds(null, today()), sem = focusSeconds(null, weekDates()[0]);
  return `<div class="sec"><div class="sec-b" style="padding:14px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
      <div><div class="gt">Sesión de foco</div><div class="bizmeta">${fmtHrs(hoy)} hoy · ${fmtHrs(sem)} esta semana</div></div>
      <span style="color:var(--ingresos);display:flex">${icon("timer2")}</span></div>
    <div class="chips" style="padding:0">${ps.map(p => `<div class="chip" onclick="startFocus('${p.id}')" style="border-color:${p.color}66">${icon("play")} ${esc(p.name)}</div>`).join("")}</div>
    <button class="addbtn" onclick="openFocusManual()">${icon("plus")} Registrar a mano</button></div></div>`;
}
/* El intervalo SOLO repinta: el transcurrido siempre sale del reloj. */
let _focusTimer = null;
function focusTick() {
  const r = getFocusRun(), el = document.getElementById("focusTime");
  if (!r || !el) { if (_focusTimer) { clearInterval(_focusTimer); _focusTimer = null; } return; }
  el.textContent = fmtClock(focusElapsed(r));
}
function armFocusTimer() {
  if (_focusTimer) { clearInterval(_focusTimer); _focusTimer = null; }
  if (getFocusRun() && document.getElementById("focusTime")) _focusTimer = setInterval(focusTick, 1000);
}
/* Al volver de segundo plano se repinta con la hora real. */
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && getFocusRun()) { focusTick(); armFocusTimer(); }
  });
}

/* ---------- Revisión semanal del negocio ---------- */
function bizReviewSection(d) {
  const rd = reviewDateFor(d);
  if (!rd) return null;
  if (!BIZ.projects.length && !BIZ.leads.length) return null;
  const late = rd !== d, r = bizReview(rd), f = bizWeekFacts(rd);
  const body = `${late ? `<div class="empty" style="text-align:left;padding:2px 2px 10px">La semana que cerró ayer. Hoy es tu último día para escribirla.</div>` : ""}
    <div class="statrow"><div class="stat"><b>${f.acciones}</b><span>acciones cerradas</span></div>
      <div class="stat"><b>${f.leads}</b><span>leads movidos</span></div>
      <div class="stat"><b style="color:var(--text)">${fmtHrs(f.segundos)}</b><span>de foco</span></div></div>
    ${f.nums ? `<div class="empty" style="text-align:left;padding:6px 2px 0">${f.nums} ${f.nums === 1 ? "número capturado" : "números capturados"} este periodo.</div>` : ""}
    <div class="lbl">¿Qué se movió de verdad?</div><textarea id="brM" placeholder="Lo que avanzó, no lo que se intentó">${esc(r.moved)}</textarea>
    <div class="lbl">¿Qué está atorado, y por qué?</div><textarea id="brS" placeholder="La causa, no la excusa">${esc(r.stuck)}</textarea>
    <div class="lbl">El ÚNICO foco de la próxima semana</div><textarea id="brF" placeholder="Uno. Si son tres, no es foco.">${esc(r.focus)}</textarea>
    <button class="btn p" onclick="saveBizReview('${rd}')">Guardar revisión</button>`;
  return sec("n_rev", "Revisión del negocio", hasBizReview(rd) ? "Escrita" : (late ? "Último día" : "Domingo"), body, "calendar", "var(--lectura)");
}

let NEGTAB = "proyectos";
function setNegTab(t) { NEGTAB = t; render(); }
function renderNegocio() {
  const venc = openLeadsList().filter(l => followState(l) === "vencido").length;
  const inbox = BIZ.ideas.filter(i => i.status === "inbox").length;
  const rev = bizReviewSection(viewDay());
  let out = header("Negocio", "Tu trabajo, con la misma disciplina")
    + (rev || "")
    + `<div class="seg"><button class="${NEGTAB === "proyectos" ? "on" : ""}" onclick="setNegTab('proyectos')">Proyectos</button>
      <button class="${NEGTAB === "pipeline" ? "on" : ""}" onclick="setNegTab('pipeline')">Pipeline${venc ? ` <span style="color:var(--bad)">${venc}</span>` : ""}</button>
      <button class="${NEGTAB === "numeros" ? "on" : ""}" onclick="setNegTab('numeros')">Números</button>
      <button class="${NEGTAB === "ideas" ? "on" : ""}" onclick="setNegTab('ideas')">Ideas${inbox ? ` <span style="color:var(--lectura)">${inbox}</span>` : ""}</button></div>`;
  const body = NEGTAB === "pipeline" ? pipelineView()
    : NEGTAB === "numeros" ? numerosView()
    : NEGTAB === "ideas" ? ideasView()
    : projectsView();
  app.innerHTML = out + body;
  if (NEGTAB === "numeros") drawBizSparks();
  armFocusTimer();
}
function projectsView() {
  const act = activeProjects();
  const otros = BIZ.projects.filter(p => p.status !== "activo")
    .sort((a, b) => (a.status === b.status ? (b.updatedAt || 0) - (a.updatedAt || 0) : a.status === "pausado" ? -1 : 1));
  let out = "";

  if (!BIZ.projects.length) {
    out += `<div class="hero" style="background:linear-gradient(140deg, #10B98133, var(--card) 70%)">
      <div class="hero-top"><span class="hero-tag" style="color:var(--ingresos);background:#10B98122">${icon("ingresos")} Negocio</span></div>
      <div class="hero-title">Empieza por un proyecto</div>
      <div class="hero-sub">Cada proyecto lleva UNA próxima acción: el paso concreto que sigue. Nada más. Eso es lo que evita quedarte viendo la pantalla sin saber por dónde entrar.</div>
      <button class="hero-cta" style="background:var(--ingresos)" onclick="openBizProject()">${icon("plus")} Nuevo proyecto</button></div>`;
    return out + focusCard();
  }

  const sinAccion = act.filter(p => !p.nextAction).length;
  const vencidas = act.filter(p => dueState(p) === "vencida").length;
  const estancados = act.filter(isStale).length;
  const avisos = [];
  if (vencidas) avisos.push(vencidas === 1 ? "1 acción vencida" : vencidas + " acciones vencidas");
  if (sinAccion) avisos.push(sinAccion === 1 ? "1 sin próxima acción" : sinAccion + " sin próxima acción");
  if (estancados) avisos.push(estancados === 1 ? "1 estancado" : estancados + " estancados");
  out += `<div class="hero" style="background:linear-gradient(140deg, #10B98133, var(--card) 70%)">
    <div class="hero-top"><span class="hero-tag" style="color:var(--ingresos);background:#10B98122">${icon("ingresos")} Negocio</span></div>
    <div class="hero-title">${act.length} ${act.length === 1 ? "proyecto activo" : "proyectos activos"}</div>
    <div class="hero-sub">${avisos.length ? esc(avisos.join(" · ")) : "Todo con su próximo paso definido y al día."}</div></div>`;

  out += focusCard();
  /* La recompensa: lo que sí cerraste. Sin esto el módulo solo reclama. */
  const dw = doneThisWeek();
  out += `<div class="statrow"><div class="stat"><b>${dw}</b><span>${dw === 1 ? "acción cerrada esta semana" : "acciones cerradas esta semana"}</span></div>
    <div class="stat"><b style="color:var(--text)">${BIZ.done.length}</b><span>en total</span></div></div>`;

  out += act.map(projectCard).join("");
  out += `<button class="addbtn" onclick="openBizProject()">${icon("plus")} Nuevo proyecto</button>`;
  if (otros.length) {
    out += sec("n_otros", "Pausados y terminados", String(otros.length),
      otros.map(p => `<div class="row" onclick="openBizProject('${p.id}')">
        <span class="dotc" style="background:${p.color}"></span>
        <div class="body"><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.status)} · ${agoLabel(p.updatedAt)}</div></div>
        <span class="chev">${icon("chevron")}</span></div>`).join(""), "list", "var(--muted)");
  }
  return out;
}

/* ========================= PIPELINE =========================
   El mini CRM: lo que de verdad genera ingreso y lo que más fácil se
   olvida. Un lead que lleva días en la misma etapa se está enfriando, así
   que el tiempo EN ETAPA (`stageAt`) pesa tanto como la fecha de
   seguimiento. Avanzar de etapa es un solo tap desde la fila. */
const LEAD_STAGES = ["nuevo", "contactado", "llamada", "propuesta", "cerrado", "perdido"];
const LEAD_OPEN = ["nuevo", "contactado", "llamada", "propuesta"];   // el pipeline vivo
const LEAD_COLOR = { nuevo: "#8A8F9C", contactado: "#3B82F6", llamada: "#8B5CF6", propuesta: "#F59E0B", cerrado: "#22C55E", perdido: "#EF4444" };
const LEAD_STALE_DAYS = 10;   // 10 días en la misma etapa = se está enfriando

function bizLead(id) { return BIZ.leads.find(l => l.id === id) || null; }
function isOpenStage(st) { return LEAD_OPEN.indexOf(st) >= 0; }
function openLeadsList() { return BIZ.leads.filter(l => isOpenStage(l.stage)); }
function leadStale(l) { const d = daysSince(l.stageAt); return isOpenStage(l.stage) && d !== null && d >= LEAD_STALE_DAYS; }
/* Estado del seguimiento. Solo aplica al pipeline vivo: un cerrado o un
   perdido ya no se persigue. */
function followState(l) {
  if (!isOpenStage(l.stage) || !l.followUp) return null;
  const t = today();
  if (l.followUp < t) return "vencido";
  if (l.followUp === t) return "hoy";
  return "futuro";
}
/* Mismo criterio que los proyectos: primero lo vencido, luego lo de hoy,
   luego lo que no tiene fecha, luego lo que se está enfriando. */
function leadRank(l) {
  const f = followState(l);
  if (f === "vencido") return 0;
  if (f === "hoy") return 1;
  if (!l.followUp) return 2;
  if (leadStale(l)) return 3;
  return 4;
}
function nextStage(st) { const i = LEAD_OPEN.indexOf(st); return (i >= 0 && i < LEAD_OPEN.length - 1) ? LEAD_OPEN[i + 1] : "cerrado"; }
function fmtMoney(v) { const n = Number(v); return (!v || isNaN(n)) ? "" : "$" + Math.round(n).toLocaleString("es-MX"); }
function stageLeads(st) { return BIZ.leads.filter(l => l.stage === st).sort((a, b) => leadRank(a) - leadRank(b) || (a.stageAt || 0) - (b.stageAt || 0)); }
function sumValue(list) { return list.reduce((a, l) => a + (Number(l.value) || 0), 0); }

/* ---------- Mover de etapa ----------
   Un tap en la fila avanza a la siguiente etapa; ahí mismo se ofrece la
   próxima fecha de seguimiento con atajos de un tap, igual que completar la
   acción de un proyecto pregunta por la siguiente. */
function setLeadStage(id, stage, ask) {
  const l = bizLead(id); if (!l) return;
  if (l.stage !== stage) { l.stage = stage; l.stageAt = Date.now(); }
  l.updatedAt = Date.now(); saveBiz();
  if (ask && isOpenStage(stage)) openFollowUp(id, true);
  else { closeModal(); render(); }
}
function advanceLead(id) { const l = bizLead(id); if (l) setLeadStage(id, nextStage(l.stage), true); }
function openFollowUp(id, justMoved) {
  const l = bizLead(id); if (!l) return;
  const t = today();
  const atajos = [["Mañana", addDays(t, 1)], ["En 3 días", addDays(t, 3)], ["En 1 semana", addDays(t, 7)], ["En 2 semanas", addDays(t, 14)]];
  sheet(`<h3>${justMoved ? "Movido a " + cap(l.stage) + ". ¿Cuándo lo sigues?" : "Próximo seguimiento"}</h3>
    <div class="mm">${esc(l.name)} · ponerle fecha es lo único que evita que se enfríe.</div>
    <div class="chips" style="padding:0">${atajos.map(([lbl, dt]) => `<div class="chip" onclick="pickFollow('${id}','${dt}')">${lbl}</div>`).join("")}</div>
    <div class="lbl">O una fecha exacta</div><input id="fuDate" class="field" type="date" value="${esc(l.followUp || "")}">
    <button class="btn p" onclick="saveFollowUp('${id}')">Guardar</button>
    <button class="btn g" onclick="closeModal();render()">${justMoved ? "Ahora no" : "Cancelar"}</button>`);
}
/* Un solo tap: fija la fecha y guarda. */
function pickFollow(id, dt) { const l = bizLead(id); if (!l) return; l.followUp = dt; l.updatedAt = Date.now(); saveBiz(); closeModal(); render(); }
function saveFollowUp(id) {
  const l = bizLead(id); if (!l) return;
  l.followUp = document.getElementById("fuDate").value || "";
  l.updatedAt = Date.now(); saveBiz(); closeModal(); render();
}

/* ---------- Alta y edición de un lead ---------- */
let _leadStage = "nuevo", _leadProject = "";
function pickLeadStage(s) { _leadStage = s; document.querySelectorAll("#lgStage button").forEach(b => b.classList.toggle("on", b.dataset.s === s)); }
function pickLeadProject(pid) {
  _leadProject = pid;
  document.querySelectorAll("#lgProj .chip").forEach(c => {
    const on = c.dataset.p === pid;
    c.classList.toggle("on", on);
    c.style.background = on ? "var(--ingresos)" : ""; c.style.borderColor = on ? "var(--ingresos)" : ""; c.style.color = on ? "#0E0F13" : "";
  });
}
function openLead(id) {
  const editing = !!id, l = editing ? bizLead(id) : null;
  if (editing && !l) return render();
  const v = l || { name: "", contact: "", stage: "nuevo", value: "", followUp: "", notes: "", projectId: "" };
  _leadStage = v.stage; _leadProject = v.projectId || "";
  const proyectos = BIZ.projects.filter(p => p.status === "activo");
  sheet(`<h3>${editing ? "Editar prospecto" : "Nuevo prospecto"}</h3>
    <div class="mm">${editing ? "En " + esc(v.stage) + " " + agoLabel(v.stageAt) : "Alguien que puede convertirse en ingreso."}</div>
    <div class="lbl">Nombre o empresa</div><input id="lgName" class="field" value="${esc(v.name)}" placeholder="Estudio Ollin">
    <div class="lbl">Contacto</div><input id="lgContact" class="field" value="${esc(v.contact)}" placeholder="Persona, correo, teléfono...">
    <div class="lbl">Etapa</div><div class="seg small" id="lgStage">${LEAD_STAGES.map(s => `<button data-s="${s}" class="${s === v.stage ? "on" : ""}" onclick="pickLeadStage('${s}')">${cap(s)}</button>`).join("")}</div>
    <div class="row2"><div><div class="lbl">Valor estimado</div><input id="lgValue" class="field" type="number" inputmode="decimal" step="any" value="${esc(v.value === 0 || v.value ? v.value : "")}" placeholder="0"></div>
      <div><div class="lbl">Seguimiento</div><input id="lgFollow" class="field" type="date" value="${esc(v.followUp || "")}"></div></div>
    ${proyectos.length ? `<div class="lbl">¿De qué proyecto? (opcional)</div><div class="chips" id="lgProj" style="padding:0">
      <div class="chip ${!_leadProject ? "on" : ""}" data-p="" onclick="pickLeadProject('')" style="${!_leadProject ? "background:var(--ingresos);border-color:var(--ingresos);color:#0E0F13" : ""}">Ninguno</div>
      ${proyectos.map(p => `<div class="chip ${_leadProject === p.id ? "on" : ""}" data-p="${p.id}" onclick="pickLeadProject('${p.id}')" style="${_leadProject === p.id ? "background:var(--ingresos);border-color:var(--ingresos);color:#0E0F13" : ""}">${esc(p.name)}</div>`).join("")}</div>` : ""}
    <div class="lbl">Notas</div><textarea id="lgNotes" placeholder="Qué necesita, qué le dijiste, qué sigue...">${esc(v.notes)}</textarea>
    <button class="btn p" onclick="saveLead('${editing ? id : ""}')">${editing ? "Guardar" : "Crear prospecto"}</button>
    ${editing && isOpenStage(v.stage) ? `<button class="btn g" onclick="advanceLead('${id}')">${icon("chevright")} Avanzar a ${cap(nextStage(v.stage))}</button>` : ""}
    ${editing ? `<button class="btn g" style="color:var(--bad)" onclick="confirmDelLead('${id}')">Borrar prospecto</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function saveLead(id) {
  const name = document.getElementById("lgName").value.trim();
  if (!name) return;
  const raw = document.getElementById("lgValue").value.trim();
  const data = {
    name,
    contact: document.getElementById("lgContact").value.trim(),
    stage: LEAD_STAGES.indexOf(_leadStage) >= 0 ? _leadStage : "nuevo",
    value: (raw === "" || isNaN(Number(raw))) ? "" : Number(raw),
    followUp: document.getElementById("lgFollow").value || "",
    notes: document.getElementById("lgNotes").value.trim(),
    projectId: _leadProject || ""
  };
  const l = id ? bizLead(id) : null;
  const now = Date.now();
  if (l) {
    if (l.stage !== data.stage) l.stageAt = now;   // cambiar de etapa reinicia el reloj
    Object.assign(l, data); l.updatedAt = now;
  } else {
    BIZ.leads.push(Object.assign({ id: uid("ld") }, data, { stageAt: now, updatedAt: now }));
  }
  saveBiz(); closeModal(); render();
}
function confirmDelLead(id) {
  const l = bizLead(id); if (!l) return;
  sheet(`<h3>¿Borrar "${esc(l.name)}"?</h3><div class="mm">Se borra el prospecto y sus notas. Esto no se puede deshacer.</div>
    <button class="btn p" style="background:var(--bad)" onclick="delLead('${id}')">Sí, borrar</button>
    <button class="btn g" onclick="openLead('${id}')">Cancelar</button>`);
}
function delLead(id) { BIZ.leads = BIZ.leads.filter(l => l.id !== id); saveBiz(); closeModal(); render(); }
function gotoLead(id) { VIEW = "negocio"; NEGTAB = "pipeline"; buildNav(); render(); openLead(id); }

/* ---------- Fila de un lead ---------- */
function leadRow(l) {
  const f = followState(l), st = leadStale(l);
  const bits = [];
  const money = fmtMoney(l.value);
  if (money) bits.push(`<b style="color:var(--text)">${money}</b>`);
  if (f === "vencido") bits.push(`<span style="color:var(--bad);font-weight:700">seguimiento vencido · ${fmtShort(l.followUp)}</span>`);
  else if (f === "hoy") bits.push(`<span style="color:var(--ingresos);font-weight:700">seguir hoy</span>`);
  else if (l.followUp) bits.push(`seguir el ${fmtShort(l.followUp)}`);
  else if (isOpenStage(l.stage)) bits.push(`<span style="color:var(--lectura)">sin seguimiento</span>`);
  bits.push(`<span${st ? ` style="color:var(--lectura)"` : ""}>en ${esc(l.stage)} ${agoLabel(l.stageAt)}</span>`);
  return `<div class="row${f === "vencido" ? " leadvenc" : ""}" onclick="openLead('${l.id}')">
    <span class="dotc" style="background:${LEAD_COLOR[l.stage]}"></span>
    <div class="body"><div class="name">${esc(l.name)}</div><div class="sub">${bits.join(" · ")}</div></div>
    ${isOpenStage(l.stage) ? `<button class="note-btn" aria-label="Avanzar a ${cap(nextStage(l.stage))}" onclick="event.stopPropagation();advanceLead('${l.id}')">${icon("chevright")}</button>` : ""}</div>`;
}

/* ========================= NÚMEROS DEL NEGOCIO =========================
   Los de `CFG.metrics` son DIARIOS (peso, horas). Estos se mueven en otro
   reloj: ingreso del mes, clientes activos, ahorro para la visa. Por eso
   son un almacén aparte con su propia clave de periodo, no una variante del
   diario.

   REGLA DE MONEDA: `unit` es la etiqueta de la unidad y NUNCA se suma entre
   unidades distintas. Lo freelance está en MXN y la inversión de la visa en
   USD: juntarlas en un número daría un total falso. Cada métrica se lee
   sola, con su unidad pegada. Si alguna vez hace falta un agregado, tiene
   que ir agrupado por unidad (`sumByUnit`), nunca en una sola cifra. */
const BIZ_PERIODS = ["semana", "mes"];

/* Semana ISO 8601 (la que empieza en lunes; manda el jueves de esa semana).
   Hacerlo bien importa en el cambio de año: el 2025-12-29 pertenece a la
   semana 1 de 2026, no a la última de 2025. */
function isoWeekKey(dateKey) {
  const dt = new Date((dateKey || today()) + "T00:00:00");
  const dow = (dt.getDay() + 6) % 7;               // lunes = 0
  dt.setDate(dt.getDate() - dow + 3);              // jueves de esa semana
  const isoYear = dt.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const j4dow = (jan4.getDay() + 6) % 7;
  const week1Thu = new Date(isoYear, 0, 4 - j4dow + 3);
  const week = 1 + Math.round((dt - week1Thu) / 604800000);
  return isoYear + "-W" + String(week).padStart(2, "0");
}
function monthKey(dateKey) { return (dateKey || today()).slice(0, 7); }
function periodKey(period, dateKey) { return period === "semana" ? isoWeekKey(dateKey) : monthKey(dateKey); }
/* Las N periodos que terminan en `endKey`, en orden cronológico. */
function lastNPeriods(period, n, endKey) {
  const out = [];
  if (period === "mes") {
    const t = endKey || today(), y = +t.slice(0, 4), m = +t.slice(5, 7) - 1;
    for (let i = n - 1; i >= 0; i--) { const d = new Date(y, m - i, 1); out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")); }
  } else {
    let d = endKey || today();
    const ks = [];
    for (let i = 0; i < n; i++) { ks.push(isoWeekKey(d)); d = addDays(d, -7); }
    ks.reverse().forEach(k => out.push(k));
  }
  return out;
}
function prevPeriodKey(period, endKey) { const ps = lastNPeriods(period, 2, endKey); return ps[0]; }
function periodLabel(period, key) {
  if (period === "mes") {
    const y = +key.slice(0, 4), m = +key.slice(5, 7) - 1;
    return cap(new Date(y, m, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" }));
  }
  return "Semana " + key.slice(6) + " de " + key.slice(0, 4);
}

function bizMetric(id) { return BIZ.metrics.find(m => m.id === id) || null; }
function bizMval(id, pk) {
  const row = BIZ.mvals[id];
  const v = row ? row[pk] : undefined;
  return (v === undefined || v === null || v === "") ? null : Number(v);
}
function setBizMval(id, pk, v) {
  if (!BIZ.mvals[id]) BIZ.mvals[id] = {};
  if (v === null) delete BIZ.mvals[id][pk]; else BIZ.mvals[id][pk] = v;
  saveBiz();
}
function bizMvals(id, period, n, endKey) { return lastNPeriods(period, n, endKey).map(pk => bizMval(id, pk)); }
/* Único agregado permitido: agrupado por unidad. Devuelve {unidad: suma}. */
function sumByUnit(metrics, pk) {
  const out = {};
  metrics.forEach(m => {
    const v = bizMval(m.id, pk || periodKey(m.period));
    if (v === null) return;
    const u = (m.unit || "").trim() || "—";
    out[u] = (out[u] || 0) + v;
  });
  return out;
}

/* ========================= IDEAS =========================
   La única métrica que importa aquí es la velocidad de captura: si toma más
   de tres segundos, la idea se pierde o secuestra el día. Por eso el campo
   vive siempre visible arriba y guarda con Enter o con un tap. */
const IDEA_STATUS = ["inbox", "guardada", "descartada"];
function bizIdea(id) { return BIZ.ideas.find(i => i.id === id) || null; }
function captureIdea() {
  const el = document.getElementById("ideaIn"); if (!el) return;
  const text = (el.value || "").trim(); if (!text) return;
  BIZ.ideas.unshift({ id: uid("idea"), text: text, ts: Date.now(), status: "inbox", projectId: "" });
  el.value = "";
  saveBiz(); render();
  const again = document.getElementById("ideaIn"); if (again) again.focus();
}
function setIdeaStatus(id, st) { const i = bizIdea(id); if (!i) return; i.status = st; saveBiz(); closeModal(); render(); }
function ideasSorted() {
  const rank = { inbox: 0, guardada: 1, descartada: 2 };
  return BIZ.ideas.slice().sort((a, b) => (rank[a.status] - rank[b.status]) || (b.ts - a.ts));
}
/* Promover: una idea se vuelve proyecto, o la próxima acción de uno. */
function openPromoteIdea(id) {
  const i = bizIdea(id); if (!i) return;
  const ps = BIZ.projects.filter(p => p.status === "activo");
  sheet(`<h3>Promover idea</h3><div class="mm">${esc(i.text)}</div>
    <button class="btn p" onclick="ideaToProject('${id}')">${icon("plus")} Convertirla en proyecto</button>
    ${ps.length ? `<div class="lbl">O volverla la próxima acción de</div>`
      + ps.map(p => `<div class="row" onclick="ideaToNextAction('${id}','${p.id}')">
          <span class="dotc" style="background:${p.color}"></span>
          <div class="body"><div class="name">${esc(p.name)}</div><div class="sub">${p.nextAction ? "reemplaza: " + esc(p.nextAction) : "sin próxima acción"}</div></div>
          <span class="chev">${icon("chevron")}</span></div>`).join("") : ""}
    <button class="btn g" onclick="setIdeaStatus('${id}','guardada')">Solo guardarla</button>
    <button class="btn g" style="color:var(--bad)" onclick="setIdeaStatus('${id}','descartada')">Descartar</button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function ideaToProject(id) {
  const i = bizIdea(id); if (!i) return;
  const p = { id: uid("pj"), name: i.text.slice(0, 60), color: PALETTE[5], status: "activo", why: "", nextAction: "", nextActionDue: "", updatedAt: Date.now() };
  BIZ.projects.push(p);
  i.status = "guardada"; i.projectId = p.id;
  saveBiz(); closeModal(); NEGTAB = "proyectos"; render(); openBizProject(p.id);
}
function ideaToNextAction(id, projectId) {
  const i = bizIdea(id), p = bizProject(projectId); if (!i || !p) return;
  p.nextAction = i.text; p.nextActionDue = ""; touchProject(p);
  i.status = "guardada"; i.projectId = p.id;
  saveBiz(); closeModal(); render();
}

/* ========================= SESIONES DE FOCO =========================
   El cronómetro es POR MARCA DE TIEMPO, igual que el descanso del
   reproductor de gym: se guarda `startedAt` y el transcurrido se recalcula
   con Date.now(). Un setInterval que suma de a uno se congela cuando se
   bloquea la pantalla o la app pasa a segundo plano, y devolvería basura.
   El intervalo aquí solo repinta el texto; la verdad siempre es el reloj.
   La sesión en curso vive en `mt_focusRun`, como `mt_activeWorkout`. */
function getFocusRun() {
  const r = safeJSON(store.get("mt_focusRun"));
  if (!r || !r.projectId || !r.startedAt) return null;
  if (!bizProject(r.projectId)) return null;   // el proyecto ya no existe
  return r;
}
function saveFocusRun(r) { store.set("mt_focusRun", JSON.stringify(r)); }
function clearFocusRun() { store.set("mt_focusRun", ""); }
function focusElapsed(r) { return (r.baseSeconds || 0) + Math.max(0, Math.floor((Date.now() - r.startedAt) / 1000)); }
function startFocus(projectId) {
  if (!bizProject(projectId)) return;
  saveFocusRun({ projectId: projectId, startedAt: Date.now(), baseSeconds: 0 });
  closeModal(); render();
}
function stopFocus() {
  const r = getFocusRun(); if (!r) return;
  const secs = focusElapsed(r);
  if (secs >= 1) BIZ.focus.push({ id: uid("fs"), date: today(), projectId: r.projectId, seconds: secs, note: "" });
  clearFocusRun(); saveBiz(); closeModal(); render();
}
function discardFocus() { clearFocusRun(); closeModal(); render(); }
function fmtHrs(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  if (!h && !m) return "0m";
  return (h ? h + "h" : "") + (h && m ? " " : "") + (m ? m + "m" : "");
}
function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(r).padStart(2, "0");
}
function focusSeconds(projectId, from) {
  return BIZ.focus.filter(f => (!projectId || f.projectId === projectId) && (!from || f.date >= from))
    .reduce((a, f) => a + (Number(f.seconds) || 0), 0);
}
function focusWeek(projectId) { return focusSeconds(projectId, weekDates()[0]); }
/* Registrar a mano (se me olvidó arrancarlo). */
function openFocusManual(projectId) {
  const ps = BIZ.projects.filter(p => p.status === "activo");
  if (!ps.length) return;
  _focusProj = projectId || (ps[0] && ps[0].id) || "";
  sheet(`<h3>Registrar foco</h3><div class="mm">Para cuando trabajaste sin arrancar el cronómetro.</div>
    <div class="lbl">Proyecto</div><div class="chips" id="fmProj" style="padding:0">${ps.map(p => `<div class="chip ${p.id === _focusProj ? "on" : ""}" data-p="${p.id}" onclick="pickFocusProj('${p.id}')" style="${p.id === _focusProj ? `background:${p.color};border-color:${p.color};color:#0E0F13` : ""}">${esc(p.name)}</div>`).join("")}</div>
    <div class="row2"><div><div class="lbl">Minutos</div><input id="fmMin" class="field" type="number" inputmode="numeric" min="1" placeholder="60"></div>
      <div><div class="lbl">Día</div><input id="fmDate" class="field" type="date" value="${today()}"></div></div>
    <div class="lbl">Nota (opcional)</div><input id="fmNote" class="field" placeholder="En qué se fue el tiempo">
    <button class="btn p" onclick="saveFocusManual()">Guardar</button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
let _focusProj = "";
function pickFocusProj(pid) {
  _focusProj = pid;
  document.querySelectorAll("#fmProj .chip").forEach(c => {
    const on = c.dataset.p === pid, p = bizProject(c.dataset.p);
    c.classList.toggle("on", on);
    c.style.background = on && p ? p.color : ""; c.style.borderColor = on && p ? p.color : ""; c.style.color = on ? "#0E0F13" : "";
  });
}
function saveFocusManual() {
  const min = parseInt(document.getElementById("fmMin").value, 10);
  if (!_focusProj || !min || min <= 0) return;
  BIZ.focus.push({
    id: uid("fs"), date: document.getElementById("fmDate").value || today(),
    projectId: _focusProj, seconds: min * 60, note: document.getElementById("fmNote").value.trim()
  });
  saveBiz(); closeModal(); render();
}
function delFocus(id) { BIZ.focus = BIZ.focus.filter(f => f.id !== id); saveBiz(); closeModal(); render(); }

/* ========================= REVISIÓN SEMANAL DEL NEGOCIO =========================
   Hermana de la revisión de vida: misma regla de `reviewDateFor` (se pinta
   domingo y lunes, y SIEMPRE escribe sobre el domingo que cerró la semana).
   Se pre-llena con hechos que la app ya sabe, para que el ejercicio sea
   reflexionar y no tratar de acordarse. */
function bizReview(rd) { return BIZ.reviews[rd] || { moved: "", stuck: "", focus: "" }; }
function hasBizReview(rd) { const r = BIZ.reviews[rd]; return !!(r && (r.moved || r.stuck || r.focus)); }
function bizWeekFacts(rd) {
  const from = addDays(rd, -6), fromTs = new Date(from + "T00:00:00").getTime();
  const toTs = new Date(rd + "T00:00:00").getTime() + 86400000;
  const inRange = ts => ts >= fromTs && ts < toTs;
  const acciones = BIZ.done.filter(x => inRange(x.doneAt)).length;
  const leads = BIZ.leads.filter(l => inRange(l.stageAt)).length;
  const segundos = BIZ.focus.filter(f => f.date >= from && f.date <= rd).reduce((a, f) => a + (Number(f.seconds) || 0), 0);
  const nums = BIZ.metrics.filter(m => bizMval(m.id, periodKey(m.period, rd)) !== null).length;
  return { acciones: acciones, leads: leads, segundos: segundos, nums: nums, from: from };
}
function saveBizReview(rd) {
  BIZ.reviews[rd] = {
    moved: (document.getElementById("brM") || {}).value || "",
    stuck: (document.getElementById("brS") || {}).value || "",
    focus: (document.getElementById("brF") || {}).value || ""
  };
  saveBiz(); render();
}

/* ---------- La vista del pipeline ---------- */
function pipelineView() {
  if (!BIZ.leads.length) {
    return `<div class="hero" style="background:linear-gradient(140deg, #3B82F633, var(--card) 70%)">
      <div class="hero-top"><span class="hero-tag" style="color:var(--ciber);background:#3B82F622">${icon("list")} Pipeline</span></div>
      <div class="hero-title">Todavía no hay prospectos</div>
      <div class="hero-sub">Aquí vive lo que puede convertirse en ingreso. Cada prospecto tiene una etapa y una fecha para volver a buscarlo: sin fecha, se enfría.</div>
      <button class="hero-cta" style="background:var(--ciber)" onclick="openLead()">${icon("plus")} Nuevo prospecto</button></div>`;
  }
  const abiertos = openLeadsList();
  const venc = abiertos.filter(l => followState(l) === "vencido").length;
  const fríos = abiertos.filter(leadStale).length;
  const sinFecha = abiertos.filter(l => !l.followUp).length;
  const avisos = [];
  if (venc) avisos.push(venc === 1 ? "1 seguimiento vencido" : venc + " seguimientos vencidos");
  if (sinFecha) avisos.push(sinFecha === 1 ? "1 sin fecha" : sinFecha + " sin fecha");
  if (fríos) avisos.push(fríos === 1 ? "1 enfriándose" : fríos + " enfriándose");
  let out = `<div class="hero" style="background:linear-gradient(140deg, #3B82F633, var(--card) 70%)">
    <div class="hero-top"><span class="hero-tag" style="color:var(--ciber);background:#3B82F622">${icon("list")} Pipeline</span></div>
    <div class="hero-title">${fmtMoney(sumValue(abiertos)) || abiertos.length + " en curso"}</div>
    <div class="hero-sub">${abiertos.length} ${abiertos.length === 1 ? "prospecto abierto" : "prospectos abiertos"}${avisos.length ? " · " + esc(avisos.join(" · ")) : " · todo con su fecha"}</div></div>`;

  LEAD_OPEN.forEach(st => {
    const ls = stageLeads(st), tot = sumValue(ls);
    out += sec("n_st_" + st, cap(st), `${ls.length}${tot ? " · " + fmtMoney(tot) : ""}`,
      ls.length ? ls.map(leadRow).join("") : `<div class="empty">Nada en esta etapa</div>`, "list", LEAD_COLOR[st]);
  });
  out += `<button class="addbtn" onclick="openLead()">${icon("plus")} Nuevo prospecto</button>`;

  const cerrados = BIZ.leads.filter(l => !isOpenStage(l.stage)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (cerrados.length) {
    const ganado = sumValue(cerrados.filter(l => l.stage === "cerrado"));
    out += sec("n_cerr", "Cerrados y perdidos", `${cerrados.length}${ganado ? " · " + fmtMoney(ganado) : ""}`,
      cerrados.map(leadRow).join(""), "trophy", "var(--muted)");
  }
  return out;
}

/* ---------- Editar un proyecto ---------- */
let _bizColor = PALETTE[5], _bizStatus = "activo";
function pickBizColor(c) {
  _bizColor = c;
  document.querySelectorAll("#bpColors .sw").forEach(s => s.classList.toggle("on", rgbToHex(s.style.background) === c.toLowerCase()));
}
function pickBizStatus(s) {
  _bizStatus = s;
  document.querySelectorAll("#bpStatus button").forEach(b => b.classList.toggle("on", b.dataset.s === s));
}
function openBizProject(id) {
  const editing = !!id;
  const p = editing ? bizProject(id) : null;
  if (editing && !p) return render();
  const v = p || { name: "", color: PALETTE[5], status: "activo", why: "", nextAction: "", nextActionDue: "" };
  _bizColor = v.color; _bizStatus = v.status;
  sheet(`<h3>${editing ? "Editar proyecto" : "Nuevo proyecto"}</h3>
    <div class="mm">${editing ? "Actualizado " + agoLabel(v.updatedAt) : "Un frente de trabajo: un producto, un cliente, un ahorro."}</div>
    <div class="lbl">Nombre</div><input id="bpName" class="field" value="${esc(v.name)}" placeholder="CRM">
    <div class="lbl">Color</div><div class="swatches" id="bpColors">${PALETTE.map(c => `<span class="sw ${c === v.color ? "on" : ""}" style="background:${c}" onclick="pickBizColor('${c}')"></span>`).join("")}</div>
    <div class="lbl">Estado</div><div class="seg small" id="bpStatus">${BIZ_STATUS.map(s => `<button data-s="${s}" class="${s === v.status ? "on" : ""}" onclick="pickBizStatus('${s}')">${cap(s)}</button>`).join("")}</div>
    <div class="lbl">Mi para qué</div><textarea id="bpWhy" placeholder="¿Por qué existe este proyecto?">${esc(v.why)}</textarea>
    <div class="lbl">Próxima acción</div><input id="bpNa" class="field" value="${esc(v.nextAction)}" placeholder="El siguiente paso concreto">
    <div class="lbl">¿Para cuándo? (opcional)</div><input id="bpDue" class="field" type="date" value="${esc(v.nextActionDue || "")}">
    ${editing ? focusSummaryBlock(id) : ""}
    ${editing ? doneHistoryBlock(id) : ""}
    <button class="btn p" onclick="saveBizProject('${editing ? id : ""}')">${editing ? "Guardar" : "Crear proyecto"}</button>
    ${editing ? `<button class="btn g" style="color:var(--bad)" onclick="confirmDelProject('${id}')">Borrar proyecto</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
/* El rastro de lo cerrado: un proyecto se lee como una fila de pasos
   entregados, no solo como uno pendiente. */
function doneHistoryBlock(id) {
  const h = projectDone(id);
  if (!h.length) return `<div class="lbl">Hecho</div><div class="empty" style="text-align:left;padding:4px 2px">Todavía nada. Lo que cierres aparece aquí.</div>`;
  return `<div class="lbl">Hecho (${h.length})</div>`
    + `<div class="empty" style="text-align:left;padding:2px 2px 6px">Toca una para devolverla a próxima acción.</div>`
    + h.slice(0, 8).map(x => `<div class="catrow" style="cursor:pointer" onclick="restoreDone('${x.id}')"><span>${esc(x.text)}</span><span class="amt">${fmtShort(toKey(new Date(x.doneAt)))}</span></div>`).join("")
    + (h.length > 8 ? `<div class="empty" style="padding:6px">y ${h.length - 8} más</div>` : "");
}
/* Tiempo dedicado a un proyecto: esta semana y en total. */
function focusSummaryBlock(id) {
  const sem = focusWeek(id), tot = focusSeconds(id);
  const ses = BIZ.focus.filter(f => f.projectId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return `<div class="lbl">Foco</div>
    <div class="statrow"><div class="stat"><b>${fmtHrs(sem)}</b><span>esta semana</span></div>
      <div class="stat"><b style="color:var(--text)">${fmtHrs(tot)}</b><span>en total</span></div></div>
    ${ses.map(f => `<div class="catrow"><span>${cap(fmtShort(f.date))}${f.note ? " · " + esc(f.note) : ""}</span><span class="amt">${fmtHrs(f.seconds)}</span></div>`).join("")}`;
}

/* ---------- Deshacer un "Listo" ----------
   Completar está a un tap de un botón verde muy visible, así que tiene que
   haber camino de vuelta: se toca la línea en "Hecho" y la acción regresa a
   ser la próxima. Si ya hay una escrita se pregunta antes de pisarla: nunca
   se descarta trabajo en silencio. */
function restoreDone(doneId) {
  const d = BIZ.done.find(x => x.id === doneId); if (!d) return;
  const p = bizProject(d.projectId); if (!p) return;
  if (p.nextAction) {
    sheet(`<h3>Ya hay una próxima acción</h3>
      <div class="mm">${esc(p.name)} · si devuelves la de antes, la de ahora se pierde.</div>
      <div class="lbl">Ahora</div><div class="catrow"><span>${esc(p.nextAction)}</span></div>
      <div class="lbl">Volvería a ser</div><div class="catrow"><span>${esc(d.text)}</span></div>
      <button class="btn p" onclick="doRestoreDone('${doneId}')">Reemplazar</button>
      <button class="btn g" onclick="openBizProject('${p.id}')">Cancelar</button>`);
    return;
  }
  doRestoreDone(doneId);
}
function doRestoreDone(doneId) {
  const d = BIZ.done.find(x => x.id === doneId); if (!d) return;
  const p = bizProject(d.projectId); if (!p) return;
  p.nextAction = d.text; p.nextActionDue = ""; touchProject(p);
  BIZ.done = BIZ.done.filter(x => x.id !== doneId);
  saveBiz(); closeModal(); render();
}

function saveBizProject(id) {
  const name = document.getElementById("bpName").value.trim();
  if (!name) return;
  const data = {
    name,
    color: _bizColor,
    status: BIZ_STATUS.indexOf(_bizStatus) >= 0 ? _bizStatus : "activo",
    why: document.getElementById("bpWhy").value.trim(),
    nextAction: document.getElementById("bpNa").value.trim(),
    nextActionDue: document.getElementById("bpDue").value || ""
  };
  if (!data.nextAction) data.nextActionDue = "";   // sin acción no hay fecha que valga
  const p = id ? bizProject(id) : null;
  if (p) Object.assign(p, data), touchProject(p);
  else { const np = Object.assign({ id: uid("pj") }, data); touchProject(np); BIZ.projects.push(np); }
  saveBiz(); closeModal(); render();
}
function confirmDelProject(id) {
  const p = bizProject(id); if (!p) return;
  sheet(`<h3>¿Borrar "${esc(p.name)}"?</h3><div class="mm">Se borra el proyecto y su próxima acción. Esto no se puede deshacer.</div>
    <button class="btn p" style="background:var(--bad)" onclick="delBizProject('${id}')">Sí, borrar</button>
    <button class="btn g" onclick="openBizProject('${id}')">Cancelar</button>`);
}
function delBizProject(id) { BIZ.projects = BIZ.projects.filter(p => p.id !== id); saveBiz(); closeModal(); render(); }

/* ---------- La próxima acción ----------
   Terminar una acción deja el proyecto sin siguiente paso, que es justo el
   estado que no queremos. Por eso completar abre de inmediato la pregunta
   "¿y ahora qué sigue?": un tap para marcar, escribir, un tap para guardar. */
function completeNextAction(id) {
  const p = bizProject(id); if (!p) return;
  /* Antes de limpiar, queda el rastro: avanzar tiene que dejar historial,
     igual que una serie registrada. Esto NO agrega un solo tap. */
  if (p.nextAction) BIZ.done.push({ id: uid("dn"), projectId: p.id, text: p.nextAction, doneAt: Date.now() });
  p.nextAction = ""; p.nextActionDue = ""; touchProject(p); saveBiz();
  openNextAction(id, true);
}
/* Lo hecho de un proyecto, lo más reciente primero. `done` es append-only,
   así que a igualdad de milisegundo desempata el orden de inserción: el
   historial nunca sale barajado. */
function projectDone(id) {
  return BIZ.done.map((x, i) => ({ x: x, i: i }))
    .filter(o => o.x.projectId === id)
    .sort((a, b) => (b.x.doneAt - a.x.doneAt) || (b.i - a.i))
    .map(o => o.x);
}
/* Acciones cerradas desde el lunes de esta semana. Es la recompensa que le
   faltaba al módulo: el equivalente de negocio a una racha. */
function weekStartTs() { return new Date(weekDates()[0] + "T00:00:00").getTime(); }
function doneThisWeek() { const from = weekStartTs(); return BIZ.done.filter(x => x.doneAt >= from).length; }
function openNextAction(id, justDone) {
  const p = bizProject(id); if (!p) return;
  sheet(`<h3>${justDone ? "Hecho. ¿Y ahora qué sigue?" : "Próxima acción"}</h3>
    <div class="mm">${esc(p.name)} · un solo paso concreto, el más pequeño que te mueva.</div>
    <div class="lbl">Próxima acción</div><input id="naTxt" class="field" value="${esc(p.nextAction)}" placeholder="Llamar a...">
    <div class="lbl">¿Para cuándo? (opcional)</div><input id="naDue" class="field" type="date" value="${esc(p.nextActionDue || "")}">
    <button class="btn p" onclick="saveNextAction('${id}')">Guardar</button>
    <button class="btn g" onclick="closeModal();render()">${justDone ? "Ahora no" : "Cancelar"}</button>`);
  const el = document.getElementById("naTxt"); if (el) { el.focus(); el.select(); }
}
function saveNextAction(id) {
  const p = bizProject(id); if (!p) return;
  p.nextAction = document.getElementById("naTxt").value.trim();
  p.nextActionDue = p.nextAction ? (document.getElementById("naDue").value || "") : "";
  touchProject(p); saveBiz(); closeModal(); render();
}
/* Desde Hoy: pararse en el proyecto. */
function gotoProject(id) { VIEW = "negocio"; buildNav(); render(); openBizProject(id); }

/* ---------- Negocio en Hoy ----------
   Un empujón, no la lista completa: solo lo que pide atención. Se esconde
   si no hay proyectos activos (mismo criterio que las métricas) y en un día
   pasado, porque la próxima acción es de ahora: no hay registro de cuál era
   la próxima acción de un martes de hace tres semanas. */
const BIZ_HOY_CAP = 5;
/* Lo que pide atención hoy: acciones de proyecto y seguimientos de
   pipeline, mezclados por urgencia y CON TOPE. Un lead vencido pesa igual
   que una acción vencida: los dos son deuda de ayer. */
function bizHoyItems() {
  const items = [];
  activeProjects().forEach(p => { const r = projectRank(p); if (r <= 3) items.push({ kind: "proj", rank: r, p }); });
  openLeadsList().forEach(l => { const f = followState(l); if (f === "vencido" || f === "hoy") items.push({ kind: "lead", rank: f === "vencido" ? 0 : 1, l }); });
  return items.sort((a, b) => a.rank - b.rank).slice(0, BIZ_HOY_CAP);
}
function hoyProjRow(p) {
  const nag = !p.nextAction, ds = dueState(p);
  const extra = ds === "vencida" ? ` · <span style="color:var(--bad)">vencida</span>`
    : ds === "hoy" ? ` · <span style="color:var(--ingresos)">para hoy</span>`
    : isStale(p) ? ` · <span style="color:var(--lectura)">${agoLabel(p.updatedAt)}</span>` : "";
  return `<div class="row" onclick="gotoProject('${p.id}')">
    <span class="dotc" style="background:${p.color}"></span>
    <div class="body"><div class="name"${nag ? ` style="color:var(--lectura)"` : ""}>${nag ? "Define la próxima acción" : esc(p.nextAction)}</div>
      <div class="sub">Proyecto · ${esc(p.name)}${extra}</div></div>
    <span class="chev">${icon("chevron")}</span></div>`;
}
/* Un lead se persigue, un proyecto se hace: el texto lo dice sin ambigüedad. */
function hoyLeadRow(l) {
  const f = followState(l);
  return `<div class="row${f === "vencido" ? " leadvenc" : ""}" onclick="gotoLead('${l.id}')">
    <span class="dotc" style="background:${LEAD_COLOR[l.stage]}"></span>
    <div class="body"><div class="name">Seguir a ${esc(l.name)}</div>
      <div class="sub">Pipeline · ${esc(l.stage)} · <span style="color:${f === "vencido" ? "var(--bad)" : "var(--ingresos)"}">${f === "vencido" ? "seguimiento vencido" : "seguir hoy"}</span></div></div>
    <span class="chev">${icon("chevron")}</span></div>`;
}
function bizSection(d) {
  if (d !== today()) return null;
  if (!activeProjects().length && !openLeadsList().length) return null;
  const items = bizHoyItems();
  const body = items.length
    ? items.map(it => it.kind === "proj" ? hoyProjRow(it.p) : hoyLeadRow(it.l)).join("")
    : `<div class="empty">Nada urgente en tu negocio. Sigue con lo tuyo.</div>`;
  return sec("h_biz", "Negocio", items.length ? String(items.length) : "al día",
    body + `<button class="addbtn" onclick="VIEW='negocio';buildNav();render()">${icon("ingresos")} Ver Negocio</button>`,
    "ingresos", "var(--ingresos)");
}

/* ---------- Navegación ---------- */
/* Ajustes NO está aquí: se abre con el engrane del header. La barra es para
   lo que se toca a diario. */
const NAV = [["hoy","Hoy","list"], ["progreso","Progreso","chart"], ["workouts","Workouts","dumbbell"], ["negocio","Negocio","ingresos"], ["metas","Metas","target"]];
/* Abre Ajustes; estando dentro, regresa a la vista anterior. */
function openAjustes() {
  if (VIEW === "ajustes") VIEW = (LASTVIEW && LASTVIEW !== "ajustes") ? LASTVIEW : "hoy";
  else { LASTVIEW = VIEW; VIEW = "ajustes"; }
  closeModal(); buildNav(); render();
}
function buildNav() { document.getElementById("nav").innerHTML = NAV.map(([v, label, ic]) => `<button data-v="${v}" class="${v === VIEW ? "on" : ""}">${icon(ic)}${label}</button>`).join(""); }
document.getElementById("nav").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; VIEW = b.dataset.v; document.querySelectorAll("#nav button").forEach(x => x.classList.toggle("on", x === b)); render(); });

/* La inicialización (buildNav + render + service worker) vive en reorder.js,
   que se carga al final para que todas las funciones estén definidas. */
