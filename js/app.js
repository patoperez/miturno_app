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
  c.identities = c.identities || []; c.habits = c.habits || []; c.commitments = c.commitments || [];
  if (!c.meals) c.meals = JSON.parse(JSON.stringify(DEFAULT_CFG.meals));
  c.meals.menu = c.meals.menu || [];
  c.meals.fichas = c.meals.fichas || JSON.parse(JSON.stringify(DEFAULT_CFG.meals.fichas));
  c.meals.fichas.categories = c.meals.fichas.categories || [];
  c.meals.fichas.catalog = c.meals.fichas.catalog || {};
  c.meals.fichas.innegociables = c.meals.fichas.innegociables || [];
  c.routines = c.routines || [];
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

let LOG = loadLog(), TASKS = loadTasks(), WORKOUTS = loadWorkouts();
let VIEW = "hoy";
let PROG = store.get("mt_prog") || "semana"; // semana | mes | bitacora
let CALYM = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();
const COLLAPSE = { h_next: true, w_hist: false, w_rec: true, w_rt: true, w_act: true };
const DEFAULT_HOY_ORDER = ["hab", "com", "gym", "meal", "task", "next", "sleep", "mood", "journal"];
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
  l.menuDone = l.menuDone || {}; l.fichas = l.fichas || {}; l.inneg = l.inneg || {};
  if (l.sleep === undefined) l.sleep = null; if (l.mood === undefined) l.mood = null; if (l.journal === undefined) l.journal = "";
  return l;
}

/* ---------- Puntos ---------- */
function mealWeight() { return CFG.meals.menu.length || CFG.meals.fichas.categories.length || 3; }
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
function pointsFor(d) {
  const l = LOG[d]; if (!l) return 0;
  if (l.frozen) return l.pts || 0; // día pasado: puntaje fijo, inmune a cambios de config
  return Object.values(l.habits || {}).filter(Boolean).length
    + Object.values(l.commitments || {}).filter(Boolean).length + mealScore(d);
}
function maxFor(d) { const l = LOG[d]; return (l && l.frozen) ? (l.max || maxPts()) : maxPts(); }
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
function streak(id) {
  let d = today();
  if (!(LOG[d] && LOG[d].commitments && LOG[d].commitments[id])) d = addDays(d, -1);
  let s = 0;
  while (LOG[d] && LOG[d].commitments && LOG[d].commitments[id] === true) { s++; d = addDays(d, -1); }
  return s;
}

/* ---------- Analítica de workouts ---------- */
function normName(s) { return (s || "").toLowerCase().trim(); }
function lastPerf(name) {
  const key = normName(name);
  for (let i = WORKOUTS.length - 1; i >= 0; i--) {
    const w = WORKOUTS[i]; if (!w.sets) continue;
    const hit = w.sets.filter(s => normName(s.exName) === key && (s.weight || s.reps));
    if (hit.length) { const s = hit[hit.length - 1]; return { weight: s.weight, reps: s.reps, date: w.date }; }
  }
  return null;
}
function exercisePR(name) {
  const key = normName(name); let best = null;
  WORKOUTS.forEach(w => (w.sets || []).forEach(s => {
    if (normName(s.exName) !== key) return;
    const wt = parseFloat(s.weight); if (isNaN(wt)) return;
    if (!best || wt > best.weight) best = { weight: wt, reps: s.reps, date: w.date };
  }));
  return best;
}
function allLoggedExercises() {
  const set = {};
  WORKOUTS.forEach(w => (w.sets || []).forEach(s => { if (s.weight && !isNaN(parseFloat(s.weight))) set[normName(s.exName)] = s.exName; }));
  return Object.values(set);
}
function workoutsInRange(from, to) { return WORKOUTS.filter(w => w.date >= from && w.date <= to); }
function hasWorkout(d) { return WORKOUTS.some(w => w.date === d); }

/* ---------- Render ---------- */
const app = document.getElementById("app");
function render() {
  ({ hoy: renderHoy, progreso: renderProgreso, workouts: renderWorkouts, metas: renderMetas, ajustes: renderAjustes }[VIEW] || renderHoy)();
}
function header(title, sub) {
  const pct = Math.round(pointsFor(today()) / maxPts() * 100) || 0;
  const c = 2 * Math.PI * 26;
  return `<div class="hd"><div><div class="greet">${sub || ("Hola, " + esc(CFG.settings.userName))}</div><div class="date">${title}</div></div>
    <div class="ring"><svg width="62" height="62"><circle cx="31" cy="31" r="26" stroke="var(--line)" stroke-width="6" fill="none"/>
      <circle cx="31" cy="31" r="26" stroke="var(--ok)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}"/></svg>
      <div class="val">${pct}%</div></div></div>`;
}
function sec(id, title, meta, body, iconName, iconColor) {
  const ic = iconName ? `<span style="color:${iconColor || "var(--muted)"};display:flex">${icon(iconName)}</span>` : "";
  return `<div class="sec ${COLLAPSE[id] ? "collapsed" : ""}"><div class="sec-h" onclick="toggleSec('${id}')"><div class="t">${ic}${title}</div>
      <div class="meta">${meta || ""}<span class="chev">${icon("chevron")}</span></div></div><div class="sec-b">${body}</div></div>`;
}

/* ========================= HOY ========================= */
function habitRow(h, d) {
  const l = day(d), done = !!l.habits[h.id], idn = getIdn(h.idn), note = l.notes[h.id];
  return `<div class="row ${done ? "done" : ""}"><div class="mark" style="${done ? `background:${idn.raw};border-color:${idn.raw}` : ""}" onclick="toggleHabit('${d}','${h.id}')">${icon("check")}</div>
    <div class="body" onclick="toggleHabit('${d}','${h.id}')"><div class="name">${esc(h.name)}</div><div class="sub"><span style="color:${idn.raw}">${esc(idn.label)}</span></div></div>
    <button class="note-btn ${note ? "has" : ""}" onclick="openNote('${d}','${h.id}')">${icon(note ? "edit" : "plus")}</button></div>`;
}
function commitmentRow(c, d) {
  const l = day(d), done = !!l.commitments[c.id], idn = getIdn(c.idn), s = streak(c.id);
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

function renderHoy() {
  const d = today(), l = day(d), B = {};
  const doneH = CFG.habits.filter(x => l.habits[x.id]).length;
  B.hab = sec("h_hab", "Hábitos de hoy", `${doneH}/${CFG.habits.length}`,
    (CFG.habits.length ? CFG.habits.map(x => habitRow(x, d)).join("") : `<div class="empty">Aún no tienes hábitos</div>`)
    + `<button class="addbtn" onclick="openEditHabit()">${icon("plus")} Agregar hábito</button>`, "check", "var(--ok)");
  const doneC = CFG.commitments.filter(x => l.commitments[x.id]).length;
  B.com = sec("h_com", "Compromisos", `${doneC}/${CFG.commitments.length}`,
    `<div class="empty" style="padding:6px 6px 10px;text-align:left">Marca lo que hoy lograste NO hacer. Cada día limpio suma a tu racha.</div>`
    + CFG.commitments.map(x => commitmentRow(x, d)).join("")
    + `<button class="addbtn" onclick="openEditCommit()">${icon("plus")} Agregar compromiso</button>`, "flame", "var(--ok)");
  B.gym = gymCardHoy(d);
  B.meal = mealsSection(d);
  const tt = TASKS.filter(t => t.date === d);
  B.task = sec("h_task", "Tareas de hoy", `${tt.filter(t => t.done).length}/${tt.length}`,
    (tt.length ? tt.map(taskRow).join("") : `<div class="empty">Sin tareas para hoy</div>`)
    + `<button class="addbtn" onclick="openTask()">${icon("plus")} Agregar tarea</button>`, "clock", "var(--muted)");
  const up = TASKS.filter(t => t.date > d && t.date <= addDays(d, 30) && !t.done).sort((a, b) => a.date.localeCompare(b.date));
  if (up.length) B.next = sec("h_next", "Próximas", String(up.length),
    up.slice(0, 8).map(t => `<div class="row"><span class="datechip">${fmtShort(t.date)}</span><div class="body"><div class="name">${esc(t.text)}${t.time ? ` <span style="color:var(--muted2)">· ${esc(t.time)}</span>` : ""}</div></div></div>`).join("")
    + `<button class="addbtn" onclick="VIEW='progreso';PROG='mes';buildNav();render()">${icon("calendar")} Ver calendario</button>`, "calendar", "var(--muted)");
  B.sleep = sec("h_sleep", "Sueño", l.sleep || "—",
    `<div class="chips">${SLEEP_RANGES.map(s => `<div class="chip ${l.sleep === s ? "on" : ""}" style="${l.sleep === s ? "background:var(--ciber);border-color:var(--ciber)" : ""}" onclick="setSleep('${d}','${s}')">${s}</div>`).join("")}</div>`, "moon", "var(--ciber)");
  B.mood = sec("h_mood", "¿Cómo me sentí hoy?", l.mood ? `${l.mood}/10` : "—",
    `<div class="mood">${[1,2,3,4,5,6,7,8,9,10].map(n => `<b class="${l.mood === n ? "on" : ""}" style="${l.mood === n ? `background:${moodColor(n)}` : ""}" onclick="setMood('${d}',${n})">${n}</b>`).join("")}</div>`, "productividad", "var(--productividad)");
  B.journal = sec("h_journal", "Bitácora del día", l.journal ? "Escrita" : "",
    `<textarea placeholder="Escribe cómo te fue hoy... (opcional)" onchange="setJournal('${d}',this.value)">${esc(l.journal)}</textarea>`, "book", "var(--lectura)");
  const list = HOY_ORDER.filter(k => B[k]).map(k => `<div class="dsec" data-key="${k}">${B[k]}</div>`).join("");
  app.innerHTML = header(cap(fmtDate(d))) + `<div class="hoylist" id="hoylist">${list}</div>`;
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
    let body = `<div class="gymrow"><div><div class="name" style="color:var(--ok)">Ya entrenaste hoy</div><div class="sub">${esc(doneT.map(w => w.name).join(", "))}${vol ? " · " + Math.round(vol) + " kg vol" : ""}</div></div><span style="color:var(--ok);display:flex">${icon("check")}</span></div>`;
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
function toggleMenu(d, id) { const l = day(d); l.menuDone[id] = !l.menuDone[id]; saveLog(); render(); }
function setFicha(d, cid, n) { const l = day(d); const cur = l.fichas[cid] || 0; l.fichas[cid] = (cur >= n) ? n - 1 : n; saveLog(); render(); }
function toggleInneg(d, id) { const l = day(d); l.inneg[id] = !l.inneg[id]; saveLog(); render(); }
function openCatalog(cid) {
  const c = CFG.meals.fichas.categories.find(x => x.id === cid) || { name: "", color: "#888" };
  const list = (CFG.meals.fichas.catalog[cid] || []);
  sheet(`<h3 style="color:${c.color}">${esc(c.name)}</h3><div class="mm">Cada ficha equivale a una de estas opciones</div>
    ${list.length ? list.map(o => `<div class="catrow"><div><b>${esc(o.food)}</b>${o.note ? ` <span style="color:var(--muted2)">· ${esc(o.note)}</span>` : ""}</div><span class="amt">${esc(o.amount)}</span></div>`).join("") : `<div class="empty">Sin opciones. Edítalas en Ajustes.</div>`}
    <button class="btn g" onclick="closeModal()">Cerrar</button>`);
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
    const rows = (CFG.habits.length ? `<tr><td class="subhead" colspan="8">Hábitos</td></tr>${weekRows(CFG.habits, "habit")}` : "")
      + (CFG.commitments.length ? `<tr><td class="subhead" colspan="8">Compromisos</td></tr>${weekRows(CFG.commitments, "commit")}` : "");
    out += sec("p_grid", "Hábitos × 7 días", "", `<table class="grid">${head}<tbody>${rows}</tbody></table>`, "grid");
    out += sec("p_chart", "Línea de progreso semanal", "", `<canvas id="chart" width="600" height="200" style="width:100%;height:auto;margin-top:8px"></canvas>`, "chart", "var(--ok)");
    app.innerHTML = out;
    drawChart(wd.map(pointsFor), (new Date().getDay() + 6) % 7);
  } else if (PROG === "mes") {
    out += sec("p_cal", "Calendario", "", unifiedMonth(), "calendar", "var(--ok)");
    out += sec("p_chart", "Línea de progreso del mes", "", `<canvas id="chart" width="600" height="200" style="width:100%;height:auto;margin-top:8px"></canvas>`, "chart", "var(--ok)");
    app.innerHTML = out;
    const y = CALYM.y, m = CALYM.m, days = new Date(y, m + 1, 0).getDate(), vals = [];
    for (let dn = 1; dn <= days; dn++) vals.push(pointsFor(`${y}-${String(m + 1).padStart(2, "0")}-${String(dn).padStart(2, "0")}`));
    const tdy = (today().slice(0, 7) === `${y}-${String(m + 1).padStart(2, "0")}`) ? new Date().getDate() - 1 : days - 1;
    drawChart(vals, tdy);
  } else { out += bitacoraList(); app.innerHTML = out; }
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
function bitacoraList() {
  const days = Object.keys(LOG).filter(d => LOG[d].journal || LOG[d].mood).sort().reverse();
  return days.length ? days.map(d => {
    const l = LOG[d];
    return `<div class="sec"><div class="sec-b" style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <b style="text-transform:capitalize;cursor:pointer" onclick="openDay('${d}')">${fmtDate(d)}</b>
      ${l.mood ? `<span class="streak" style="background:${moodColor(l.mood)};color:#0E0F13;border:none">${l.mood}/10</span>` : ""}</div>
      ${l.journal ? `<div style="font-size:14px;color:var(--muted)">${esc(l.journal)}</div>` : `<div class="empty">Sin nota</div>`}
      <div class="sub" style="margin-top:8px;font-size:12px;color:var(--muted2)">${Math.round(pointsFor(d))} puntos${l.sleep ? " · " + l.sleep + " de sueño" : ""}</div></div></div>`;
  }).join("") : `<div class="empty" style="padding:40px">Tu bitácora aparecerá aquí conforme escribas cada día.</div>`;
}

/* ---------- Detalle de día (tareas + bitácora) ---------- */
function openDay(ds) {
  const l = day(ds);
  const tt = TASKS.filter(t => t.date === ds);
  const ww = WORKOUTS.filter(w => w.date === ds);
  sheet(`<h3 style="text-transform:capitalize">${fmtDate(ds)}</h3><div class="mm">${Math.round(pointsFor(ds))} puntos${l.sleep ? " · " + l.sleep : ""}</div>
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
    const s = (w.sets || []).length; return `${s} series · ${fmtDur(w.duration)}${w.volume ? " · " + Math.round(w.volume) + " kg vol" : ""}`;
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
  // Records
  const exs = allLoggedExercises();
  out += sec("w_rec", "Records", String(exs.length), exs.length ? exs.map(name => {
    const pr = exercisePR(name);
    return `<div class="row"><span class="idi" style="background:#F59E0B22;color:#F59E0B">${icon("trophy")}</span><div class="body"><div class="name">${esc(name)}</div><div class="sub">${pr ? pr.weight + " kg × " + esc(pr.reps) : "—"}</div></div></div>`;
  }).join("") : `<div class="empty">Tus records aparecerán al registrar pesos.</div>`, "trophy", "var(--lectura)");
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
    const byEx = {};
    w.sets.forEach(s => { (byEx[s.exName] = byEx[s.exName] || []).push(s); });
    body = Object.keys(byEx).map(nm => `<div class="lbl">${esc(nm)}</div>` + byEx[nm].map((s, i) => `<div class="catrow"><span>Serie ${i + 1}</span><span class="amt">${s.weight ? s.weight + " kg" : "—"} × ${esc(s.reps) || "—"}</span></div>`).join("")).join("");
  } else {
    body = `<div class="catrow"><span>Duración</span><span class="amt">${w.duration || 0} min</span></div>${w.intensity ? `<div class="catrow"><span>Intensidad</span><span class="amt">${w.intensity}/10</span></div>` : ""}${w.notes ? `<div class="lbl">Notas</div><div style="font-size:14px;color:var(--muted)">${esc(w.notes)}</div>` : ""}`;
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
    `<div class="empty" style="text-align:left;padding:4px 2px 10px">Descarga un archivo con TODOS tus datos (config, historial, tareas y entrenos). Guárdalo por si cambias de dispositivo o de dominio.</div>
     <button class="addbtn" onclick="exportAllData()">${icon("download")} Descargar respaldo</button>
     <button class="addbtn" onclick="openImportData()">${icon("upload")} Restaurar respaldo</button>`, "sliders", "var(--muted)");
  if (typeof cloudSection === "function") out += cloudSection();
  app.innerHTML = out;
}
function setUserName(v) { CFG.settings.userName = v.trim() || "tú"; saveCfg(); }

/* ---------- Acciones día ---------- */
function toggleSec(id) { if (window._justDragged) { window._justDragged = false; return; } COLLAPSE[id] = !COLLAPSE[id]; render(); }
function toggleHabit(d, id) { const l = day(d); l.habits[id] = !l.habits[id]; saveLog(); render(); }
function toggleCommit(d, id) { const l = day(d); l.commitments[id] = !l.commitments[id]; saveLog(); render(); }
function setSleep(d, s) { const l = day(d); l.sleep = l.sleep === s ? null : s; saveLog(); render(); }
function setMood(d, n) { const l = day(d); l.mood = l.mood === n ? null : n; saveLog(); render(); }
function setJournal(d, v) { const l = day(d); l.journal = v; saveLog(); }
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
function loadGoalPhotos(id) {
  const box = document.getElementById("vboard"); if (!box) return;
  idbGetPhotos(id).then(list => {
    box.innerHTML = list.length ? list.map(p => `<div class="vthumb"><img src="${p.dataUrl}"><button onclick="delGoalPhoto(${p.id},'${id}')">${icon("close")}</button></div>`).join("") : `<div class="empty" style="grid-column:1/-1">Sin fotos aún. Agrega imágenes que representen esta meta.</div>`;
  }).catch(() => { box.innerHTML = `<div class="empty" style="grid-column:1/-1">Las fotos solo funcionan en la app instalada.</div>`; });
}
function addGoalPhoto(id, input) {
  const f = input.files && input.files[0]; if (!f) return;
  const box = document.getElementById("vboard"); if (box) box.innerHTML = `<div class="empty" style="grid-column:1/-1">Procesando...</div>`;
  compressImage(f, dataUrl => { if (!dataUrl) return loadGoalPhotos(id); idbAddPhoto(id, dataUrl).then(() => loadGoalPhotos(id)).catch(() => loadGoalPhotos(id)); });
  input.value = "";
}
function delGoalPhoto(pid, id) { idbDelPhoto(pid).then(() => loadGoalPhotos(id)).catch(() => loadGoalPhotos(id)); }

function openGoal(id) {
  const g = getIdn(id);
  const items = CFG.habits.filter(h => h.idn === id).map(h => "· " + h.name).concat(CFG.commitments.filter(c => c.idn === id).map(c => "· " + c.name));
  sheet(`<span class="gicon" style="width:48px;height:48px;background:${g.raw}22;color:${g.raw};display:flex;align-items:center;justify-content:center;border-radius:13px">${icon(g.icon)}</span>
    <h3 style="margin-top:10px">${esc(g.label)}</h3><div class="mm">Mi para qué</div><div style="font-size:15px;line-height:1.5">${esc(g.why)}</div>
    <div class="lbl">Recordatorios de identidad</div>${(g.quotes || []).map(q => `<div class="quote">${esc(q)}</div>`).join("") || `<div class="empty">Sin frases</div>`}
    <div class="lbl">Lo que vota por esta identidad</div><div style="font-size:14px;color:var(--muted)">${items.map(esc).join("<br>") || "—"}</div>
    <div class="lbl">Vision board</div>
    <div id="vboard" class="vgrid"><div class="empty" style="grid-column:1/-1">Cargando...</div></div>
    <label class="addbtn">${icon("plus")} Agregar foto<input type="file" accept="image/*" style="display:none" onchange="addGoalPhoto('${id}',this)"></label>
    <button class="btn p" onclick="openEditIdentity('${id}')">Editar meta</button><button class="btn g" onclick="closeModal()">Cerrar</button>`);
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
  const editing = !!id, it = editing ? list.find(x => x.id === id) : { name: "", idn: null };
  _tidn = it.idn; const title = kind === "habit" ? "hábito" : "compromiso";
  sheet(`<h3>${editing ? "Editar " + title : "Nuevo " + title}</h3><div class="mm">${kind === "habit" ? "Algo que quieres hacer" : "Algo que quieres dejar (lleva racha)"}</div>
    <div class="lbl">Nombre</div><input id="iName" class="field" value="${esc(it.name)}" placeholder="${kind === "habit" ? "Ej: Leer 20 minutos" : "Ej: Sin azúcar"}">
    <div class="lbl">¿Conectado a una meta? (opcional)</div><div class="chips" id="pickidn" style="padding:0">${idnChips(it.idn)}</div>
    <button class="btn p" onclick="saveItem('${kind}','${editing ? id : ""}')">${editing ? "Guardar" : "Crear"}</button>
    ${editing ? `<button class="btn g" onclick="delItem('${kind}','${id}')" style="color:var(--bad)">Borrar</button>` : ""}<button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function openEditHabit(id) { itemEditor("habit", id); }
function openEditCommit(id) { itemEditor("commit", id); }
function saveItem(kind, id) { const name = document.getElementById("iName").value.trim(); if (!name) return; freezePastDays(); const list = kind === "habit" ? CFG.habits : CFG.commitments; if (id) { const it = list.find(x => x.id === id); it.name = name; it.idn = _tidn; } else list.push({ id: uid(kind), name, idn: _tidn }); _tidn = null; saveCfg(); closeModal(); render(); }
function delItem(kind, id) { freezePastDays(); if (kind === "habit") CFG.habits = CFG.habits.filter(x => x.id !== id); else CFG.commitments = CFG.commitments.filter(x => x.id !== id); saveCfg(); closeModal(); render(); }

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
const BACKUP_KEYS = ["mt_cfg", "mt_log", "mt_tasks", "mt_workouts", "mt_prog", "mt_hoyOrder", "mt_todayRoutine", "mt_activeWorkout"];
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
  CFG = loadCfg(); LOG = loadLog(); TASKS = loadTasks(); WORKOUTS = loadWorkouts();
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

/* ---------- Navegación ---------- */
const NAV = [["hoy","Hoy","list"], ["progreso","Progreso","chart"], ["workouts","Workouts","dumbbell"], ["metas","Metas","target"], ["ajustes","Ajustes","sliders"]];
function buildNav() { document.getElementById("nav").innerHTML = NAV.map(([v, label, ic]) => `<button data-v="${v}" class="${v === VIEW ? "on" : ""}">${icon(ic)}${label}</button>`).join(""); }
document.getElementById("nav").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; VIEW = b.dataset.v; document.querySelectorAll("#nav button").forEach(x => x.classList.toggle("on", x === b)); render(); });

/* La inicialización (buildNav + render + service worker) vive en reorder.js,
   que se carga al final para que todas las funciones estén definidas. */
