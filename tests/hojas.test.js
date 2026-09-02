/* La garantia estructural: NINGUNA hoja puede quedarse sin ranura de aviso,
   y NINGUN boton principal puede abortar en silencio.

   Estas pruebas fallan si alguien agrega una hoja nueva por fuera de sheet(),
   escribe la ranura a mano, o pone un boton principal sin onclick. No prueban
   una convencion: prueban que la convencion ya no hace falta. */
const assert = require("assert");
const fs = require("fs"), path = require("path");
const { ROOT } = require("./harness");
const els = global.__els;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }

const SRC = {
  "js/app.js": fs.readFileSync(path.join(ROOT, "js/app.js"), "utf8"),
  "js/gym.js": fs.readFileSync(path.join(ROOT, "js/gym.js"), "utf8")
};
/* Para los escaneos de fuente hay que sacar el cuerpo de armSheet: ahi viven
   a proposito las cadenas `<button class="btn p` y `class="fmsg"` que el
   resto del codigo tiene prohibidas. Es el framework, no un caso de uso. */
function stripFn(s, name) {
  const i = s.indexOf("function " + name + "(");
  if (i < 0) return s;
  const j = s.indexOf("\n}", i);
  return s.slice(0, i) + s.slice(j + 2);
}
const SCAN = {};
Object.keys(SRC).forEach(f => { SCAN[f] = stripFn(SRC[f], "armSheet"); });

const set = (id, v) => { document.getElementById(id).value = v == null ? "" : String(v); };
const T = today();
const slotAt = h => h.indexOf(`id="${FMSG_ID}"`);
const primAt = h => h.indexOf(`<button class="btn p`);

/* =====================================================================
   1. armSheet: la ranura no es del autor de la hoja
   ===================================================================== */
console.log("\n== 1. armSheet siempre pone la ranura ==");

t("mete la ranura JUSTO ENCIMA del boton principal", () => {
  const h = armSheet(`<h3>X</h3><input id="a"><button class="btn p" onclick="guardar()">Guardar</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
  assert.ok(slotAt(h) > -1, "no puso ranura");
  assert.ok(slotAt(h) < primAt(h), "la ranura quedo DEBAJO del boton principal");
  assert.ok(h.indexOf("<h3>X</h3>") < slotAt(h), "la ranura quedo antes del contenido");
});

t("una sola ranura, aunque haya varios botones principales", () => {
  const h = armSheet(`<button class="btn p" onclick="a()">A</button><button class="btn p" onclick="b()">B</button>`);
  assert.strictEqual(h.split(`id="${FMSG_ID}"`).length - 1, 1, "puso mas de una ranura");
});

t("sin boton principal la pone encima del primer boton que haya", () => {
  const h = armSheet(`<h3>Info</h3><button class="btn g" onclick="closeModal()">Cerrar</button>`);
  assert.ok(slotAt(h) > -1 && slotAt(h) < h.indexOf(`<button class="btn g`), "mal colocada");
});

t("sin botones tampoco revienta", () => {
  const h = armSheet(`<h3>Solo texto</h3>`);
  assert.ok(slotAt(h) > -1, "no puso ranura");
});

t("el aviso pendiente sobrevive al re-render (segundo parametro)", () => {
  const h = armSheet(`<button class="btn p" onclick="g()">Guardar</button>`, "Falta el nombre");
  assert.ok(/ferr/.test(h) && /Falta el nombre/.test(h), "no pinto el aviso que venia del estado");
});

t("el aviso pendiente se escapa: no se puede inyectar HTML", () => {
  const h = armSheet(`<button class="btn p" onclick="g()">G</button>`, `<img src=x onerror="hack()">`);
  assert.ok(!/<img/.test(h), "metio HTML crudo del mensaje");
  assert.ok(/&lt;img/.test(h), "no escapo el mensaje");
});

/* =====================================================================
   2. armSheet: todo boton principal pasa por submitSheet
   ===================================================================== */
console.log("\n== 2. Los botones principales van enrutados ==");

t("enruta el onclick por submitSheet", () => {
  const h = armSheet(`<button class="btn p" onclick="saveTask()">Agregar</button>`);
  assert.ok(/onclick="submitSheet\(function\(\)\{return saveTask\(\)\}\)"/.test(h), h);
});

t("respeta los argumentos con comillas simples", () => {
  const h = armSheet(`<button class="btn p" onclick="saveLead('lg_1')">Guardar</button>`);
  assert.ok(h.includes(`return saveLead('lg_1')`), h);
});

t("respeta atributos entre class y onclick, y la clase .off", () => {
  const h = armSheet(`<button class="btn p off" style="background:var(--bad)" onclick="del('x')">Borrar</button>`);
  assert.ok(h.includes(`class="btn p off"`), "perdio la clase off");
  assert.ok(h.includes(`style="background:var(--bad)"`), "perdio el estilo");
  assert.ok(h.includes(`submitSheet(function(){return del('x')})`), h);
});

t("NO enruta los botones secundarios", () => {
  const h = armSheet(`<button class="btn p" onclick="a()">A</button><button class="btn g" onclick="closeModal()">Cancelar</button>`);
  assert.ok(h.includes(`<button class="btn g" onclick="closeModal()"`), "toco un boton secundario");
});

t("no enruta dos veces si ya venia armado", () => {
  const una = armSheet(`<button class="btn p" onclick="a()">A</button>`);
  const dos = armSheet(una);
  assert.strictEqual(dos.split("submitSheet(").length - 1, 1, "doble envoltura");
});

t("armar dos veces NO mete dos ranuras", () => {
  const una = armSheet(`<h3>X</h3><button class="btn p" onclick="a()">A</button>`);
  const dos = armSheet(una);
  assert.strictEqual(dos.split(`id="${FMSG_ID}"`).length - 1, 1, "metio una segunda ranura");
});

t("armar dos veces conserva el aviso de la primera", () => {
  const una = armSheet(`<button class="btn p" onclick="a()">A</button>`, "Falta el nombre");
  const dos = armSheet(una);
  assert.ok(/Falta el nombre/.test(dos), "perdio el aviso al re-armar");
  assert.strictEqual(dos.split("ferr").length - 1, 1, "duplico el aviso");
});

t("le quita disabled: un boton principal SIEMPRE se puede tocar", () => {
  const h = armSheet(`<button class="btn p off" disabled onclick="g()">Guardar</button>`);
  assert.ok(!/disabled/.test(h), "dejo el disabled: entonces no puede explicar que falta");
  assert.ok(h.includes("submitSheet("), "y encima lo dejo sin enrutar");
});

/* =====================================================================
   3. submitSheet: el silencio es imposible
   ===================================================================== */
console.log("\n== 3. submitSheet no deja abortar en silencio ==");

t("un handler mudo produce un aviso generico", () => {
  els.modal.innerHTML = "<div class='sheet'>igual que antes</div>";
  clearFormError();
  submitSheet(function () { /* aborta sin decir nada */ });
  assert.ok(/ferr/.test(formErrorText()), "dejo la hoja en silencio");
  assert.ok(formErrorText().includes("No se pudo guardar"), formErrorText());
});

t("si el handler SI explico, respeta su mensaje", () => {
  els.modal.innerHTML = "<div class='sheet'>igual que antes</div>";
  clearFormError();
  submitSheet(function () { return formError("Ponle nombre al prospecto"); });
  assert.ok(formErrorText().includes("Ponle nombre al prospecto"), formErrorText());
  assert.ok(!formErrorText().includes("No se pudo guardar"), "piso el mensaje del handler");
});

t("si el handler cerro la hoja, no inventa un aviso", () => {
  els.modal.innerHTML = "<div class='sheet'>algo</div>";
  clearFormError();
  submitSheet(function () { closeModal(); });
  assert.strictEqual(formErrorText(), "", "aviso falso sobre un guardado que si funciono");
});

t("si el handler repinto la hoja, no inventa un aviso", () => {
  els.modal.innerHTML = "<div class='sheet'>v1</div>";
  clearFormError();
  submitSheet(function () { els.modal.innerHTML = "<div class='sheet'>v2</div>"; });
  assert.strictEqual(formErrorText(), "", "aviso falso sobre un re-render");
});

t("limpia el aviso anterior antes de correr el handler", () => {
  els.modal.innerHTML = "<div class='sheet'>x</div>";
  formError("aviso viejo");
  submitSheet(function () { els.modal.innerHTML = "<div class='sheet'>y</div>"; });
  assert.strictEqual(formErrorText(), "", "dejo pegado el aviso de la vez pasada");
});

t("devuelve lo que devolvio el handler", () => {
  els.modal.innerHTML = "<div class='sheet'>z</div>";
  assert.strictEqual(submitSheet(function () { closeModal(); return 42; }), 42);
});

/* =====================================================================
   4. El codigo fuente no puede saltarse el framework
   ===================================================================== */
console.log("\n== 4. Nadie se salta sheet() ==");

/* El player y la vista de meta son otros overlays (.player, .goalview) y no
   llevan ranura: no son formularios. Por eso la regla es mas fina que "nadie
   escribe modal.innerHTML": lo que se prohibe es pintar una .sheet por fuera
   de sheet(), porque ahi es donde entra la ranura. */
t("nadie pinta una .sheet por fuera de sheet()", () => {
  const malos = [];
  Object.keys(SRC).forEach(f => {
    SRC[f].split("\n").forEach((ln, i) => {
      if (!/class="sheet"/.test(ln)) return;
      if (/^function sheet\(/.test(ln)) return;
      malos.push(f + ":" + (i + 1) + "  " + ln.trim().slice(0, 90));
    });
  });
  assert.strictEqual(malos.length, 0,
    "hay hojas pintadas por fuera de sheet(), que es donde se pone la ranura:\n" + malos.join("\n"));
});

t("los overlays que SI escriben modal.innerHTML son los dos conocidos", () => {
  const otros = [];
  Object.keys(SRC).forEach(f => {
    SRC[f].split("\n").forEach((ln, i) => {
      if (!/modal\.innerHTML\s*=[^=]/.test(ln)) return;
      if (/^function (sheet|closeModal)\(/.test(ln)) return;
      otros.push(f + ":" + (i + 1) + "  " + ln.trim().slice(0, 60));
    });
  });
  /* Solo renderPlayer (.player) y la vista de meta (.goalview). Si aparece un
     tercero hay que mirarlo: puede ser una hoja disfrazada, sin ranura. */
  assert.strictEqual(otros.length, 2, "overlays inesperados:\n" + otros.join("\n"));
});

t("nadie escribe la ranura a mano", () => {
  const malos = [];
  Object.keys(SCAN).forEach(f => {
    SCAN[f].split("\n").forEach((ln, i) => {
      if (/class="fmsg"/.test(ln)) malos.push(f + "  " + ln.trim().slice(0, 90));
    });
  });
  assert.strictEqual(malos.length, 0, "ranuras escritas a mano:\n" + malos.join("\n"));
});

t("formSlot ya no existe: no hay dos maneras de hacerlo", () => {
  Object.keys(SRC).forEach(f => {
    assert.ok(!/formSlot/.test(SRC[f]), f + " todavia usa formSlot");
  });
  assert.strictEqual(typeof global.formSlot, "undefined", "formSlot sigue definido");
});

t("todo boton principal del codigo tiene onclick (si no, no se puede enrutar)", () => {
  const malos = [];
  Object.keys(SCAN).forEach(f => {
    const re = /<button class="btn p[^"]*"([^>]*)>/g;
    let m;
    while ((m = re.exec(SCAN[f]))) {
      if (!/onclick="/.test(m[1])) {
        malos.push(f + "  " + m[0].slice(0, 90));
      }
    }
  });
  assert.strictEqual(malos.length, 0, "botones principales sin onclick:\n" + malos.join("\n"));
});

/* armSheet reconoce los botones principales por `<button class="btn p`. Si
   alguien pone la clase en otro orden de atributos, el boton se queda SIN
   enrutar y sin que nadie se entere. Esta prueba fija la forma canonica. */
t("todo boton principal se escribe en la forma que armSheet reconoce", () => {
  const malos = [];
  Object.keys(SCAN).forEach(f => {
    const re = /class="btn p/g;
    let m;
    while ((m = re.exec(SCAN[f]))) {
      const antes = SCAN[f].slice(Math.max(0, m.index - 8), m.index);
      if (antes !== "<button ") malos.push(f + "  ..." + SCAN[f].slice(m.index - 20, m.index + 40));
    }
  });
  assert.strictEqual(malos.length, 0,
    'la clase "btn p" tiene que ir pegada a <button (primer atributo):\n' + malos.join("\n"));
});

t("un boton principal fuera de forma NO se enruta (por eso existe la de arriba)", () => {
  const h = armSheet(`<button onclick="g()" class="btn p">Guardar</button>`);
  assert.ok(!h.includes("submitSheet("), "si esto cambia, relaja la prueba anterior");
});

/* El limite honesto de la garantia: cubre HOJAS. Las dos revisiones semanales
   se pintan inline en la pagina (dentro de un `sec`), no en una hoja, asi que
   armSheet no las toca. Hoy da igual porque guardan siempre (no pueden
   negarse), pero si aparece un tercer formulario inline hay que mirarlo: ahi
   la red de seguridad NO existe. */
t("los formularios inline (fuera de hoja) son solo los dos conocidos", () => {
  const inline = [];
  Object.keys(SCAN).forEach(f => {
    const s = SCAN[f];
    let i = 0;
    while ((i = s.indexOf(`<button class="btn p`, i)) > -1) {
      const head = s.lastIndexOf("\nfunction ", i);
      const fin = s.indexOf("\nfunction ", i);
      const cuerpo = s.slice(head, fin < 0 ? s.length : fin);
      const m = /\nfunction (\w+)/.exec(cuerpo);
      if (m && cuerpo.indexOf("sheet(`") < 0) inline.push(m[1]);
      i += 10;
    }
  });
  assert.deepStrictEqual([...new Set(inline)].sort(), ["bizReviewSection", "reviewSection"],
    "hay un formulario inline nuevo, fuera de la garantia de sheet(): " + inline.join(", "));
});

t("ningun handler usa su propia area de mensajes ad-hoc", () => {
  const malos = [];
  Object.keys(SRC).forEach(f => {
    SRC[f].split("\n").forEach((ln, i) => {
      if (/innerHTML\s*=\s*`?<span style="color:var\(--bad\)/.test(ln))
        malos.push(f + ":" + (i + 1) + "  " + ln.trim().slice(0, 90));
    });
  });
  assert.strictEqual(malos.length, 0, "avisos por fuera de la ranura:\n" + malos.join("\n"));
});

/* =====================================================================
   5. Las hojas de verdad: se abren y traen su ranura
   ===================================================================== */
console.log("\n== 5. Cada hoja real trae su ranura ==");

CFG.identities.length = 0; CFG.habits.length = 0; CFG.commitments.length = 0;
CFG.metrics.length = 0; CFG.routines.length = 0; CFG.exercises.length = 0;
CFG.meals.menu.length = 0; CFG.meals.fichas.categories.length = 0;
CFG.meals.fichas.innegociables.length = 0;
WORKOUTS.length = 0; TASKS.length = 0;
BIZ.projects.length = 0; BIZ.leads.length = 0; BIZ.metrics.length = 0;
BIZ.ideas.length = 0; BIZ.focus.length = 0; BIZ.done.length = 0;
CFG.activities.push({ id: "gym", name: "Gym", type: "strength", icon: "dumbbell", color: "#FF5A3C" });
CFG.habits.push({ id: "gym", name: "Gym", idn: null });
CFG.metrics.push({ id: "q1", name: "Peso", unit: "kg", target: "", idn: null });
CFG.meals.fichas.categories.push({ id: "c1", name: "Proteina", quota: 3, color: PALETTE[0] });
CFG.meals.fichas.catalog["c1"] = [{ food: "Pollo", amount: "175 g", note: "" }];
CFG.meals.menu.push({ id: "m1", name: "Desayuno", desc: "" });
CFG.meals.fichas.innegociables.push({ id: "in1", name: "Agua" });
CFG.routines.push(normalizeRoutine({
  name: "Push", blocks: [{ name: "P", kind: "principal", exercises: [{ name: "Press", sets: 2, reps: "8", rest: 60 }] }]
}));
BIZ.projects.push({ id: "p1", name: "Demo", color: PALETTE[5], status: "activo", why: "", nextAction: "Llamar", nextActionDue: "", updatedAt: Date.now() });
BIZ.leads.push({ id: "lg1", name: "Lead", contact: "", stage: "nuevo", value: "", unit: "", followUp: "", notes: "", projectId: "", stageAt: Date.now(), updatedAt: Date.now() });
BIZ.metrics.push({ id: "bn1", name: "Ingreso", unit: "MXN", target: "", period: "mes" });
BIZ.ideas.push({ id: "id1", text: "Una idea", ts: Date.now(), status: "inbox", projectId: "" });
BIZ.focus.push({ id: "fo1", date: T, projectId: "p1", seconds: 600, note: "" });
BIZ.done.push({ id: "dn1", projectId: "p1", text: "Algo hecho", doneAt: Date.now() });
WORKOUTS.push({ id: "w1", date: T, activityId: "gym", type: "strength", routineId: null, name: "E", duration: 600, volume: 100, unit: "kg", sets: [{ exName: "Press", exId: null, reps: "8", weight: "50" }] });
saveCfg(); saveBiz(); saveWorkouts(); saveTasks();
const RID = CFG.routines[0].id;
migrateExercises();
const XID = findOrCreateExercise("Press").id;
const XID2 = findOrCreateExercise("Press banca").id;
saveCfg();

/* Toda funcion del codigo que llama a sheet(`...`). La lista de abajo tiene
   que cubrirlas todas: si alguien agrega una hoja nueva y no la cubre, la
   ultima prueba de esta seccion falla. */
const HOJAS = [
  ["openCatalog", () => openCatalog()],
  ["openMetric", () => openMetric(T, "q1")],
  ["openDay", () => openDay(T)],
  ["confirmClearDay", () => confirmClearDay(T)],
  ["openMergeChoice", () => openMergeChoice(XID, XID2)],
  ["openExerciseDetail", () => openExerciseDetail(XID)],
  ["openRenameExercise", () => openRenameExercise(XID)],
  ["openMergePick", () => openMergePick(XID)],
  ["openWorkoutDetail", () => openWorkoutDetail("w1")],
  ["openLogSession", () => openLogSession("gym", T)],
  ["openManualWorkout", () => openManualWorkout(T)],
  /* La hoja del alta manual se repinta sola: se cubre tambien por su render. */
  ["renderManualWorkout", () => { openManualWorkout(T); renderManualWorkout(); }],
  ["openMwSet", () => { openManualWorkout(T); openMwSet(); }],
  ["openMwEdit", () => { openManualWorkout(T); openMwSet(); set("mwEx", "Press"); set("mwW", "50"); set("mwR", "8"); set("mwN", 1); addMwSet(); openMwEdit(0); }],
  ["openEditActivity", () => openEditActivity("gym")],
  ["openNote", () => openNote(T, "gym")],
  ["openTask", () => openTask(T)],
  ["openEditIdentity", () => openEditIdentity()],
  ["itemEditor(habit)", () => openEditHabit("gym")],
  ["openEditMetric", () => openEditMetric("q1")],
  ["openEditMeal", () => openEditMeal("m1")],
  ["openEditCat", () => openEditCat("c1")],
  ["openEditFood", () => openEditFood("c1", 0)],
  ["openEditInneg", () => openEditInneg("in1")],
  ["openImportPlan", () => openImportPlan()],
  ["exportPlan", () => exportPlan()],
  ["openImportMeals", () => openImportMeals()],
  ["exportMeals", () => exportMeals()],
  /* Solo abre hoja cuando la descarga falla (iOS). Se fuerza ese camino. */
  ["exportAllData", () => { const B = global.Blob; global.Blob = function () { throw new Error("sin descarga"); };
    try { exportAllData(); } finally { global.Blob = B; } }],
  ["openImportData", () => openImportData()],
  ["openBizMval", () => openBizMval("bn1")],
  ["openBizMetric", () => openBizMetric("bn1")],
  ["confirmDelBizMetric", () => confirmDelBizMetric("bn1")],
  ["openFollowUp", () => openFollowUp("lg1")],
  ["openLead", () => openLead("lg1")],
  ["confirmDelLead", () => confirmDelLead("lg1")],
  ["openPromoteIdea", () => openPromoteIdea("id1")],
  ["openFocusManual", () => openFocusManual("p1")],
  ["openFocusEdit", () => openFocusEdit("fo1")],
  ["confirmDelFocus", () => confirmDelFocus("fo1")],
  ["openBizProject", () => openBizProject("p1")],
  ["restoreDone", () => restoreDone("dn1")],
  ["confirmDelProject", () => confirmDelProject("p1")],
  ["openNextAction", () => openNextAction("p1")],
  ["openPickRoutine", () => openPickRoutine()],
  ["renderRoutineEditor", () => openRoutineEditor(RID)],
  ["openBlockEdit", () => { openRoutineEditor(RID); openBlockEdit(0); }],
  ["delBlock", () => { openRoutineEditor(RID); delBlock(0); }],
  ["openMoveExercise", () => { openRoutineEditor(RID); openMoveExercise(0, 0); }],
  ["openExercise", () => { openRoutineEditor(RID); openExercise(0, 0); }],
  ["openImportJSON", () => openImportJSON()],
  ["exportRoutine", () => exportRoutine(RID)],
  /* Las tres necesitan un entreno guardado en curso. */
  ["openResumeChoice", () => { beginWorkout(RID); savePlayerState(); openResumeChoice(); }],
  ["confirmRestart", () => { beginWorkout(RID); savePlayerState(); confirmRestart(); }],
  ["openActiveOptions", () => { beginWorkout(RID); savePlayerState(); openActiveOptions(); }]
];

HOJAS.forEach(([nombre, abrir]) => {
  t(nombre + ": trae ranura y botones enrutados", () => {
    els.modal.innerHTML = "";
    abrir();
    const h = els.modal.innerHTML;
    assert.ok(h.length > 0, nombre + ": no pinto nada");
    assert.strictEqual(h.split(`id="${FMSG_ID}"`).length - 1, 1, nombre + ": ranuras != 1");
    const p = primAt(h);
    if (p > -1) assert.ok(slotAt(h) < p, nombre + ": la ranura quedo debajo del boton principal");
    /* cada boton principal tiene que ir por la guarda */
    const re = /<button class="btn p[^"]*"[^>]*onclick="([^"]*)"/g;
    let m;
    while ((m = re.exec(h))) {
      assert.ok(m[1].indexOf("submitSheet(") === 0, nombre + ": boton principal sin guarda -> " + m[1].slice(0, 60));
    }
  });
});
cleanupPlayer(); clearActive();

t("la lista de arriba cubre TODAS las hojas del codigo", () => {
  const fns = new Set();
  Object.keys(SRC).forEach(f => {
    const s = SRC[f];
    let i = 0;
    while ((i = s.indexOf("sheet(`", i)) > -1) {
      const head = s.lastIndexOf("\nfunction ", i);
      const m = /\nfunction (\w+)/.exec(s.slice(head, head + 80));
      if (m) fns.add(m[1]);
      i += 6;
    }
  });
  const cubiertas = new Set(HOJAS.map(h => h[0].replace(/\(.*/, "")));
  const faltan = [...fns].filter(x => !cubiertas.has(x));
  assert.strictEqual(faltan.length, 0,
    "hojas sin cubrir en test-sheet.js (agregalas a HOJAS): " + faltan.join(", "));
});

/* =====================================================================
   6. La garantia de punta a punta, con la hoja que origino todo
   ===================================================================== */
console.log("\n== 6. De punta a punta ==");

t("guardar un entreno sin series avisa Y el aviso va sobre el boton", () => {
  openManualWorkout(addDays(T, -1));
  clearFormError();
  saveManualWorkout();
  const h = els.modal.innerHTML;
  assert.ok(/al menos una serie/i.test(h), "no explico: " + h.slice(0, 160));
  assert.ok(slotAt(h) > -1 && slotAt(h) < primAt(h), "el aviso no quedo encima del boton");
  assert.ok(/class="btn p off"/.test(h), "el boton no se ve apagado sin series");
  assert.ok(!/disabled/.test(h), "el boton quedo intocable: no podria explicar nada");
  closeModal();
});

t("un handler nuevo que se olvide de explicar NO puede quedar mudo", () => {
  /* Simula al desarrollador distraido: hoja normal, handler que solo hace
     `return false`. El framework tiene que decir algo igual. */
  global.__handlerDistraido = function () { return false; };
  sheet(`<h3>Hoja nueva</h3><input id="zz"><button class="btn p" onclick="__handlerDistraido()">Guardar</button>`);
  const antes = els.modal.innerHTML;
  assert.ok(antes.includes(`id="${FMSG_ID}"`), "la hoja nueva nacio sin ranura");
  clearFormError();
  submitSheet(global.__handlerDistraido);
  assert.ok(/ferr/.test(formErrorText()), "el handler distraido dejo al usuario sin nada");
  closeModal();
});

console.log("\n" + n + " pruebas OK");
