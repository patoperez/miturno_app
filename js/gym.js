/* =====================================================================
   gym.js  ·  Mi Turno  ·  rutinas + reproductor con registro de series
   Depende de app.js (CFG, store, icon, day, sheet, render, WORKOUTS, etc.)
===================================================================== */
"use strict";

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fmtTime(s) { const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); }

/* ---------- Elegir rutina de hoy ---------- */
function openPickRoutine() {
  if (!CFG.routines.length) return openRoutineEditor();
  const cur = todayRoutine();
  sheet(`<h3>Rutina de hoy</h3><div class="mm">Elige cuál quieres hacer hoy</div>
    ${CFG.routines.map(r => `<div class="row" onclick="setTodayRoutine('${r.id}')"><span class="idi" style="background:#FF5A3C22;color:var(--cuerpo)">${icon("dumbbell")}</span>
      <div class="body"><div class="name">${esc(r.name)}</div><div class="sub">${r.exercises.length} ejercicios${r.days && r.days.length ? " · " + r.days.join(", ") : ""}</div></div>
      ${cur && cur.id === r.id ? `<span class="streak hot">${icon("check")}</span>` : ""}</div>`).join("")}
    <button class="btn g" onclick="closeModal()">Cerrar</button>`);
}
function setTodayRoutine(id) { store.set("mt_todayRoutine", JSON.stringify({ date: today(), routineId: id })); closeModal(); render(); }
function openRoutines() { VIEW = "workouts"; buildNav(); render(); closeModal(); }

/* ---------- Editor de rutina ---------- */
let _RT = null;
function openRoutineEditor(id) {
  const r = id ? CFG.routines.find(x => x.id === id) : null;
  _RT = r ? clone(r) : { id: null, name: "", days: [], exercises: [] };
  renderRoutineEditor();
}
function renderRoutineEditor() {
  const exRows = _RT.exercises.length ? _RT.exercises.map((e, i) => `
    <div class="row" onclick="openExercise(${i})"><span class="idi" style="background:#FF5A3C22;color:var(--cuerpo)">${i + 1}</span>
      <div class="body"><div class="name">${esc(e.name || "Ejercicio")}</div><div class="sub">${e.sets}×${esc(e.reps)} · descanso ${e.rest}s${e.weight ? " · " + esc(e.weight) : ""}</div></div>
      <button class="note-btn" onclick="event.stopPropagation();delExercise(${i})">${icon("trash")}</button></div>`).join("") : `<div class="empty">Sin ejercicios aún</div>`;
  sheet(`<h3>${_RT.id ? "Editar rutina" : "Nueva rutina"}</h3><div class="mm">Sin límites: agrega los ejercicios y series que quieras</div>
    <div class="lbl">Nombre</div><input id="rName" class="field" value="${esc(_RT.name)}" placeholder="Push A" oninput="_RT.name=this.value">
    <div class="lbl">Días asignados (opcional)</div>
    <div class="chips" id="rDays">${WEEKDAYS.map(d => `<div class="chip ${_RT.days.includes(d) ? "on" : ""}" style="${_RT.days.includes(d) ? "background:var(--cuerpo);border-color:var(--cuerpo);color:#fff" : ""}" onclick="toggleDay('${d}')">${d.slice(0, 3)}</div>`).join("")}</div>
    <div class="lbl">Ejercicios</div>${exRows}
    <button class="addbtn" onclick="openExercise(-1)">${icon("plus")} Agregar ejercicio</button>
    <button class="btn p" onclick="saveRoutine()">Guardar rutina</button>
    ${_RT.id ? `<button class="btn g" onclick="exportRoutine('${_RT.id}')">${icon("download")} Exportar JSON</button><button class="btn g" onclick="delRoutine('${_RT.id}')" style="color:var(--bad)">Borrar rutina</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function toggleDay(d) { const i = _RT.days.indexOf(d); if (i >= 0) _RT.days.splice(i, 1); else _RT.days.push(d); renderRoutineEditor(); }
function delExercise(i) { _RT.exercises.splice(i, 1); renderRoutineEditor(); }
function openExercise(i) {
  const isNew = i < 0, e = isNew ? { name: "", sets: 3, reps: "10", rest: 90, weight: "", note: "" } : _RT.exercises[i];
  sheet(`<h3>${isNew ? "Nuevo ejercicio" : "Editar ejercicio"}</h3>
    <div class="lbl">Nombre</div><input id="xName" class="field" value="${esc(e.name)}" placeholder="Press banca">
    <div class="row2"><div><div class="lbl">Series</div><input id="xSets" class="field" type="number" min="1" value="${e.sets}"></div>
      <div><div class="lbl">Reps</div><input id="xReps" class="field" value="${esc(e.reps)}" placeholder="8-10"></div></div>
    <div class="row2"><div><div class="lbl">Descanso (seg)</div><input id="xRest" class="field" type="number" min="0" value="${e.rest}"></div>
      <div><div class="lbl">Peso (opcional)</div><input id="xWeight" class="field" value="${esc(e.weight)}" placeholder="60 kg"></div></div>
    <div class="lbl">Nota (opcional)</div><input id="xNote" class="field" value="${esc(e.note)}" placeholder="tempo, técnica...">
    <button class="btn p" onclick="saveExercise(${i})">Guardar ejercicio</button><button class="btn g" onclick="renderRoutineEditor()">Cancelar</button>`);
}
function saveExercise(i) {
  /* Todo nombre pasa por el catálogo: si ya existe (o es un alias), se reusa
     su id en vez de crear un ejercicio nuevo. */
  const cat = findOrCreateExercise(document.getElementById("xName").value);
  const ex = {
    id: i < 0 ? uid("e") : (_RT.exercises[i].id || uid("e")),
    exId: cat.id,
    name: cat.name,
    sets: Math.max(1, parseInt(document.getElementById("xSets").value) || 1),
    reps: document.getElementById("xReps").value.trim() || "-",
    rest: Math.max(0, parseInt(document.getElementById("xRest").value) || 0),
    weight: document.getElementById("xWeight").value.trim(),
    note: document.getElementById("xNote").value.trim()
  };
  if (i < 0) _RT.exercises.push(ex); else _RT.exercises[i] = ex;
  saveCfg();   // el catálogo pudo crecer
  renderRoutineEditor();
}
function saveRoutine() {
  _RT.name = (document.getElementById("rName") ? document.getElementById("rName").value.trim() : _RT.name) || "Rutina";
  if (_RT.id) { const idx = CFG.routines.findIndex(r => r.id === _RT.id); if (idx >= 0) CFG.routines[idx] = _RT; }
  else { _RT.id = uid("rt"); CFG.routines.push(_RT); }
  saveCfg(); closeModal(); render();
}
function delRoutine(id) { CFG.routines = CFG.routines.filter(r => r.id !== id); saveCfg(); closeModal(); render(); }

/* ---------- Importar / exportar JSON ---------- */
function openImportJSON() {
  sheet(`<h3>Importar rutina (JSON)</h3><div class="mm">Pega el JSON de tu rutina. Acepta una rutina, varias, o {"routines":[...]}. Revisa las instrucciones que te dejé.</div>
    <textarea id="jsonIn" placeholder='{"name":"Push A","days":["lunes"],"exercises":[{"name":"Press banca","sets":4,"reps":"8-10","rest":120}]}' style="min-height:160px;font-family:monospace;font-size:12px"></textarea>
    <div id="jsonMsg" style="font-size:13px;margin-top:8px"></div>
    <button class="btn p" onclick="importJSON()">Importar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function normalizeRoutine(o) {
  if (!o || !Array.isArray(o.exercises)) return null;
  return {
    id: uid("rt"), name: (o.name || "Rutina importada").toString(),
    days: Array.isArray(o.days) ? o.days.filter(d => WEEKDAYS.includes(d)) : [],
    /* Cada nombre importado se resuelve contra el catálogo (nombre canónico
       y alias, sin acentos ni mayúsculas ni espacios de más). Reimportar la
       misma rutina con otra grafía reusa el id: el historial no se parte. */
    exercises: o.exercises.map(e => {
      const cat = findOrCreateExercise((e.name || "Ejercicio").toString());
      return {
        id: uid("e"), exId: cat.id, name: cat.name,
        sets: Math.max(1, parseInt(e.sets) || 1), reps: (e.reps != null ? e.reps : "-").toString(),
        rest: Math.max(0, parseInt(e.rest) || 0), weight: (e.weight || "").toString(), note: (e.note || "").toString()
      };
    })
  };
}
function importJSON() {
  const msg = document.getElementById("jsonMsg");
  let data; try { data = JSON.parse(document.getElementById("jsonIn").value); } catch (e) { msg.innerHTML = `<span style="color:var(--bad)">JSON inválido: ${esc(e.message)}</span>`; return; }
  let arr = Array.isArray(data) ? data : (data && Array.isArray(data.routines) ? data.routines : [data]);
  const norm = arr.map(normalizeRoutine).filter(Boolean);
  if (!norm.length) { msg.innerHTML = `<span style="color:var(--bad)">No encontré rutinas válidas. Cada rutina necesita "exercises".</span>`; return; }
  norm.forEach(r => CFG.routines.push(r)); saveCfg(); closeModal(); render();
}
function exportRoutine(id) {
  const r = CFG.routines.find(x => x.id === id); if (!r) return;
  const clean = { name: r.name, days: r.days, exercises: r.exercises.map(e => ({ name: e.name, sets: e.sets, reps: e.reps, rest: e.rest, weight: e.weight, note: e.note })) };
  sheet(`<h3>Exportar "${esc(r.name)}"</h3><div class="mm">Copia este JSON para respaldarlo o compartirlo</div>
    <textarea style="min-height:200px;font-family:monospace;font-size:12px" onclick="this.select()">${esc(JSON.stringify(clean, null, 2))}</textarea>
    <button class="btn g" onclick="renderRoutineEditor()">Volver</button>`);
}

/* ---------- Reproductor con registro de series ---------- */
let PLAYER = null;

/* Persistencia del entreno en curso (para reanudar) */
function getActiveWorkout() {
  const a = safeJSON(store.get("mt_activeWorkout"));
  if (!a || !a.rid || !CFG.routines.find(r => r.id === a.rid)) return null;
  return a;
}
function savePlayerState() {
  if (!PLAYER) return;
  store.set("mt_activeWorkout", JSON.stringify({ rid: PLAYER.r.id, ei: PLAYER.ei, si: PLAYER.si, phase: PLAYER.phase, log: PLAYER.log, elapsedBase: elapsed(), restEnd: PLAYER.restEnd || null, lastIdx: PLAYER.lastIdx == null ? null : PLAYER.lastIdx, prs: PLAYER.prs || [], restNotified: !!PLAYER.restNotified }));
}
function clearActive() { store.set("mt_activeWorkout", ""); }

function startWorkout(rid) {
  const act = getActiveWorkout();
  if (act) { openResumeChoice(rid); return; }
  beginWorkout(rid);
}
function beginWorkout(rid) {
  const r = CFG.routines.find(x => x.id === rid);
  if (!r || !r.exercises.length) { openRoutineEditor(rid); return; }
  PLAYER = { r, ei: 0, si: 1, phase: "set", remaining: 0, timer: null, start: Date.now(), elapsedBase: 0, wake: null, log: [], prs: [], pr: null };
  requestWake(); renderPlayer();
}
function resumeWorkout() {
  const a = getActiveWorkout(); if (!a) return render();
  const r = CFG.routines.find(x => x.id === a.rid); if (!r) { clearActive(); return render(); }
  PLAYER = { r, ei: a.ei, si: a.si, phase: a.phase, timer: null, start: Date.now(), elapsedBase: a.elapsedBase || 0, wake: null, log: a.log || [], restEnd: a.restEnd || null, lastIdx: a.lastIdx == null ? (a.log ? a.log.length - 1 : null) : a.lastIdx, prs: a.prs || [], pr: null, restNotified: !!a.restNotified };
  // Si estaba descansando: continúa el conteo real; si ya venció mientras no estabas, suena la alarma.
  if (PLAYER.phase === "rest" || PLAYER.phase === "alarm") {
    if (PLAYER.restEnd && restLeft() > 0) { PLAYER.phase = "rest"; PLAYER.timer = setInterval(tick, 500); }
    else { PLAYER.phase = "alarm"; startAlarm(); }
  }
  requestWake(); renderPlayer();
}
function openResumeChoice(rid) {
  const a = getActiveWorkout(); const r = CFG.routines.find(x => x.id === a.rid);
  sheet(`<h3>Entreno en curso</h3><div class="mm">Tienes un entreno sin terminar: ${esc(r ? r.name : "")} (ejercicio ${a.ei + 1}, serie ${a.si})</div>
    <button class="btn p" onclick="resumeWorkout()">${icon("play")} Reanudar</button>
    <button class="btn g" onclick="discardAndBegin('${rid}')">Empezar de nuevo</button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function discardAndBegin(rid) { clearActive(); beginWorkout(rid); }
function confirmRestart() {
  const a = getActiveWorkout(); if (!a) return;
  const r = CFG.routines.find(x => x.id === a.rid);
  sheet(`<h3>¿Reiniciar el entreno?</h3><div class="mm">Se borrará el progreso de esta sesión de ${esc(r ? r.name : "")}. Esto no se puede deshacer.</div>
    <button class="btn p" onclick="doRestart('${a.rid}')" style="background:var(--bad)">Sí, reiniciar</button>
    <button class="btn g" onclick="resumeWorkout()">Mejor reanudar</button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function doRestart(rid) { clearActive(); beginWorkout(rid); }

/* Opciones del entreno en curso: reanudar / finalizar / reiniciar / descartar */
function openActiveOptions() {
  const a = getActiveWorkout(); if (!a) return;
  const r = CFG.routines.find(x => x.id === a.rid);
  const nSets = (a.log || []).length;
  sheet(`<h3>Entreno en curso</h3><div class="mm">${esc(r ? r.name : "")} · ejercicio ${a.ei + 1}, serie ${a.si}${nSets ? ` · ${nSets} series registradas` : ""}</div>
    <button class="btn p" onclick="resumeWorkout()">${icon("play")} Reanudar</button>
    <button class="btn g" onclick="finalizeActive()">Finalizar y guardar lo que llevo</button>
    <button class="btn g" onclick="doRestart('${a.rid}')">Reiniciar desde cero</button>
    <button class="btn g" onclick="discardActive()" style="color:var(--bad)">Descartar (borrar todo)</button>
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function finalizeActive() {
  const a = getActiveWorkout(); if (!a) { closeModal(); return render(); }
  const r = CFG.routines.find(x => x.id === a.rid);
  const log = a.log || [];
  if (!log.length) { discardActive(); return; } // nada registrado -> como descartar
  const vol = log.reduce((acc, s) => { const w = parseFloat(s.weight), rp = parseInt(s.reps); return acc + (isNaN(w) || isNaN(rp) ? 0 : w * rp); }, 0);
  WORKOUTS.push({ id: uid("w"), date: today(), activityId: "gym", type: "strength", routineId: a.rid, name: r ? r.name : "Entreno", duration: a.elapsedBase || 0, volume: vol, unit: weightUnit(), sets: log.map(s => ({ exName: s.exName, exId: s.exId || null, reps: s.reps, weight: s.weight })) });
  saveWorkouts();
  const l = day(today()); const gh = CFG.habits.find(h => h.id === "gym") || CFG.habits.find(h => /gym|entren/i.test(h.name)); if (gh) l.habits[gh.id] = true; saveLog();
  clearActive(); closeModal(); render();
}
function discardActive() { clearActive(); closeModal(); render(); }

function requestWake() { try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(w => { if (PLAYER) PLAYER.wake = w; }).catch(() => {}); } catch (e) {} }
function buzz() { try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {} }
function elapsed() { const P = PLAYER; return (P.elapsedBase || 0) + Math.floor((Date.now() - P.start) / 1000); }

/* ---------- Unidad de peso (kg / lb) ---------- */
function weightUnit() { return (CFG.settings && CFG.settings.unit) || "kg"; }
function setWeightUnit(u) { CFG.settings.unit = u; saveCfg(); render(); }

/* ---------- Alarma (sonido + vibración, hasta detenerla) ---------- */
const ALARM = { ctx: null, osc: null, gain: null, vib: null, on: false };
function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!ALARM.ctx) ALARM.ctx = new AC();
    if (ALARM.ctx.state === "suspended") ALARM.ctx.resume();
    // "desbloquea" el audio en iOS con un pulso mudo dentro del gesto del usuario
    const g = ALARM.ctx.createGain(); g.gain.value = 0;
    const o = ALARM.ctx.createOscillator(); o.connect(g); g.connect(ALARM.ctx.destination);
    o.start(); o.stop(ALARM.ctx.currentTime + 0.01);
  } catch (e) {}
}
function startAlarm() {
  if (ALARM.on) return; ALARM.on = true;
  try {
    if (ALARM.ctx) {
      if (ALARM.ctx.state === "suspended") ALARM.ctx.resume();
      const ctx = ALARM.ctx;
      ALARM.gain = ctx.createGain(); ALARM.gain.gain.value = 0.0001; ALARM.gain.connect(ctx.destination);
      ALARM.osc = ctx.createOscillator(); ALARM.osc.type = "sine"; ALARM.osc.frequency.value = 880;
      ALARM.osc.connect(ALARM.gain); ALARM.osc.start();
      // patrón de bips: sube y baja el volumen cada 0.35 s
      const t0 = ctx.currentTime;
      for (let i = 0; i < 600; i++) {
        const t = t0 + i * 0.7;
        ALARM.gain.gain.setValueAtTime(0.35, t);
        ALARM.gain.gain.setValueAtTime(0.0001, t + 0.35);
      }
    }
  } catch (e) {}
  try { if (navigator.vibrate) { navigator.vibrate([600, 300, 600, 300]); ALARM.vib = setInterval(() => { try { navigator.vibrate([600, 300, 600, 300]); } catch (_) {} }, 1800); } } catch (e) {}
}
function stopAlarm() {
  ALARM.on = false;
  try { if (ALARM.osc) { ALARM.osc.stop(); ALARM.osc.disconnect(); } } catch (e) {}
  try { if (ALARM.gain) ALARM.gain.disconnect(); } catch (e) {}
  ALARM.osc = null; ALARM.gain = null;
  if (ALARM.vib) { clearInterval(ALARM.vib); ALARM.vib = null; }
  try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {}
}
function dismissAlarm() {
  stopAlarm();
  const P = PLAYER; if (!P) return;
  P.phase = "set"; P.restEnd = null; P.pr = null; renderPlayer();
}

/* ---------- Registro de series ---------- */
/* El id del ejercicio que se está haciendo. Una rutina vieja puede no
   traerlo todavía: se resuelve (o se crea) por nombre. */
function curExId(ex) {
  if (ex.exId && exById(ex.exId)) return ex.exId;
  const cat = findOrCreateExercise(ex.name);
  ex.exId = cat.id; saveCfg();
  return cat.id;
}
function prefillFor(ex) {
  const id = curExId(ex);
  for (let i = PLAYER.log.length - 1; i >= 0; i--) if (PLAYER.log[i].exId === id) return { weight: PLAYER.log[i].weight, reps: PLAYER.log[i].reps };
  const lp = lastPerf(id); if (lp) return { weight: lp.weight, reps: lp.reps };
  return { weight: "", reps: "" };
}
/* Mejor peso de ESTE ejercicio en la sesión en curso (aún sin guardar). */
function sessionBest(id) {
  let b = null;
  PLAYER.log.forEach(s => { if (s.exId !== id) return; const v = parseFloat(s.weight); if (!isNaN(v) && (b === null || v > b)) b = v; });
  return b;
}
function logCurrentSet() {
  const P = PLAYER, ex = P.r.exercises[P.ei];
  const id = curExId(ex);
  const w = document.getElementById("plW"), r = document.getElementById("plR");
  const weight = w ? w.value.trim() : "", reps = r ? r.value.trim() : "";
  /* ¿Récord? Se compara ANTES de anotar, contra el historial guardado y
     contra lo ya hecho en esta misma sesión, para no celebrar dos veces
     el mismo peso. */
  const wt = parseFloat(weight);
  const stored = exercisePR(id), sb = sessionBest(id);
  const prev = Math.max(stored ? parseFloat(stored.weight) : -Infinity, sb === null ? -Infinity : sb);
  P.pr = null;
  if (!isNaN(wt) && wt > 0 && wt > prev) {
    P.pr = { name: exName(id, ex.name), weight: weight, reps: reps, unit: weightUnit(), previo: isFinite(prev) ? prev : null };
    P.prs = (P.prs || []).concat([P.pr]);
  }
  P.log.push({ exName: ex.name, exId: id, set: P.si, weight: weight, reps: reps, unit: weightUnit() });
  P.lastIdx = P.log.length - 1;
}
/* Banner de récord: claro pero sin bloquear nada. */
function prBanner(P) {
  if (!P.pr) return "";
  return `<div class="pl-pr">${icon("trophy")}<div><b>¡Nuevo record!</b>
    <span>${esc(P.pr.name)} · ${esc(P.pr.weight)} ${esc(P.pr.unit)}${P.pr.reps ? " × " + esc(P.pr.reps) : ""}${P.pr.previo !== null ? " · antes " + P.pr.previo + " " + esc(P.pr.unit) : ""}</span></div></div>`;
}
/* Editar la serie recién registrada mientras corre el descanso */
function editLoggedSet(which, val) {
  const P = PLAYER; if (!P || P.lastIdx == null || !P.log[P.lastIdx]) return;
  P.log[P.lastIdx][which] = val.trim(); savePlayerState();
}
function renderPlayer() {
  const P = PLAYER, r = P.r, ex = r.exercises[P.ei], next = r.exercises[P.ei + 1];
  const topbar = `<div class="pl-top"><button class="pl-x" onclick="closePlayer()">${icon("close")}</button>
    <div class="pl-prog">${esc(r.name)} · ${P.ei + 1}/${r.exercises.length}</div><div class="pl-elapsed">${fmtTime(elapsed())}</div></div>`;
  let body = "";
  const U = weightUnit();
  if (P.phase === "set") {
    const last = P.si >= ex.sets, pf = prefillFor(ex), lp = lastPerf(curExId(ex));
    body = `<div class="pl-mid">
      <div class="pl-ex">${esc(exName(curExId(ex), ex.name))}</div>
      <div class="pl-set">Serie ${P.si} de ${ex.sets}</div>
      <div class="pl-reps">objetivo: ${esc(ex.reps)} reps${ex.weight ? " · " + esc(ex.weight) : ""}</div>
      ${ex.note ? `<div class="pl-note">${esc(ex.note)}</div>` : ""}
      <div class="pl-log"><div><label>Peso (${U})</label><input id="plW" inputmode="decimal" value="${esc(pf.weight)}" placeholder="—"></div>
        <div><label>Reps</label><input id="plR" inputmode="numeric" value="${esc(pf.reps)}" placeholder="${esc(ex.reps)}"></div></div>
      ${lp ? `<div class="pl-last">Última vez: ${esc(lp.weight) || "—"} ${U} × ${esc(lp.reps) || "—"}</div>` : ""}
    </div>
    <div class="pl-actions">
      ${last ? `<button class="pl-primary" onclick="afterLastSet()">Terminar ejercicio</button>` : `<button class="pl-primary" onclick="startRest()">${icon("play")} Registrar y descansar ${ex.rest}s</button>`}
      <div class="pl-sub">Anota lo que hiciste y presiona el botón</div>
    </div>`;
  } else if (P.phase === "rest") {
    const s = P.log[P.lastIdx] || { weight: "", reps: "" };
    body = `<div class="pl-mid">${prBanner(P)}<div class="pl-restlbl">Descanso</div><div class="pl-timer" id="ptime">${fmtTime(restLeft())}</div>
      <div class="pl-next">Sigue: Serie ${P.si} de ${ex.sets} · ${esc(ex.name)}</div>
      <div class="pl-logrest"><div class="pl-logtitle">Serie anterior · puedes ajustarla</div>
        <div class="pl-log"><div><label>Peso (${U})</label><input inputmode="decimal" value="${esc(s.weight)}" placeholder="—" onchange="editLoggedSet('weight',this.value)"></div>
          <div><label>Reps</label><input inputmode="numeric" value="${esc(s.reps)}" placeholder="—" onchange="editLoggedSet('reps',this.value)"></div></div></div>
    </div>
    <div class="pl-actions"><div class="pl-restctl"><button onclick="addRest(-15)">-15s</button><button onclick="addRest(15)">+15s</button><button onclick="skipRest()">${icon("skipfwd")} Saltar</button></div></div>`;
  } else if (P.phase === "alarm") {
    body = `<div class="pl-mid"><div class="pl-restlbl">Descanso terminado</div>
      <div class="pl-timer alarm">0:00</div>
      <div class="pl-next big">Serie ${P.si} de ${ex.sets}</div><div class="pl-next">${esc(ex.name)}</div></div>
    <div class="pl-actions"><button class="pl-primary alarmbtn" onclick="dismissAlarm()">Detener alarma</button></div>`;
  } else if (P.phase === "transition") {
    body = `<div class="pl-mid">${prBanner(P)}<div class="pl-done">${icon("check")}</div><div class="pl-ex">Terminaste ${esc(ex.name)}</div>
      <div class="pl-next big">Sigue: ${esc(next.name)}</div><div class="pl-summary">${next.sets} series × ${esc(next.reps)} reps · descanso ${next.rest}s${next.weight ? " · " + esc(next.weight) : ""}</div></div>
    <div class="pl-actions"><button class="pl-primary" onclick="continueNext()">Continuar</button></div>`;
  } else {
    const total = P.log.length, vol = P.log.reduce((a, s) => { const w = parseFloat(s.weight), rp = parseInt(s.reps); return a + (isNaN(w) || isNaN(rp) ? 0 : w * rp); }, 0);
    const nprs = (P.prs || []).length;
    body = `<div class="pl-mid"><div class="pl-done big">${icon("check")}</div><div class="pl-ex">¡Rutina terminada!</div>
      <div class="pl-summary">${r.exercises.length} ejercicios · ${total} series${vol ? " · " + Math.round(vol) + " kg de volumen" : ""} · ${fmtTime(elapsed())}</div>
      ${nprs ? `<div class="pl-pr">${icon("trophy")}<div><b>${nprs === 1 ? "1 nuevo record" : nprs + " nuevos records"}</b>
        <span>${P.prs.map(x => esc(x.name) + " " + esc(x.weight) + " " + esc(x.unit)).join(" · ")}</span></div></div>` : ""}
      <div class="pl-note">Un voto más por el cuerpo que quieres.</div></div>
    <div class="pl-actions"><button class="pl-primary" onclick="finishWorkout()">Guardar entreno</button></div>`;
  }
  modal.innerHTML = `<div class="player${P.phase === "alarm" ? " alarming" : ""}">${topbar}${body}</div>`;
  savePlayerState();
}

/* ---------- Temporizador basado en reloj real (sobrevive bloqueo/segundo plano) ---------- */
function restLeft() { const P = PLAYER; if (!P || !P.restEnd) return 0; return Math.max(0, Math.round((P.restEnd - Date.now()) / 1000)); }
function startRest() {
  const P = PLAYER, ex = P.r.exercises[P.ei];
  primeAudio(); // el tap del usuario habilita el sonido de la alarma
  logCurrentSet();
  P.phase = "rest"; P.restEnd = Date.now() + ex.rest * 1000; P.si++; P.restNotified = false;
  clearInterval(P.timer); P.timer = setInterval(tick, 500); renderPlayer();
}
/* ---------- Aviso local de fin de descanso ----------
   Notificación LOCAL por el service worker, NO push de servidor: el
   descanso dura segundos y vive en este dispositivo; pasarlo por Supabase
   agregaría latencia y complejidad sin ganar nada.
   Degrada en silencio si no hay permiso: jamás se pide permiso a media
   serie ni se bloquea el entreno por esto. */
function notifyRestDone() {
  const P = PLAYER;
  if (!P || P.restNotified) return;
  P.restNotified = true;            // se marca siempre: nunca dos avisos del mismo descanso
  savePlayerState();
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistration) return;
    const ex = P.r.exercises[P.ei];
    const cuerpo = "Serie " + P.si + " de " + ex.sets + " · " + exName(curExId(ex), ex.name);
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg || !reg.showNotification) return;
      reg.showNotification("Descanso terminado", {
        body: cuerpo, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png",
        tag: "mt-rest", renotify: true, data: { url: "./index.html", resume: true }
      });
    }).catch(() => {});
  } catch (e) { /* sin notificaciones: se queda la alarma de siempre */ }
}
function restExpired() {
  const P = PLAYER; if (!P) return;
  clearInterval(P.timer); P.timer = null;
  P.phase = "alarm"; startAlarm(); renderPlayer();
}
function tick() {
  const P = PLAYER; if (!P) return;
  if (P.phase !== "rest") return;
  const left = restLeft();
  const el = document.getElementById("ptime"); if (el) el.textContent = fmtTime(left);
  if (left <= 0) { notifyRestDone(); restExpired(); }
}
function addRest(s) {
  const P = PLAYER; if (!P.restEnd) return;
  P.restEnd = Math.max(Date.now() + 1000, P.restEnd + s * 1000);
  const el = document.getElementById("ptime"); if (el) el.textContent = fmtTime(restLeft());
  savePlayerState();
}
function skipRest() { const P = PLAYER; clearInterval(P.timer); P.timer = null; P.restEnd = null; stopAlarm(); P.phase = "set"; P.pr = null; renderPlayer(); }
/* Al volver a la app: recalcula el tiempo transcurrido en segundo plano */
if (typeof document !== "undefined") {
  /* iOS estrangula (o congela) los timers de una PWA en segundo plano, así
     que `tick` puede no haber corrido nunca. Al volver se recalcula contra
     el reloj real y, si el descanso ya venció, se atiende de inmediato.
     `restNotified` se marca igual para no soltar un aviso tardío de un
     descanso que el usuario ya está viendo en pantalla. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !PLAYER) return;
    if (PLAYER.phase === "rest") {
      if (restLeft() <= 0) { PLAYER.restNotified = true; restExpired(); }
      else renderPlayer();
      return;
    }
  });
}
function afterLastSet() {
  const P = PLAYER; logCurrentSet();
  if (P.ei < P.r.exercises.length - 1) { P.phase = "transition"; renderPlayer(); }
  else { P.phase = "done"; renderPlayer(); }
}
function continueNext() { const P = PLAYER; P.ei++; P.si = 1; P.phase = "set"; P.pr = null; renderPlayer(); }
function finishWorkout() {
  const P = PLAYER;
  const vol = P.log.reduce((a, s) => { const w = parseFloat(s.weight), r = parseInt(s.reps); return a + (isNaN(w) || isNaN(r) ? 0 : w * r); }, 0);
  WORKOUTS.push({ id: uid("w"), date: today(), activityId: "gym", type: "strength", routineId: P.r.id, name: P.r.name, duration: elapsed(), volume: vol, unit: weightUnit(), sets: P.log.map(s => ({ exName: s.exName, exId: s.exId || null, reps: s.reps, weight: s.weight })) });
  saveWorkouts();
  const l = day(today());
  const gh = CFG.habits.find(h => h.id === "gym") || CFG.habits.find(h => /gym|entren/i.test(h.name));
  if (gh) l.habits[gh.id] = true; saveLog();
  clearActive(); cleanupPlayer(); render();
}
function cleanupPlayer() {
  stopAlarm();
  if (PLAYER) { clearInterval(PLAYER.timer); try { if (PLAYER.wake) PLAYER.wake.release(); } catch (e) {} }
  PLAYER = null; closeModal();
}
function closePlayer() { if (PLAYER) savePlayerState(); cleanupPlayer(); render(); }

/* Tocar la notificación enfoca la app; el service worker avisa aquí para
   volver al reproductor aunque la página se haya recargado. */
if (typeof navigator !== "undefined" && navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
  navigator.serviceWorker.addEventListener("message", e => {
    if (!e.data || e.data.type !== "mt-resume-workout") return;
    if (PLAYER) { renderPlayer(); return; }
    if (getActiveWorkout()) resumeWorkout();
  });
}
