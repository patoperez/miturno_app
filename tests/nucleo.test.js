const assert = require("assert");
const { ROOT } = require("./harness");
const els = global.__els;
let n = 0;
function t(name, fn) { fn(); n++; console.log("  ok  " + name); }
const pct = d => Math.round(pointsFor(d) / (maxFor(d) || 1) * 100) || 0;

const T = today();
const AYER = addDays(T, -1);
const PAST = addDays(T, -5);

function resetCfg() {
  CFG.habits.length = 0;
  CFG.commitments.length = 0;
  CFG.meals.menu.length = 0;
  CFG.meals.fichas.categories.length = 0;
  CFG.metrics.length = 0;
  CFG.settings.mealView = "menu";
}
function mkDay(marks, extra) {
  const l = { habits: {}, commitments: {}, notes: {}, menuDone: {}, fichas: {},
              inneg: {}, metrics: {}, sleep: null, mood: null, journal: "" };
  (marks || []).forEach(id => { l.habits[id] = true; });
  return Object.assign(l, extra || {});
}

/* =====================================================================
   1. REGRESIÓN: recalcDay no puede encoger el denominador de un día
   ===================================================================== */
console.log("\n== 1. Regresion del 150% (recalcDay y el denominador) ==");

resetCfg();
CFG.habits.push({ id: "h1", name: "Leer", idn: null }, { id: "h2", name: "Correr", idn: null },
                { id: "h3", name: "Meditar", idn: null }, { id: "h4", name: "Escribir", idn: null });
// Ayer: 3 de 4 marcados, congelado como lo dejaria freezePastDays.
LOG[AYER] = mkDay(["h1", "h2", "h3"], { frozen: true, pts: 3, max: 4 });

t("punto de partida: ayer lee 3/4 = 75%", () => {
  assert.strictEqual(maxPts(), 4);
  assert.strictEqual(pointsFor(AYER), 3);
  assert.strictEqual(maxFor(AYER), 4);
  assert.strictEqual(pct(AYER), 75);
});
t("borro UN habito hoy: ayer sigue 3/4 (historial protegido)", () => {
  CFG.habits = CFG.habits.filter(h => h.id !== "h4");
  global.CFG = CFG;
  assert.strictEqual(maxPts(), 3);
  assert.strictEqual(pct(AYER), 75, "un cambio de config movio el pasado");
});
t("borro un SEGUNDO habito: ayer sigue 3/4 aunque maxPts() ya sea 2", () => {
  CFG.habits = CFG.habits.filter(h => h.id !== "h3");
  assert.strictEqual(maxPts(), 2);
  assert.strictEqual(pct(AYER), 75);
});
t("y AHORA edito ayer: sigue 3/4 = 75%, nunca 3/2 = 150%", () => {
  // toggle de ida y vuelta sobre un habito que sigue existiendo
  toggleHabit(AYER, "h1");
  assert.strictEqual(LOG[AYER].pts, 2, "el toggle no recalculo pts");
  assert.strictEqual(LOG[AYER].max, 4, "max se encogio al editar");
  assert.ok(pct(AYER) <= 100, "paso de 100% con h1 desmarcado");
  toggleHabit(AYER, "h1");
  assert.strictEqual(LOG[AYER].pts, 3, "pts no volvio a 3");
  assert.strictEqual(LOG[AYER].max, 4, "REGRESION: max encogio de 4 a " + LOG[AYER].max);
  assert.strictEqual(pct(AYER), 75, "REGRESION: ayer lee " + pct(AYER) + "% en vez de 75%");
});
t("max solo crece: si la config crece, el dia puede subir su techo", () => {
  CFG.habits.push({ id: "h5", name: "Nadar", idn: null }, { id: "h6", name: "Estirar", idn: null },
                  { id: "h7", name: "Diario", idn: null }, { id: "h8", name: "Caminar", idn: null });
  assert.strictEqual(maxPts(), 6);
  toggleHabit(AYER, "h1"); toggleHabit(AYER, "h1");   // fuerza recalcDay
  assert.ok(LOG[AYER].max >= 4, "max bajo de 4");
  assert.ok(LOG[AYER].pts <= LOG[AYER].max, "pts quedo por encima de max");
});

console.log("\n== 2. Ningun dia puede pintar mas de 100% ==");
t("dia con marcas de habitos ya borrados nunca pasa de 100%", () => {
  resetCfg();
  CFG.habits.push({ id: "a", name: "A", idn: null });
  // marcas de 4 habitos, de los cuales 3 ya no existen en CFG
  LOG[PAST] = mkDay(["a", "borrado1", "borrado2", "borrado3"], { frozen: true, pts: 4, max: 4 });
  assert.ok(pct(PAST) <= 100, "pinto " + pct(PAST) + "%");
  toggleHabit(PAST, "a"); toggleHabit(PAST, "a");
  assert.ok(pct(PAST) <= 100, "tras editar pinto " + pct(PAST) + "%");
});
t("sana historiales YA torcidos por la version anterior (max=2, pts=3)", () => {
  const roto = addDays(T, -8);
  LOG[roto] = mkDay(["x", "y", "z"], { frozen: true, pts: 3, max: 2 });   // guardado por el bug viejo
  assert.ok(pct(roto) <= 100, "un LOG heredado sigue pintando " + pct(roto) + "%");
  assert.strictEqual(pct(roto), 100);
});
t("dia de HOY con marcas huerfanas tampoco pasa de 100%", () => {
  resetCfg();
  CFG.habits.push({ id: "a", name: "A", idn: null });
  LOG[T] = mkDay(["a", "fantasma1", "fantasma2"]);   // no congelado: se calcula en vivo
  assert.ok(pct(T) <= 100, "hoy pinto " + pct(T) + "%");
});
t("barrido: ningun dia del LOG pinta mas de 100%", () => {
  Object.keys(LOG).forEach(d => {
    assert.ok(pct(d) <= 100, "el dia " + d + " pinta " + pct(d) + "%");
  });
});
t("un dia normal no se ve afectado: 2 de 4 sigue siendo 50%", () => {
  resetCfg();
  CFG.habits.push({ id: "h1", name: "A", idn: null }, { id: "h2", name: "B", idn: null },
                  { id: "h3", name: "C", idn: null }, { id: "h4", name: "D", idn: null });
  const d = addDays(T, -12);
  LOG[d] = mkDay(["h1", "h2"], { frozen: true, pts: 2, max: 4 });
  assert.strictEqual(pct(d), 50);
  toggleHabit(d, "h3");
  assert.strictEqual(LOG[d].pts, 3);
  assert.strictEqual(LOG[d].max, 4);
  assert.strictEqual(pct(d), 75, "editar un dia normal dejo de sumar bien");
});

/* =====================================================================
   3. Editar un dia congelado sigue actualizando pts (no se rompio nada)
   ===================================================================== */
console.log("\n== 3. Editar un dia pasado congelado sigue funcionando ==");
resetCfg();
CFG.habits.push({ id: "h1", name: "Leer", idn: null }, { id: "h2", name: "Correr", idn: null },
                { id: "h3", name: "Meditar", idn: null });
CFG.commitments.push({ id: "c1", name: "No pantalla", idn: null });
CFG.meals.menu.push({ id: "m1", name: "Desayuno", desc: "" }, { id: "m2", name: "Cena", desc: "" });
LOG[PAST] = mkDay(["h1"], { frozen: true, pts: 1, max: 6 });

t("maxPts = habitos + compromisos + peso de comidas", () => assert.strictEqual(maxPts(), 3 + 1 + 2));
t("toggleHabit sube pts y pointsFor lo refleja", () => {
  toggleHabit(PAST, "h2");
  assert.strictEqual(LOG[PAST].pts, 2);
  assert.strictEqual(pointsFor(PAST), 2);
  assert.strictEqual(LOG[PAST].frozen, true);
});
t("destildar vuelve a bajar", () => {
  toggleHabit(PAST, "h2");
  assert.strictEqual(pointsFor(PAST), 1);
});
t("toggleCommit y toggleMenu (mealScore) tambien recalculan", () => {
  toggleCommit(PAST, "c1");
  assert.strictEqual(LOG[PAST].pts, 2);
  toggleMenu(PAST, "m1");
  assert.strictEqual(LOG[PAST].pts, 3);
  toggleCommit(PAST, "c1"); toggleMenu(PAST, "m1");
  assert.strictEqual(LOG[PAST].pts, 1);
});
t("recalcDay no toca un dia NO congelado", () => {
  const l = day(T); delete l.frozen; delete l.pts;
  recalcDay(T);
  assert.strictEqual(l.pts, undefined);
});
t("sueno / mood / bitacora no mueven el puntaje", () => {
  const before = LOG[PAST].pts;
  setSleep(PAST, "7h"); setMood(PAST, 8); setJournal(PAST, "nota");
  assert.strictEqual(LOG[PAST].pts, before);
});

/* =====================================================================
   4. Navegacion: nunca al futuro
   ===================================================================== */
console.log("\n== 4. Navegacion de dia: nunca al futuro ==");
t("goDay(+1) parado en hoy NO avanza (rebota)", () => {
  goToday(); goDay(1);
  assert.strictEqual(__getVDAY(), T, "se navego al futuro");
});
t("goDay(-1) retrocede y goDay(+1) vuelve, topando en hoy", () => {
  goToday(); goDay(-1);
  assert.strictEqual(__getVDAY(), addDays(T, -1));
  goDay(1); assert.strictEqual(__getVDAY(), T);
  goDay(1); assert.strictEqual(__getVDAY(), T, "topo mal");
});
t("setVDay y viewDay recortan cualquier fecha futura", () => {
  setVDay("2099-01-01"); assert.strictEqual(__getVDAY(), T);
  __setVDAY("2099-06-01"); assert.strictEqual(viewDay(), T);
});
t("goToday desde el pasado vuelve a hoy", () => {
  setVDay(PAST); assert.strictEqual(__getVDAY(), PAST);
  goToday(); assert.strictEqual(__getVDAY(), T);
});
t("editDay sigue funcionando y recorta el futuro", () => {
  __setVIEW("progreso");
  editDay(PAST);
  assert.strictEqual(__getVDAY(), PAST);
  assert.strictEqual(__getVIEW(), "hoy");
  editDay("2099-01-01");
  assert.strictEqual(__getVDAY(), T);
});
t("bounceHoy y slideHoy no explotan sin DOM real", () => {
  bounceHoy(); slideHoy(-1); slideHoy(1);
});

/* =====================================================================
   5. La fecha aparece EXACTAMENTE una vez, y no queda rastro de .daynav
   ===================================================================== */
console.log("\n== 5. Una sola fecha en pantalla ==");
function count(hay, needle) {
  let c = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { c++; i += needle.length; }
  return c;
}
t("en hoy la fecha aparece una sola vez", () => {
  goToday(); renderHoy();
  const h = els.app.innerHTML;
  assert.strictEqual(count(h, cap(fmtDate(T))), 1, "la fecha aparece " + count(h, cap(fmtDate(T))) + " veces");
});
t("en un dia pasado la fecha tambien aparece una sola vez", () => {
  setVDay(PAST); renderHoy();
  const h = els.app.innerHTML;
  assert.strictEqual(count(h, cap(fmtDate(PAST))), 1, "la fecha aparece " + count(h, cap(fmtDate(PAST))) + " veces");
});
t("no queda nada del navegador .daynav", () => {
  const h = els.app.innerHTML;
  assert.ok(!/daynav/.test(h), "sigue el .daynav");
  assert.ok(!/dn-today/.test(h), "sigue el boton viejo");
  assert.ok(!/goDay\(/.test(h), "quedaron flechas que llaman a goDay");
});
t("dia pasado: fecha tenida + chip Hoy que vuelve a hoy", () => {
  setVDay(PAST); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(/class="date past"/.test(h), "la fecha no va tenida");
  assert.ok(/todaychip/.test(h), "falta el chip Hoy");
  assert.ok(/onclick="goToday\(\)"/.test(h), "el chip no vuelve a hoy");
  assert.ok(h.includes("Estás editando otro día"));
});
t("en hoy no hay chip ni tinte", () => {
  goToday(); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(!/date past/.test(h), "tine la fecha estando en hoy");
  assert.ok(!/todaychip/.test(h), "muestra el chip estando en hoy");
});
t("el anillo del header usa los puntos del dia VISTO", () => {
  setVDay(PAST); renderHoy();
  assert.ok(els.app.innerHTML.includes(">" + pct(PAST) + "%<"), "el anillo no es el del dia visto");
});

/* =====================================================================
   6. Pista de deslizar (una sola vez) y arrastre intacto
   ===================================================================== */
console.log("\n== 6. Pista de deslizar y arrastre ==");
t("la pista sale la primera vez", () => {
  goToday(); renderHoy();
  assert.ok(swipeHintPending(), "la pista ya venia apagada");
  assert.ok(/swipehint/.test(els.app.innerHTML), "no se pinto la pista");
  assert.ok(els.app.innerHTML.includes("Desliza para ver otro día"));
});
t("tras el primer swipe la pista se apaga para siempre", () => {
  dismissSwipeHint();
  assert.ok(!swipeHintPending());
  renderHoy();
  assert.ok(!/swipehint/.test(els.app.innerHTML), "la pista sigue ahi");
  assert.strictEqual(global.__MEM.mt_swipeHint, "1");
});
t("mt_swipeHint NO se sincroniza ni entra al respaldo", () => {
  assert.ok(!BACKUP_KEYS.includes("mt_swipeHint"), "la pista se estaria sincronizando");
});
t("las secciones arrastrables siguen intactas", () => {
  goToday(); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(/id="hoylist"/.test(h), "se perdio #hoylist");
  assert.ok(/<div class="dsec" data-key="/.test(h), "se perdieron los nodos arrastrables");
  const keys = HOY_ORDER.filter(k => h.includes('data-key="' + k + '"'));
  assert.ok(keys.length >= 8, "faltan secciones arrastrables: " + keys.length);
});
t("dia pasado: sin 'Iniciar' rutina y sin 'Proximas'", () => {
  TASKS.length = 0;
  TASKS.push({ id: "t1", text: "Futura", date: addDays(T, 2), done: false });
  setVDay(PAST); renderHoy();
  const h = els.app.innerHTML;
  assert.ok(!/Iniciar/.test(h));
  assert.ok(!/Próximas/.test(h));
  assert.ok(h.includes("openTask('" + PAST + "')"));
});

console.log("\n" + n + " pruebas OK\n");
