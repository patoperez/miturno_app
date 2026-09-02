const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
const MEM = global.__MEM;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }
const set = (id, v) => { document.getElementById(id).value = v == null ? "" : String(v); };
const T = today();

/* =====================================================================
   1. Migracion de rutinas planas a bloques
   ===================================================================== */
console.log("\n== 1. Rutinas planas -> un bloque principal ==");
CFG.routines.length = 0; CFG.exercises.length = 0; WORKOUTS.length = 0; saveCfg(); saveWorkouts();
t("una rutina plana migra sin perder nada y de forma idempotente", () => {
  CFG.routines.push({ id: "rt1", name: "Push A", days: ["lunes"], exercises: [
    { id: "e1", exId: "exA", name: "Press banca", sets: 4, reps: "8", rest: 120, weight: "60 kg", note: "pausa" },
    { id: "e2", exId: "exB", name: "Remo", sets: 3, reps: "10", rest: 90, weight: "", note: "" }] });
  saveCfg();
  assert.strictEqual(migrateRoutineBlocks(), true, "no migro");
  const r = CFG.routines[0];
  assert.ok(Array.isArray(r.blocks) && r.blocks.length === 1, "no creo un solo bloque");
  assert.strictEqual(r.blocks[0].kind, "principal");
  assert.strictEqual(r.blocks[0].exercises.length, 2, "perdio ejercicios");
  assert.strictEqual(r.blocks[0].exercises[0].exId, "exA", "perdio el vinculo con el catalogo");
  assert.strictEqual(r.blocks[0].exercises[0].note, "pausa", "perdio datos del ejercicio");
  assert.strictEqual(r.exercises, undefined, "dejo el arreglo plano duplicado");
  assert.strictEqual(migrateRoutineBlocks(), false, "no es idempotente");
  const snap = JSON.stringify(CFG.routines);
  migrateRoutineBlocks();
  assert.strictEqual(JSON.stringify(CFG.routines), snap, "la 3a corrida cambio algo");
});
t("routineExercises y routineBlocks aplanan en orden", () => {
  const r = CFG.routines[0];
  assert.deepStrictEqual(routineExercises(r).map(e => e.name), ["Press banca", "Remo"]);
  assert.strictEqual(routineBlocks(r).length, 1);
});
t("routineBlocks tolera una rutina que aun no migro", () => {
  const plana = { id: "x", name: "Vieja", days: [], exercises: [{ id: "a", name: "Uno", sets: 1, reps: "1", rest: 0 }] };
  assert.strictEqual(routineBlocks(plana).length, 1);
  assert.strictEqual(routineBlocks(plana)[0].kind, "principal");
  assert.strictEqual(routineExercises(plana).length, 1);
});
t("el catalogo se sigue construyendo desde los bloques", () => {
  CFG.exercises.length = 0; saveCfg();
  migrateExercises();
  assert.ok(exFind("Press banca"), "no metio el ejercicio del bloque al catalogo");
  assert.ok(exFind("Remo"));
});
t("blockOfIndex ubica el bloque de un indice aplanado", () => {
  const r = { blocks: [
    { id: "b1", name: "Cal", kind: "calentamiento", exercises: [{ name: "A" }, { name: "B" }] },
    { id: "b2", name: "Push", kind: "principal", exercises: [{ name: "C" }] }] };
  assert.strictEqual(blockOfIndex(r, 0).block.name, "Cal");
  assert.strictEqual(blockOfIndex(r, 1).idx, 1);
  assert.strictEqual(blockOfIndex(r, 2).block.name, "Push");
  assert.strictEqual(blockOfIndex(r, 9), null);
});

/* =====================================================================
   2. Importador: acepta los dos formatos
   ===================================================================== */
console.log("\n== 2. Importar formato viejo y nuevo ==");
t("el formato VIEJO (plano) sigue funcionando", () => {
  const r = normalizeRoutine({ name: "Legacy", days: ["martes"], exercises: [
    { name: "Sentadilla", sets: 5, reps: "5", rest: 180, weight: "100 kg" }] });
  assert.ok(r, "rechazo el formato viejo");
  assert.strictEqual(r.blocks.length, 1, "no lo metio en un solo bloque");
  assert.strictEqual(r.blocks[0].kind, "principal");
  assert.strictEqual(r.blocks[0].exercises.length, 1);
  assert.strictEqual(r.blocks[0].exercises[0].name, "Sentadilla");
  assert.ok(r.blocks[0].exercises[0].exId, "no lo ligo al catalogo");
  assert.deepStrictEqual(r.days, ["martes"]);
});
t("el formato NUEVO produce los bloques correctos", () => {
  const r = normalizeRoutine({ name: "Push completo", days: ["lunes"], blocks: [
    { name: "Movilidad", kind: "calentamiento", exercises: [{ name: "Gato-camello", sets: 1, reps: "10", rest: 0 }] },
    { name: "Push", kind: "principal", exercises: [{ name: "Press banca", sets: 4, reps: "8", rest: 120 }] },
    { name: "Abdomen", kind: "extra", exercises: [{ name: "Plancha", sets: 3, type: "tiempo", seconds: 45, rest: 45 }] },
    { name: "Cuello", kind: "extra", exercises: [{ name: "Flexion de cuello", sets: 2, reps: "12", rest: 30, bodyweight: true }] },
    { name: "Estiramiento", kind: "enfriamiento", exercises: [{ name: "Respiracion", sets: 1, type: "tiempo", seconds: 120, rest: 0 }] }] });
  assert.strictEqual(r.blocks.length, 5, "bloques: " + r.blocks.length);
  assert.deepStrictEqual(r.blocks.map(b => b.kind), ["calentamiento", "principal", "extra", "extra", "enfriamiento"]);
  assert.deepStrictEqual(r.blocks.map(b => b.name), ["Movilidad", "Push", "Abdomen", "Cuello", "Estiramiento"]);
  const plancha = r.blocks[2].exercises[0];
  assert.strictEqual(plancha.type, "tiempo");
  assert.strictEqual(plancha.seconds, 45);
  const cuello = r.blocks[3].exercises[0];
  assert.strictEqual(cuello.bodyweight, true);
  assert.strictEqual(cuello.weight, "", "un ejercicio de peso corporal no debe traer peso");
});
t("dos bloques 'extra' se leen como secciones distintas, no como sobras", () => {
  const r = normalizeRoutine({ name: "X", blocks: [
    { name: "Abdomen", kind: "extra", exercises: [{ name: "Crunch", sets: 3, reps: "15", rest: 45 }] },
    { name: "Cuello", kind: "extra", exercises: [{ name: "Extension cuello", sets: 2, reps: "12", rest: 30 }] }] });
  assert.strictEqual(r.blocks[0].name, "Abdomen");
  assert.strictEqual(r.blocks[1].name, "Cuello");
  assert.notStrictEqual(r.blocks[0].name, r.blocks[1].name);
});
t("un kind desconocido cae en 'principal' y no rompe", () => {
  const r = normalizeRoutine({ name: "X", blocks: [{ name: "Raro", kind: "inventado", exercises: [{ name: "A", sets: 1, reps: "1", rest: 0 }] }] });
  assert.strictEqual(r.blocks[0].kind, "principal");
});
t("exportar -> reimportar conserva bloques, tipos y peso corporal", () => {
  const orig = normalizeRoutine({ name: "RoundTrip", days: ["lunes"], blocks: [
    { name: "Cal", kind: "calentamiento", exercises: [{ name: "Movilidad RT", sets: 1, type: "tiempo", seconds: 90, rest: 10, note: "suave" }] },
    { name: "Main", kind: "principal", exercises: [{ name: "Press RT", sets: 3, reps: "8", rest: 120, weight: "60 kg" }] },
    { name: "Abs", kind: "extra", exercises: [{ name: "Plancha RT", sets: 2, type: "tiempo", seconds: 45, rest: 30 }] },
    { name: "Cuello RT", kind: "extra", exercises: [{ name: "Cuello RT", sets: 2, reps: "12", rest: 30, bodyweight: true }] },
    { name: "Fin", kind: "enfriamiento", exercises: [{ name: "Respirar RT", sets: 1, type: "tiempo", seconds: 60, rest: 0 }] }] });
  CFG.routines.push(orig); saveCfg();
  // lo mismo que arma exportRoutine
  const limpiaEx = e => {
    const o = { name: e.name, sets: e.sets, rest: e.rest };
    if (exIsTime(e)) { o.type = "tiempo"; o.seconds = exSeconds(e); } else o.reps = e.reps;
    if (exIsBw(e)) o.bodyweight = true;
    if (!exIsBw(e) && e.weight) o.weight = e.weight;
    if (e.note) o.note = e.note;
    return o;
  };
  const exportado = { name: orig.name, days: orig.days,
    blocks: routineBlocks(orig).map(b => ({ name: b.name, kind: blockKind(b.kind), exercises: (b.exercises || []).map(limpiaEx) })) };
  const vuelta = normalizeRoutine(JSON.parse(JSON.stringify(exportado)));
  assert.strictEqual(vuelta.blocks.length, 5, "perdio bloques en la vuelta");
  assert.deepStrictEqual(vuelta.blocks.map(b => b.kind), orig.blocks.map(b => b.kind));
  assert.deepStrictEqual(vuelta.blocks.map(b => b.name), orig.blocks.map(b => b.name));
  const a = routineExercises(orig), b = routineExercises(vuelta);
  assert.strictEqual(a.length, b.length, "perdio ejercicios");
  a.forEach((e, i) => {
    assert.strictEqual(b[i].name, e.name);
    assert.strictEqual(exType(b[i]), exType(e), "cambio el tipo de " + e.name);
    assert.strictEqual(exIsBw(b[i]), exIsBw(e), "cambio el peso corporal de " + e.name);
    if (exIsTime(e)) assert.strictEqual(exSeconds(b[i]), exSeconds(e), "cambio los segundos de " + e.name);
    else assert.strictEqual(b[i].reps, e.reps, "cambio las reps de " + e.name);
    assert.strictEqual(b[i].exId, e.exId, "se fragmento el catalogo en la vuelta");
  });
  CFG.routines.pop(); saveCfg();
});
t("un JSON sin blocks ni exercises se rechaza", () => {
  assert.strictEqual(normalizeRoutine({ name: "Nada" }), null);
  assert.strictEqual(normalizeRoutine(null), null);
});
t("reimportar reusa el exId del catalogo (no fragmenta)", () => {
  const antes = CFG.exercises.length;
  const a = normalizeRoutine({ name: "A", blocks: [{ name: "P", kind: "principal", exercises: [{ name: "PRESS  BANCA", sets: 1, reps: "1", rest: 0 }] }] });
  assert.strictEqual(CFG.exercises.length, antes, "creo un ejercicio duplicado");
  assert.strictEqual(a.blocks[0].exercises[0].exId, exFind("Press banca").id);
});
t("el tipo y el peso corporal NO fragmentan el catalogo", () => {
  const antes = CFG.exercises.length;
  normalizeRoutine({ name: "B", blocks: [{ name: "P", kind: "extra", exercises: [
    { name: "Press banca", sets: 1, type: "tiempo", seconds: 30, rest: 0 },
    { name: "Press banca", sets: 1, reps: "5", rest: 0, bodyweight: true }] }] });
  assert.strictEqual(CFG.exercises.length, antes, "el tipo creo entradas nuevas en el catalogo");
});

/* =====================================================================
   3. Tipos de ejercicio y records por medida
   ===================================================================== */
console.log("\n== 3. Tiempo, peso corporal y records ==");
CFG.exercises.length = 0; WORKOUTS.length = 0; saveCfg(); saveWorkouts();
const exPlancha = findOrCreateExercise("Plancha");
const exDom = findOrCreateExercise("Dominadas");
const exBanca = findOrCreateExercise("Press banca");
saveCfg();
t("defaults: sin type es 'reps' y no es peso corporal", () => {
  assert.strictEqual(exType({}), "reps");
  assert.strictEqual(exIsTime({}), false);
  assert.strictEqual(exIsBw({}), false);
  assert.strictEqual(exType({ type: "tiempo" }), "tiempo");
  assert.strictEqual(exSeconds({}), 30, "default de segundos");
  assert.strictEqual(exSeconds({ seconds: 45 }), 45);
});
t("el record de un ejercicio de TIEMPO es el aguante mas largo", () => {
  WORKOUTS.push({ id: "w1", date: addDays(T, -3), type: "strength", name: "A", unit: "kg", sets: [
    { exName: "Plancha", exId: exPlancha.id, reps: "", weight: "", secs: 45 },
    { exName: "Plancha", exId: exPlancha.id, reps: "", weight: "", secs: 60 }] });
  saveWorkouts();
  const pr = exPRInfo(exPlancha.id);
  assert.ok(pr, "sin record");
  assert.strictEqual(pr.kind, "tiempo");
  assert.strictEqual(pr.value, 60, "no tomo el aguante mas largo");
  assert.strictEqual(pr.label, "1m");
  assert.strictEqual(exercisePR(exPlancha.id), null, "reporto un record de PESO para algo sin peso");
});
t("el record de un ejercicio de PESO CORPORAL son las reps mas altas", () => {
  WORKOUTS.push({ id: "w2", date: addDays(T, -2), type: "strength", name: "B", unit: "kg", sets: [
    { exName: "Dominadas", exId: exDom.id, reps: "8", weight: "" },
    { exName: "Dominadas", exId: exDom.id, reps: "11", weight: "" }] });
  saveWorkouts();
  const pr = exPRInfo(exDom.id);
  assert.strictEqual(pr.kind, "reps");
  assert.strictEqual(pr.value, 11, "no tomo las reps mas altas");
  assert.strictEqual(pr.label, "11 reps");
  assert.strictEqual(exercisePR(exDom.id), null, "reporto un record de PESO sin peso");
});
t("el record de un ejercicio normal sigue siendo el peso mas alto", () => {
  WORKOUTS.push({ id: "w3", date: addDays(T, -1), type: "strength", name: "C", unit: "kg", sets: [
    { exName: "Press banca", exId: exBanca.id, reps: "8", weight: "60" },
    { exName: "Press banca", exId: exBanca.id, reps: "6", weight: "72.5" }] });
  saveWorkouts();
  const pr = exPRInfo(exBanca.id);
  assert.strictEqual(pr.kind, "peso");
  assert.strictEqual(pr.value, 72.5);
  assert.strictEqual(exercisePR(exBanca.id).weight, 72.5);
});
t("lastPerf ve una serie por tiempo (sin peso ni reps)", () => {
  const lp = lastPerf(exPlancha.id);
  assert.ok(lp, "no encontro la ultima serie por tiempo");
  assert.strictEqual(lp.secs, 60);
});
t("Records incluye tiempo y peso corporal, no solo peso", () => {
  const nombres = allLoggedExercises().map(e => e.name).sort();
  assert.ok(nombres.indexOf("Plancha") >= 0, "dejo fuera un ejercicio de tiempo: " + nombres.join(","));
  assert.ok(nombres.indexOf("Dominadas") >= 0, "dejo fuera uno de peso corporal: " + nombres.join(","));
  assert.ok(nombres.indexOf("Press banca") >= 0, "dejo fuera uno de peso");
});
t("sin nada registrado no hay record", () => {
  const nuevo = findOrCreateExercise("Ejercicio sin datos"); saveCfg();
  assert.strictEqual(exPRInfo(nuevo.id), null);
});

/* =====================================================================
   4. El player entiende bloques y tiempo
   ===================================================================== */
console.log("\n== 4. Reproductor por bloques ==");
CFG.routines.length = 0;
CFG.routines.push(normalizeRoutine({ name: "Sesion completa", days: [], blocks: [
  { name: "Movilidad", kind: "calentamiento", exercises: [{ name: "Gato-camello", sets: 1, reps: "10", rest: 5 }] },
  { name: "Push", kind: "principal", exercises: [
    { name: "Press banca", sets: 2, reps: "8", rest: 5 },
    { name: "Dominadas", sets: 1, reps: "8", rest: 5, bodyweight: true }] },
  { name: "Abdomen", kind: "extra", exercises: [{ name: "Plancha", sets: 1, type: "tiempo", seconds: 40, rest: 5 }] },
  { name: "Cuello", kind: "extra", exercises: [{ name: "Extension cuello", sets: 1, reps: "12", rest: 5 }] },
  { name: "Respiracion", kind: "enfriamiento", exercises: [{ name: "Respirar", sets: 1, type: "tiempo", seconds: 30, rest: 0 }] }] }));
const RID = CFG.routines[0].id;
saveCfg();

t("el plan aplana los bloques conservando a cual pertenece cada paso", () => {
  const plan = buildPlan(CFG.routines[0]);
  assert.strictEqual(plan.length, 6, "pasos: " + plan.length);
  assert.deepStrictEqual(plan.map(s => s.bname), ["Movilidad", "Push", "Push", "Abdomen", "Cuello", "Respiracion"]);
  assert.deepStrictEqual(plan.map(s => s.bkind), ["calentamiento", "principal", "principal", "extra", "extra", "enfriamiento"]);
  assert.strictEqual(plan[1].n, 1); assert.strictEqual(plan[1].of, 2);
  assert.strictEqual(plan[2].n, 2);
});
t("terminar un ejercicio DENTRO del bloque es 'transition'", () => {
  beginWorkout(RID);
  const P = __getPLAYER();
  assert.ok(P, "no arranco");
  assert.strictEqual(P.plan.length, 6);
  // paso 0: unica serie del calentamiento -> siguiente paso es OTRO bloque
  set("plR", "10"); afterLastSet();
  assert.strictEqual(__getPLAYER().phase, "blockdone", "cerrar el calentamiento deberia marcar fin de bloque");
});
t("cambiar de bloque es 'blockdone' y NO arranca solo", () => {
  const P = __getPLAYER();
  assert.strictEqual(P.phase, "blockdone");
  assert.ok(els.modal.innerHTML.includes("bloque terminado"), "no lo dice");
  assert.ok(els.modal.innerHTML.includes("Empezar Push"), "no ofrece empezar el siguiente bloque");
  assert.strictEqual(P.ei, 0, "avanzo solo sin que se lo pidieran");
  continueNext();
  assert.strictEqual(__getPLAYER().ei, 1);
  assert.strictEqual(__getPLAYER().phase, "set");
});
t("dentro del bloque principal, entre ejercicios es 'transition'", () => {
  const P = __getPLAYER();
  set("plW", "60"); set("plR", "8"); startRest();     // serie 1 de 2
  skipRest();
  set("plW", "62"); set("plR", "8"); afterLastSet();  // ultima serie
  assert.strictEqual(__getPLAYER().phase, "transition", "dentro del bloque no deberia ser fin de bloque");
  continueNext();
});
t("un ejercicio de peso corporal no pide peso y registra solo reps", () => {
  const P = __getPLAYER();
  const ex = curEx(P);
  assert.strictEqual(ex.name, "Dominadas");
  assert.ok(exIsBw(ex));
  assert.ok(!els.modal.innerHTML.includes('id="plW"'), "pidio peso en un ejercicio de peso corporal");
  set("plR", "12"); afterLastSet();
  const s = P.log[P.log.length - 1];
  assert.strictEqual(s.weight, "", "guardo un peso");
  assert.strictEqual(s.reps, "12");
  assert.ok(P.prs.some(x => x.kind === "reps"), "no celebro record de reps");
});
t("un ejercicio de TIEMPO cuenta el trabajo y registra segundos", () => {
  continueNext();                      // entra al bloque Abdomen
  const P = __getPLAYER();
  assert.strictEqual(P.phase, "set");
  assert.strictEqual(curEx(P).name, "Plancha");
  assert.ok(els.modal.innerHTML.includes("Empezar 40s"), "no ofrece arrancar el tiempo");
  assert.ok(!els.modal.innerHTML.includes('id="plR"'), "pidio reps en un ejercicio por tiempo");
  startWork();
  assert.strictEqual(__getPLAYER().phase, "work");
  assert.ok(__getPLAYER().workEnd > Date.now(), "no puso fin de trabajo");
  // simula que se acabo el tiempo
  __getPLAYER().workEnd = Date.now() - 1000;
  tick();
  assert.strictEqual(__getPLAYER().phase, "workalarm", "no paso a la alarma de trabajo");
  finishWorkSet();
  const s = P.log[P.log.length - 1];
  assert.strictEqual(s.secs, 40, "no registro los segundos");
  assert.strictEqual(s.reps, "", "registro reps en un ejercicio por tiempo");
  assert.strictEqual(s.weight, "");
});
t("el cronometro de trabajo es por marca de tiempo (sobrevive segundo plano)", () => {
  continueNext();                      // Cuello
  set("plR", "12"); afterLastSet();
  continueNext();                      // Respiracion (enfriamiento)
  const P = __getPLAYER();
  assert.strictEqual(curEx(P).name, "Respirar");
  startWork();
  P.workEnd = Date.now() - 90 * 1000;   // como si la pantalla se hubiera bloqueado
  assert.strictEqual(workLeft(), 0, "el tiempo restante no sale del reloj");
  P.restNotified = true; workExpired();
  assert.strictEqual(P.phase, "workalarm");
  finishWorkSet();
  assert.strictEqual(P.phase, "done", "no llego al cierre");
});
t("el cierre resume bloques y records", () => {
  const h = els.modal.innerHTML;
  assert.ok(h.includes("¡Rutina terminada!"));
  assert.ok(/6 ejercicios en 5 bloques/.test(h), "no resume por bloques: " + (h.match(/\d+ ejercicios en \d+ bloques/) || [""])[0]);
  // Un mismo ejercicio que subio dos veces cuenta como UN record, no dos.
  const P = __getPLAYER();
  const nombres = (P.prs || []).map(x => x.name);
  const unicos = nombres.filter((v, i) => nombres.indexOf(v) === i);
  if (nombres.length > unicos.length) {
    const m = h.match(/(\d+) nuevos records/);
    assert.ok(m, "no muestra el conteo de records");
    assert.strictEqual(+m[1], unicos.length, "conto el mismo ejercicio dos veces");
    unicos.forEach(nm => {
      const veces = (h.split('<span>')[1] || "").split(nm).length - 1;
      assert.ok(veces <= 1, "listo " + nm + " mas de una vez");
    });
  }
});
t("guardar el entreno conserva los segundos de las series por tiempo", () => {
  finishWorkout();
  const w = WORKOUTS[WORKOUTS.length - 1];
  const conSecs = w.sets.filter(s => s.secs);
  assert.strictEqual(conSecs.length, 2, "no guardo las series por tiempo");
  assert.ok(w.sets.every(s => !!s.exId), "alguna serie sin exId");
  assert.strictEqual(exPRInfo(findOrCreateExercise("Plancha").id).kind, "tiempo");
});
t("en calentamiento y enfriamiento NO se celebran records", () => {
  // El plan demo arranca en calentamiento: la primera serie seria un "record"
  // por ser la primera vez, pero ahi es ruido.
  const rid2 = CFG.routines[0].id;
  cleanupPlayer(); clearActive();
  beginWorkout(rid2);
  const P2 = __getPLAYER();
  assert.strictEqual(planStep(P2).bkind, "calentamiento");
  set("plR", "10"); logCurrentSet();
  assert.strictEqual(P2.pr, null, "celebro un record en el calentamiento");
  assert.strictEqual((P2.prs || []).length, 0);
  cleanupPlayer(); clearActive();
});

/* =====================================================================
   5. Los tres arreglos pendientes
   ===================================================================== */
console.log("\n== 5. Unidad normalizada, editar serie, fecha futura ==");
t("'usd' y 'USD' son la MISMA unidad", () => {
  BIZ.leads.length = 0;
  BIZ.leads.push({ id: "l1", name: "A", stage: "nuevo", value: 100, unit: "USD", stageAt: Date.now(), updatedAt: Date.now() });
  BIZ.leads.push({ id: "l2", name: "B", stage: "nuevo", value: 50, unit: "usd", stageAt: Date.now(), updatedAt: Date.now() });
  BIZ.leads.push({ id: "l3", name: "C", stage: "nuevo", value: 25, unit: " Usd ", stageAt: Date.now(), updatedAt: Date.now() });
  saveBiz();
  const tot = leadUnitTotals(BIZ.leads);
  assert.strictEqual(tot.length, 1, "abrio " + tot.length + " cubetas para la misma moneda");
  assert.strictEqual(tot[0].sum, 175);
  assert.strictEqual(unitKey("USD"), unitKey(" usd "));
});
t("MXN y USD siguen separadas", () => {
  BIZ.leads.push({ id: "l4", name: "D", stage: "nuevo", value: 1000, unit: "MXN", stageAt: Date.now(), updatedAt: Date.now() });
  saveBiz();
  const tot = leadUnitTotals(BIZ.leads);
  assert.strictEqual(tot.length, 2);
  assert.ok(!tot.some(x => x.sum === 1175), "sumo monedas distintas");
});
t("al escribir una grafia nueva se reusa la que ya tenias", () => {
  assert.strictEqual(canonicalLeadUnit("usd"), "USD", "no reuso la grafia existente");
  assert.strictEqual(canonicalLeadUnit("EUR"), "EUR", "cambio una unidad nueva");
  assert.strictEqual(canonicalLeadUnit("  "), "");
  const ks = knownLeadUnits().map(x => x.label);
  assert.ok(ks.indexOf("USD") >= 0 && ks.indexOf("MXN") >= 0, "no lista las unidades usadas");
});
t("una serie del alta manual se puede EDITAR", () => {
  WORKOUTS.length = 0; saveWorkouts();
  openManualWorkout(addDays(T, -1));
  openMwSet(); set("mwEx", "Press banca"); set("mwW", "60"); set("mwR", "8"); set("mwS", ""); set("mwN", 2); addMwSet();
  openMwEdit(0);
  assert.ok(els.modal.innerHTML.includes("Editar serie"), "no abrio el editor de serie");
  set("meW", "65"); set("meR", "6"); set("meS", "");
  saveMwEdit(0);
  saveManualWorkout();
  const w = WORKOUTS[WORKOUTS.length - 1];
  assert.strictEqual(w.sets[0].weight, "65", "no guardo la correccion");
  assert.strictEqual(w.sets[0].reps, "6");
  assert.strictEqual(w.sets[1].weight, "60", "toco la serie equivocada");
});
t("una fecha futura se RECHAZA, no se reescribe", () => {
  assert.strictEqual(validPast("2099-01-01"), null);
  assert.strictEqual(validPast(""), null);
  assert.strictEqual(validPast(addDays(T, -1)), addDays(T, -1));
  assert.strictEqual(isFutureDate("2099-01-01"), true);
  assert.strictEqual(isFutureDate(T), false);
  const antes = WORKOUTS.length;
  openManualWorkout(T);
  openMwSet(); set("mwEx", "Sentadilla"); set("mwW", "80"); set("mwR", "5"); set("mwS", ""); set("mwN", 1); addMwSet();
  mwSetDate("2099-06-01");
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes, "guardo un entreno con fecha futura");
  assert.ok(els.modal.innerHTML.includes("aún no llega"), "no avisa por que no guardo");
  // con una fecha valida si guarda
  mwSetDate(addDays(T, -2));
  saveManualWorkout();
  assert.strictEqual(WORKOUTS.length, antes + 1, "no guardo con fecha valida");
  assert.strictEqual(WORKOUTS[WORKOUTS.length - 1].date, addDays(T, -2));
});

console.log("\n" + n + " pruebas OK\n");
