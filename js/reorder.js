/* =====================================================================
   reorder.js  ·  Mi Turno
   - Reordenar las secciones de "Hoy" con mantener-presionado + arrastrar.
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
  const y0 = e.clientY;
  let dragging = false;
  const holdTimer = setTimeout(startDrag, 300);

  function startDrag() {
    dragging = true;
    node.classList.add("dragging");
    document.body.classList.add("noscroll");
    const sc = document.getElementById("app"); if (sc) sc.classList.add("noscroll");
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
  }
  function onMove(ev) {
    if (!dragging) {
      if (Math.abs(ev.clientY - y0) > 8) { clearTimeout(holdTimer); finish(false); } // era scroll
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
buildNav();
render();
syncNavHeight();
if (window.ResizeObserver) new ResizeObserver(syncNavHeight).observe(document.getElementById("nav"));
window.addEventListener("resize", syncNavHeight);
window.addEventListener("orientationchange", () => setTimeout(syncNavHeight, 300));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
