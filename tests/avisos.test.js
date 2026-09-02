const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
const MEM = global.__MEM;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }
const set = (id, v) => { document.getElementById(id).value = v == null ? "" : String(v); };
const T = today();
/* La hoja se pinta como cadena en modal.innerHTML; los avisos se escriben en
   la ranura por id. Se revisan los dos lugares. */
/* Solo hay una hoja abierta a la vez, asi que la ranura tiene UN id fijo.
   Se limpia antes de cada revision: en el harness getElementById devuelve
   siempre el mismo stub, y un aviso viejo daria un falso positivo. */
const slot = () => document.getElementById(FMSG_ID).innerHTML || "";
const dijoAlgo = () => /ferr/.test(slot());

/* =====================================================================
   1. EL BUG: Guardar no hacia nada sin series
   ===================================================================== */
console.log("\n== 1. Guardar sin series: avisa en vez de callarse ==");
CFG.routines.length = 0; CFG.exercises.length = 0; WORKOUTS.length = 0;
CFG.habits.length = 0; CFG.habits.push({ id: "gym", name: "Gym", idn: null });
saveCfg(); saveWorkouts();

t("guardar SIN series no guarda, pero SI explica por que", () => {
  const antes = WORKOUTS.length;
  openManualWorkout(addDays(T, -1));
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes, "guardo un entreno vacio");
  const h = els.modal.innerHTML;
  assert.ok(/al menos una serie/i.test(h), "no dijo que faltan series: " + h.slice(0, 200));
  assert.ok(/ferr/.test(h), "el aviso no va en rojo");
  assert.ok(h.includes("Guardar entreno"), "cerro la hoja en vez de avisar");
});
t("el boton se ve apagado mientras no hay series", () => {
  openManualWorkout(addDays(T, -1));
  assert.ok(/class="btn p off"/.test(els.modal.innerHTML), "el boton no se de-enfatiza sin series");
});
t("al agregar una serie el aviso se va y el boton se enciende", () => {
  openMwSet(); set("mwEx", "Press banca"); set("mwW", "60"); set("mwR", "8"); set("mwS", ""); set("mwN", 2);
  addMwSet();
  const h = els.modal.innerHTML;
  assert.ok(!/al menos una serie/i.test(h), "el aviso sobrevivio a agregar la serie");
  assert.ok(!/class="btn p off"/.test(h), "el boton sigue apagado con series");
});
t("y entonces SI guarda, en el dia correcto", () => {
  const antes = WORKOUTS.length;
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes + 1, "no guardo teniendo series");
  assert.strictEqual(WORKOUTS[WORKOUTS.length - 1].date, addDays(T, -1));
});
t("un ejercicio sin nombre tampoco se agrega en silencio", () => {
  openManualWorkout(addDays(T, -1));
  openMwSet(); set("mwEx", "   "); set("mwW", "60"); set("mwR", "8"); set("mwN", 1);
  addMwSet();
  assert.strictEqual(__getMW().sets.length, 0, "agrego una serie sin ejercicio");
  assert.ok(dijoAlgo(), "no dijo que falta el nombre");
  closeModal();
});

/* =====================================================================
   2. Auditoria: ningun guardado aborta en silencio
   ===================================================================== */
console.log("\n== 2. Todos los guardados avisan ==");
BIZ.projects.length = 0; BIZ.leads.length = 0; BIZ.metrics.length = 0; BIZ.ideas.length = 0; BIZ.focus.length = 0;
saveBiz();

function abortaConAviso(nombre, abrir, guardar, _slotId, cuantos) {
  t(nombre, () => {
    const antes = cuantos();
    abrir();
    clearFormError();
    guardar();
    assert.strictEqual(cuantos(), antes, nombre + ": guardo algo invalido");
    assert.ok(dijoAlgo(), nombre + ": aborto sin decir nada");
  });
}
abortaConAviso("proyecto sin nombre",
  () => { openBizProject(); set("bpName", "  "); set("bpWhy", ""); set("bpNa", ""); set("bpDue", ""); pickBizStatus("activo"); },
  () => saveBizProject(""), "bpMsg", () => BIZ.projects.length);

abortaConAviso("prospecto sin nombre",
  () => { openLead(); set("lgName", ""); set("lgContact", ""); set("lgValue", ""); set("lgUnit", ""); set("lgFollow", ""); set("lgNotes", ""); pickLeadStage("nuevo"); pickLeadProject(""); },
  () => saveLead(""), "lgMsg", () => BIZ.leads.length);

abortaConAviso("numero del negocio sin nombre",
  () => { openBizMetric(); set("bnName", ""); set("bnUnit", "MXN"); set("bnTarget", ""); pickBmPeriod("mes"); },
  () => saveBizMetric(""), "bnMsg", () => BIZ.metrics.length);

abortaConAviso("meta sin nombre",
  () => { openEditIdentity(); set("eName", ""); set("eWhy", ""); set("eQuotes", ""); },
  () => saveIdentity(""), "eMsg", () => CFG.identities.length);

abortaConAviso("habito sin nombre",
  () => { openEditHabit(); set("iName", ""); set("iTime", ""); },
  () => saveItem("habit", ""), "iMsg", () => CFG.habits.length);

abortaConAviso("metrica diaria sin nombre",
  () => { openEditMetric(); set("qName", ""); set("qUnit", ""); set("qTarget", ""); },
  () => saveMetric(""), "qMsg", () => CFG.metrics.length);

abortaConAviso("actividad sin nombre",
  () => { openEditActivity(); set("aName", ""); },
  () => saveActivity(""), "aMsg", () => CFG.activities.length);

abortaConAviso("tarea sin texto",
  () => { openTask(T); set("ttxt", "   "); set("ttime", ""); },
  () => saveTask(), "tMsg", () => TASKS.length);

t("la tarea vacia YA NO cierra la hoja en silencio", () => {
  assert.ok(els.modal.innerHTML.includes("Agregar"), "cerro la hoja sin explicar");
});

abortaConAviso("sesion de foco a mano sin minutos",
  () => { BIZ.projects.push({ id: "p1", name: "Demo", color: PALETTE[5], status: "activo", why: "", nextAction: "", nextActionDue: "", updatedAt: Date.now() }); saveBiz();
          openFocusManual("p1"); set("fmMin", ""); set("fmDate", T); set("fmNote", ""); pickFocusProj("p1"); },
  () => saveFocusManual(), "fmMsg", () => BIZ.focus.length);

t("ejercicio de rutina sin nombre avisa", () => {
  CFG.routines.push(normalizeRoutine({ name: "R", blocks: [{ name: "P", kind: "principal", exercises: [{ name: "A", sets: 1, reps: "1", rest: 0 }] }] }));
  saveCfg();
  openRoutineEditor(CFG.routines[0].id);
  const antes = __getRT().blocks[0].exercises.length;
  openExercise(0, -1);
  set("xName", "  "); set("xSets", 3); set("xReps", "10"); set("xRest", 60); set("xWeight", ""); set("xNote", "");
  saveExercise(0, -1);
  assert.strictEqual(__getRT().blocks[0].exercises.length, antes, "agrego un ejercicio sin nombre");
  assert.ok(dijoAlgo(), "no dijo que falta el nombre");
  closeModal();
});
t("la fecha futura sigue avisando (no se rompio)", () => {
  const antes = WORKOUTS.length;
  openManualWorkout(addDays(T, -1));
  openMwSet(); set("mwEx", "Sentadilla"); set("mwW", "80"); set("mwR", "5"); set("mwS", ""); set("mwN", 1); addMwSet();
  mwSetDate("2099-01-01");
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes, "guardo en el futuro");
  assert.ok(/aún no llega/.test(els.modal.innerHTML), "no aviso de la fecha");
  closeModal();
});

/* =====================================================================
   3. (a) Cortar un ejercicio de tiempo registra lo REAL
   ===================================================================== */
console.log("\n== 3. Serie por tiempo cortada antes ==");
CFG.routines.length = 0; CFG.exercises.length = 0; WORKOUTS.length = 0; saveCfg(); saveWorkouts();
CFG.routines.push(normalizeRoutine({ name: "Timed", days: [], blocks: [
  { name: "Abdomen", kind: "extra", exercises: [
    { name: "Plancha", sets: 2, type: "tiempo", seconds: 45, rest: 5 }] }] }));
saveCfg();
const RID = CFG.routines[0].id;

t("bajarse a los 20 de 45 registra 20, no 45", () => {
  beginWorkout(RID);
  startWork();
  const P = __getPLAYER();
  assert.strictEqual(P.phase, "work");
  // como si hubieran pasado 20 s de los 45
  P.workEnd = Date.now() + 25 * 1000;
  stopWorkEarly();
  assert.strictEqual(__getPLAYER().phase, "workalarm");
  assert.ok(Math.abs(__getPLAYER().hechos - 20) <= 1, "midio " + __getPLAYER().hechos + " en vez de 20");
  finishWorkSet();
  const s = __getPLAYER().log[0];
  assert.ok(Math.abs(s.secs - 20) <= 1, "REGISTRO " + s.secs + " segundos en vez de ~20");
  assert.notStrictEqual(s.secs, 45, "guardo la duracion completa pese a cortar antes");
});
t("la pantalla dice que la serie se corto y cuanto va a registrar", () => {
  // se vuelve a montar el estado de serie cortada para mirar el render
  const P = __getPLAYER();
  P.phase = "workalarm"; P.hechos = 20; renderPlayer();
  const h = els.modal.innerHTML;
  assert.ok(/Serie cortada/.test(h), "no avisa que se corto");
  assert.ok(/Registrar 20s/.test(h), "no dice cuanto va a registrar");
});
t("dejar correr el tiempo completo sigue registrando la duracion entera", () => {
  const P = __getPLAYER();
  P.phase = "set"; P.hechos = null; P.si = 2;
  startWork();
  __getPLAYER().workEnd = Date.now() - 500;
  tick();
  assert.strictEqual(__getPLAYER().phase, "workalarm");
  finishWorkSet();
  const s = __getPLAYER().log[__getPLAYER().log.length - 1];
  assert.strictEqual(s.secs, 45, "no registro la duracion completa: " + s.secs);
});
t("empezar un intervalo nuevo limpia lo cortado del anterior", () => {
  const P = __getPLAYER();
  P.hechos = 20; P.phase = "set";
  startWork();
  assert.strictEqual(__getPLAYER().hechos, null, "arrastro los segundos del intervalo anterior");
  cleanupPlayer(); clearActive();
});

/* =====================================================================
   4. (c) La rutina editada a media sesion no mueve el entreno en curso
   ===================================================================== */
console.log("\n== 4. Plan congelado en la sesion en curso ==");
CFG.routines.length = 0; saveCfg();
CFG.routines.push(normalizeRoutine({ name: "Sesion", days: [], blocks: [
  { name: "Cal", kind: "calentamiento", exercises: [{ name: "Movilidad", sets: 1, reps: "10", rest: 5 }] },
  { name: "Push", kind: "principal", exercises: [
    { name: "Press banca", sets: 1, reps: "8", rest: 5 },
    { name: "Fondos", sets: 1, reps: "10", rest: 5 }] }] }));
saveCfg();
const RID2 = CFG.routines[0].id;

t("el plan se guarda con la sesion", () => {
  beginWorkout(RID2);
  savePlayerState();
  const a = JSON.parse(MEM.mt_activeWorkout);
  assert.ok(Array.isArray(a.plan) && a.plan.length === 3, "no persistio el plan");
  assert.deepStrictEqual(a.plan.map(s => s.bname), ["Cal", "Push", "Push"]);
});
t("editar la rutina a media sesion NO mueve el entreno en curso", () => {
  const P = __getPLAYER();
  set("plR", "10"); afterLastSet(); continueNext();      // ahora en Press banca
  assert.strictEqual(curEx(__getPLAYER()).name, "Press banca");
  savePlayerState();
  // se edita la rutina por debajo: se borra el calentamiento entero
  const r = CFG.routines.find(x => x.id === RID2);
  r.blocks.splice(0, 1);
  saveCfg();
  // al reanudar, la sesion sigue donde estaba
  cleanupPlayer();
  resumeWorkout();
  const Q = __getPLAYER();
  assert.strictEqual(Q.plan.length, 3, "el plan se encogio con la rutina");
  assert.strictEqual(curEx(Q).name, "Press banca", "la sesion se movio a otro ejercicio");
  assert.strictEqual(planStep(Q).bname, "Push");
});
t("una sesion guardada SIN plan (version anterior) se reconstruye sola", () => {
  const a = JSON.parse(MEM.mt_activeWorkout);
  delete a.plan;
  MEM.mt_activeWorkout = JSON.stringify(a);
  cleanupPlayer();
  resumeWorkout();
  const Q = __getPLAYER();
  assert.ok(Q.plan.length > 0, "no reconstruyo el plan");
  cleanupPlayer(); clearActive();
});

/* =====================================================================
   5. (b) Borrar un bloque ofrece mudar los ejercicios
   ===================================================================== */
console.log("\n== 5. Borrar un bloque sin perder ejercicios ==");
t("ofrece mudar los ejercicios a otro bloque", () => {
  CFG.routines.length = 0;
  CFG.routines.push(normalizeRoutine({ name: "R", blocks: [
    { name: "Push", kind: "principal", exercises: [{ name: "Press", sets: 1, reps: "8", rest: 0 }] },
    { name: "Abdomen", kind: "extra", exercises: [
      { name: "Plancha RT", sets: 1, reps: "10", rest: 0 },
      { name: "Crunch RT", sets: 1, reps: "15", rest: 0 }] }] }));
  saveCfg();
  openRoutineEditor(CFG.routines[0].id);
  delBlock(1);
  const h = els.modal.innerHTML;
  assert.ok(/mudarlos a otro bloque/.test(h), "no ofrece mudarlos");
  assert.ok(/moveBlockExercises\(1,0\)/.test(h), "no ofrece el bloque destino");
  assert.ok(/Borrar el bloque y sus 2 ejercicios/.test(h), "no dice cuantos se pierden");
  assert.ok(!/btn p" style="background:var\(--bad\)/.test(h), "destruir sigue siendo la opcion principal");
});
t("mudar mueve los ejercicios y quita el bloque vacio", () => {
  moveBlockExercises(1, 0);
  const rt = __getRT();
  assert.strictEqual(rt.blocks.length, 1, "no quito el bloque");
  assert.strictEqual(rt.blocks[0].exercises.length, 3, "perdio ejercicios al mudar");
  assert.deepStrictEqual(rt.blocks[0].exercises.map(e => e.name), ["Press", "Plancha RT", "Crunch RT"]);
});
t("borrar de verdad sigue disponible", () => {
  const rt = __getRT();
  rt.blocks.push({ id: "bk2", name: "Sobra", kind: "extra", exercises: [{ id: "z", name: "X", sets: 1, reps: "1", rest: 0 }] });
  renderRoutineEditor();
  doDelBlock(1);
  assert.strictEqual(__getRT().blocks.length, 1, "no borro");
});
t("un bloque vacio se borra sin preguntar", () => {
  const rt = __getRT();
  rt.blocks.push({ id: "bk3", name: "Vacio", kind: "extra", exercises: [] });
  const antes = rt.blocks.length;
  delBlock(antes - 1);
  assert.strictEqual(__getRT().blocks.length, antes - 1, "pregunto por un bloque vacio");
  closeModal();
});

console.log("\n" + n + " pruebas OK\n");
