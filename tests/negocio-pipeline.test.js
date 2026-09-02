const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
const MEM = global.__MEM;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }

const DAY = 86400000;
const B = () => __getBIZ();
/* En el DOM real input.value SIEMPRE es cadena; el stub debe hacer lo mismo. */
const set = (id, v) => { document.getElementById(id).value = v == null ? "" : String(v); };
function reset() { B().projects.length = 0; B().leads.length = 0; B().done.length = 0; saveBiz(); }

function crearProy(name, na, due) {
  openBizProject();
  set("bpName", name); set("bpWhy", ""); set("bpNa", na || ""); set("bpDue", due || "");
  pickBizStatus("activo"); saveBizProject("");
  return B().projects[B().projects.length - 1];
}
function crearLead(name, o) {
  o = o || {};
  openLead();
  set("lgName", name); set("lgContact", o.contact || ""); set("lgValue", o.value == null ? "" : o.value);
  set("lgFollow", o.followUp || ""); set("lgNotes", o.notes || "");
  pickLeadStage(o.stage || "nuevo"); pickLeadProject(o.projectId || "");
  saveLead("");
  const l = B().leads[B().leads.length - 1];
  if (o.stageAt) { l.stageAt = o.stageAt; saveBiz(); }
  return l;
}

/* =====================================================================
   1. Historial de acciones hechas
   ===================================================================== */
console.log("\n== 1. Acciones hechas (done) ==");
reset();
t("el contenedor done existe y loadBiz lo tolera ausente", () => {
  assert.ok(Array.isArray(DEFAULT_BIZ.done), "done no esta en DEFAULT_BIZ");
  MEM.mt_biz = '{"projects":[]}';           // respaldo anterior a esta version
  assert.ok(Array.isArray(loadBiz().done), "loadBiz no crea done");
  delete MEM.mt_biz;
});
t("completar empuja a done ANTES de limpiar, sin taps extra", () => {
  reset();
  const p = crearProy("CRM", "Terminar el onboarding", today());
  completeNextAction(p.id);
  assert.strictEqual(B().done.length, 1, "no registro la accion");
  const d = B().done[0];
  assert.strictEqual(d.text, "Terminar el onboarding", "no guardo el texto tal cual estaba");
  assert.strictEqual(d.projectId, p.id);
  assert.ok(d.id && d.doneAt > 0, "sin id o sin fecha");
  assert.strictEqual(bizProject(p.id).nextAction, "", "no limpio la accion");
  // el mismo tap ya dejo abierta la pregunta por la siguiente
  assert.ok(els.modal.innerHTML.includes("¿Y ahora qué sigue?"), "no encadeno la siguiente pregunta");
  assert.strictEqual(JSON.parse(MEM.mt_biz).done.length, 1, "no persistio");
});
t("completar sin accion escrita no ensucia el historial", () => {
  const p = B().projects[0];
  const antes = B().done.length;
  completeNextAction(p.id);
  assert.strictEqual(B().done.length, antes, "registro una accion vacia");
});
t("projectDone devuelve lo del proyecto, lo mas reciente primero", () => {
  reset();
  const a = crearProy("A", "uno"); const b = crearProy("B", "otro");
  completeNextAction(a.id); closeModal();
  set("naTxt", "dos"); saveNextAction(a.id);
  completeNextAction(a.id); closeModal();
  completeNextAction(b.id); closeModal();
  const h = projectDone(a.id);
  assert.strictEqual(h.length, 2, "conto mal lo de A");
  assert.strictEqual(h[0].text, "dos", "no ordeno por fecha desc");
  assert.strictEqual(h[1].text, "uno");
  assert.strictEqual(projectDone(b.id).length, 1, "mezclo proyectos");
});
t("el bloque 'Hecho' aparece en el detalle del proyecto", () => {
  const a = B().projects[0];
  openBizProject(a.id);
  const h = els.modal.innerHTML;
  assert.ok(h.includes("Hecho ("), "no muestra el historial");
  assert.ok(h.includes("dos") && h.includes("uno"), "no lista lo cerrado");
  const b = crearProy("Sin historial");
  openBizProject(b.id);
  assert.ok(els.modal.innerHTML.includes("Lo que cierres aparece aquí"), "sin estado vacio del historial");
  delBizProject(b.id);
});
t("el conteo semanal cuenta desde el lunes, no lo de la semana pasada", () => {
  reset();
  const p = crearProy("P", "x");
  const lunes = weekStartTs();
  B().done.push({ id: "d1", projectId: p.id, text: "esta semana", doneAt: lunes + 60000 });
  B().done.push({ id: "d2", projectId: p.id, text: "tambien", doneAt: Date.now() });
  B().done.push({ id: "d3", projectId: p.id, text: "semana pasada", doneAt: lunes - 60000 });
  B().done.push({ id: "d4", projectId: p.id, text: "hace mucho", doneAt: lunes - 10 * DAY });
  saveBiz();
  assert.strictEqual(doneThisWeek(), 2, "conteo semanal incorrecto: " + doneThisWeek());
  assert.strictEqual(B().done.length, 4, "el total debe seguir siendo 4");
});
t("justo en el limite del lunes cuenta como de esta semana", () => {
  const lunes = weekStartTs();
  B().done.length = 0;
  B().done.push({ id: "x", projectId: "p", text: "limite", doneAt: lunes });
  saveBiz();
  assert.strictEqual(doneThisWeek(), 1, "el lunes 00:00 debe contar");
  B().done.push({ id: "y", projectId: "p", text: "un ms antes", doneAt: lunes - 1 });
  saveBiz();
  assert.strictEqual(doneThisWeek(), 1, "conto un milisegundo antes del lunes");
});
t("el historial sobrevive exportar -> borrar todo -> restaurar", () => {
  reset();
  const p = crearProy("CRM", "Entregar la demo");
  completeNextAction(p.id); closeModal();
  const antes = JSON.parse(MEM.mt_biz).done.length;
  assert.ok(antes > 0);
  const texto = JSON.stringify(buildBackup());
  Object.keys(MEM).forEach(k => delete MEM[k]);
  assert.strictEqual(applyBackup(texto), true);
  refreshState();
  assert.strictEqual(__getBIZ().done.length, antes, "se perdio el historial");
  assert.strictEqual(__getBIZ().done[0].text, "Entregar la demo");
});

/* =====================================================================
   2. Pipeline: CRUD
   ===================================================================== */
console.log("\n== 2. Pipeline: alta, edicion y borrado ==");
reset();
t("crear un lead persiste con todos los campos", () => {
  const l = crearLead("Estudio Ollin", { contact: "ana@ollin.mx", value: 25000, followUp: addDays(today(), 3), notes: "Quiere CRM", stage: "contactado" });
  assert.ok(l.id, "sin id");
  assert.strictEqual(l.name, "Estudio Ollin");
  assert.strictEqual(l.contact, "ana@ollin.mx");
  assert.strictEqual(l.stage, "contactado");
  assert.strictEqual(l.value, 25000);
  assert.strictEqual(l.followUp, addDays(today(), 3));
  assert.strictEqual(l.notes, "Quiere CRM");
  assert.ok(l.stageAt > 0 && l.updatedAt > 0, "sin marcas de tiempo");
  assert.strictEqual(JSON.parse(MEM.mt_biz).leads.length, 1, "no persistio");
});
t("un lead sin nombre no se crea", () => {
  const antes = B().leads.length;
  openLead(); set("lgName", "  "); saveLead("");
  assert.strictEqual(B().leads.length, antes);
});
t("un valor no numerico se guarda vacio, no NaN", () => {
  const l = crearLead("Sin monto", { value: "" });
  assert.strictEqual(l.value, "", "valor invalido: " + l.value);
  leadUnitTotals(B().leads).forEach(x => assert.ok(!isNaN(x.sum), "un total salio NaN"));
  delLead(l.id);
});
t("editar persiste y cambiar de etapa reinicia el reloj de etapa", () => {
  const l = B().leads[0];
  l.stageAt = Date.now() - 20 * DAY; saveBiz();
  const antes = l.stageAt;
  openLead(l.id);
  set("lgName", "Estudio Ollin"); set("lgContact", "ana@ollin.mx"); set("lgValue", 30000);
  set("lgFollow", l.followUp); set("lgNotes", "Quiere CRM");
  pickLeadStage("llamada"); pickLeadProject("");
  saveLead(l.id);
  const q = bizLead(l.id);
  assert.strictEqual(q.value, 30000, "no guardo el valor");
  assert.strictEqual(q.stage, "llamada");
  assert.ok(q.stageAt > antes, "no reinicio stageAt al cambiar de etapa");
});
t("editar SIN cambiar de etapa conserva stageAt", () => {
  const l = B().leads[0];
  l.stageAt = Date.now() - 9 * DAY; saveBiz();
  const antes = l.stageAt;
  openLead(l.id);
  set("lgName", "Estudio Ollin"); set("lgValue", 30000); set("lgFollow", l.followUp); set("lgNotes", "n");
  pickLeadStage("llamada"); saveLead(l.id);
  assert.strictEqual(bizLead(l.id).stageAt, antes, "reinicio stageAt sin cambiar de etapa");
});
t("se puede ligar a un proyecto", () => {
  const p = crearProy("CRM", "x");
  const l = crearLead("Ligado", { projectId: p.id });
  assert.strictEqual(l.projectId, p.id);
  delLead(l.id);
});
t("borrar pide confirmacion y persiste", () => {
  const l = crearLead("Temporal");
  confirmDelLead(l.id);
  assert.ok(els.modal.innerHTML.includes("Sí, borrar"), "no confirma");
  assert.ok(els.modal.innerHTML.includes("Temporal"), "no nombra el prospecto");
  delLead(l.id);
  assert.ok(!bizLead(l.id), "no lo borro");
  assert.ok(!JSON.parse(MEM.mt_biz).leads.some(x => x.id === l.id), "no persistio el borrado");
});

/* =====================================================================
   3. Etapas
   ===================================================================== */
console.log("\n== 3. Avanzar de etapa ==");
reset();
t("nextStage recorre el pipeline y termina en cerrado", () => {
  assert.strictEqual(nextStage("nuevo"), "contactado");
  assert.strictEqual(nextStage("contactado"), "llamada");
  assert.strictEqual(nextStage("llamada"), "propuesta");
  assert.strictEqual(nextStage("propuesta"), "cerrado");
});
t("avanzar actualiza stageAt y ofrece la fecha en el acto", () => {
  const l = crearLead("Avanza", { stage: "nuevo", stageAt: Date.now() - 5 * DAY });
  const antes = l.stageAt;
  advanceLead(l.id);
  const q = bizLead(l.id);
  assert.strictEqual(q.stage, "contactado", "no avanzo");
  assert.ok(q.stageAt > antes, "no reinicio stageAt");
  assert.ok(els.modal.innerHTML.includes("¿Cuándo lo sigues?"), "no ofrecio el seguimiento");
  assert.strictEqual(JSON.parse(MEM.mt_biz).leads.find(x => x.id === l.id).stage, "contactado", "no persistio");
});
t("un atajo de la hoja fija la fecha en UN tap", () => {
  const l = B().leads[0];
  assert.ok(els.modal.innerHTML.includes("pickFollow("), "no hay atajos de un tap");
  pickFollow(l.id, addDays(today(), 3));
  assert.strictEqual(bizLead(l.id).followUp, addDays(today(), 3), "el atajo no guardo");
  assert.strictEqual(els.modal.innerHTML, "", "no cerro la hoja");
});
t("avanzar hasta cerrado NO pide seguimiento", () => {
  const l = bizLead(B().leads[0].id);
  setLeadStage(l.id, "propuesta", false);
  advanceLead(l.id);
  assert.strictEqual(bizLead(l.id).stage, "cerrado");
  assert.ok(!els.modal.innerHTML.includes("¿Cuándo lo sigues?"), "pidio seguimiento en un cerrado");
});
t("cerrado y perdido salen del pipeline vivo", () => {
  reset();
  crearLead("Vivo", { stage: "propuesta" });
  crearLead("Ganado", { stage: "cerrado" });
  crearLead("Perdido", { stage: "perdido" });
  const abiertos = openLeadsList().map(l => l.name);
  assert.deepStrictEqual(abiertos, ["Vivo"], "el pipeline vivo trae: " + abiertos.join(","));
  assert.strictEqual(followState(bizLead(B().leads[1].id)), null, "un cerrado sigue teniendo seguimiento");
});

/* =====================================================================
   4. Seguimientos y enfriamiento
   ===================================================================== */
console.log("\n== 4. Seguimiento vencido y lead enfriandose ==");
reset();
const T = today();
const lVenc = crearLead("Vencido", { stage: "contactado", followUp: addDays(T, -3), value: 10000 });
const lHoy = crearLead("Hoy", { stage: "llamada", followUp: T, value: 5000 });
const lFut = crearLead("Futuro", { stage: "nuevo", followUp: addDays(T, 5) });
const lSin = crearLead("Sin fecha", { stage: "propuesta" });
const lFrio = crearLead("Frio", { stage: "contactado", followUp: addDays(T, 20), stageAt: Date.now() - 15 * DAY });

t("followState clasifica vencido / hoy / futuro", () => {
  assert.strictEqual(followState(lVenc), "vencido");
  assert.strictEqual(followState(lHoy), "hoy");
  assert.strictEqual(followState(lFut), "futuro");
  assert.strictEqual(followState(lSin), null);
});
t("leadStale marca 10 dias en la misma etapa", () => {
  assert.strictEqual(LEAD_STALE_DAYS, 10);
  assert.ok(leadStale(lFrio), "no detecto el que se enfria");
  assert.ok(!leadStale(lHoy), "marco uno recien movido");
});
t("el orden pone vencido primero y luego lo de hoy", () => {
  const orden = openLeadsList().slice().sort((a, b) => leadRank(a) - leadRank(b)).map(l => l.name);
  assert.strictEqual(orden[0], "Vencido", "orden: " + orden.join(" > "));
  assert.strictEqual(orden[1], "Hoy");
});
t("la fila marca el vencido en rojo y el frio en ambar", () => {
  const rv = leadRow(lVenc);
  assert.ok(rv.includes("leadvenc"), "el vencido no lleva la barra roja");
  assert.ok(rv.includes("seguimiento vencido"), "no lo dice con palabras");
  // El "$" se quito a proposito: con varias monedas es ambiguo. Ahora va el
  // numero y su unidad al lado (o solo el numero si el lead no tiene unidad).
  assert.ok(rv.includes("10,000"), "no muestra el valor");
  assert.ok(rv.includes("advanceLead("), "no se puede avanzar desde la fila");
  const rf = leadRow(lFrio);
  assert.ok(/color:var\(--lectura\)/.test(rf), "el que se enfria no se pinta");
  assert.ok(rf.includes("en contactado hace 15 días"), "no dice cuanto lleva en la etapa");
  assert.ok(leadRow(lSin).includes("sin seguimiento"), "no reclama la falta de fecha");
});
t("un cerrado no ofrece avanzar", () => {
  const l = crearLead("Ganado", { stage: "cerrado" });
  assert.ok(!leadRow(l).includes("advanceLead("), "ofrece avanzar un cerrado");
  delLead(l.id);
});
t("los totales agrupan por unidad y stageLeads ordena por etapa", () => {
  const tot = leadUnitTotals(openLeadsList());
  assert.strictEqual(tot.length, 1, "sin unidad deberia haber un solo grupo");
  assert.strictEqual(tot[0].sum, 15000);
  assert.deepStrictEqual(stageLeads("contactado").map(l => l.name), ["Vencido", "Frio"]);
});

/* =====================================================================
   5. La vista del pipeline
   ===================================================================== */
console.log("\n== 5. Vista Pipeline ==");
t("agrupa por etapa con conteo y total, y separa los cerrados", () => {
  __setVIEW("negocio"); __setNEGTAB("pipeline"); renderNegocio();
  const h = els.app.innerHTML;
  LEAD_OPEN.forEach(st => assert.ok(h.includes(cap(st)), "falta la etapa " + st));
  // El total va en un stat por unidad, sin "$" y sin cifra combinada.
  assert.ok(h.includes("15,000"), "no muestra el total abierto");
  assert.ok(h.includes("1 seguimiento vencido"), "el resumen no avisa lo vencido");
  assert.ok(h.includes("1 sin fecha"), "no avisa el que no tiene fecha");
  assert.ok(h.includes("1 enfriándose"), "no avisa el que se enfria");
  crearLead("Ganado", { stage: "cerrado", value: 8000 });
  renderNegocio();
  assert.ok(els.app.innerHTML.includes("Cerrados y perdidos"), "no separa los cerrados");
});
t("el control segmentado alterna Proyectos y Pipeline", () => {
  const h = els.app.innerHTML;
  assert.ok(h.includes("setNegTab('proyectos')") && h.includes("setNegTab('pipeline')"), "sin control segmentado");
  __setNEGTAB("proyectos"); renderNegocio();
  assert.ok(!els.app.innerHTML.includes("Cerrados y perdidos"), "la pestana de proyectos muestra el pipeline");
  __setNEGTAB("pipeline");
});
t("sin leads, estado vacio con su llamada a la accion", () => {
  const guardados = B().leads.slice();
  B().leads.length = 0; saveBiz();
  renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Todavía no hay prospectos"), "sin estado vacio");
  assert.ok(h.includes("openLead()"), "no deja crear");
  guardados.forEach(l => B().leads.push(l)); saveBiz();
});

/* =====================================================================
   6. Hoy
   ===================================================================== */
console.log("\n== 6. Negocio en Hoy ==");
t("Hoy trae los seguimientos vencidos y los de hoy, no los futuros", () => {
  __setVIEW("hoy"); goToday(); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Seguir a Vencido"), "no trae el vencido");
  assert.ok(h.includes("Seguir a Hoy"), "no trae el de hoy");
  assert.ok(!h.includes("Seguir a Futuro"), "trae un seguimiento futuro");
  assert.ok(!h.includes("Seguir a Frio"), "trae uno cuya fecha aun no llega");
});
t("un lead se distingue de una accion de proyecto", () => {
  crearProy("CRM", "Terminar la demo", addDays(T, -1));
  renderHoy();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Pipeline · contactado"), "el lead no se identifica como pipeline");
  assert.ok(h.includes("Proyecto · CRM"), "la accion no se identifica como proyecto");
  assert.ok(h.includes("Seguir a "), "el lead no dice que se persigue");
  assert.ok(h.includes("Terminar la demo"), "no trae la accion del proyecto");
});
t("la seccion tiene tope y no crece sin control", () => {
  for (let i = 0; i < 8; i++) crearLead("Extra " + i, { stage: "nuevo", followUp: addDays(T, -1) });
  for (let i = 0; i < 5; i++) crearProy("Proy " + i, "accion " + i, addDays(T, -1));
  renderHoy();
  const bloque = els.app.innerHTML.split('data-key="biz"')[1].split("</div></div></div>")[0];
  const filas = (bloque.match(/gotoLead\(|gotoProject\(/g) || []).length;
  assert.ok(filas <= 5, "la seccion crecio a " + filas + " filas");
});
t("los vencidos ganan el cupo antes que los de hoy", () => {
  const items = bizHoyItems();
  assert.ok(items.length <= 5);
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].rank <= items[i].rank, "no quedo ordenado por urgencia");
});
t("Hoy sin proyectos ni leads no mete ruido", () => {
  const P = B().projects.slice(), L = B().leads.slice();
  B().projects.length = 0; B().leads.length = 0; saveBiz();
  assert.strictEqual(bizSection(today()), null, "pinta la seccion vacia");
  renderHoy();
  assert.ok(!els.app.innerHTML.includes('data-key="biz"'));
  P.forEach(p => B().projects.push(p)); L.forEach(l => B().leads.push(l)); saveBiz();
});
t("con leads pero sin proyectos la seccion sigue apareciendo", () => {
  const P = B().projects.slice();
  B().projects.length = 0; saveBiz();
  renderHoy();
  assert.ok(els.app.innerHTML.includes('data-key="biz"'), "se escondio teniendo leads urgentes");
  assert.ok(els.app.innerHTML.includes("Seguir a "), "no trae los seguimientos");
  P.forEach(p => B().projects.push(p)); saveBiz();
});
t("en un dia pasado la seccion se retira", () => {
  const ayer = addDays(today(), -1);
  assert.strictEqual(bizSection(ayer), null, "muestra pendientes de hoy en un dia pasado");
  setVDay(ayer); renderHoy();
  assert.ok(!els.app.innerHTML.includes('data-key="biz"'), "sobrevivio a un dia pasado");
  goToday();
});
t("gotoLead salta al pipeline y abre ese prospecto", () => {
  __setVIEW("hoy"); __setNEGTAB("proyectos");
  gotoLead(lVenc.id);
  assert.strictEqual(__getVIEW(), "negocio");
  assert.strictEqual(__getNEGTAB(), "pipeline", "no cambio a la pestana de pipeline");
  assert.ok(els.modal.innerHTML.includes("Vencido"), "no abrio el prospecto");
});

/* =====================================================================
   7. mt_biz sigue viajando entero
   ===================================================================== */
console.log("\n== 7. Respaldo y nube, con leads y done ==");
t("mt_biz completo sobrevive exportar -> borrar -> restaurar", () => {
  const antes = JSON.parse(MEM.mt_biz);
  const texto = JSON.stringify(buildBackup());
  Object.keys(MEM).forEach(k => delete MEM[k]);
  assert.strictEqual(applyBackup(texto), true);
  refreshState();
  const b = __getBIZ();
  assert.strictEqual(b.leads.length, antes.leads.length, "se perdieron leads");
  assert.strictEqual(b.projects.length, antes.projects.length, "se perdieron proyectos");
  assert.strictEqual(b.done.length, antes.done.length, "se perdio el historial");
  assert.ok(b.leads.some(l => l.name === "Vencido"), "los leads no viajaron intactos");
});
t("mt_biz sigue en BACKUP_KEYS y sync.js lo recorre", () => {
  assert.ok(BACKUP_KEYS.includes("mt_biz"));
  const fs = require("fs"), path = require("path");
  const sync = fs.readFileSync(path.join(ROOT, "js/sync.js"), "utf8");
  assert.ok(/BACKUP_KEYS\.forEach/.test(sync) && /buildBackup\(\)\.data/.test(sync));
});

console.log("\n" + n + " pruebas OK\n");
