/* =====================================================================
   sync.js  ·  Mi Turno  ·  Supabase (login + sincronización online/offline)
   Local-first: la app funciona sin conexión (localStorage). Cuando hay
   sesión y red, sube/baja todo el estado (last-write-wins). Las fotos NO
   se sincronizan (viven en IndexedDB del dispositivo).
   Requiere: supabase-js cargado antes, y app.js (buildBackup, BACKUP_KEYS,
   store, refreshState, render, sec, icon, esc, VIEW).
===================================================================== */
"use strict";

const SB = { client: null, session: null, timer: null, applying: false, status: "", err: false, email: "", pulledFor: null, lastSync: 0 };

function sbInit() {
  if (typeof supabase === "undefined" || !SUPABASE_URL || SUPABASE_URL.indexOf("http") !== 0) return;
  try { SB.client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }); }
  catch (e) { return; }
  window.__onWrite = k => { if (SB.applying || !SB.session) return; if (typeof k === "string" && k.indexOf("mt_") === 0 && k !== "mt_updated") scheduleSync(); };
  SB.client.auth.getSession().then(({ data }) => { SB.session = data.session; if (SB.session) onLogin(); updateCloudUI(); });
  SB.client.auth.onAuthStateChange((_e, s) => { SB.session = s; if (s) onLogin(); else SB.pulledFor = null; updateCloudUI(); });
  if (typeof window !== "undefined") window.addEventListener("online", () => { if (SB.session) pushLocal(); });
}

function traduce(m) {
  m = m || "";
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/already registered/i.test(m)) return "Ese correo ya tiene cuenta. Usa Entrar.";
  if (/at least 6/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/Email not confirmed/i.test(m)) return "Falta confirmar el correo. Desactiva la confirmación en Supabase (ver guía).";
  return m;
}

function onLogin() {
  if (!SB.session) return;
  const uid = SB.session.user.id;
  if (SB.pulledFor === uid) return; SB.pulledFor = uid;
  SB.email = SB.session.user.email || SB.email;
  SB.client.from("app_state").select("data,updated_at").eq("user_id", uid).maybeSingle().then(({ data, error }) => {
    if (error) { SB.status = "No pude leer la nube (¿creaste la tabla?)."; SB.err = true; updateCloudUI(); return; }
    const localTs = parseInt(store.get("mt_updated") || "0", 10);
    if (data && data.data) {
      const remoteTs = Date.parse(data.updated_at) || 0;
      if (remoteTs > localTs) { applyRemote(data.data, remoteTs); SB.status = "Datos de la nube cargados."; SB.err = false; updateCloudUI(); return; }
    }
    pushLocal();
  });
}

function applyRemote(dataObj, ts) {
  SB.applying = true;
  BACKUP_KEYS.forEach(k => { if (k in dataObj) store.set(k, dataObj[k]); });
  store.set("mt_updated", String(ts));
  SB.applying = false;
  refreshState();
}

function pushLocal() {
  if (!SB.session || !SB.client) return;
  const now = Date.now();
  SB.applying = true; store.set("mt_updated", String(now)); SB.applying = false;
  const payload = { user_id: SB.session.user.id, data: buildBackup().data, updated_at: new Date(now).toISOString() };
  SB.status = "Sincronizando..."; SB.err = false; updateCloudUI();
  SB.client.from("app_state").upsert(payload).then(({ error }) => {
    if (error) { SB.status = "Error al sincronizar: " + error.message; SB.err = true; }
    else { SB.lastSync = now; SB.status = "Sincronizado " + new Date(now).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); SB.err = false; }
    updateCloudUI();
  });
}
function scheduleSync() { clearTimeout(SB.timer); SB.timer = setTimeout(() => { if (typeof navigator === "undefined" || navigator.onLine !== false) pushLocal(); }, 2500); }

/* ---------- Auth (correo + contraseña) ---------- */
function cloudField(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
function cloudSignIn() {
  const email = cloudField("sbEmail"), pass = cloudField("sbPass");
  if (!email || !pass) { SB.status = "Escribe correo y contraseña."; SB.err = true; return updateCloudUI(); }
  SB.email = email; SB.status = "Entrando..."; SB.err = false; updateCloudUI();
  SB.client.auth.signInWithPassword({ email, password: pass }).then(({ error }) => {
    if (error) { SB.status = traduce(error.message); SB.err = true; updateCloudUI(); }
  });
}
function cloudSignUp() {
  const email = cloudField("sbEmail"), pass = cloudField("sbPass");
  if (!email || pass.length < 6) { SB.status = "Correo y contraseña (mín. 6 caracteres)."; SB.err = true; return updateCloudUI(); }
  SB.email = email; SB.status = "Creando cuenta..."; SB.err = false; updateCloudUI();
  SB.client.auth.signUp({ email, password: pass }).then(({ data, error }) => {
    if (error) { SB.status = traduce(error.message); SB.err = true; updateCloudUI(); return; }
    if (data.session) { SB.status = "Cuenta creada. Conectando..."; SB.err = false; }
    else { SB.status = "Cuenta creada. Si pide confirmar el correo, desactívalo en Supabase (ver guía) y entra."; SB.err = false; }
    updateCloudUI();
  });
}
function cloudSignOut() { SB.client.auth.signOut().then(() => { SB.session = null; SB.pulledFor = null; SB.status = "Sesión cerrada."; SB.err = false; updateCloudUI(); }); }
function updateCloudUI() { if (typeof VIEW !== "undefined" && VIEW === "ajustes") render(); }

/* ---------- Sección de nube en Ajustes ---------- */
function cloudSection() {
  if (!SB.client) return sec("a_cloud", "Nube", "No disponible", `<div class="empty" style="text-align:left;padding:6px 2px">La sincronización se activa cuando abras la app con conexión.</div>`, "upload", "var(--muted)");
  const msg = SB.status ? `<div style="font-size:13px;margin:8px 2px;color:${SB.err ? "var(--bad)" : "var(--ok)"}">${esc(SB.status)}</div>` : "";
  if (!SB.session) {
    return sec("a_cloud", "Nube", "Sin conectar",
      `<div class="empty" style="text-align:left;padding:4px 2px 10px">Conéctate para respaldar en la nube y sincronizar entre tus dispositivos. Tus datos son solo tuyos.</div>
       <div class="lbl">Correo</div><input id="sbEmail" class="field" type="email" autocomplete="email" placeholder="tucorreo@gmail.com" value="${esc(SB.email)}">
       <div class="lbl">Contraseña</div><input id="sbPass" class="field" type="password" autocomplete="current-password" placeholder="mínimo 6 caracteres">
       ${msg}
       <button class="btn p" onclick="cloudSignIn()">Entrar</button>
       <button class="btn g" onclick="cloudSignUp()">Crear cuenta</button>`, "upload", "var(--ingresos)");
  }
  return sec("a_cloud", "Nube", "Conectado",
    `<div class="empty" style="text-align:left;padding:4px 2px">Conectado como ${esc(SB.session.user.email)}. Todo se sincroniza solo.</div>${msg}
     <button class="addbtn" onclick="pushLocal()">${icon("upload")} Sincronizar ahora</button>
     <button class="addbtn" onclick="cloudSignOut()">Cerrar sesión</button>`, "upload", "var(--ingresos)");
}

/* ===================== NOTIFICACIONES (Web Push) ===================== */
const NOTIF = { status: "", err: false };
function notifSupported() { return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window; }
function b64ToUint8(base64) {
  const pad = "=".repeat((4 - base64.length % 4) % 4);
  const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function notifPrefs() { return (CFG.settings && CFG.settings.notif) || { enabled: false, morning: { on: true, time: "07:30" }, midday: { on: true, time: "15:00" }, night: { on: true, time: "21:30" } }; }
function myTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City"; } catch (e) { return "America/Mexico_City"; } }

async function enableNotifications() {
  if (!notifSupported()) { NOTIF.status = "Tu dispositivo no soporta notificaciones (instala la app primero)."; NOTIF.err = true; return updateNotifUI(); }
  if (!SB.session) { NOTIF.status = "Primero conéctate en la sección Nube."; NOTIF.err = true; return updateNotifUI(); }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { NOTIF.status = "No diste permiso de notificaciones."; NOTIF.err = true; return updateNotifUI(); }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(VAPID_PUBLIC) });
    const p = notifPrefs(); p.enabled = true; CFG.settings.notif = p; saveCfg();
    await saveSubscription(sub);
    NOTIF.status = "Notificaciones activadas."; NOTIF.err = false; updateNotifUI();
  } catch (e) { NOTIF.status = "No se pudieron activar: " + e.message; NOTIF.err = true; updateNotifUI(); }
}
async function disableNotifications() {
  const p = notifPrefs(); p.enabled = false; CFG.settings.notif = p; saveCfg();
  try {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (SB.session && SB.client) await SB.client.from("push_subscriptions").delete().eq("user_id", SB.session.user.id);
  } catch (e) {}
  NOTIF.status = "Notificaciones desactivadas."; NOTIF.err = false; updateNotifUI();
}
async function saveSubscription(sub) {
  if (!SB.session || !SB.client) return;
  const p = notifPrefs();
  await SB.client.from("push_subscriptions").upsert({
    user_id: SB.session.user.id, subscription: sub.toJSON ? sub.toJSON() : sub,
    prefs: { morning: p.morning, midday: p.midday, night: p.night, name: CFG.settings.userName }, tz: myTz(), updated_at: new Date().toISOString()
  });
}
async function saveNotifPrefs() {
  const p = notifPrefs();
  ["morning", "midday", "night"].forEach(s => {
    const on = document.getElementById("nt_" + s + "_on"), tm = document.getElementById("nt_" + s + "_time");
    if (on) p[s].on = on.checked; if (tm && tm.value) p[s].time = tm.value;
  });
  CFG.settings.notif = p; saveCfg();
  if (p.enabled && SB.session && SB.client) {
    await SB.client.from("push_subscriptions").update({ prefs: { morning: p.morning, midday: p.midday, night: p.night, name: CFG.settings.userName }, tz: myTz(), updated_at: new Date().toISOString() }).eq("user_id", SB.session.user.id);
  }
  NOTIF.status = "Horarios guardados."; NOTIF.err = false; updateNotifUI();
}
async function sendTestNotif() {
  if (!SB.session || !SB.client) { NOTIF.status = "Conéctate a la nube primero."; NOTIF.err = true; return updateNotifUI(); }
  NOTIF.status = "Enviando prueba..."; NOTIF.err = false; updateNotifUI();
  try {
    const { error } = await SB.client.functions.invoke("send-reminders", { body: { test: true, user_id: SB.session.user.id } });
    NOTIF.status = error ? ("Error: " + error.message + " (¿desplegaste la función?)") : "Prueba enviada. Debe llegarte en unos segundos.";
    NOTIF.err = !!error;
  } catch (e) { NOTIF.status = "Error: " + e.message; NOTIF.err = true; }
  updateNotifUI();
}
function updateNotifUI() { if (typeof VIEW !== "undefined" && VIEW === "ajustes") render(); }

function notifRow(slot, label) {
  const p = notifPrefs()[slot] || { on: true, time: "08:00" };
  return `<div class="ntrow"><label class="ntlab"><input type="checkbox" id="nt_${slot}_on" ${p.on ? "checked" : ""}> ${label}</label>
    <input type="time" id="nt_${slot}_time" class="field nttime" value="${esc(p.time)}"></div>`;
}
function notifSection() {
  const p = notifPrefs();
  const msg = NOTIF.status ? `<div style="font-size:13px;margin:8px 2px;color:${NOTIF.err ? "var(--bad)" : "var(--ok)"}">${esc(NOTIF.status)}</div>` : "";
  if (!notifSupported()) return sec("a_notif", "Notificaciones", "No disponible", `<div class="empty" style="text-align:left;padding:6px 2px">Las notificaciones funcionan en la app instalada en tu pantalla de inicio.</div>${msg}`, "clock", "var(--productividad)");
  let body = `<div class="empty" style="text-align:left;padding:4px 2px 10px">Resumen en la mañana, empujón a media tarde y repaso en la noche. Requiere estar conectado en la Nube.</div>`;
  body += notifRow("morning", "Mañana (resumen)") + notifRow("midday", "Tarde (empujón)") + notifRow("night", "Noche (repaso)");
  body += `<button class="addbtn" onclick="saveNotifPrefs()">Guardar horarios</button>`;
  if (p.enabled) {
    body += `<button class="addbtn" onclick="sendTestNotif()">${icon("upload")} Enviar notificación de prueba</button>`;
    body += `<button class="addbtn" onclick="disableNotifications()" style="color:var(--bad)">Desactivar notificaciones</button>`;
  } else {
    body += `<button class="btn p" onclick="enableNotifications()">Activar notificaciones</button>`;
  }
  body += msg;
  return sec("a_notif", "Notificaciones", p.enabled ? "Activas" : "Apagadas", body, "clock", "var(--productividad)");
}

/* ---------- Init ---------- */
sbInit();
