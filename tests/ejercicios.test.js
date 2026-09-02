const assert = require("assert");
const { ROOT } = require("./harness");
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }
const snap = () => JSON.stringify({ c: CFG, w: WORKOUTS });

function reset() {
  CFG.exercises.length = 0;
  CFG.exDismissed.length = 0;
  CFG.routines.length = 0;
  WORKOUTS.length = 0;
}

/* =====================================================================
   1. exKey: la clave de comparación
   ===================================================================== */
console.log("\n== 1. exKey normaliza acentos, mayusculas, espacios y puntuacion ==");
t("acentos, mayusculas y espacios de mas colapsan a la misma clave", () => {
  assert.strictEqual(exKey("Préss  DE  Pecho"), "press de pecho");
  assert.strictEqual(exKey("press de pecho "), "press de pecho");
  assert.strictEqual(exKey("PRESS DE PECHO"), "press de pecho");
  assert.strictEqual(exKey("Press-de-Pecho!"), "press de pecho");
});
t("nombres distintos siguen dando claves distintas", () => {
  assert.notStrictEqual(exKey("Press banca"), exKey("Press militar"));
});

/* =====================================================================
   2. Migración: catálogo desde rutinas + historial, sin perder nada
   ===================================================================== */
console.log("\n== 2. Migracion no destructiva ==");
reset();
CFG.routines.push({
  id: "rt1", name: "Push A", days: ["lunes"],
  exercises: [
    { id: "e1", name: "Press banca", sets: 4, reps: "8", rest: 120, weight: "", note: "" },
    { id: "e2", name: "Press de pecho", sets: 3, reps: "10", rest: 90, weight: "", note: "" }
  ]
});
WORKOUTS.push(
  { id: "w1", date: "2026-08-01", activityId: "gym", type: "strength", routineId: "rt1", name: "Push A",
    duration: 2400, volume: 100, unit: "kg",
    sets: [{ exName: "Press banca", reps: "8", weight: "60" }, { exName: "Press banca", reps: "8", weight: "62" }] },
  { id: "w2", date: "2026-08-05", activityId: "gym", type: "strength", routineId: "rt1", name: "Push A",
    duration: 2400, volume: 100, unit: "kg",
    sets: [{ exName: "Press pecho", reps: "10", weight: "40" }] },
  { id: "w3", date: "2026-08-06", activityId: "box", type: "class", name: "Box", duration: 60, intensity: 8, notes: "" }
);
const setsAntes = WORKOUTS.reduce((a, w) => a + (w.sets || []).length, 0);
const workoutsAntes = WORKOUTS.length;
const nombresAntes = WORKOUTS.map(w => (w.sets || []).map(s => s.exName).join("|")).join("//");

t("construye el catalogo desde rutinas Y desde el historial", () => {
  const res = migrateExercises();
  // Press banca, Press de pecho (rutina) + Press pecho (historial, grafia distinta)
  assert.strictEqual(res.entries, 3, "catalogo con " + res.entries + " entradas");
  assert.ok(exFind("Press banca"), "falta Press banca");
  assert.ok(exFind("Press de pecho"), "falta Press de pecho");
  assert.ok(exFind("Press pecho"), "falta Press pecho");
});
t("asigna exId a cada ejercicio de rutina y a cada serie", () => {
  CFG.routines[0].exercises.forEach(e => assert.ok(e.exId, "ejercicio de rutina sin exId: " + e.name));
  WORKOUTS.forEach(w => (w.sets || []).forEach(s => assert.ok(s.exId, "serie sin exId: " + s.exName)));
});
t("NO pierde entrenos ni series, y conserva exName intacto", () => {
  assert.strictEqual(WORKOUTS.length, workoutsAntes, "se perdio un entreno");
  assert.strictEqual(WORKOUTS.reduce((a, w) => a + (w.sets || []).length, 0), setsAntes, "se perdio una serie");
  assert.strictEqual(WORKOUTS.map(w => (w.sets || []).map(s => s.exName).join("|")).join("//"), nombresAntes,
    "se reescribio algun exName");
});
t("la sesion de clase (sin sets) sobrevive intacta", () => {
  const w3 = WORKOUTS.find(w => w.id === "w3");
  assert.ok(w3, "se perdio la clase");
  assert.strictEqual(w3.sets, undefined);
});
t("correrla DOS veces no cambia nada la segunda vez", () => {
  const antes = snap();
  const res = migrateExercises();
  assert.strictEqual(res.cfgDirty, false, "la 2a corrida ensucio CFG");
  assert.strictEqual(res.wDirty, false, "la 2a corrida ensucio WORKOUTS");
  assert.strictEqual(snap(), antes, "la 2a corrida cambio el estado");
  migrateExercises();
  assert.strictEqual(snap(), antes, "la 3a corrida cambio el estado");
});

/* =====================================================================
   3. Importar: mismas grafías -> mismo exId (el objetivo central)
   ===================================================================== */
console.log("\n== 3. Importar una rutina no crea duplicados ==");
t("acentos / mayusculas / espacios de mas reusan el MISMO exId", () => {
  const idBanca = exFind("Press banca").id;
  const antes = CFG.exercises.length;
  const r = normalizeRoutine({
    name: "Push A (reimportada)",
    exercises: [
      { name: "PRESS BANCA", sets: 4, reps: "8", rest: 120 },
      { name: "  press   banca  ", sets: 3, reps: "10", rest: 90 },
      { name: "Préss bánca", sets: 3, reps: "10", rest: 90 }
    ]
  });
  assert.ok(r, "no normalizo la rutina");
  // normalizeRoutine ahora devuelve bloques: se aplana para comprobarlo.
  routineExercises(r).forEach(e => assert.strictEqual(e.exId, idBanca, "creo un id nuevo para " + e.name));
  assert.strictEqual(CFG.exercises.length, antes, "el catalogo crecio: se crearon duplicados");
});
t("el nombre mostrado queda en el canonico, no en la grafia importada", () => {
  const r = normalizeRoutine({ name: "X", exercises: [{ name: "PRESS BANCA", sets: 1, reps: "1", rest: 0 }] });
  assert.strictEqual(routineExercises(r)[0].name, "Press banca");
});
t("un nombre realmente nuevo SI crea entrada", () => {
  const antes = CFG.exercises.length;
  const r = normalizeRoutine({ name: "Y", exercises: [{ name: "Remo con barra", sets: 3, reps: "10", rest: 90 }] });
  assert.strictEqual(CFG.exercises.length, antes + 1);
  assert.ok(routineExercises(r)[0].exId);
});
t("importar por un ALIAS tambien reusa el id", () => {
  const ex = exFind("Remo con barra");
  addAlias(ex, "Remo barra");
  const r = normalizeRoutine({ name: "Z", exercises: [{ name: "REMO BARRA", sets: 3, reps: "10", rest: 90 }] });
  assert.strictEqual(routineExercises(r)[0].exId, ex.id, "el alias no resolvio");
});

/* =====================================================================
   4. Agregación por exId
   ===================================================================== */
console.log("\n== 4. PR y ultima marca agregan por exId ==");
t("exercisePR usa el id, no el texto", () => {
  const id = exFind("Press banca").id;
  const pr = exercisePR(id);
  assert.ok(pr, "sin PR");
  assert.strictEqual(pr.weight, 62);
  assert.strictEqual(pr.date, "2026-08-01");
});
t("exercisePR sigue aceptando un nombre (compatibilidad)", () => {
  assert.strictEqual(exercisePR("Press banca").weight, 62);
  assert.strictEqual(exercisePR("PRESS BANCA").weight, 62, "no resolvio por grafia");
});
t("lastPerf devuelve la ultima serie de ese ejercicio", () => {
  const lp = lastPerf(exFind("Press banca").id);
  assert.strictEqual(lp.weight, "62");
  assert.strictEqual(lp.date, "2026-08-01");
});
t("allLoggedExercises devuelve entradas del catalogo con peso", () => {
  const list = allLoggedExercises();
  const names = list.map(e => e.name).sort();
  assert.deepStrictEqual(names, ["Press banca", "Press pecho"], "obtuve " + names.join(","));
});
t("una serie heredada SIN exId se resuelve por nombre", () => {
  const id = exFind("Press banca").id;
  WORKOUTS.push({ id: "wLeg", date: "2026-08-10", activityId: "gym", type: "strength", name: "Legacy",
    duration: 0, volume: 0, unit: "kg", sets: [{ exName: "press  BANCA", reps: "5", weight: "70" }] });
  assert.strictEqual(setExId(WORKOUTS[WORKOUTS.length - 1].sets[0]), id, "no resolvio la serie heredada");
  assert.strictEqual(exercisePR(id).weight, 70, "el PR ignoro la serie heredada");
  WORKOUTS.pop();
});

/* =====================================================================
   5. Fusionar: un solo record tras unir dos grafías
   ===================================================================== */
console.log("\n== 5. Fusionar unifica el historial ==");
t("antes de fusionar, 'Press de pecho' y 'Press pecho' estan separados", () => {
  const a = exFind("Press de pecho"), b = exFind("Press pecho");
  assert.notStrictEqual(a.id, b.id, "ya estaban unidos");
  assert.strictEqual(exercisePR(a.id), null, "la rutina no deberia tener series");
  assert.strictEqual(exercisePR(b.id).weight, 40);
});
t("mergeExercises unifica series, rutinas y alias", () => {
  const keep = exFind("Press de pecho"), drop = exFind("Press pecho");
  const keepId = keep.id, dropId = drop.id;
  const setsAntes = WORKOUTS.reduce((a, w) => a + (w.sets || []).length, 0);
  assert.strictEqual(mergeExercises(keepId, dropId), true);
  assert.strictEqual(exById(dropId), null, "la entrada perdedora sigue en el catalogo");
  assert.ok(exFind("Press pecho"), "el nombre perdido no quedo como alias");
  assert.strictEqual(exFind("Press pecho").id, keepId, "el alias no apunta al superviviente");
  assert.strictEqual(WORKOUTS.reduce((a, w) => a + (w.sets || []).length, 0), setsAntes, "se perdio una serie al fusionar");
});
t("exercisePR devuelve UN record unificado tras la fusion", () => {
  const id = exFind("Press de pecho").id;
  const pr = exercisePR(id);
  assert.ok(pr, "sin PR tras fusionar");
  assert.strictEqual(pr.weight, 40, "el PR no heredo el historial del otro nombre");
  assert.strictEqual(exercisePR("Press pecho").weight, 40, "consultar por el alias no da el mismo PR");
  assert.strictEqual(exercisePR("PRESS  PECHO").weight, 40);
});
t("la rutina quedo apuntando al id superviviente", () => {
  const id = exFind("Press de pecho").id;
  assert.strictEqual(routineExercises(CFG.routines[0])[1].exId, id);
});

/* =====================================================================
   6. Renombrar preserva el historial
   ===================================================================== */
console.log("\n== 6. Renombrar no rompe el historial ==");
t("renombrar conserva PR, sesiones e id", () => {
  const id = exFind("Press banca").id;
  const prAntes = exercisePR(id), sesAntes = exSessions(id).length;
  assert.strictEqual(renameExercise(id, "Press de banca plano"), true);
  assert.strictEqual(exById(id).name, "Press de banca plano");
  assert.deepStrictEqual(exercisePR(id), prAntes, "el PR cambio al renombrar");
  assert.strictEqual(exSessions(id).length, sesAntes, "se perdieron sesiones");
});
t("el nombre viejo queda como alias y sigue resolviendo", () => {
  const id = exFind("Press de banca plano").id;
  assert.strictEqual(exFind("Press banca").id, id, "el nombre viejo dejo de resolver");
  assert.strictEqual(exercisePR("Press banca").weight, 62);
});
t("renombrar a un nombre que ya existe se rechaza", () => {
  const id = exFind("Press de banca plano").id;
  assert.strictEqual(renameExercise(id, "Press de pecho"), "clash");
  assert.strictEqual(exById(id).name, "Press de banca plano", "renombro pese al choque");
});
t("renombrar a vacio se rechaza", () => {
  const id = exFind("Press de banca plano").id;
  assert.strictEqual(renameExercise(id, "   "), false);
});

/* =====================================================================
   7. Detección de duplicados
   ===================================================================== */
console.log("\n== 7. Deteccion de duplicados ==");
t("propone variantes del mismo ejercicio", () => {
  reset();
  ["Press de pecho", "Press pecho", "Sentadilla", "Sentadillas", "Curl de biceps", "Curl biceps"]
    .forEach(findOrCreateExercise);
  const c = dupCandidates();
  const pares = c.map(x => [x.a.name, x.b.name].sort().join(" ~ ")).sort();
  assert.ok(pares.indexOf("Press de pecho ~ Press pecho") >= 0, "no detecto press: " + pares.join(" | "));
  assert.ok(pares.indexOf("Sentadilla ~ Sentadillas") >= 0, "no detecto sentadilla: " + pares.join(" | "));
  assert.ok(pares.indexOf("Curl biceps ~ Curl de biceps") >= 0, "no detecto curl: " + pares.join(" | "));
});
t("NO propone ejercicios genuinamente distintos", () => {
  reset();
  ["Press banca", "Press militar", "Press banca inclinado", "Peso muerto", "Peso muerto rumano", "Remo con barra"]
    .forEach(findOrCreateExercise);
  const pares = dupCandidates().map(x => [x.a.name, x.b.name].sort().join(" ~ "));
  assert.strictEqual(pares.length, 0, "falsos positivos: " + pares.join(" | "));
});
t("NO propone los falsos positivos que salieron en los datos reales", () => {
  reset();
  ["Enfriamiento · Estiramientos (PUSH)", "Enfriamiento · Estiramientos (PULL)",
   "Enfriamiento · Estiramientos (LEGS)",
   "Calentamiento · Activación de pierna (LEGS)", "Calentamiento · Activación de cadera (LEGS)",
   "Remo en máquina (apoyado)", "Remo en máquina pesado",
   "Pantorrilla · Elevación de talón de pie", "Pantorrilla · Elevación de talón en prensa",
   "Pantorrilla · Elevación de talón sentado"].forEach(findOrCreateExercise);
  const pares = dupCandidates().map(x => [x.a.name, x.b.name].join(" ~ "));
  assert.strictEqual(pares.length, 0, "falsos positivos reales: " + pares.join(" | "));
});
t("SI propone una errata de una sola letra", () => {
  reset();
  findOrCreateExercise("Press banca"); findOrCreateExercise("Press banka");
  assert.strictEqual(dupCandidates().length, 1, "no detecto la errata");
});
t("un par rechazado no vuelve a proponerse", () => {
  reset();
  const a = findOrCreateExercise("Sentadilla"), b = findOrCreateExercise("Sentadillas");
  assert.strictEqual(dupCandidates().length, 1);
  CFG.exDismissed.push(dupPairKey(a.id, b.id));
  assert.strictEqual(dupCandidates().length, 0, "el par rechazado volvio");
});
t("grafias que solo difieren en acento/espacio NI SIQUIERA generan dos entradas", () => {
  reset();
  const a = findOrCreateExercise("Press pecho");
  const b = findOrCreateExercise("  PRESS   PÉCHO  ");
  assert.strictEqual(a.id, b.id, "creo dos entradas para la misma grafia normalizada");
  assert.strictEqual(CFG.exercises.length, 1);
});
t("el alias tambien delata el duplicado", () => {
  reset();
  const a = findOrCreateExercise("Jalon al pecho");
  addAlias(a, "Sentadilla frontal");
  findOrCreateExercise("Sentadillas frontales");
  assert.ok(dupCandidates().length >= 1, "el alias no disparo la deteccion");
});

/* =====================================================================
   8. Progresión y sesiones
   ===================================================================== */
console.log("\n== 8. Detalle: sesiones y progresion ==");
t("exSessions agrupa por sesion, mas reciente primero", () => {
  reset();
  const ex = findOrCreateExercise("Press banca");
  WORKOUTS.push(
    { id: "a", date: "2026-08-01", type: "strength", name: "A", unit: "kg",
      sets: [{ exName: "Press banca", exId: ex.id, reps: "8", weight: "60" }, { exName: "Press banca", exId: ex.id, reps: "8", weight: "62" }] },
    { id: "b", date: "2026-08-08", type: "strength", name: "B", unit: "kg",
      sets: [{ exName: "Press banca", exId: ex.id, reps: "8", weight: "65" }] }
  );
  const g = exSessions(ex.id);
  assert.strictEqual(g.length, 2);
  assert.strictEqual(g[0].w.date, "2026-08-08", "no ordeno por fecha desc");
  assert.strictEqual(g[1].sets.length, 2);
});
t("exProgress da el mejor peso por sesion, en orden cronologico", () => {
  const ex = exFind("Press banca");
  const p = exProgress(ex.id);
  assert.deepStrictEqual(p, [{ date: "2026-08-01", weight: 62 }, { date: "2026-08-08", weight: 65 }]);
});

/* =====================================================================
   9. La vista de Workouts se pinta y no trae emojis
   ===================================================================== */
console.log("\n== 9. Render ==");
t("renderWorkouts pinta Records, Ejercicios y el detalle abre", () => {
  __setVIEW("workouts");
  renderWorkouts();
  const h = global.__els.app.innerHTML;
  assert.ok(h.includes("Records"), "falta Records");
  assert.ok(h.includes("Ejercicios"), "falta la seccion Ejercicios");
  assert.ok(h.includes("openExerciseDetail("), "las filas no abren el detalle");
  const ex = exFind("Press banca");
  openExerciseDetail(ex.id);
  const m = global.__els.modal.innerHTML;
  assert.ok(m.includes("Press banca"), "el detalle no muestra el nombre");
  assert.ok(m.includes("Renombrar"), "falta renombrar");
  assert.ok(m.includes("Unir con otro"), "falta unir");
  assert.ok(m.includes("exchart"), "falta la grafica de progresion");
});
t("la tarjeta de duplicados aparece solo si hay candidatos", () => {
  reset();
  assert.strictEqual(dupPrompt(), "", "propone duplicados sin catalogo");
  findOrCreateExercise("Sentadilla"); findOrCreateExercise("Sentadillas");
  const p = dupPrompt();
  assert.ok(p.includes("Posibles duplicados"), "no salio la tarjeta");
  assert.ok(p.includes("openMergeChoice("), "no ofrece unir");
  assert.ok(p.includes("rejectDupPair("), "no ofrece rechazar");
});

console.log("\n" + n + " pruebas OK\n");
