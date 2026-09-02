const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
const MEM = global.__MEM;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }

const DAY = 86400000;
const B = () => __getBIZ();
const set = (id, v) => { document.getElementById(id).value = v == null ? "" : String(v); };
function reset() {
  const b = B();
  ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(k => { b[k].length = 0; });
  b.mvals = {}; b.reviews = {};
  clearFocusRun(); saveBiz();
}
function crearProy(name, na) {
  openBizProject();
  set("bpName", name); set("bpWhy", ""); set("bpNa", na || ""); set("bpDue", "");
  pickBizStatus("activo"); saveBizProject("");
  return B().projects[B().projects.length - 1];
}

/* =====================================================================
   A. Deshacer un "Listo"
   ===================================================================== */
console.log("\n== A. Restaurar una accion hecha ==");
reset();
t("tocar una linea del historial la devuelve a proxima accion", () => {
  const p = crearProy("CRM", "Terminar la demo");
  completeNextAction(p.id); closeModal();
  assert.strictEqual(bizProject(p.id).nextAction, "");
  const d = B().done[0];
  restoreDone(d.id);
  assert.strictEqual(bizProject(p.id).nextAction, "Terminar la demo", "no la devolvio");
  assert.strictEqual(B().done.length, 0, "no la saco del historial");
  assert.strictEqual(JSON.parse(MEM.mt_biz).projects[0].nextAction, "Terminar la demo", "no persistio");
});
t("si ya hay una proxima accion, PREGUNTA antes de pisarla", () => {
  const p = B().projects[0];
  completeNextAction(p.id); closeModal();          // done: "Terminar la demo"
  set("naTxt", "Escribir la landing"); saveNextAction(p.id);
  const d = B().done[0];
  restoreDone(d.id);
  const h = els.modal.innerHTML;
  assert.ok(h.includes("Ya hay una próxima acción"), "no pregunto");
  assert.ok(h.includes("Escribir la landing") && h.includes("Terminar la demo"), "no muestra las dos");
  assert.strictEqual(bizProject(p.id).nextAction, "Escribir la landing", "piso sin preguntar");
  assert.strictEqual(B().done.length, 1, "saco del historial antes de confirmar");
});
t("al confirmar reemplaza, y la accion de antes NO vuelve al historial", () => {
  const p = B().projects[0], d = B().done[0];
  doRestoreDone(d.id);
  assert.strictEqual(bizProject(p.id).nextAction, "Terminar la demo");
  assert.strictEqual(B().done.length, 0);
});
t("el bloque Hecho ofrece la restauracion", () => {
  const p = B().projects[0];
  completeNextAction(p.id); closeModal();
  openBizProject(p.id);
  assert.ok(els.modal.innerHTML.includes("restoreDone("), "las lineas no son tocables");
  assert.ok(els.modal.innerHTML.includes("Toca una para devolverla"), "no lo explica");
});

/* =====================================================================
   B. Numeros del negocio
   ===================================================================== */
console.log("\n== B. Numeros: periodos, metas y unidades ==");
reset();
t("la semana ISO es correcta en el cambio de anio", () => {
  assert.strictEqual(isoWeekKey("2025-12-28"), "2025-W52", "domingo final de 2025");
  assert.strictEqual(isoWeekKey("2025-12-29"), "2026-W01", "el lunes ya es la semana 1 de 2026");
  assert.strictEqual(isoWeekKey("2026-01-01"), "2026-W01");
  assert.strictEqual(isoWeekKey("2026-01-04"), "2026-W01", "el domingo cierra la misma semana");
  assert.strictEqual(isoWeekKey("2026-01-05"), "2026-W02");
  assert.strictEqual(isoWeekKey("2026-12-31"), "2026-W53");
  assert.strictEqual(isoWeekKey("2027-01-03"), "2026-W53", "sigue siendo la 53 de 2026");
  assert.strictEqual(isoWeekKey("2027-01-04"), "2027-W01");
});
t("los 7 dias de una semana comparten clave", () => {
  const base = "2026-03-16";   // lunes
  const ks = [];
  for (let i = 0; i < 7; i++) ks.push(isoWeekKey(addDays(base, i)));
  assert.strictEqual(new Set(ks).size, 1, "la semana se parte: " + ks.join(","));
  assert.notStrictEqual(isoWeekKey(addDays(base, 7)), ks[0], "la semana siguiente repite clave");
});
t("la clave mensual y los periodos previos cruzan el anio", () => {
  assert.strictEqual(monthKey("2026-08-30"), "2026-08");
  assert.deepStrictEqual(lastNPeriods("mes", 3, "2026-01-15"), ["2025-11", "2025-12", "2026-01"]);
  assert.deepStrictEqual(lastNPeriods("semana", 3, "2026-01-05"), ["2025-W52", "2026-W01", "2026-W02"]);
  assert.strictEqual(prevPeriodKey("mes", "2026-01-15"), "2025-12");
});
t("crear un numero y capturar un valor en el periodo actual", () => {
  openBizMetric();
  set("bnName", "Ingreso freelance"); set("bnUnit", "MXN"); set("bnTarget", 60000);
  pickBmPeriod("mes"); saveBizMetric("");
  const m = B().metrics[0];
  assert.strictEqual(m.name, "Ingreso freelance");
  assert.strictEqual(m.unit, "MXN");
  assert.strictEqual(m.target, 60000);
  assert.strictEqual(m.period, "mes");
  openBizMval(m.id);
  assert.ok(els.modal.innerHTML.includes(periodLabel("mes", periodKey("mes"))), "no arranca en el periodo actual");
  set("bmVal", 45000); saveBizMval(m.id, periodKey("mes"));
  assert.strictEqual(bizMval(m.id, periodKey("mes")), 45000);
  assert.strictEqual(JSON.parse(MEM.mt_biz).mvals[m.id][periodKey("mes")], 45000, "no persistio");
});
t("el progreso hacia la meta se calcula y se pinta", () => {
  const m = B().metrics[0];
  const card = bizMetricCard(m);
  assert.ok(card.includes("gbar"), "sin barra de progreso");
  assert.ok(card.includes("75% de la meta"), "porcentaje incorrecto");
  assert.ok(card.includes("MXN"), "no muestra la unidad");
});
t("NUNCA se suman unidades distintas: sumByUnit agrupa", () => {
  openBizMetric(); set("bnName", "Ahorro visa"); set("bnUnit", "USD"); set("bnTarget", 100000);
  pickBmPeriod("mes"); saveBizMetric("");
  const usd = B().metrics[1];
  setBizMval(usd.id, periodKey("mes"), 12000);
  const porUnidad = sumByUnit(B().metrics);
  assert.deepStrictEqual(porUnidad, { MXN: 45000, USD: 12000 }, "mezclo monedas: " + JSON.stringify(porUnidad));
  assert.notStrictEqual(porUnidad.MXN, 57000, "sumo MXN con USD");
});
t("la vista de numeros nunca imprime un total unico entre monedas", () => {
  __setVIEW("negocio"); __setNEGTAB("numeros"); renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Ingreso freelance") && h.includes("Ahorro visa"));
  assert.ok(h.includes("MXN") && h.includes("USD"), "no muestra cada unidad");
  assert.ok(!h.includes("57000") && !h.includes("57,000"), "aparecio la suma MXN+USD");
});
t("dos periodos distintos no se pisan y el previo se compara solo", () => {
  const m = B().metrics[0], cur = periodKey("mes"), prev = prevPeriodKey("mes");
  setBizMval(m.id, prev, 30000);
  assert.strictEqual(bizMval(m.id, cur), 45000);
  assert.strictEqual(bizMval(m.id, prev), 30000);
  assert.ok(bizMetricCard(m).includes("+15000"), "no calculo la variacion contra el periodo anterior");
});
t("borrar un numero se lleva su historico", () => {
  const m = B().metrics[1];
  confirmDelBizMetric(m.id);
  assert.ok(els.modal.innerHTML.includes("Sí, borrar"));
  delBizMetric(m.id);
  assert.ok(!bizMetric(m.id));
  assert.strictEqual(B().mvals[m.id], undefined, "quedaron valores huerfanos");
});

/* =====================================================================
   C. Ideas
   ===================================================================== */
console.log("\n== C. Bandeja de ideas ==");
t("capturar es un solo gesto y persiste", () => {
  __setNEGTAB("ideas"); renderNegocio();
  assert.ok(els.app.innerHTML.includes('id="ideaIn"'), "el campo no esta siempre visible");
  assert.ok(els.app.innerHTML.includes("event.key==='Enter'"), "Enter no captura");
  set("ideaIn", "Automatizar el onboarding");
  captureIdea();
  const i = B().ideas[0];
  assert.strictEqual(i.text, "Automatizar el onboarding");
  assert.strictEqual(i.status, "inbox");
  assert.ok(i.ts > 0 && i.id);
  assert.strictEqual(JSON.parse(MEM.mt_biz).ideas.length, 1, "no persistio");
  assert.strictEqual(document.getElementById("ideaIn").value, "", "no limpio el campo");
});
t("una idea vacia no se guarda", () => {
  const antes = B().ideas.length;
  set("ideaIn", "   "); captureIdea();
  assert.strictEqual(B().ideas.length, antes);
});
t("la bandeja va primero y lo descartado al final", () => {
  set("ideaIn", "Otra mas"); captureIdea();
  const i2 = B().ideas[0];
  setIdeaStatus(i2.id, "descartada");
  const orden = ideasSorted().map(x => x.status);
  assert.strictEqual(orden[0], "inbox", "la bandeja no va primero");
  assert.strictEqual(orden[orden.length - 1], "descartada", "lo descartado no va al final");
});
t("descartar NO borra: sigue recuperable", () => {
  const d = B().ideas.find(i => i.status === "descartada");
  assert.ok(d, "se perdio la idea descartada");
  setIdeaStatus(d.id, "guardada");
  assert.strictEqual(bizIdea(d.id).status, "guardada", "no se pudo recuperar");
});
t("promover una idea la convierte en proyecto", () => {
  const i = B().ideas.find(x => x.status === "inbox");
  const antes = B().projects.length;
  openPromoteIdea(i.id);
  assert.ok(els.modal.innerHTML.includes("Convertirla en proyecto"), "no ofrece convertirla");
  ideaToProject(i.id);
  assert.strictEqual(B().projects.length, antes + 1, "no creo el proyecto");
  assert.strictEqual(bizIdea(i.id).status, "guardada");
  assert.ok(bizIdea(i.id).projectId, "no quedo ligada");
});
t("promover una idea a proxima accion de un proyecto", () => {
  set("ideaIn", "Llamar al contador"); captureIdea();
  const i = B().ideas[0], p = B().projects[0];
  ideaToNextAction(i.id, p.id);
  assert.strictEqual(bizProject(p.id).nextAction, "Llamar al contador");
  assert.strictEqual(bizIdea(i.id).projectId, p.id);
  assert.strictEqual(bizIdea(i.id).status, "guardada");
});

/* =====================================================================
   D. Sesiones de foco
   ===================================================================== */
console.log("\n== D. Foco por marca de tiempo ==");
reset();
const pFoco = crearProy("CRM", "x");
t("arrancar guarda la sesion en mt_focusRun", () => {
  startFocus(pFoco.id);
  const r = getFocusRun();
  assert.ok(r, "no quedo sesion en curso");
  assert.strictEqual(r.projectId, pFoco.id);
  assert.ok(r.startedAt > 0);
  assert.ok(MEM.mt_focusRun, "no persistio la sesion");
  assert.ok(BACKUP_KEYS.includes("mt_focusRun"), "mt_focusRun fuera del respaldo");
});
t("SOBREVIVE a segundo plano: el transcurrido sale del reloj, no de un contador", () => {
  const r = getFocusRun();
  // simula que la pantalla se bloqueo 90 minutos: un setInterval habria quedado congelado
  r.startedAt = Date.now() - 90 * 60000;
  saveFocusRun(r);
  const secs = focusElapsed(getFocusRun());
  assert.ok(Math.abs(secs - 5400) <= 2, "transcurrido incorrecto tras el fondo: " + secs);
});
t("al recargar la app la sesion sigue viva", () => {
  refreshState();
  const r = getFocusRun();
  assert.ok(r, "se perdio la sesion al recargar");
  assert.ok(Math.abs(focusElapsed(r) - 5400) <= 3, "se perdio el tiempo acumulado");
});
t("terminar registra la duracion correcta y limpia la sesion", () => {
  stopFocus();
  assert.strictEqual(getFocusRun(), null, "no limpio la sesion en curso");
  assert.strictEqual(B().focus.length, 1);
  const f = B().focus[0];
  assert.strictEqual(f.projectId, pFoco.id);
  assert.ok(Math.abs(f.seconds - 5400) <= 3, "guardo " + f.seconds + " segundos");
  assert.strictEqual(f.date, today());
  assert.strictEqual(JSON.parse(MEM.mt_biz).focus.length, 1, "no persistio");
});
t("descartar no registra nada", () => {
  startFocus(pFoco.id);
  const antes = B().focus.length;
  discardFocus();
  assert.strictEqual(getFocusRun(), null);
  assert.strictEqual(B().focus.length, antes, "registro una sesion descartada");
});
t("registrar a mano funciona", () => {
  openFocusManual(pFoco.id);
  set("fmMin", 45); set("fmDate", today()); set("fmNote", "Diseño del modelo");
  pickFocusProj(pFoco.id); saveFocusManual();
  const f = B().focus[B().focus.length - 1];
  assert.strictEqual(f.seconds, 45 * 60);
  assert.strictEqual(f.note, "Diseño del modelo");
});
t("horas por proyecto: esta semana y total", () => {
  const tot = focusSeconds(pFoco.id);
  assert.ok(Math.abs(tot - (5400 + 2700)) <= 3, "total incorrecto: " + tot);
  assert.ok(focusWeek(pFoco.id) > 0, "la semana no cuenta lo de hoy");
  const viejo = { id: "old", date: addDays(today(), -60), projectId: pFoco.id, seconds: 3600, note: "" };
  B().focus.push(viejo); saveBiz();
  assert.strictEqual(focusWeek(pFoco.id), tot, "la semana conto algo de hace dos meses");
  assert.ok(Math.abs(focusSeconds(pFoco.id) - (tot + 3600)) <= 3, "el total no incluye lo viejo");
});
t("el detalle del proyecto muestra el foco", () => {
  const h = focusSummaryBlock(pFoco.id);
  assert.ok(h.includes("esta semana") && h.includes("en total"), "no resume el foco");
  assert.ok(/\dh/.test(h), "no muestra horas");
});
t("fmtHrs y fmtClock formatean bien", () => {
  assert.strictEqual(fmtHrs(0), "0m");
  assert.strictEqual(fmtHrs(5400), "1h 30m");
  assert.strictEqual(fmtHrs(3600), "1h");
  assert.strictEqual(fmtHrs(600), "10m");
  assert.strictEqual(fmtClock(65), "1:05");
  assert.strictEqual(fmtClock(3725), "1:02:05");
});
t("si el proyecto desaparece, la sesion en curso no rompe", () => {
  startFocus(pFoco.id);
  const otro = crearProy("Temporal", "");
  startFocus(otro.id);
  delBizProject(otro.id);
  assert.strictEqual(getFocusRun(), null, "quedo una sesion apuntando a la nada");
});

/* =====================================================================
   E. Revision semanal del negocio
   ===================================================================== */
console.log("\n== E. Revision del negocio ==");
t("escribe SIEMPRE sobre el domingo, tanto en domingo como en lunes", () => {
  let dom = today(); while (weekdayIdx(dom) !== 6) dom = addDays(dom, -1);
  const lun = addDays(dom, 1);
  assert.strictEqual(reviewDateFor(dom), dom, "el domingo no apunta a si mismo");
  assert.strictEqual(reviewDateFor(lun), dom, "el lunes no apunta al domingo que cerro");
  // desde el domingo
  assert.ok(bizReviewSection(dom), "no se pinta en domingo");
  set("brM", "Cerre el CRM"); set("brS", "La visa"); set("brF", "Vender");
  saveBizReview(dom);
  assert.ok(B().reviews[dom], "no escribio en el domingo");
  assert.strictEqual(B().reviews[dom].moved, "Cerre el CRM");
  // desde el lunes debe editar EL MISMO registro
  const sec = bizReviewSection(lun);
  assert.ok(sec, "no se pinta el lunes");
  assert.ok(sec.includes("Cerre el CRM"), "el lunes no precarga lo del domingo");
  assert.ok(sec.includes("saveBizReview('" + dom + "')"), "el lunes escribiria en otra fecha");
  set("brM", "Corregido el lunes"); set("brS", "x"); set("brF", "y");
  saveBizReview(reviewDateFor(lun));
  assert.strictEqual(Object.keys(B().reviews).length, 1, "creo un registro nuevo en vez de editar");
  assert.strictEqual(B().reviews[dom].moved, "Corregido el lunes");
});
t("los otros cinco dias no la pintan", () => {
  let mie = today(); while (weekdayIdx(mie) !== 2) mie = addDays(mie, -1);
  assert.strictEqual(bizReviewSection(mie), null);
});
t("se pre-llena con hechos que la app ya sabe", () => {
  let dom = today(); while (weekdayIdx(dom) !== 6) dom = addDays(dom, -1);
  const f = bizWeekFacts(dom);
  assert.ok(typeof f.acciones === "number" && typeof f.leads === "number");
  assert.ok(typeof f.segundos === "number" && typeof f.nums === "number");
  const s = bizReviewSection(dom);
  assert.ok(s.includes("acciones cerradas") && s.includes("leads movidos") && s.includes("de foco"),
    "no muestra los hechos de la semana");
});
t("los hechos solo cuentan la semana correcta", () => {
  reset();
  let dom = today(); while (weekdayIdx(dom) !== 6) dom = addDays(dom, -1);
  const dentro = new Date(addDays(dom, -2) + "T12:00:00").getTime();
  const fuera = new Date(addDays(dom, -10) + "T12:00:00").getTime();
  B().done.push({ id: "a", projectId: "p", text: "dentro", doneAt: dentro });
  B().done.push({ id: "b", projectId: "p", text: "fuera", doneAt: fuera });
  B().focus.push({ id: "f1", date: addDays(dom, -1), projectId: "p", seconds: 3600, note: "" });
  B().focus.push({ id: "f2", date: addDays(dom, -20), projectId: "p", seconds: 7200, note: "" });
  saveBiz();
  const f = bizWeekFacts(dom);
  assert.strictEqual(f.acciones, 1, "conto acciones de otra semana");
  assert.strictEqual(f.segundos, 3600, "conto foco de otra semana");
});
t("la Bitacora lee la revision del negocio", () => {
  let dom = today(); while (weekdayIdx(dom) !== 6) dom = addDays(dom, -1);
  B().reviews[dom] = { moved: "Se movio el CRM", stuck: "", focus: "Vender" };
  saveBiz();
  const h = bitacoraList();
  assert.ok(h.includes("Revisión del negocio"), "la Bitacora no la muestra");
  assert.ok(h.includes("Se movio el CRM"), "no trae el texto");
  assert.ok(h.includes("Vender"));
});

/* =====================================================================
   F. Todo junto sigue viajando
   ===================================================================== */
console.log("\n== F. Respaldo con TODOS los contenedores llenos ==");
t("mt_biz completo sobrevive exportar -> borrar -> restaurar", () => {
  reset();
  const p = crearProy("CRM", "Terminar la demo");
  openLead(); set("lgName", "Estudio Ollin"); set("lgContact", ""); set("lgValue", "1000");
  set("lgFollow", ""); set("lgNotes", ""); pickLeadStage("nuevo"); pickLeadProject(""); saveLead("");
  completeNextAction(p.id); closeModal();
  openBizMetric(); set("bnName", "Ingreso"); set("bnUnit", "MXN"); set("bnTarget", 1000); pickBmPeriod("mes"); saveBizMetric("");
  setBizMval(B().metrics[0].id, periodKey("mes"), 500);
  set("ideaIn", "Una idea"); captureIdea();
  B().focus.push({ id: "f", date: today(), projectId: p.id, seconds: 1800, note: "n" });
  B().reviews[today()] = { moved: "algo", stuck: "", focus: "" };
  startFocus(p.id);
  saveBiz();
  const antes = JSON.parse(MEM.mt_biz), corriendo = MEM.mt_focusRun;
  ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(k => assert.ok(antes[k].length > 0, k + " vacio antes de respaldar"));
  assert.ok(Object.keys(antes.mvals).length && Object.keys(antes.reviews).length);

  const texto = JSON.stringify(buildBackup());
  Object.keys(MEM).forEach(k => delete MEM[k]);
  assert.strictEqual(applyBackup(texto), true);
  refreshState();
  const b = __getBIZ();
  ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(k =>
    assert.strictEqual(b[k].length, antes[k].length, "se perdio " + k));
  assert.deepStrictEqual(b.mvals, antes.mvals, "se perdieron los valores");
  assert.deepStrictEqual(b.reviews, antes.reviews, "se perdieron las revisiones");
  assert.strictEqual(MEM.mt_focusRun, corriendo, "se perdio la sesion en curso");
  assert.ok(getFocusRun(), "la sesion en curso no revivio");
});
t("loadBiz sigue tolerando un respaldo viejo sin los contenedores nuevos", () => {
  MEM.mt_biz = '{"projects":[{"id":"a","name":"X"}]}';
  const b = loadBiz();
  ["leads", "done", "metrics", "ideas", "focus"].forEach(k => assert.ok(Array.isArray(b[k]), k));
  ["mvals", "reviews"].forEach(k => assert.ok(b[k] && !Array.isArray(b[k]), k));
  assert.strictEqual(b.projects[0].name, "X");
});

/* El stub del harness devuelve un elemento para CUALQUIER id, asi que el
   intervalo del cronometro nunca se apagaria solo y Node no saldria. */
clearFocusRun(); armFocusTimer();

console.log("\n" + n + " pruebas OK\n");
