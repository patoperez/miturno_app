/* =====================================================================
   reorder.js  ·  Mi Turno
   - Reordenar las secciones de "Hoy" con mantener-presionado + arrastrar.
   - Deslizar horizontalmente en "Hoy" para cambiar de día.
   - Inicialización de la app (se carga al final).
===================================================================== */
"use strict";

function initReorderHoy() {
  const list = document.getElementById("hoylist");
  if (!list) return;
  list.querySelectorAll(".dsec").forEach(node => {
    const handle = node.querySelector(".sec-h");
    if (!handle) return;
    handle.style.cursor = "grab";
    handle.addEventListener("pointerdown", e => onPressStart(e, node, list));
  });
}

function onPressStart(e, node, list) {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const y0 = e.clientY, x0 = e.clientX;
  let dragging = false;
  const holdTimer = setTimeout(startDrag, 300);

  function startDrag() {
    dragging = true;
    window.__reorderDragging = true;   // el swipe de día se aparta mientras se reordena
    node.classList.add("dragging");
    document.body.classList.add("noscroll");
    const sc = document.getElementById("app"); if (sc) sc.classList.add("noscroll");
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
  }
  function onMove(ev) {
    if (!dragging) {
      /* Si el dedo se movió antes de los 300 ms no era mantener-presionado:
         en vertical era scroll, en horizontal es un swipe de día. En ambos
         casos se cancela el hold para no robarle el gesto a nadie. */
      if (Math.abs(ev.clientY - y0) > 8 || Math.abs(ev.clientX - x0) > 8) { clearTimeout(holdTimer); finish(false); }
      return;
    }
    ev.preventDefault();
    const y = ev.clientY;
    const sibs = Array.prototype.slice.call(list.querySelectorAll(".dsec")).filter(n => n !== node);
    for (const s of sibs) {
      const r = s.getBoundingClientRect();
      if (y > r.top && y < r.bottom) {
        if (y < r.top + r.height / 2) list.insertBefore(node, s);
        else list.insertBefore(node, s.nextSibling);
        break;
      }
    }
  }
  function onUp() { clearTimeout(holdTimer); finish(dragging); }
  function finish(wasDragging) {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    window.__reorderDragging = false;
    if (!wasDragging) return;
    node.classList.remove("dragging");
    document.body.classList.remove("noscroll");
    const sc = document.getElementById("app"); if (sc) sc.classList.remove("noscroll");
    HOY_ORDER = Array.prototype.slice.call(list.querySelectorAll(".dsec")).map(n => n.dataset.key);
    DEFAULT_HOY_ORDER.forEach(k => { if (!HOY_ORDER.includes(k)) HOY_ORDER.push(k); });
    saveHoyOrder();
    window._justDragged = true;
    setTimeout(() => { window._justDragged = false; }, 500);
    render();
  }
  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
}

/* ---------- Deslizar para cambiar de día (solo en Hoy) ----------
   Convive con tres gestos que ya existen, y por eso es tan restrictivo:
   1. Scroll vertical de #app  -> se exige |dx| > |dy| * SWIPE_RATIO y se
      abandona en cuanto el dedo se va más en vertical que en horizontal.
      El listener es passive y nunca hace preventDefault, así que el scroll
      nativo jamás se toca.
   2. Reordenar secciones (mantener-presionado) -> si hay un arrastre en
      curso (window.__reorderDragging) el swipe se ignora; y del otro lado,
      moverse >8px en horizontal cancela el hold antes de que empiece.
   3. Gesto "atrás" del borde izquierdo en iOS standalone -> se ignora todo
      lo que empiece dentro de EDGE_GUARD px del borde.
   Se decide en pointermove, no en pointerup: así el gesto responde de
   inmediato y sobrevive a un pointercancel del navegador. */
const SWIPE_MIN = 60;      // distancia horizontal mínima, en px
const SWIPE_RATIO = 1.5;   // |dx| debe superar |dy| * 1.5
const EDGE_GUARD = 24;     // franja del borde izquierdo que no se toca

function initSwipeHoy() {
  const sc = document.getElementById("app");
  if (!sc) return;
  let x0 = 0, y0 = 0, pid = null, dead = true;

  sc.addEventListener("pointerdown", e => {
    pid = null; dead = true;
    if (VIEW !== "hoy") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.clientX <= EDGE_GUARD) return;                       // gesto "atrás" de iOS
    if (e.target.closest && e.target.closest("textarea, input, select, .ov, .player")) return;
    const md = document.getElementById("modal");
    if (md && md.innerHTML) return;                            // hay un modal abierto
    pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dead = false;
  }, { passive: true });

  sc.addEventListener("pointermove", e => {
    if (dead || e.pointerId !== pid) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dy) > Math.abs(dx)) { dead = true; return; }   // esto era scroll
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy) * SWIPE_RATIO) return;
    dead = true; pid = null;
    if (window.__reorderDragging) return;                       // se está reordenando
    if (typeof dismissSwipeHint === "function") dismissSwipeHint();
    goDay(dx > 0 ? -1 : 1);                                     // derecha = día anterior
  }, { passive: true });

  const drop = () => { pid = null; dead = true; };
  sc.addEventListener("pointerup", drop, { passive: true });
  sc.addEventListener("pointercancel", drop, { passive: true });
}

/* ---------- Alto real de la barra inferior ----------
   La barra está fija al borde inferior, así que .app reserva su alto como
   padding. Se mide en runtime para que nunca quede corto ni sobre (safe area,
   tamaño de texto del sistema, rotación). */
function syncNavHeight() {
  const n = document.getElementById("nav");
  if (!n) return;
  const h = Math.round(n.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty("--nav-h", h + "px");
}

/* ---------- Init de la app ---------- */
freezePastDays();
migrateExercises();   // catálogo de ejercicios: idempotente, solo agrega
buildNav();
render();
initSwipeHoy();
syncNavHeight();
if (window.ResizeObserver) new ResizeObserver(syncNavHeight).observe(document.getElementById("nav"));
window.addEventListener("resize", syncNavHeight);
window.addEventListener("orientationchange", () => setTimeout(syncNavHeight, 300));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
