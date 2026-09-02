const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
const MEM = global.__MEM;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }

const B = () => __getBIZ();
const set = (id, v) => { document.getElementById(id).value = v == null ? "" : String(v); };
const T = today();
function resetBiz() {
  const b = B();
  ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(k => { b[k].length = 0; });
  b.mvals = {}; b.reviews = {}; clearFocusRun(); saveBiz();
}
function crearLead(name, o) {
  o = o || {};
  openLead();
  set("lgName", name); set("lgContact", ""); set("lgValue", o.value == null ? "" : o.value);
  set("lgUnit", o.unit == null ? "" : o.unit);
  set("lgFollow", ""); set("lgNotes", "");
  pickLeadStage(o.stage || "nuevo"); pickLeadProject("");
  saveLead("");
  return B().leads[B().leads.length - 1];
}

/* =====================================================================
   1. El pipeline nunca mezcla monedas
   ===================================================================== */
console.log("\n== 1. Unidad por lead ==");
resetBiz();
t("un lead guarda su unidad", () => {
  const l = crearLead("Estudio Ollin", { value: 25000, unit: "MXN", stage: "contactado" });
  assert.strictEqual(l.unit, "MXN");
  assert.strictEqual(l.value, 25000);
  assert.strictEqual(JSON.parse(MEM.mt_biz).leads[0].unit, "MXN", "no persistio la unidad");
});
t("los totales se separan por unidad, NUNCA en una sola cifra", () => {
  crearLead("Inversion visa", { value: 12000, unit: "USD", stage: "propuesta" });
  const tot = leadUnitTotals(openLeadsList());
  assert.strictEqual(tot.length, 2, "no separo las monedas");
  const map = {}; tot.forEach(x => { map[x.unit] = x.sum; });
  assert.deepStrictEqual(map, { MXN: 25000, USD: 12000 });
  assert.ok(!tot.some(x => x.sum === 37000), "aparecio la suma MXN+USD");
});
t("la vista del pipeline no imprime el total combinado", () => {
  __setVIEW("negocio"); __setNEGTAB("pipeline"); renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.includes("MXN") && h.includes("USD"), "no muestra ambas unidades");
  assert.ok(!h.includes("37000") && !h.includes("37,000"), "aparecio la suma cruzada");
  assert.ok(h.includes("25,000") && h.includes("12,000"), "faltan los totales por unidad");
});
t("dos leads de la MISMA unidad si se suman", () => {
  crearLead("Otro MXN", { value: 5000, unit: "MXN", stage: "nuevo" });
  const map = {}; leadUnitTotals(openLeadsList()).forEach(x => { map[x.unit] = x.sum; });
  assert.strictEqual(map.MXN, 30000, "no sumo dos leads de la misma moneda");
  assert.strictEqual(map.USD, 12000);
});
t("un lead sin unidad va a su propio grupo, no se mezcla", () => {
  crearLead("Sin moneda", { value: 900, stage: "nuevo" });
  const tot = leadUnitTotals(openLeadsList());
  const sinU = tot.find(x => x.unit === LEAD_NO_UNIT);
  assert.ok(sinU, "no agrupo lo que no tiene unidad");
  assert.strictEqual(sinU.sum, 900);
  assert.strictEqual(tot.find(x => x.unit === "MXN").sum, 30000, "contamino el grupo MXN");
});
t("la migracion agrega unit vacio sin inventar moneda", () => {
  B().leads.push({ id: "viejo", name: "Heredado", contact: "", stage: "nuevo", value: 111,
    followUp: "", notes: "", projectId: "", stageAt: Date.now(), updatedAt: Date.now() });
  saveBiz();
  assert.strictEqual(B().leads[B().leads.length - 1].unit, undefined);
  assert.strictEqual(migrateLeadUnits(), true, "no migro");
  assert.strictEqual(bizLead("viejo").unit, "", "invento una moneda");
  assert.strictEqual(migrateLeadUnits(), false, "no es idempotente");
});
t("el formulario propone la unidad mas usada, no una inventada", () => {
  assert.strictEqual(commonLeadUnit(), "MXN", "no propuso la mas frecuente");
  B().leads.length = 0; saveBiz();
  assert.strictEqual(commonLeadUnit(), "", "invento una moneda sin datos");
});

/* =====================================================================
   2. Corregir una sesion de foco
   ===================================================================== */
console.log("\n== 2. Editar y borrar una sesion de foco ==");
resetBiz();
t("editar una sesion persiste", () => {
  openBizProject(); set("bpName", "CRM"); set("bpWhy", ""); set("bpNa", ""); set("bpDue", "");
  pickBizStatus("activo"); saveBizProject("");
  const p = B().projects[0];
  B().focus.push({ id: "fs1", date: T, projectId: p.id, seconds: 45 * 60, note: "mal tecleado" });
  saveBiz();
  openFocusEdit("fs1");
  assert.ok(els.modal.innerHTML.includes("Editar sesión de foco"), "no abrio el editor");
  set("feMin", 90); set("feDate", addDays(T, -2)); set("feNote", "corregido");
  saveFocusEdit("fs1");
  const f = B().focus[0];
  assert.strictEqual(f.seconds, 5400, "no guardo los minutos");
  assert.strictEqual(f.date, addDays(T, -2), "no guardo el dia");
  assert.strictEqual(f.note, "corregido");
  assert.strictEqual(JSON.parse(MEM.mt_biz).focus[0].seconds, 5400, "no persistio");
});
t("una fecha futura se RECHAZA (antes se recortaba en silencio)", () => {
  const antes = B().focus[0].date;
  set("feMin", 30); set("feDate", "2099-01-01"); set("feNote", "");
  saveFocusEdit("fs1");
  assert.strictEqual(B().focus[0].date, antes, "acepto o reescribio una fecha futura");
  assert.strictEqual(B().focus[0].seconds, 5400, "guardo el resto pese a rechazar la fecha");
  // con una fecha valida si guarda
  set("feMin", 30); set("feDate", T); set("feNote", "");
  saveFocusEdit("fs1");
  assert.strictEqual(B().focus[0].date, T);
  assert.strictEqual(B().focus[0].seconds, 1800);
});
t("borrar pide confirmacion y persiste", () => {
  confirmDelFocus("fs1");
  assert.ok(els.modal.innerHTML.includes("¿Borrar esta sesión?"), "no confirmo");
  delFocus("fs1");
  assert.strictEqual(B().focus.length, 0, "no borro");
  assert.strictEqual(JSON.parse(MEM.mt_biz).focus.length, 0, "no persistio el borrado");
});
t("el detalle del proyecto ofrece editar cada sesion", () => {
  const p = B().projects[0];
  B().focus.push({ id: "fs2", date: T, projectId: p.id, seconds: 1800, note: "" });
  saveBiz();
  const h = focusSummaryBlock(p.id);
  assert.ok(h.includes("openFocusEdit('fs2')"), "las sesiones no son tocables");
  assert.ok(h.includes("Toca una sesión para corregirla"), "no lo explica");
});

/* =====================================================================
   3. Entreno registrado a posteriori
   ===================================================================== */
console.log("\n== 3. Registrar un entreno pasado ==");
WORKOUTS.length = 0; saveWorkouts();
CFG.habits.length = 0;
CFG.habits.push({ id: "gym", name: "Gym", idn: null });
CFG.exercises.length = 0; saveCfg();
const AYER = addDays(T, -1);

t("un entreno de fuerza cae en la fecha correcta y con sus series", () => {
  openManualWorkout(AYER);
  mwPickRoutine("");
  openMwSet(); set("mwEx", "Press banca"); set("mwW", "60"); set("mwR", "8"); set("mwN", 3); addMwSet();
  openMwSet(); set("mwEx", "Remo con barra"); set("mwW", "50"); set("mwR", "10"); set("mwN", 2); addMwSet();
  set("mwDur", 45);
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, 1, "no guardo el entreno");
  const w = WORKOUTS[0];
  assert.strictEqual(w.date, AYER, "cayo en otra fecha");
  assert.strictEqual(w.type, "strength");
  assert.strictEqual(w.sets.length, 5, "series: " + w.sets.length);
  assert.strictEqual(w.volume, 60 * 8 * 3 + 50 * 10 * 2, "volumen mal calculado");
  assert.ok(JSON.parse(MEM.mt_workouts).length === 1, "no persistio");
});
t("cada serie pasa por el catalogo, asi que alimenta los records", () => {
  const w = WORKOUTS[0];
  w.sets.forEach(s => assert.ok(s.exId, "serie sin exId: " + s.exName));
  const ex = exFind("Press banca");
  assert.ok(ex, "no entro al catalogo");
  const pr = exercisePR(ex.id);
  assert.ok(pr, "no genero PR");
  assert.strictEqual(pr.weight, 60);
  assert.strictEqual(pr.date, AYER);
  assert.strictEqual(lastPerf(ex.id).date, AYER);
  assert.ok(allLoggedExercises().some(e => e.name === "Press banca"), "no aparece en records");
});
t("cuenta en historial, estadisticas y el punto del calendario", () => {
  assert.ok(hasWorkout(AYER), "el calendario no lo ve");
  assert.strictEqual(workoutsInRange(AYER, T).length, 1, "no entra al rango semanal");
  __setVIEW("workouts"); renderWorkouts();
  assert.ok(els.app.innerHTML.includes("Press banca"), "no aparece en records de la vista");
});
t("marca el habito de gym de ESE dia y recalcula si estaba congelado", () => {
  assert.strictEqual(LOG[AYER].habits.gym, true, "no marco el habito de ese dia");
  // un dia congelado debe recalcularse, no quedarse con el puntaje viejo
  const otro = addDays(T, -3);
  LOG[otro] = { habits: {}, commitments: {}, notes: {}, menuDone: {}, fichas: {}, inneg: {},
                metrics: {}, sleep: null, mood: null, journal: "", frozen: true, pts: 0, max: 1 };
  saveLog();
  markGymHabit(otro);
  assert.strictEqual(LOG[otro].habits.gym, true);
  assert.strictEqual(LOG[otro].pts, 1, "no recalculo el dia congelado");
});
t("NUNCA acepta una fecha futura", () => {
  assert.strictEqual(clampPast("2099-01-01"), T);
  assert.strictEqual(clampPast(""), T);
  assert.strictEqual(clampPast(AYER), AYER);
  const antes = WORKOUTS.length;
  openManualWorkout("2099-01-01");
  openMwSet(); set("mwEx", "Sentadilla"); set("mwW", "80"); set("mwR", "5"); set("mwN", 1); addMwSet();
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes + 1);
  assert.strictEqual(WORKOUTS[WORKOUTS.length - 1].date, T, "guardo un entreno en el futuro");
  WORKOUTS.pop(); saveWorkouts();
});
t("un entreno sin series no se guarda", () => {
  const antes = WORKOUTS.length;
  openManualWorkout(AYER);
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes, "guardo un entreno vacio");
});
t("una clase tambien acepta fecha pasada y marca el habito", () => {
  CFG.activities.push({ id: "box", name: "Boxeo", type: "class", icon: "boxing", color: "#EF4444" });
  const d = addDays(T, -4);
  openLogSession("box", d);
  assert.ok(els.modal.innerHTML.includes('id="sDate"'), "la clase no deja elegir dia");
  set("sDur", 60); set("sDate", d); set("sNote", "sparring");
  pickIntensity({ classList: { add() {} } }, 8);
  saveSession("box", d);
  const w = WORKOUTS[WORKOUTS.length - 1];
  assert.strictEqual(w.date, d, "la clase cayo en otra fecha");
  assert.strictEqual(w.type, "class");
  assert.strictEqual(LOG[d].habits.gym, true, "no marco el habito de ese dia");
});
t("una clase con fecha futura se RECHAZA (antes se recortaba)", () => {
  const antes = WORKOUTS.length;
  set("sDur", 30); set("sDate", "2099-05-05"); set("sNote", "");
  saveSession("box", "2099-05-05");
  assert.strictEqual(WORKOUTS.length, antes, "guardo una clase con fecha futura");
  // con una fecha valida si guarda
  const d = addDays(T, -5);
  set("sDur", 30); set("sDate", d); set("sNote", "");
  saveSession("box", d);
  assert.strictEqual(WORKOUTS.length, antes + 1, "no guardo con fecha valida");
  assert.strictEqual(WORKOUTS[WORKOUTS.length - 1].date, d);
  WORKOUTS.pop(); saveWorkouts();
});
t("el dia pasado de Hoy ofrece registrar", () => {
  const card = gymCardHoy(addDays(T, -7));
  assert.ok(card.includes("openManualWorkout('" + addDays(T, -7) + "')"), "no ofrece registrar fuerza");
  assert.ok(card.includes("openLogSession('box','" + addDays(T, -7) + "')"), "no ofrece registrar clase");
  const conEntreno = gymCardHoy(AYER);
  assert.ok(conEntreno.includes("openManualWorkout("), "no deja agregar otro entreno a ese dia");
});
t("la pestana Workouts ofrece registrar un entreno pasado", () => {
  __setVIEW("workouts"); renderWorkouts();
  assert.ok(els.app.innerHTML.includes("Registrar un entreno pasado"), "no hay entrada desde Workouts");
});

/* =====================================================================
   4. Aviso local de fin de descanso
   ===================================================================== */
console.log("\n== 4. Notificacion local del descanso ==");
t("empezar un descanso limpia la marca de aviso", () => {
  CFG.routines.length = 0;
  CFG.routines.push({ id: "rt1", name: "Push", days: [], exercises: [
    { id: "e1", exId: null, name: "Press banca", sets: 3, reps: "8", rest: 60, weight: "", note: "" },
    { id: "e2", exId: null, name: "Remo", sets: 3, reps: "10", rest: 60, weight: "", note: "" }] });
  saveCfg();
  beginWorkout("rt1");
  const P = __getPLAYER();
  assert.ok(P, "no arranco el reproductor");
  startRest();
  assert.strictEqual(__getPLAYER().restNotified, false, "no limpio la marca");
  assert.ok(__getPLAYER().restEnd > Date.now(), "no puso fin de descanso");
});
t("degrada en silencio sin permiso de notificaciones", () => {
  assert.strictEqual(typeof Notification, "undefined", "el harness no deberia tener Notification");
  notifyRestDone();   // no debe lanzar
  assert.strictEqual(__getPLAYER().restNotified, true, "no marco el aviso");
});
t("no dispara dos veces el mismo descanso", () => {
  const P = __getPLAYER();
  P.restNotified = false;
  notifyRestDone();
  assert.strictEqual(P.restNotified, true);
  notifyRestDone();   // segunda llamada: no vuelve a avisar
  assert.strictEqual(P.restNotified, true);
});
t("la marca se persiste, asi que recargar no repite el aviso", () => {
  savePlayerState();
  const a = JSON.parse(MEM.mt_activeWorkout);
  assert.strictEqual(a.restNotified, true, "no se persistio restNotified");
});
t("al vencer el descanso pasa a alarma y avisa una sola vez", () => {
  const P = __getPLAYER();
  P.phase = "rest"; P.restNotified = false; P.restEnd = Date.now() - 1000;
  tick();
  assert.strictEqual(P.phase, "alarm", "no paso a la alarma");
  assert.strictEqual(P.restNotified, true, "no aviso");
});
t("puesta al dia tras segundo plano: vencido se atiende sin aviso tardio", () => {
  const P = __getPLAYER();
  P.phase = "rest"; P.restNotified = false; P.restEnd = Date.now() - 5 * 60000;
  // lo que hace el manejador de visibilitychange
  if (restLeft() <= 0) { P.restNotified = true; restExpired(); }
  assert.strictEqual(P.phase, "alarm", "no se puso al dia");
  assert.strictEqual(P.restNotified, true, "podria soltar un aviso tardio");
});
t("el service worker avisa al cliente para volver al reproductor", () => {
  const fs = require("fs"), path = require("path");
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.includes("mt-resume-workout"), "el SW no manda el mensaje de reanudar");
  assert.ok(sw.includes("d.resume"), "el SW no distingue el aviso de descanso");
  const gym = fs.readFileSync(path.join(ROOT, "js/gym.js"), "utf8");
  assert.ok(gym.includes('e.data.type !== "mt-resume-workout"'), "gym.js no escucha el mensaje");
  assert.ok(/getRegistration/.test(gym) && /showNotification/.test(gym), "no usa el SW para notificar");
  // Se mira el CODIGO, no los comentarios (que si nombran a Supabase para
  // explicar justamente por que NO se usa aqui).
  const codigo = gym.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/pushManager|supabase|SB\.client|api\.supabase/i.test(codigo),
    "el aviso de descanso NO debe pasar por el servidor");
  assert.ok(!/fetch\s*\(/.test(codigo), "el aviso de descanso no debe hacer peticiones de red");
});
skipRest(); clearActive();

console.log("\n" + n + " pruebas OK\n");
