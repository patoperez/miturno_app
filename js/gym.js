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
  const ex = {
    id: i < 0 ? uid("e") : (_RT.exercises[i].id || uid("e")),
    name: document.getElementById("xName").value.trim() || "Ejercicio",
    sets: Math.max(1, parseInt(document.getElementById("xSets").value) || 1),
    reps: document.getElementById("xReps").value.trim() || "-",
    rest: Math.max(0, parseInt(document.getElementById("xRest").value) || 0),
    weight: document.getElementById("xWeight").value.trim(),
    note: document.getElementById("xNote").value.trim()
  };
  if (i < 0) _RT.exercises.push(ex); else _RT.exercises[i] = ex;
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
    exercises: o.exercises.map(e => ({
      id: uid("e"), name: (e.name || "Ejercicio").toString(),
      sets: Math.max(1, parseInt(e.sets) || 1), reps: (e.reps != null ? e.reps : "-").toString(),
      rest: Math.max(0, parseInt(e.rest) || 0), weight: (e.weight || "").toString(), note: (e.note || "").toString()
    }))
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
  store.set("mt_activeWorkout", JSON.stringify({ rid: PLAYER.r.id, ei: PLAYER.ei, si: PLAYER.si, phase: PLAYER.phase, log: PLAYER.log, elapsedBase: elapsed() }));
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
  PLAYER = { r, ei: 0, si: 1, phase: "set", remaining: 0, timer: null, start: Date.now(), elapsedBase: 0, wake: null, log: [] };
  requestWake(); renderPlayer();
}
function resumeWorkout() {
  const a = getActiveWorkout(); if (!a) return render();
  const r = CFG.routines.find(x => x.id === a.rid); if (!r) { clearActive(); return render(); }
  PLAYER = { r, ei: a.ei, si: a.si, phase: a.phase === "rest" ? "set" : a.phase, remaining: 0, timer: null, start: Date.now(), elapsedBase: a.elapsedBase || 0, wake: null, log: a.log || [] };
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
  WORKOUTS.push({ id: uid("w"), date: today(), activityId: "gym", type: "strength", routineId: a.rid, name: r ? r.name : "Entreno", duration: a.elapsedBase || 0, volume: vol, sets: log.map(s => ({ exName: s.exName, reps: s.reps, weight: s.weight })) });
  saveWorkouts();
  const l = day(today()); const gh = CFG.habits.find(h => h.id === "gym") || CFG.habits.find(h => /gym|entren/i.test(h.name)); if (gh) l.habits[gh.id] = true; saveLog();
  clearActive(); closeModal(); render();
}
function discardActive() { clearActive(); closeModal(); render(); }

function requestWake() { try { if (navigator.wakeLock) navigator.wakeLock.request("screen").then(w => { if (PLAYER) PLAYER.wake = w; }).catch(() => {}); } catch (e) {} }
function buzz() { try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {} }
function elapsed() { const P = PLAYER; return (P.elapsedBase || 0) + Math.floor((Date.now() - P.start) / 1000); }

function prefillFor(exName, si) {
  // 1) misma sesión: última serie registrada de este ejercicio
  for (let i = PLAYER.log.length - 1; i >= 0; i--) if (normName(PLAYER.log[i].exName) === normName(exName)) return { weight: PLAYER.log[i].weight, reps: PLAYER.log[i].reps };
  // 2) historial: última vez que lo hiciste
  const lp = lastPerf(exName); if (lp) return { weight: lp.weight, reps: lp.reps };
  return { weight: "", reps: "" };
}
function logCurrentSet() {
  const P = PLAYER, ex = P.r.exercises[P.ei];
  const w = document.getElementById("plW"), r = document.getElementById("plR");
  P.log.push({ exName: ex.name, set: P.si, weight: w ? w.value.trim() : "", reps: r ? r.value.trim() : "" });
}
function renderPlayer() {
  const P = PLAYER, r = P.r, ex = r.exercises[P.ei], next = r.exercises[P.ei + 1];
  const topbar = `<div class="pl-top"><button class="pl-x" onclick="closePlayer()">${icon("close")}</button>
    <div class="pl-prog">${esc(r.name)} · ${P.ei + 1}/${r.exercises.length}</div><div class="pl-elapsed">${fmtTime(elapsed())}</div></div>`;
  let body = "";
  if (P.phase === "set") {
    const last = P.si >= ex.sets, pf = prefillFor(ex.name, P.si), lp = lastPerf(ex.name);
    body = `<div class="pl-mid">
      <div class="pl-ex">${esc(ex.name)}</div>
      <div class="pl-set">Serie ${P.si} de ${ex.sets}</div>
      <div class="pl-reps">objetivo: ${esc(ex.reps)} reps${ex.weight ? " · " + esc(ex.weight) : ""}</div>
      ${ex.note ? `<div class="pl-note">${esc(ex.note)}</div>` : ""}
      <div class="pl-log"><div><label>Peso (kg)</label><input id="plW" inputmode="decimal" value="${esc(pf.weight)}" placeholder="—"></div>
        <div><label>Reps</label><input id="plR" inputmode="numeric" value="${esc(pf.reps)}" placeholder="${esc(ex.reps)}"></div></div>
      ${lp ? `<div class="pl-last">Última vez: ${esc(lp.weight) || "—"} kg × ${esc(lp.reps) || "—"}</div>` : ""}
    </div>
    <div class="pl-actions">
      ${last ? `<button class="pl-primary" onclick="afterLastSet()">Terminar ejercicio</button>` : `<button class="pl-primary" onclick="startRest()">${icon("play")} Registrar y descansar ${ex.rest}s</button>`}
      <div class="pl-sub">Anota lo que hiciste y presiona el botón</div>
    </div>`;
  } else if (P.phase === "rest") {
    body = `<div class="pl-mid"><div class="pl-restlbl">Descanso</div><div class="pl-timer" id="ptime">${fmtTime(P.remaining)}</div>
      <div class="pl-next">Sigue: Serie ${P.si} de ${ex.sets} · ${esc(ex.name)}</div></div>
    <div class="pl-actions"><div class="pl-restctl"><button onclick="addRest(-15)">-15s</button><button onclick="addRest(15)">+15s</button><button onclick="skipRest()">${icon("skipfwd")} Saltar</button></div></div>`;
  } else if (P.phase === "transition") {
    body = `<div class="pl-mid"><div class="pl-done">${icon("check")}</div><div class="pl-ex">Terminaste ${esc(ex.name)}</div>
      <div class="pl-next big">Sigue: ${esc(next.name)}</div><div class="pl-summary">${next.sets} series × ${esc(next.reps)} reps · descanso ${next.rest}s${next.weight ? " · " + esc(next.weight) : ""}</div></div>
    <div class="pl-actions"><button class="pl-primary" onclick="continueNext()">Continuar</button></div>`;
  } else {
    const total = P.log.length, vol = P.log.reduce((a, s) => { const w = parseFloat(s.weight), rp = parseInt(s.reps); return a + (isNaN(w) || isNaN(rp) ? 0 : w * rp); }, 0);
    body = `<div class="pl-mid"><div class="pl-done big">${icon("check")}</div><div class="pl-ex">¡Rutina terminada!</div>
      <div class="pl-summary">${r.exercises.length} ejercicios · ${total} series${vol ? " · " + Math.round(vol) + " kg de volumen" : ""} · ${fmtTime(elapsed())}</div>
      <div class="pl-note">Un voto más por el cuerpo que quieres.</div></div>
    <div class="pl-actions"><button class="pl-primary" onclick="finishWorkout()">Guardar entreno</button></div>`;
  }
  modal.innerHTML = `<div class="player">${topbar}${body}</div>`;
  savePlayerState();
}
function startRest() {
  const P = PLAYER, ex = P.r.exercises[P.ei];
  logCurrentSet();
  P.phase = "rest"; P.remaining = ex.rest; P.si++;
  clearInterval(P.timer); P.timer = setInterval(tick, 1000); renderPlayer();
}
function tick() {
  const P = PLAYER; if (!P) return;
  P.remaining--;
  const el = document.getElementById("ptime"); if (el) el.textContent = fmtTime(Math.max(0, P.remaining));
  if (P.remaining <= 0) { clearInterval(P.timer); buzz(); P.phase = "set"; renderPlayer(); }
}
function addRest(s) { const P = PLAYER; P.remaining = Math.max(1, P.remaining + s); const el = document.getElementById("ptime"); if (el) el.textContent = fmtTime(P.remaining); }
function skipRest() { const P = PLAYER; clearInterval(P.timer); P.phase = "set"; renderPlayer(); }
function afterLastSet() {
  const P = PLAYER; logCurrentSet();
  if (P.ei < P.r.exercises.length - 1) { P.phase = "transition"; renderPlayer(); }
  else { P.phase = "done"; renderPlayer(); }
}
function continueNext() { const P = PLAYER; P.ei++; P.si = 1; P.phase = "set"; renderPlayer(); }
function finishWorkout() {
  const P = PLAYER;
  const vol = P.log.reduce((a, s) => { const w = parseFloat(s.weight), r = parseInt(s.reps); return a + (isNaN(w) || isNaN(r) ? 0 : w * r); }, 0);
  WORKOUTS.push({ id: uid("w"), date: today(), activityId: "gym", type: "strength", routineId: P.r.id, name: P.r.name, duration: elapsed(), volume: vol, sets: P.log.map(s => ({ exName: s.exName, reps: s.reps, weight: s.weight })) });
  saveWorkouts();
  const l = day(today());
  const gh = CFG.habits.find(h => h.id === "gym") || CFG.habits.find(h => /gym|entren/i.test(h.name));
  if (gh) l.habits[gh.id] = true; saveLog();
  clearActive(); cleanupPlayer(); render();
}
function cleanupPlayer() {
  if (PLAYER) { clearInterval(PLAYER.timer); try { if (PLAYER.wake) PLAYER.wake.release(); } catch (e) {} }
  PLAYER = null; closeModal();
}
function closePlayer() { if (PLAYER) savePlayerState(); cleanupPlayer(); render(); }
