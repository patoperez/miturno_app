const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }

console.log("\n== 1. Barra inferior ==");
t("5 pestanas, en el orden pedido", () => {
  assert.deepStrictEqual(NAV.map(x => x[0]), ["hoy", "progreso", "workouts", "negocio", "metas"]);
  assert.deepStrictEqual(NAV.map(x => x[1]), ["Hoy", "Progreso", "Workouts", "Negocio", "Metas"]);
});
t("Ajustes YA NO ocupa un lugar en la barra", () => {
  assert.ok(!NAV.some(x => x[0] === "ajustes"), "ajustes sigue en la barra");
});
t("cada pestana tiene un icono que existe en ICONS", () => {
  NAV.forEach(([v, l, ic]) => assert.ok(ICONS[ic], "icono inexistente: " + ic + " (" + v + ")"));
});
t("buildNav pinta las 5 y marca la activa", () => {
  __setVIEW("negocio"); buildNav();
  const h = els.nav.innerHTML;
  NAV.forEach(([v]) => assert.ok(h.includes('data-v="' + v + '"'), "falta " + v));
  assert.ok(!h.includes('data-v="ajustes"'));
});

console.log("\n== 2. Engrane en el header ==");
t("el engrane aparece en TODAS las vistas", () => {
  ["hoy", "progreso", "workouts", "negocio", "metas", "ajustes"].forEach(v => {
    __setVIEW(v);
    assert.ok(header("X").includes("hd-gear"), "sin engrane en " + v);
    assert.ok(header("X").includes("openAjustes()"), "el engrane no abre ajustes en " + v);
  });
});
t("fuera de Ajustes es el icono de ajustes; dentro es una X", () => {
  __setVIEW("hoy");
  const fuera = header("X");
  assert.ok(fuera.includes(ICONS.sliders), "no usa el icono de ajustes");
  assert.ok(!fuera.includes("hd-gear on"), "se pinta activo fuera de ajustes");
  assert.ok(fuera.includes('aria-label="Ajustes"'));
  __setVIEW("ajustes");
  const dentro = header("X");
  assert.ok(dentro.includes(ICONS.close), "dentro de ajustes no es una X");
  assert.ok(dentro.includes("hd-gear on"), "no se marca activo dentro de ajustes");
  assert.ok(dentro.includes('aria-label="Cerrar ajustes"'));
});
t("el engrane NO rompe el anillo de progreso", () => {
  __setVIEW("hoy");
  const h = header("X");
  assert.ok(h.includes('class="ring"'), "se perdio el anillo");
  assert.ok(h.includes("stroke-dasharray"), "se perdio el arco");
  assert.ok(/<div class="hd-r">/.test(h), "falta el bloque derecho");
});
t("el engrane convive con el estado de dia pasado de Hoy (dayKey)", () => {
  __setVIEW("hoy");
  const ayer = addDays(today(), -1);
  const h = header(cap(fmtDate(ayer)), "Estás editando otro día", ayer);
  assert.ok(h.includes('class="date past"'), "se perdio el tinte de dia pasado");
  assert.ok(h.includes("todaychip"), "se perdio el chip Hoy");
  assert.ok(h.includes("goToday()"), "el chip no vuelve a hoy");
  assert.ok(h.includes("hd-gear"), "se perdio el engrane en dia pasado");
  assert.ok(h.includes('class="ring"'), "se perdio el anillo en dia pasado");
});
t("en hoy (sin dayKey) no hay tinte ni chip, pero si engrane", () => {
  __setVIEW("hoy");
  const h = header(cap(fmtDate(today())));
  assert.ok(!/date past/.test(h));
  assert.ok(!/todaychip/.test(h));
  assert.ok(h.includes("hd-gear"));
});

console.log("\n== 3. Abrir y cerrar Ajustes ==");
t("desde cualquier vista, el engrane abre Ajustes y recuerda de donde venias", () => {
  ["hoy", "progreso", "workouts", "negocio", "metas"].forEach(v => {
    __setVIEW(v); __setLASTVIEW("hoy");
    openAjustes();
    assert.strictEqual(__getVIEW(), "ajustes", "no abrio ajustes desde " + v);
    assert.strictEqual(__getLASTVIEW(), v, "no recordo " + v);
    openAjustes();
    assert.strictEqual(__getVIEW(), v, "no regreso a " + v);
  });
});
t("si la vista anterior fuera 'ajustes', cae a Hoy en vez de trabarse", () => {
  __setVIEW("ajustes"); __setLASTVIEW("ajustes");
  openAjustes();
  assert.strictEqual(__getVIEW(), "hoy");
});
t("abrir Ajustes cierra cualquier modal abierto", () => {
  __setVIEW("hoy");
  els.modal.innerHTML = "<div>algo</div>";
  openAjustes();
  assert.strictEqual(els.modal.innerHTML, "", "dejo el modal abierto encima");
});
t("estando en Ajustes ninguna pestana queda marcada como activa", () => {
  __setVIEW("workouts"); openAjustes();
  assert.strictEqual(__getVIEW(), "ajustes");
  assert.ok(!/class="on"/.test(els.nav.innerHTML), "una pestana quedo activa dentro de ajustes");
  openAjustes();
});

console.log("\n== 4. Vista Negocio ==");
t("renderNegocio pinta sin proyectos y sin romperse", () => {
  __setVIEW("negocio"); renderNegocio();
  const h = els.app.innerHTML;
  assert.ok(h.length > 300, "render vacio");
  assert.ok(h.includes("Negocio"), "sin titulo");
  assert.ok(h.includes("hd-gear"), "sin engrane");
  assert.ok(h.includes("Empieza por un proyecto"), "sin estado vacio");
});
t("mt_biz SI esta en BACKUP_KEYS (respaldo y nube)", () => {
  assert.ok(BACKUP_KEYS.includes("mt_biz"), "mt_biz fuera de BACKUP_KEYS: se perderia en silencio");
});
t("el router resuelve 'negocio' a renderNegocio", () => {
  __setVIEW("negocio"); els.app.innerHTML = "";
  render();
  assert.ok(els.app.innerHTML.includes("Empieza por un proyecto"), "el router no llego a Negocio");
});
t("las demas vistas siguen pintando", () => {
  ["hoy", "progreso", "workouts", "metas", "ajustes"].forEach(v => {
    __setVIEW(v); els.app.innerHTML = "";
    render();
    assert.ok(els.app.innerHTML.length > 200, "la vista " + v + " quedo vacia");
  });
});

console.log("\n" + n + " pruebas OK\n");
