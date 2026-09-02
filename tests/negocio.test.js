const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
const MEM = global.__MEM;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }

const DAY = 86400000;
const B = () => __getBIZ();
/* Los stubs del harness se crean al pedirlos por id, no al pintar el HTML. */
const set = (id, v) => { document.getElementById(id).value = v == null ? "" : v; };
function reset() { B().projects.length = 0; B().leads.length = 0; B().done.length = 0; saveBiz(); }
/* Crea un proyecto pasando por la UI real (openBizProject + saveBizProject). */
function crear(name, extra) {
  openBizProject();
  set("bpName", name);
  set("bpWhy", (extra && extra.why) || "");
  set("bpNa", (extra && extra.nextAction) || "");
  set("bpDue", (extra && extra.nextActionDue) || "");
  if (extra && extra.color) pickBizColor(extra.color);
  pickBizStatus((extra && extra.status) || "activo");
  saveBizProject("");
  const p = B().projects[B().projects.length - 1];
  if (extra && extra.updatedAt) { p.updatedAt = extra.updatedAt; saveBiz(); }
  return p;
}

/* =====================================================================
   1. El almacén
   ===================================================================== */
console.log("\n== 1. mt_biz: forma, tolerancia y arranque en frio ==");
t("arranque en frio: todos los contenedores existen y estan vacios", () => {
  assert.deepStrictEqual(Object.keys(DEFAULT_BIZ).sort(),
    ["done", "focus", "ideas", "leads", "metrics", "mvals", "projects", "reviews"]);
  const b = B();
  ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(k => {
    assert.ok(Array.isArray(b[k]), k + " no es arreglo"); assert.strictEqual(b[k].length, 0, k + " no viene vacio");
  });
  ["mvals", "reviews"].forEach(k => {
    assert.ok(b[k] && typeof b[k] === "object" && !Array.isArray(b[k]), k + " no es objeto");
    assert.strictEqual(Object.keys(b[k]).length, 0, k + " no viene vacio");
  });
});
t("loadBiz tolera ausencia, basura, arreglo y objeto parcial", () => {
  const casos = [
    [undefined, "sin clave"],
    ["", "cadena vacia"],
    ["no es json {{{", "basura"],
    ["null", "null"],
    ["[1,2,3]", "arreglo en vez de objeto"],
    ['{"projects":[{"id":"a","name":"X"}]}', "objeto parcial"],
    ['{"projects":"no soy arreglo","mvals":[]}', "tipos equivocados"]
  ];
  casos.forEach(([raw, label]) => {
    if (raw === undefined) delete MEM.mt_biz; else MEM.mt_biz = raw;
    const b = loadBiz();
    ["projects", "leads", "done", "metrics", "ideas", "focus"].forEach(k => assert.ok(Array.isArray(b[k]), label + ": " + k));
    ["mvals", "reviews"].forEach(k => assert.ok(b[k] && !Array.isArray(b[k]) && typeof b[k] === "object", label + ": " + k));
  });
  // el objeto parcial conserva lo que si venia
  MEM.mt_biz = '{"projects":[{"id":"a","name":"X"}]}';
  assert.strictEqual(loadBiz().projects[0].name, "X", "perdio el proyecto del objeto parcial");
  delete MEM.mt_biz;
});

/* =====================================================================
   2. Crear / editar / borrar, y que persista
   ===================================================================== */
console.log("\n== 2. Proyectos: crear, editar, borrar ==");
reset();
t("crear persiste a mt_biz con todos los campos del modelo", () => {
  const p = crear("CRM", { why: "Mi producto", nextAction: "Definir el onboarding", nextActionDue: "2026-09-10", color: PALETTE[4] });
  assert.ok(p.id, "sin id");
  assert.strictEqual(p.name, "CRM");
  assert.strictEqual(p.color, PALETTE[4]);
  assert.strictEqual(p.status, "activo");
  assert.strictEqual(p.why, "Mi producto");
  assert.strictEqual(p.nextAction, "Definir el onboarding");
  assert.strictEqual(p.nextActionDue, "2026-09-10");
  assert.ok(p.updatedAt > 0, "sin updatedAt");
  const guardado = JSON.parse(MEM.mt_biz);
  assert.strictEqual(guardado.projects.length, 1, "no persistio");
  assert.strictEqual(guardado.projects[0].name, "CRM");
});
t("un proyecto sin nombre no se crea", () => {
  const antes = B().projects.length;
  openBizProject(); set("bpName", "   "); saveBizProject("");
  assert.strictEqual(B().projects.length, antes, "creo un proyecto sin nombre");
});
t("editar persiste y refresca updatedAt", () => {
  const p = B().projects[0];
  p.updatedAt = Date.now() - 5 * DAY; saveBiz();
  const antes = p.updatedAt;
  openBizProject(p.id);
  set("bpName", "CRM Ollin"); set("bpWhy", "Mi producto"); set("bpNa", "Definir el onboarding"); set("bpDue", "2026-09-10");
  pickBizStatus("pausado"); saveBizProject(p.id);
  const q = bizProject(p.id);
  assert.strictEqual(q.name, "CRM Ollin");
  assert.strictEqual(q.status, "pausado");
  assert.ok(q.updatedAt > antes, "no refresco updatedAt");
  assert.strictEqual(JSON.parse(MEM.mt_biz).projects[0].name, "CRM Ollin", "no persistio la edicion");
  pickBizStatus("activo"); openBizProject(p.id);
  set("bpName", "CRM Ollin"); set("bpNa", "Definir el onboarding"); set("bpDue", "2026-09-10");
  pickBizStatus("activo"); saveBizProject(p.id);
});
t("sin proxima accion no se guarda fecha suelta", () => {
  const p = B().projects[0];
  openBizProject(p.id);
  set("bpName", p.name); set("bpNa", ""); set("bpDue", "2026-12-01");
  pickBizStatus("activo"); saveBizProject(p.id);
  assert.strictEqual(bizProject(p.id).nextActionDue, "", "dejo una fecha sin accion");
  set("bpNa", "Definir el onboarding"); set("bpDue", "");
  openBizProject(p.id); set("bpName", p.name); set("bpNa", "Definir el onboarding"); set("bpDue", "");
  pickBizStatus("activo"); saveBizProject(p.id);
});
t("borrar quita y persiste", () => {
  const p = crear("Temporal");
  const id = p.id;
  confirmDelProject(id);
  assert.ok(els.modal.innerHTML.includes("Sí, borrar"), "no pidio confirmacion");
  assert.ok(els.modal.innerHTML.includes("Temporal"), "la confirmacion no nombra el proyecto");
  delBizProject(id);
  assert.ok(!bizProject(id), "no lo borro");
  assert.ok(!JSON.parse(MEM.mt_biz).projects.some(x => x.id === id), "no persistio el borrado");
});

/* =====================================================================
   3. Respaldo y nube
   ===================================================================== */
console.log("\n== 3. Respaldo y sincronizacion ==");
t("mt_biz esta en BACKUP_KEYS", () => {
  assert.ok(BACKUP_KEYS.includes("mt_biz"), "mt_biz NO esta en BACKUP_KEYS: se perderia en silencio");
});
t("el JSON del respaldo contiene mt_biz de verdad", () => {
  const bk = buildBackup();
  assert.ok("mt_biz" in bk.data, "el respaldo no trae mt_biz");
  assert.ok(JSON.parse(bk.data.mt_biz).projects.length > 0, "mt_biz del respaldo va vacio");
  assert.ok(JSON.stringify(bk).includes("CRM Ollin"), "el proyecto no viaja en el respaldo");
});
t("ciclo exportar -> borrar todo -> restaurar conserva los proyectos", () => {
  const antes = JSON.parse(MEM.mt_biz);
  const texto = JSON.stringify(buildBackup());
  Object.keys(MEM).forEach(k => delete MEM[k]);        // borron total
  assert.strictEqual(MEM.mt_biz, undefined);
  assert.strictEqual(applyBackup(texto), true, "no restauro");
  refreshState();
  const b = __getBIZ();
  assert.strictEqual(b.projects.length, antes.projects.length, "se perdieron proyectos");
  assert.strictEqual(b.projects[0].name, antes.projects[0].name);
  assert.strictEqual(b.projects[0].nextAction, antes.projects[0].nextAction);
  assert.ok(Array.isArray(b.leads) && b.mvals && !Array.isArray(b.mvals), "los contenedores vacios no sobrevivieron");
});
t("sync.js sincroniza por BACKUP_KEYS, asi que mt_biz viaja a la nube", () => {
  const fs = require("fs"), path = require("path");
  const sync = fs.readFileSync(path.join(ROOT, "js/sync.js"), "utf8");
  assert.ok(/BACKUP_KEYS\.forEach/.test(sync), "sync.js ya no recorre BACKUP_KEYS");
  assert.ok(/buildBackup\(\)\.data/.test(sync), "sync.js no sube buildBackup().data");
  assert.ok(/indexOf\("mt_"\) === 0/.test(sync), "sync.js no dispara al escribir claves mt_*");
});

/* =====================================================================
   4. Orden de atencion y estancamiento
   ===================================================================== */
console.log("\n== 4. Orden de atencion, vencidas y estancados ==");
reset();
const T = today();
const pVenc = crear("Vencido", { nextAction: "Mandar propuesta", nextActionDue: addDays(T, -2) });
const pHoy = crear("Para hoy", { nextAction: "Llamar al cliente", nextActionDue: T });
const pSin = crear("Sin accion", {});
const pEstancado = crear("Estancado", { nextAction: "Retomar", updatedAt: Date.now() - 20 * DAY });
const pOk = crear("Al dia", { nextAction: "Seguir", nextActionDue: addDays(T, 10) });

t("dueState clasifica vencida / hoy / futura", () => {
  assert.strictEqual(dueState(pVenc), "vencida");
  assert.strictEqual(dueState(pHoy), "hoy");
  assert.strictEqual(dueState(pOk), "futura");
  assert.strictEqual(dueState(pSin), null, "sin accion no deberia tener estado de fecha");
});
t("isStale marca lo que lleva 2 semanas sin tocarse", () => {
  assert.ok(isStale(pEstancado), "no detecto el estancado");
  assert.ok(!isStale(pOk), "marco como estancado uno recien tocado");
  assert.strictEqual(BIZ_STALE_DAYS, 14);
});
t("un proyecto pausado no cuenta como estancado", () => {
  const p = crear("Pausado viejo", { status: "pausado", updatedAt: Date.now() - 60 * DAY });
  assert.ok(!isStale(p), "un pausado no deberia 'estancarse'");
  delBizProject(p.id);
});
t("el orden es: vencida, hoy, sin accion, estancado, resto", () => {
  const orden = activeProjects().map(p => p.name);
  assert.deepStrictEqual(orden, ["Vencido", "Para hoy", "Sin accion", "Estancado", "Al dia"], "orden real: " + orden.join(" > "));
});
t("a igual rango, primero el que lleva mas tiempo sin tocarse", () => {
  const a = crear("Viejo", { nextAction: "X", updatedAt: Date.now() - 3 * DAY });
  const b = crear("Nuevo", { nextAction: "Y" });
  const ns = activeProjects().map(p => p.name);
  assert.ok(ns.indexOf("Viejo") < ns.indexOf("Nuevo"), "no priorizo el mas viejo");
  delBizProject(a.id); delBizProject(b.id);
});
t("activeProjects deja fuera pausados y terminados", () => {
  const p = crear("Terminado", { status: "terminado" });
  assert.ok(!activeProjects().some(x => x.id === p.id), "un terminado salio como activo");
  delBizProject(p.id);
});
t("agoLabel dice hoy / ayer / hace N dias", () => {
  assert.strictEqual(agoLabel(Date.now()), "hoy");
  assert.strictEqual(agoLabel(Date.now() - 1 * DAY - 1000), "ayer");
  assert.strictEqual(agoLabel(Date.now() - 5 * DAY - 1000), "hace 5 días");
  assert.strictEqual(agoLabel(Date.now() - 40 * DAY), "hace 1 mes");
  assert.strictEqual(agoLabel(null), "sin actividad");
});

/* =====================================================================
   5. Completar una accion pide la siguiente
   ===================================================================== */
console.log("\n== 5. Completar la proxima accion ==");
t("completar la deja vacia y abre de inmediato la pregunta", () => {
  const p = bizProject(pHoy.id);
  completeNextAction(p.id);
  assert.strictEqual(bizProject(p.id).nextAction, "", "no limpio la accion");
  assert.strictEqual(bizProject(p.id).nextActionDue, "", "dejo la fecha vieja");
  assert.ok(els.modal.innerHTML.includes("¿Y ahora qué sigue?"), "no pregunto por la siguiente");
  assert.ok(els.modal.innerHTML.includes("Ahora no"), "no deja salir sin definirla");
  assert.strictEqual(JSON.parse(MEM.mt_biz).projects.find(x => x.id === p.id).nextAction, "", "no persistio");
});
t("guardar la siguiente accion la escribe con su fecha", () => {
  set("naTxt", "Cerrar la propuesta"); set("naDue", addDays(T, 3));
  saveNextAction(pHoy.id);
  const p = bizProject(pHoy.id);
  assert.strictEqual(p.nextAction, "Cerrar la propuesta");
  assert.strictEqual(p.nextActionDue, addDays(T, 3));
  assert.strictEqual(JSON.parse(MEM.mt_biz).projects.find(x => x.id === p.id).nextAction, "Cerrar la propuesta");
});
t("vaciar la accion tambien limpia la fecha", () => {
  set("naTxt", "   "); set("naDue", addDays(T, 3));
  saveNextAction(pHoy.id);
  const p = bizProject(pHoy.id);
  assert.strictEqual(p.nextAction, "");
  assert.strictEqual(p.nextActionDue, "", "quedo una fecha huerfana");
  set("naTxt", "Llamar al cliente"); set("naDue", T); saveNextAction(pHoy.id);
});

/* =====================================================================
   6. La vista Negocio
   ===================================================================== */
console.log("\n== 6. Vista Negocio ==");
t("con proyectos: tarjetas, proxima accion prominente y aviso de estancado", () => {
  __setVIEW("negocio"); renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Vencido") && h.includes("Estancado"), "faltan proyectos");
  assert.ok(h.includes("bizna"), "la proxima accion no tiene su bloque");
  assert.ok(h.includes("Mandar propuesta"), "no muestra el texto de la accion");
  assert.ok(h.includes("bizna nag"), "no reclama el proyecto sin proxima accion");
  assert.ok(h.includes("Define el siguiente paso"), "el nag no dice que hacer");
  assert.ok(h.includes("bizdue venc"), "no marca la vencida");
  assert.ok(h.includes("bizstale"), "no marca el estancado");
  assert.ok(h.includes("completeNextAction("), "no se puede completar desde la tarjeta");
  assert.ok(h.includes("openBizProject("), "las tarjetas no abren el detalle");
});
t("el resumen del hero cuenta vencidas, sin accion y estancados", () => {
  const h = els.app.innerHTML;
  assert.ok(/1 acción vencida/.test(h), "no cuenta vencidas");
  assert.ok(/1 sin próxima acción/.test(h), "no cuenta las que faltan");
  assert.ok(/1 estancado/.test(h), "no cuenta estancados");
});
t("pausados y terminados van abajo, aparte", () => {
  const p = crear("Guardado", { status: "terminado" });
  renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Pausados y terminados"), "no separa los inactivos");
  const iAct = h.indexOf("Vencido"), iOtros = h.indexOf("Pausados y terminados");
  assert.ok(iAct < iOtros, "los inactivos no quedaron abajo");
  delBizProject(p.id);
});
t("sin proyectos: estado vacio con su llamada a la accion", () => {
  const guardados = B().projects.slice();
  B().projects.length = 0; saveBiz();
  renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Empieza por un proyecto"), "sin estado vacio");
  assert.ok(h.includes("openBizProject()"), "el estado vacio no deja crear");
  assert.ok(!h.includes("bizna"), "pinta tarjetas sin proyectos");
  guardados.forEach(p => B().projects.push(p)); saveBiz();
});

/* =====================================================================
   7. Negocio en Hoy
   ===================================================================== */
console.log("\n== 7. Negocio dentro de Hoy ==");
t("'biz' esta en DEFAULT_HOY_ORDER y participa del arrastre", () => {
  assert.ok(DEFAULT_HOY_ORDER.includes("biz"), "falta la clave biz");
  goToday(); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(h.includes('data-key="biz"'), "la seccion no es arrastrable");
});
t("un mt_hoyOrder viejo SIN 'biz' sigue valiendo y la agrega al final", () => {
  const viejo = ["review", "hab", "com", "gym", "meal", "metric", "task", "next", "sleep", "mood", "journal"];
  MEM.mt_hoyOrder = JSON.stringify(viejo);
  refreshState();
  const o = __getHOYORDER();
  viejo.forEach((k, i) => assert.strictEqual(o[i], k, "se altero el orden guardado en " + k));
  assert.strictEqual(o[o.length - 1], "biz", "no agrego biz al final");
  assert.strictEqual(o.length, viejo.length + 1);
});
t("un mt_hoyOrder con claves desconocidas no rompe", () => {
  MEM.mt_hoyOrder = JSON.stringify(["hab", "inventada", "com"]);
  refreshState();
  const o = __getHOYORDER();
  assert.ok(!o.includes("inventada"), "conservo una clave que ya no existe");
  DEFAULT_HOY_ORDER.forEach(k => assert.ok(o.includes(k), "falta " + k));
  delete MEM.mt_hoyOrder; refreshState();
});
t("Hoy muestra las acciones que piden atencion, con tope", () => {
  __setVIEW("hoy"); goToday(); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(h.includes("Negocio"), "no aparece la seccion");
  assert.ok(h.includes("Mandar propuesta"), "no trae la accion vencida");
  assert.ok(h.includes("Define la próxima acción"), "no reclama la que falta");
  assert.ok(h.includes("gotoProject("), "no salta al proyecto");
  const filas = (h.match(/gotoProject\(/g) || []).length;
  assert.ok(filas <= 4, "no respeto el tope de 4, salieron " + filas);
});
t("Hoy sin proyectos activos NO mete ruido", () => {
  const guardados = B().projects.slice();
  B().projects.length = 0; saveBiz();
  assert.strictEqual(bizSection(today()), null, "pinta la seccion sin proyectos");
  renderHoy();
  assert.ok(!els.app.innerHTML.includes('data-key="biz"'), "dejo la seccion vacia en Hoy");
  guardados.forEach(p => B().projects.push(p)); saveBiz();
});
t("en un dia pasado la seccion se retira, como 'Proximas'", () => {
  const ayer = addDays(today(), -1);
  assert.strictEqual(bizSection(ayer), null, "muestra acciones de hoy en un dia pasado");
  setVDay(ayer); renderHoy();
  assert.ok(!els.app.innerHTML.includes('data-key="biz"'), "la seccion sobrevivio a un dia pasado");
  goToday();
});
t("gotoProject cambia a Negocio y abre ese proyecto", () => {
  __setVIEW("hoy");
  const p = activeProjects()[0];
  gotoProject(p.id);
  assert.strictEqual(__getVIEW(), "negocio");
  assert.ok(els.modal.innerHTML.includes(esc(p.name)), "no abrio el proyecto");
});

console.log("\n" + n + " pruebas OK\n");
