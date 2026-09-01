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
      <div class="body"><div class="name">${esc(r.name)}</div><div class="sub">${routineExercises(r).length} ejercicios${r.days && r.days.length ? " · " + r.days.join(", ") : ""}</div></div>
      ${cur && cur.id === r.id ? `<span class="streak hot">${icon("check")}</span>` : ""}</div>`).join("")}
    <button class="btn g" onclick="closeModal()">Cerrar</button>`);
}
function setTodayRoutine(id) { store.set("mt_todayRoutine", JSON.stringify({ date: today(), routineId: id })); closeModal(); render(); }
function openRoutines() { VIEW = "workouts"; buildNav(); render(); closeModal(); }

/* ---------- Editor de rutina ---------- */
let _RT = null, _xType = "reps", _xBw = false;
function openRoutineEditor(id) {
  const r = id ? CFG.routines.find(x => x.id === id) : null;
  _RT = r ? clone(r) : { id: null, name: "", days: [], blocks: [] };
  /* Una rutina vieja clonada todavía puede venir plana. */
  if (!Array.isArray(_RT.blocks) || !_RT.blocks.length) {
    _RT.blocks = [{ id: uid("bk"), name: "Principal", kind: "principal", exercises: (_RT.exercises || []) }];
  }
  delete _RT.exercises;
  renderRoutineEditor();
}
function rtBlock(bi) { return _RT.blocks[bi]; }
function renderRoutineEditor() {
  const bloques = _RT.blocks.map((b, bi) => {
    const col = BLOCK_COLOR[blockKind(b.kind)];
    const rows = (b.exercises || []).length
      ? b.exercises.map((e, i) => `<div class="row" onclick="openExercise(${bi},${i})">
          <span class="idi" style="background:${col}22;color:${col}">${i + 1}</span>
          <div class="body"><div class="name">${esc(e.name || "Ejercicio")}</div>
            <div class="sub">${exTargetText(e)} · descanso ${e.rest}s</div></div>
          <button class="note-btn" aria-label="Mover" onclick="event.stopPropagation();openMoveExercise(${bi},${i})">${icon("chevright")}</button>
          <button class="note-btn" onclick="event.stopPropagation();delExercise(${bi},${i})">${icon("trash")}</button></div>`).join("")
      : `<div class="empty">Bloque vacío</div>`;
    return `<div class="blk">
      <div class="blk-h"><span class="blk-dot" style="background:${col}"></span>
        <div class="blk-t"><b>${esc(b.name)}</b><span>${esc(BLOCK_LABEL[blockKind(b.kind)])}</span></div>
        <button class="note-btn" aria-label="Subir bloque" onclick="moveBlock(${bi},-1)" ${bi === 0 ? "disabled" : ""}>${icon("upload")}</button>
        <button class="note-btn" aria-label="Bajar bloque" onclick="moveBlock(${bi},1)" ${bi === _RT.blocks.length - 1 ? "disabled" : ""}>${icon("download")}</button>
        <button class="note-btn" onclick="openBlockEdit(${bi})">${icon("edit")}</button></div>
      ${rows}
      <button class="addbtn" onclick="openExercise(${bi},-1)">${icon("plus")} Agregar ejercicio</button></div>`;
  }).join("");
  sheet(`<h3>${_RT.id ? "Editar rutina" : "Nueva rutina"}</h3>
    <div class="mm">Una sesión tiene partes: calentamiento, lo principal, extras (abdomen, cuello) y enfriamiento.</div>
    <div class="lbl">Nombre</div><input id="rName" class="field" value="${esc(_RT.name)}" placeholder="Push A" oninput="_RT.name=this.value">
    <div class="lbl">Días asignados (opcional)</div>
    <div class="chips" id="rDays">${WEEKDAYS.map(d => `<div class="chip ${_RT.days.includes(d) ? "on" : ""}" style="${_RT.days.includes(d) ? "background:var(--cuerpo);border-color:var(--cuerpo);color:#fff" : ""}" onclick="toggleDay('${d}')">${d.slice(0, 3)}</div>`).join("")}</div>
    <div class="lbl">Bloques</div>${bloques || `<div class="empty">Sin bloques aún</div>`}
    <button class="addbtn" onclick="openBlockEdit(-1)">${icon("plus")} Agregar bloque</button>
    <button class="btn p" onclick="saveRoutine()">Guardar rutina</button>
    ${_RT.id ? `<button class="btn g" onclick="exportRoutine('${_RT.id}')">${icon("download")} Exportar JSON</button><button class="btn g" onclick="delRoutine('${_RT.id}')" style="color:var(--bad)">Borrar rutina</button>` : ""}
    <button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
function toggleDay(d) { const i = _RT.days.indexOf(d); if (i >= 0) _RT.days.splice(i, 1); else _RT.days.push(d); renderRoutineEditor(); }
function delExercise(bi, i) { _RT.blocks[bi].exercises.splice(i, 1); renderRoutineEditor(); }
function moveBlock(bi, d) {
  const j = bi + d; if (j < 0 || j >= _RT.blocks.length) return;
  const b = _RT.blocks.splice(bi, 1)[0]; _RT.blocks.splice(j, 0, b);
  renderRoutineEditor();
}
/* ---------- Bloques ---------- */
let _bkKind = "principal";
function pickBkKind(k) { _bkKind = k; document.querySelectorAll("#bkKind button").forEach(b => b.classList.toggle("on", b.dataset.k === k)); }
function openBlockEdit(bi) {
  const isNew = bi < 0, b = isNew ? { name: "", kind: "extra" } : _RT.blocks[bi];
  _bkKind = blockKind(b.kind);
  sheet(`<h3>${isNew ? "Nuevo bloque" : "Editar bloque"}</h3>
    <div class="mm">El nombre es lo que lees; el tipo manda el color y el comportamiento. "Abdomen" y "Cuello" pueden ser dos extras distintos.</div>
    <div class="lbl">Nombre</div><input id="bkName" class="field" value="${esc(b.name)}" placeholder="Abdomen">
    <div class="lbl">Tipo</div><div class="seg small" id="bkKind">${BLOCK_KINDS.map(k => `<button data-k="${k}" class="${k === _bkKind ? "on" : ""}" onclick="pickBkKind('${k}')">${esc(BLOCK_LABEL[k])}</button>`).join("")}</div>
    <button class="btn p" onclick="saveBlock(${bi})">${isNew ? "Crear bloque" : "Guardar"}</button>
    ${!isNew ? `<button class="btn g" style="color:var(--bad)" onclick="delBlock(${bi})">Borrar bloque</button>` : ""}
    <button class="btn g" onclick="renderRoutineEditor()">Cancelar</button>`);
}
function saveBlock(bi) {
  const nm = (document.getElementById("bkName").value || "").trim() || BLOCK_LABEL[_bkKind];
  if (bi < 0) _RT.blocks.push({ id: uid("bk"), name: nm, kind: _bkKind, exercises: [] });
  else { _RT.blocks[bi].name = nm; _RT.blocks[bi].kind = _bkKind; }
  renderRoutineEditor();
}
/* Borrar un bloque con ejercicios dentro se llevaba el trabajo por delante
   sin vuelta atrás. Ahora la salida segura —mudarlos a otro bloque— es la
   opción principal, y destruirlos queda como la secundaria. */
function delBlock(bi) {
  const b = _RT.blocks[bi]; if (!b) return;
  const n = (b.exercises || []).length;
  if (!n) { _RT.blocks.splice(bi, 1); return renderRoutineEditor(); }
  const otros = _RT.blocks.map((x, j) => ({ x: x, j: j })).filter(o => o.j !== bi);
  sheet(`<h3>¿Borrar "${esc(b.name)}"?</h3>
    <div class="mm">Tiene ${n} ${n === 1 ? "ejercicio" : "ejercicios"}. Puedes mudarlos a otro bloque en vez de perderlos.</div>
    ${otros.length ? `<div class="lbl">Mover ${n === 1 ? "el ejercicio" : "los " + n + " ejercicios"} a</div>`
      + otros.map(o => `<div class="row" onclick="moveBlockExercises(${bi},${o.j})">
          <span class="dotc" style="background:${BLOCK_COLOR[blockKind(o.x.kind)]}"></span>
          <div class="body"><div class="name">${esc(o.x.name)}</div><div class="sub">${esc(BLOCK_LABEL[blockKind(o.x.kind)])} · ${(o.x.exercises || []).length} ${(o.x.exercises || []).length === 1 ? "ejercicio" : "ejercicios"}</div></div>
          <span class="chev">${icon("chevright")}</span></div>`).join("")
      : `<div class="empty" style="text-align:left;padding:2px 2px 8px">No hay otro bloque a dónde mudarlos.</div>`}
    <button class="btn g" style="color:var(--bad)" onclick="doDelBlock(${bi})">Borrar el bloque y ${n === 1 ? "su ejercicio" : "sus " + n + " ejercicios"}</button>
    <button class="btn g" onclick="renderRoutineEditor()">Cancelar</button>`);
}
/* Muda los ejercicios al bloque destino y luego sí borra el vacío. */
function moveBlockExercises(bi, bj) {
  const from = _RT.blocks[bi], to = _RT.blocks[bj];
  if (!from || !to) return renderRoutineEditor();
  (from.exercises || []).forEach(e => to.exercises.push(e));
  from.exercises = [];
  _RT.blocks.splice(bi, 1);
  renderRoutineEditor();
}
function doDelBlock(bi) { _RT.blocks.splice(bi, 1); renderRoutineEditor(); }
/* Mover un ejercicio a otro bloque. */
function openMoveExercise(bi, i) {
  const e = _RT.blocks[bi].exercises[i]; if (!e) return;
  sheet(`<h3>Mover "${esc(e.name)}"</h3><div class="mm">¿A qué bloque?</div>
    ${_RT.blocks.map((b, j) => j === bi ? "" : `<div class="row" onclick="moveExerciseTo(${bi},${i},${j})">
      <span class="dotc" style="background:${BLOCK_COLOR[blockKind(b.kind)]}"></span>
      <div class="body"><div class="name">${esc(b.name)}</div><div class="sub">${esc(BLOCK_LABEL[blockKind(b.kind)])} · ${(b.exercises || []).length} ejercicios</div></div>
      <span class="chev">${icon("chevron")}</span></div>`).join("")}
    <div class="lbl">Dentro del bloque</div>
    <div class="gymlinks"><button onclick="moveExerciseWithin(${bi},${i},-1)">${icon("upload")} Subir</button><button onclick="moveExerciseWithin(${bi},${i},1)">${icon("download")} Bajar</button></div>
    <button class="btn g" onclick="renderRoutineEditor()">Cancelar</button>`);
}
function moveExerciseTo(bi, i, bj) {
  const e = _RT.blocks[bi].exercises.splice(i, 1)[0];
  _RT.blocks[bj].exercises.push(e);
  renderRoutineEditor();
}
function moveExerciseWithin(bi, i, d) {
  const xs = _RT.blocks[bi].exercises, j = i + d;
  if (j < 0 || j >= xs.length) return renderRoutineEditor();
  const e = xs.splice(i, 1)[0]; xs.splice(j, 0, e);
  renderRoutineEditor();
}
/* ---------- Ejercicio ---------- */
function pickXType(t) {
  _xType = t;
  document.querySelectorAll("#xType button").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  const rep = document.getElementById("xRepsWrap"), tim = document.getElementById("xSecsWrap");
  if (rep) rep.style.display = t === "tiempo" ? "none" : "";
  if (tim) tim.style.display = t === "tiempo" ? "" : "none";
}
function toggleXBw(el) {
  _xBw = !_xBw;
  el.classList.toggle("on", _xBw);
  el.style.background = _xBw ? "var(--ok)" : ""; el.style.borderColor = _xBw ? "var(--ok)" : ""; el.style.color = _xBw ? "#0E0F13" : "";
  const w = document.getElementById("xWeightWrap"); if (w) w.style.display = _xBw ? "none" : "";
}
function openExercise(bi, i) {
  const isNew = i < 0;
  const e = isNew ? { name: "", sets: 3, reps: "10", rest: 90, weight: "", note: "", type: "reps", seconds: 30, bodyweight: false }
                  : _RT.blocks[bi].exercises[i];
  _xType = exType(e); _xBw = exIsBw(e);
  sheet(`<h3>${isNew ? "Nuevo ejercicio" : "Editar ejercicio"}</h3>
    <div class="mm">En ${esc(_RT.blocks[bi].name)}</div>
    <div class="lbl">Nombre</div><input id="xName" class="field" value="${esc(e.name)}" placeholder="Press banca">
    <div class="lbl">¿Cómo se mide?</div><div class="seg small" id="xType">
      <button data-t="reps" class="${_xType === "reps" ? "on" : ""}" onclick="pickXType('reps')">Repeticiones</button>
      <button data-t="tiempo" class="${_xType === "tiempo" ? "on" : ""}" onclick="pickXType('tiempo')">Tiempo</button></div>
    <div class="chips" style="padding:0"><div class="chip ${_xBw ? "on" : ""}" style="${_xBw ? "background:var(--ok);border-color:var(--ok);color:#0E0F13" : ""}" onclick="toggleXBw(this)">${icon("check")} Peso corporal</div></div>
    <div class="row2"><div><div class="lbl">Series</div><input id="xSets" class="field" type="number" min="1" value="${e.sets}"></div>
      <div id="xRepsWrap" style="${_xType === "tiempo" ? "display:none" : ""}"><div class="lbl">Reps</div><input id="xReps" class="field" value="${esc(e.reps)}" placeholder="8-10"></div>
      <div id="xSecsWrap" style="${_xType === "tiempo" ? "" : "display:none"}"><div class="lbl">Segundos</div><input id="xSecs" class="field" type="number" min="1" value="${exSeconds(e)}"></div></div>
    <div class="row2"><div><div class="lbl">Descanso (seg)</div><input id="xRest" class="field" type="number" min="0" value="${e.rest}"></div>
      <div id="xWeightWrap" style="${_xBw ? "display:none" : ""}"><div class="lbl">Peso (opcional)</div><input id="xWeight" class="field" value="${esc(e.weight)}" placeholder="60 kg"></div></div>
    <div class="lbl">Nota (opcional)</div><input id="xNote" class="field" value="${esc(e.note)}" placeholder="tempo, técnica...">
    ${formSlot("xMsg")}
    <button class="btn p" onclick="saveExercise(${bi},${i})">Guardar ejercicio</button><button class="btn g" onclick="renderRoutineEditor()">Cancelar</button>`);
}
function saveExercise(bi, i) {
  /* Todo nombre pasa por el catálogo: si ya existe (o es un alias), se reusa
     su id en vez de crear un ejercicio nuevo. El tipo y el peso corporal son
     de ESTA definición, no del catálogo: el catálogo no se fragmenta. */
  const nombre = (document.getElementById("xName").value || "").trim();
  if (!nombre) return formError("xMsg", "Ponle nombre al ejercicio.");
  const cat = findOrCreateExercise(nombre);
  const xs = _RT.blocks[bi].exercises;
  const secsEl = document.getElementById("xSecs");
  const ex = {
    id: i < 0 ? uid("e") : (xs[i].id || uid("e")),
    exId: cat.id,
    name: cat.name,
    type: _xType === "tiempo" ? "tiempo" : "reps",
    bodyweight: !!_xBw,
    sets: Math.max(1, parseInt(document.getElementById("xSets").value) || 1),
    reps: _xType === "tiempo" ? "-" : ((document.getElementById("xReps") || {}).value || "").trim() || "-",
    seconds: Math.max(1, parseInt(secsEl ? secsEl.value : 30, 10) || 30),
    rest: Math.max(0, parseInt(document.getElementById("xRest").value) || 0),
    weight: _xBw ? "" : ((document.getElementById("xWeight") || {}).value || "").trim(),
    note: document.getElementById("xNote").value.trim()
  };
  if (i < 0) xs.push(ex); else xs[i] = ex;
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
  sheet(`<h3>Importar rutina (JSON)</h3><div class="mm">Pega el JSON de tu rutina. Acepta el formato nuevo (con bloques) y el viejo (lista plana), una rutina, varias, o {"routines":[...]}. Revisa RUTINAS-como-importar-json.md.</div>
    <textarea id="jsonIn" placeholder='{"name":"Push A","days":["lunes"],"blocks":[{"name":"Principal","kind":"principal","exercises":[{"name":"Press banca","sets":4,"reps":"8-10","rest":120}]}]}' style="min-height:160px;font-family:monospace;font-size:12px"></textarea>
    <div id="jsonMsg" style="font-size:13px;margin-top:8px"></div>
    <button class="btn p" onclick="importJSON()">Importar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
}
/* Un ejercicio importado. Cada nombre se resuelve contra el catálogo (nombre
   canónico y alias, sin acentos ni mayúsculas ni espacios de más): reimportar
   la misma rutina con otra grafía reusa el id y el historial no se parte. */
function normalizeExercise(e) {
  const cat = findOrCreateExercise((e.name || "Ejercicio").toString());
  const tipo = (e.type === "tiempo") ? "tiempo" : "reps";
  const secs = Math.max(1, parseInt(e.seconds, 10) || 30);
  const bw = !!e.bodyweight;
  return {
    id: uid("e"), exId: cat.id, name: cat.name,
    type: tipo, bodyweight: bw, seconds: secs,
    sets: Math.max(1, parseInt(e.sets) || 1),
    reps: tipo === "tiempo" ? "-" : (e.reps != null ? e.reps : "-").toString(),
    rest: Math.max(0, parseInt(e.rest) || 0),
    weight: bw ? "" : (e.weight || "").toString(),
    note: (e.note || "").toString()
  };
}
/* Acepta LOS DOS formatos: el nuevo con `blocks[]` y el viejo plano con
   `exercises[]`. Una rutina plana entra como un único bloque `principal`,
   así que nada de lo que ya existe se rompe al importarlo. */
function normalizeRoutine(o) {
  if (!o) return null;
  const tieneBloques = Array.isArray(o.blocks) && o.blocks.length;
  const tienePlano = Array.isArray(o.exercises);
  if (!tieneBloques && !tienePlano) return null;
  const base = {
    id: uid("rt"), name: (o.name || "Rutina importada").toString(),
    days: Array.isArray(o.days) ? o.days.filter(d => WEEKDAYS.includes(d)) : []
  };
  if (tieneBloques) {
    base.blocks = o.blocks.filter(b => b && Array.isArray(b.exercises)).map(b => ({
      id: uid("bk"),
      name: (b.name || BLOCK_LABEL[blockKind(b.kind)]).toString(),
      kind: blockKind(b.kind),
      exercises: b.exercises.map(normalizeExercise)
    }));
    if (!base.blocks.length) return null;
  } else {
    base.blocks = [{ id: uid("bk"), name: "Principal", kind: "principal", exercises: o.exercises.map(normalizeExercise) }];
  }
  return base;
}
function importJSON() {
  const msg = document.getElementById("jsonMsg");
  let data; try { data = JSON.parse(document.getElementById("jsonIn").value); } catch (e) { msg.innerHTML = `<span style="color:var(--bad)">JSON inválido: ${esc(e.message)}</span>`; return; }
  let arr = Array.isArray(data) ? data : (data && Array.isArray(data.routines) ? data.routines : [data]);
  const norm = arr.map(normalizeRoutine).filter(Boolean);
  if (!norm.length) { msg.innerHTML = `<span style="color:var(--bad)">No encontré rutinas válidas. Cada rutina necesita "blocks" (formato nuevo) o "exercises" (formato viejo).</span>`; return; }
  norm.forEach(r => CFG.routines.push(r)); saveCfg(); closeModal(); render();
}
function exportRoutine(id) {
  const r = CFG.routines.find(x => x.id === id); if (!r) return;
  /* Se exporta el formato NUEVO. Los campos que están en su valor por
     defecto no se escriben, para que el JSON siga siendo legible. */
  const limpiaEx = e => {
    const o = { name: e.name, sets: e.sets, rest: e.rest };
    if (exIsTime(e)) { o.type = "tiempo"; o.seconds = exSeconds(e); }
    else o.reps = e.reps;
    if (exIsBw(e)) o.bodyweight = true;
    if (!exIsBw(e) && e.weight) o.weight = e.weight;
    if (e.note) o.note = e.note;
    return o;
  };
  const clean = {
    name: r.name, days: r.days,
    blocks: routineBlocks(r).map(b => ({ name: b.name, kind: blockKind(b.kind), exercises: (b.exercises || []).map(limpiaEx) }))
  };
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
  /* El plan se guarda con la sesión: si editas la rutina a media sesión, el
     entreno en curso NO se mueve bajo tus pies. Se reconstruye solo si el
     guardado viene de una versión anterior. */
  store.set("mt_activeWorkout", JSON.stringify({ rid: PLAYER.r.id, plan: PLAYER.plan || [], ei: PLAYER.ei, si: PLAYER.si, phase: PLAYER.phase, log: PLAYER.log, elapsedBase: elapsed(), restEnd: PLAYER.restEnd || null, workEnd: PLAYER.workEnd || null, hechos: PLAYER.hechos == null ? null : PLAYER.hechos, lastIdx: PLAYER.lastIdx == null ? null : PLAYER.lastIdx, prs: PLAYER.prs || [], restNotified: !!PLAYER.restNotified }));
}
function clearActive() { store.set("mt_activeWorkout", ""); }

function startWorkout(rid) {
  const act = getActiveWorkout();
  if (act) { openResumeChoice(rid); return; }
  beginWorkout(rid);
}
/* ---------- El plan de la sesión ----------
   Los pasos van aplanados (P.ei sigue indexando aquí, como siempre) pero
   cada uno sabe a qué bloque pertenece. Es derivado: se reconstruye al
   arrancar y al reanudar, así que no hace falta persistirlo. */
function buildPlan(r) {
  const plan = [];
  routineBlocks(r).forEach((b, bi) => (b.exercises || []).forEach((ex, xi) => {
    plan.push({ bi: bi, bname: b.name, bkind: blockKind(b.kind), n: xi + 1, of: (b.exercises || []).length, ex: ex });
  }));
  return plan;
}
function planStep(P, i) { return P.plan[i == null ? P.ei : i] || null; }
function curEx(P) { const s = planStep(P); return s ? s.ex : null; }

function beginWorkout(rid) {
  const r = CFG.routines.find(x => x.id === rid);
  if (!r || !routineExercises(r).length) { openRoutineEditor(rid); return; }
  PLAYER = { r, plan: buildPlan(r), ei: 0, si: 1, phase: "set", remaining: 0, timer: null, start: Date.now(), elapsedBase: 0, wake: null, log: [], prs: [], pr: null };
  requestWake(); renderPlayer();
}
function resumeWorkout() {
  const a = getActiveWorkout(); if (!a) return render();
  const r = CFG.routines.find(x => x.id === a.rid); if (!r) { clearActive(); return render(); }
  const plan = (Array.isArray(a.plan) && a.plan.length) ? a.plan : buildPlan(r);
  PLAYER = { r, plan: plan, ei: a.ei, si: a.si, phase: a.phase, timer: null, start: Date.now(), elapsedBase: a.elapsedBase || 0, wake: null, log: a.log || [], restEnd: a.restEnd || null, workEnd: a.workEnd || null, hechos: a.hechos == null ? null : a.hechos, lastIdx: a.lastIdx == null ? (a.log ? a.log.length - 1 : null) : a.lastIdx, prs: a.prs || [], pr: null, restNotified: !!a.restNotified };
  if (PLAYER.ei >= PLAYER.plan.length) PLAYER.ei = Math.max(0, PLAYER.plan.length - 1);   // la rutina pudo cambiar
  // Si estaba descansando: continúa el conteo real; si ya venció mientras no estabas, suena la alarma.
  if (PLAYER.phase === "rest" || PLAYER.phase === "alarm") {
    if (PLAYER.restEnd && restLeft() > 0) { PLAYER.phase = "rest"; PLAYER.timer = setInterval(tick, 500); }
    else { PLAYER.phase = "alarm"; startAlarm(); }
  } else if (PLAYER.phase === "work" || PLAYER.phase === "workalarm") {
    if (PLAYER.workEnd && workLeft() > 0) { PLAYER.phase = "work"; PLAYER.timer = setInterval(tick, 500); }
    else { PLAYER.phase = "workalarm"; startAlarm(); }
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
  WORKOUTS.push({ id: uid("w"), date: today(), activityId: "gym", type: "strength", routineId: a.rid, name: r ? r.name : "Entreno", duration: a.elapsedBase || 0, volume: vol, unit: weightUnit(), sets: log.map(s => { const o = { exName: s.exName, exId: s.exId || null, reps: s.reps, weight: s.weight }; if (s.secs) o.secs = s.secs; return o; }) });
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
/* Mejor marca de ESTE ejercicio en la sesión en curso, según su medida. */
function sessionBestBy(id, kind) {
  let b = null;
  PLAYER.log.forEach(s => {
    if (s.exId !== id) return;
    const v = kind === "tiempo" ? parseInt(s.secs, 10) : kind === "reps" ? parseInt(s.reps, 10) : parseFloat(s.weight);
    if (isNaN(v)) return;
    if (b === null || v > b) b = v;
  });
  return b;
}
/* Registra la serie según cómo se mide el ejercicio:
   - tiempo -> segundos aguantados (el record es el aguante más largo)
   - peso corporal -> reps, sin peso (el record son las reps más altas)
   - normal -> peso × reps (el record es el peso más alto) */
function logCurrentSet(overrideSecs) {
  const P = PLAYER, ex = curEx(P);
  const id = curExId(ex);
  const isTime = exIsTime(ex), bw = exIsBw(ex);
  const w = document.getElementById("plW"), r = document.getElementById("plR");
  const weight = (isTime || bw) ? "" : (w ? w.value.trim() : "");
  const reps = isTime ? "" : (r ? r.value.trim() : "");
  const secs = isTime ? (overrideSecs != null ? overrideSecs : exSeconds(ex)) : null;

  /* ¿Récord? Se compara ANTES de anotar, contra el historial guardado y
     contra lo ya hecho en esta misma sesión, para no celebrar dos veces. */
  const kind = isTime ? "tiempo" : (bw ? "reps" : "peso");
  const val = isTime ? secs : (bw ? parseInt(reps, 10) : parseFloat(weight));
  /* En calentamiento y enfriamiento NO se celebran records: aguantar 20s de
     movilidad no es una marca, y el aviso solo hace ruido. */
  const paso = planStep(P);
  const celebra = !paso || (paso.bkind !== "calentamiento" && paso.bkind !== "enfriamiento");
  const stored = exPRInfo(id);
  const storedVal = (stored && stored.kind === kind) ? Number(stored.value) : -Infinity;
  const sb = sessionBestBy(id, kind);
  const prev = Math.max(storedVal, sb === null ? -Infinity : sb);
  P.pr = null;
  if (celebra && !isNaN(val) && val > 0 && val > prev) {
    P.pr = {
      name: exName(id, ex.name), kind: kind,
      label: isTime ? fmtSecs(val) : (bw ? val + " reps" : weight + " " + weightUnit() + (reps ? " × " + reps : "")),
      previo: isFinite(prev) ? (isTime ? fmtSecs(prev) : (bw ? prev + " reps" : prev + " " + weightUnit())) : null
    };
    P.prs = (P.prs || []).concat([P.pr]);
  }
  const row = { exName: ex.name, exId: id, set: P.si, weight: weight, reps: reps, unit: weightUnit() };
  if (isTime) row.secs = secs;
  P.log.push(row);
  P.lastIdx = P.log.length - 1;
}
/* Banner de récord: claro pero sin bloquear nada. */
function prBanner(P) {
  if (!P.pr) return "";
  return `<div class="pl-pr">${icon("trophy")}<div><b>¡Nuevo record!</b>
    <span>${esc(P.pr.name)} · ${esc(P.pr.label)}${P.pr.previo ? " · antes " + esc(P.pr.previo) : ""}</span></div></div>`;
}
/* Editar la serie recién registrada mientras corre el descanso */
function editLoggedSet(which, val) {
  const P = PLAYER; if (!P || P.lastIdx == null || !P.log[P.lastIdx]) return;
  P.log[P.lastIdx][which] = val.trim(); savePlayerState();
}
function renderPlayer() {
  const P = PLAYER, r = P.r;
  const step = planStep(P), ex = step ? step.ex : null, nx = planStep(P, P.ei + 1);
  const next = nx ? nx.ex : null;
  const col = step ? BLOCK_COLOR[step.bkind] : "var(--cuerpo)";
  /* Se lee "en qué parte de la sesión voy", no "ejercicio 3 de 14". */
  const topbar = `<div class="pl-top"><button class="pl-x" onclick="closePlayer()">${icon("close")}</button>
    <div class="pl-prog"><span class="pl-blk" style="background:${col}22;color:${col}">${esc(step ? step.bname : r.name)}</span>
      <span class="pl-blkn">${step ? step.n + "/" + step.of : ""}</span></div>
    <div class="pl-elapsed">${fmtTime(elapsed())}</div></div>`;
  let body = "";
  const U = weightUnit();
  if (P.phase === "set") {
    const last = P.si >= ex.sets, pf = prefillFor(ex), lp = lastPerf(curExId(ex));
    const isTime = exIsTime(ex), bw = exIsBw(ex);
    const objetivo = isTime ? `objetivo: ${fmtSecs(exSeconds(ex))}` : `objetivo: ${esc(ex.reps)} reps${bw ? " · peso corporal" : (ex.weight ? " · " + esc(ex.weight) : "")}`;
    const campos = isTime ? "" : `<div class="pl-log${bw ? " one" : ""}">${bw ? "" : `<div><label>Peso (${U})</label><input id="plW" inputmode="decimal" value="${esc(pf.weight)}" placeholder="—"></div>`}
        <div><label>Reps</label><input id="plR" inputmode="numeric" value="${esc(pf.reps)}" placeholder="${esc(ex.reps)}"></div></div>`;
    const ultima = lp ? `<div class="pl-last">Última vez: ${lp.secs ? fmtSecs(lp.secs) : `${esc(lp.weight) || "—"}${bw ? "" : " " + U} × ${esc(lp.reps) || "—"}`}</div>` : "";
    body = `<div class="pl-mid">
      <div class="pl-ex">${esc(exName(curExId(ex), ex.name))}</div>
      <div class="pl-set">Serie ${P.si} de ${ex.sets}</div>
      <div class="pl-reps">${objetivo}</div>
      ${ex.note ? `<div class="pl-note">${esc(ex.note)}</div>` : ""}
      ${campos}${ultima}
    </div>
    <div class="pl-actions">
      ${isTime
        ? `<button class="pl-primary" onclick="startWork()">${icon("play")} Empezar ${fmtSecs(exSeconds(ex))}</button>
           <div class="pl-sub">El tiempo corre aunque bloquees la pantalla</div>`
        : (last ? `<button class="pl-primary" onclick="afterLastSet()">Terminar ejercicio</button>`
                : `<button class="pl-primary" onclick="startRest()">${icon("play")} Registrar y descansar ${ex.rest}s</button>`)
        + `<div class="pl-sub">Anota lo que hiciste y presiona el botón</div>`}
    </div>`;
  } else if (P.phase === "work") {
    body = `<div class="pl-mid"><div class="pl-restlbl" style="color:${col}">En marcha</div>
      <div class="pl-timer" id="ptime">${fmtTime(workLeft())}</div>
      <div class="pl-next big">${esc(exName(curExId(ex), ex.name))}</div>
      <div class="pl-next">Serie ${P.si} de ${ex.sets}</div>
      ${ex.note ? `<div class="pl-note">${esc(ex.note)}</div>` : ""}</div>
    <div class="pl-actions"><div class="pl-restctl"><button onclick="stopWorkEarly()">${icon("pause")} Terminar ya</button></div></div>`;
  } else if (P.phase === "workalarm") {
    /* Si se cortó antes, se enseña lo que se va a registrar de verdad. */
    const corto = (P.hechos != null && P.hechos > 0 && P.hechos < exSeconds(ex));
    body = `<div class="pl-mid"><div class="pl-restlbl">${corto ? "Serie cortada" : "Tiempo terminado"}</div>
      <div class="pl-timer${corto ? "" : " alarm"}">${corto ? fmtSecs(P.hechos) : "0:00"}</div>
      <div class="pl-next big">${esc(exName(curExId(ex), ex.name))}</div>
      <div class="pl-next">Serie ${P.si} de ${ex.sets}${corto ? " · de " + fmtSecs(exSeconds(ex)) : ""}</div></div>
    <div class="pl-actions"><button class="pl-primary${corto ? "" : " alarmbtn"}" onclick="finishWorkSet()">Registrar ${corto ? fmtSecs(P.hechos) : "serie"}</button></div>`;
  } else if (P.phase === "rest") {
    const s = P.log[P.lastIdx] || { weight: "", reps: "" };
    const bw = exIsBw(ex), isTime = exIsTime(ex);
    body = `<div class="pl-mid">${prBanner(P)}<div class="pl-restlbl">Descanso</div><div class="pl-timer" id="ptime">${fmtTime(restLeft())}</div>
      <div class="pl-next">Sigue: Serie ${P.si} de ${ex.sets} · ${esc(ex.name)}</div>
      ${isTime ? `<div class="pl-logrest"><div class="pl-logtitle">Serie anterior · ${fmtSecs(s.secs || 0)}</div></div>`
        : `<div class="pl-logrest"><div class="pl-logtitle">Serie anterior · puedes ajustarla</div>
        <div class="pl-log${bw ? " one" : ""}">${bw ? "" : `<div><label>Peso (${U})</label><input inputmode="decimal" value="${esc(s.weight)}" placeholder="—" onchange="editLoggedSet('weight',this.value)"></div>`}
          <div><label>Reps</label><input inputmode="numeric" value="${esc(s.reps)}" placeholder="—" onchange="editLoggedSet('reps',this.value)"></div></div></div>`}
    </div>
    <div class="pl-actions"><div class="pl-restctl"><button onclick="addRest(-15)">-15s</button><button onclick="addRest(15)">+15s</button><button onclick="skipRest()">${icon("skipfwd")} Saltar</button></div></div>`;
  } else if (P.phase === "alarm") {
    body = `<div class="pl-mid"><div class="pl-restlbl">Descanso terminado</div>
      <div class="pl-timer alarm">0:00</div>
      <div class="pl-next big">Serie ${P.si} de ${ex.sets}</div><div class="pl-next">${esc(ex.name)}</div></div>
    <div class="pl-actions"><button class="pl-primary alarmbtn" onclick="dismissAlarm()">Detener alarma</button></div>`;
  } else if (P.phase === "blockdone") {
    /* Cerrar un bloque es un momento distinto a cerrar un ejercicio. */
    const ncol = BLOCK_COLOR[nx.bkind];
    body = `<div class="pl-mid">${prBanner(P)}
      <div class="pl-blkdone" style="border-color:${col}66;background:${col}14">
        <div class="pl-done" style="background:${col}22;color:${col}">${icon("check")}</div>
        <div class="pl-blkname" style="color:${col}">${esc(step.bname)}</div>
        <div class="pl-sub">bloque terminado</div></div>
      <div class="pl-next big" style="margin-top:18px">Sigue: <span style="color:${ncol}">${esc(nx.bname)}</span></div>
      <div class="pl-summary">${esc(exName(nx.ex.exId, nx.ex.name))} · ${exTargetText(nx.ex)}</div>
      <div class="pl-summary">${nx.of} ${nx.of === 1 ? "ejercicio" : "ejercicios"} en este bloque</div></div>
    <div class="pl-actions"><button class="pl-primary" style="background:${ncol}" onclick="continueNext()">Empezar ${esc(nx.bname)}</button></div>`;
  } else if (P.phase === "transition") {
    body = `<div class="pl-mid">${prBanner(P)}<div class="pl-done">${icon("check")}</div><div class="pl-ex">Terminaste ${esc(ex.name)}</div>
      <div class="pl-next big">Sigue: ${esc(next.name)}</div><div class="pl-summary">${exTargetText(next)} · descanso ${next.rest}s</div></div>
    <div class="pl-actions"><button class="pl-primary" onclick="continueNext()">Continuar</button></div>`;
  } else {
    const total = P.log.length, vol = P.log.reduce((a, s) => { const w = parseFloat(s.weight), rp = parseInt(s.reps); return a + (isNaN(w) || isNaN(rp) ? 0 : w * rp); }, 0);
    /* Si subiste tres veces el mismo ejercicio, es UN record (el ultimo), no
       tres: se deja solo la mejor marca de cada uno. */
    const porEj = {};
    (P.prs || []).forEach(x => { porEj[x.name] = x; });
    const prs = Object.keys(porEj).map(k => porEj[k]);
    const nprs = prs.length;
    const nb = routineBlocks(r).length;
    body = `<div class="pl-mid"><div class="pl-done big">${icon("check")}</div><div class="pl-ex">¡Rutina terminada!</div>
      <div class="pl-summary">${P.plan.length} ejercicios en ${nb} ${nb === 1 ? "bloque" : "bloques"} · ${total} series${vol ? " · " + Math.round(vol) + " " + U + " de volumen" : ""} · ${fmtTime(elapsed())}</div>
      ${nprs ? `<div class="pl-pr">${icon("trophy")}<div><b>${nprs === 1 ? "1 nuevo record" : nprs + " nuevos records"}</b>
        <span>${prs.map(x => esc(x.name) + " " + esc(x.label)).join(" · ")}</span></div></div>` : ""}
      <div class="pl-note">Un voto más por el cuerpo que quieres.</div></div>
    <div class="pl-actions"><button class="pl-primary" onclick="finishWorkout()">Guardar entreno</button></div>`;
  }
  modal.innerHTML = `<div class="player${(P.phase === "alarm" || P.phase === "workalarm") ? " alarming" : ""}">${topbar}${body}</div>`;
  savePlayerState();
}
/* ---------- Temporizador basado en reloj real (sobrevive bloqueo/segundo plano) ---------- */
function restLeft() { const P = PLAYER; if (!P || !P.restEnd) return 0; return Math.max(0, Math.round((P.restEnd - Date.now()) / 1000)); }
function startRest() {
  const P = PLAYER, ex = curEx(P);
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
function notifyRestDone(kind) {
  const P = PLAYER;
  if (!P || P.restNotified) return;
  P.restNotified = true;            // se marca siempre: nunca dos avisos del mismo temporizador
  savePlayerState();
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistration) return;
    const ex = curEx(P);
    const titulo = kind === "work" ? "Tiempo terminado" : "Descanso terminado";
    const cuerpo = "Serie " + P.si + " de " + ex.sets + " · " + exName(curExId(ex), ex.name);
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg || !reg.showNotification) return;
      reg.showNotification(titulo, {
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
function workLeft() { const P = PLAYER; if (!P || !P.workEnd) return 0; return Math.max(0, Math.round((P.workEnd - Date.now()) / 1000)); }
function workExpired() {
  const P = PLAYER; if (!P) return;
  clearInterval(P.timer); P.timer = null;
  P.phase = "workalarm"; startAlarm(); renderPlayer();
}
/* Un solo tick para los dos temporizadores: el de trabajo y el de descanso
   usan exactamente la misma maquinaria por marca de tiempo. */
function tick() {
  const P = PLAYER; if (!P) return;
  if (P.phase === "rest") {
    const left = restLeft();
    const el = document.getElementById("ptime"); if (el) el.textContent = fmtTime(left);
    if (left <= 0) { notifyRestDone("rest"); restExpired(); }
    return;
  }
  if (P.phase === "work") {
    const left = workLeft();
    const el = document.getElementById("ptime"); if (el) el.textContent = fmtTime(left);
    if (left <= 0) { notifyRestDone("work"); workExpired(); }
  }
}
/* Empieza el intervalo de trabajo de un ejercicio por tiempo. */
function startWork() {
  const P = PLAYER, ex = curEx(P);
  primeAudio();                       // el tap del usuario habilita el sonido
  P.phase = "work"; P.workEnd = Date.now() + exSeconds(ex) * 1000; P.restNotified = false; P.hechos = null;
  clearInterval(P.timer); P.timer = setInterval(tick, 500); renderPlayer();
}
/* Terminó el intervalo: se anota la serie y sigue el descanso (o el cierre). */
function finishWorkSet() {
  const P = PLAYER, ex = curEx(P);
  stopAlarm();
  /* Lo que DE VERDAD aguantaste. `P.hechos` lo pone stopWorkEarly al cortar
     antes de que suene; antes se calculaba aquí contra `workEnd` (que ya
     estaba en null) y acababa registrando la duración completa: bajarse a
     los 20 de 45 guardaba 45 y corrompía el historial en silencio. */
  const hechos = (P.hechos != null && P.hechos > 0)
    ? P.hechos
    : (P.workEnd ? Math.min(exSeconds(ex), exSeconds(ex) - workLeft()) : exSeconds(ex));
  logCurrentSet(hechos > 0 ? hechos : exSeconds(ex));
  P.workEnd = null; P.hechos = null;
  if (P.si >= ex.sets) { advanceAfterExercise(); return; }
  P.si++; P.phase = "rest"; P.restEnd = Date.now() + ex.rest * 1000; P.restNotified = false;
  clearInterval(P.timer); P.timer = setInterval(tick, 500); renderPlayer();
}
/* Cortar el tiempo antes de que suene. */
function stopWorkEarly() {
  const P = PLAYER, ex = curEx(P);
  clearInterval(P.timer); P.timer = null;
  /* Se mide ANTES de limpiar workEnd: workLeft() depende de él. */
  const hechos = Math.max(1, exSeconds(ex) - workLeft());
  P.hechos = hechos; P.workEnd = null;
  P.phase = "workalarm"; renderPlayer();
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
    if (PLAYER.phase === "work") {
      if (workLeft() <= 0) { PLAYER.restNotified = true; workExpired(); }
      else renderPlayer();
      return;
    }
  });
}
function afterLastSet() { logCurrentSet(); advanceAfterExercise(); }
/* Terminar un ejercicio no es lo mismo que terminar un bloque: cerrar el
   calentamiento y entrar al trabajo principal es un momento real, y llegar
   al abdomen después de lo principal también. Nunca arranca solo. */
function advanceAfterExercise() {
  const P = PLAYER;
  const cur = planStep(P), next = planStep(P, P.ei + 1);
  if (!next) { P.phase = "done"; renderPlayer(); return; }
  P.phase = (next.bi !== cur.bi) ? "blockdone" : "transition";
  renderPlayer();
}
function continueNext() { const P = PLAYER; P.ei++; P.si = 1; P.phase = "set"; P.pr = null; P.workEnd = null; P.hechos = null; renderPlayer(); }
function finishWorkout() {
  const P = PLAYER;
  const vol = P.log.reduce((a, s) => { const w = parseFloat(s.weight), r = parseInt(s.reps); return a + (isNaN(w) || isNaN(r) ? 0 : w * r); }, 0);
  WORKOUTS.push({ id: uid("w"), date: today(), activityId: "gym", type: "strength", routineId: P.r.id, name: P.r.name, duration: elapsed(), volume: vol, unit: weightUnit(), sets: P.log.map(s => { const o = { exName: s.exName, exId: s.exId || null, reps: s.reps, weight: s.weight }; if (s.secs) o.secs = s.secs; return o; }) });
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
