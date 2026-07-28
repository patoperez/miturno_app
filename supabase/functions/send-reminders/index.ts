// Edge Function: send-reminders
// Envía notificaciones push (mañana / tarde / noche) según los horarios de cada usuario.
// Se ejecuta por cron cada 5 minutos. También responde a { test: true } para una prueba inmediata.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:patg4mer@gmail.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const WINDOW_MIN = 6; // debe ser >= al intervalo del cron (5 min)

const MSGS: Record<string, { title: string; body: string }[]> = {
  morning: [
    { title: "Buenos días", body: "Empieza con intención. Abre Mi Turno y marca por dónde vas hoy." },
    { title: "Nuevo día", body: "Aún no somos quien queremos llegar a ser. Hoy sumamos un voto más." },
  ],
  midday: [
    { title: "Sigue en curso", body: "¿Ya avanzaste con lo de hoy? Un hábito más te acerca." },
    { title: "Empujón de tarde", body: "No dejes que el día se te vaya. Un paso más." },
  ],
  night: [
    { title: "Cierre del día", body: "Revisa cómo te fue y marca lo que lograste." },
    { title: "Repaso nocturno", body: "Escribe tu bitácora y cierra el día con conciencia." },
  ],
  test: [
    { title: "Notificación de prueba", body: "Si ves esto, tus notificaciones funcionan." },
  ],
};

function pick(slot: string, name?: string) {
  const arr = MSGS[slot] || MSGS.test;
  const m = arr[Math.floor(Math.random() * arr.length)];
  const title = name && slot !== "test" ? `${m.title}, ${name}` : m.title;
  return { title, body: m.body };
}
function localHM(tz: string): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const [h, m] = p.split(":").map(Number);
  return h * 60 + m;
}
function localDate(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

Deno.serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  let test = false, testUser: string | null = null;
  try { const b = await req.json(); test = !!b.test; testUser = b.user_id || null; } catch (_) { /* cron sin body */ }

  const { data: rows, error } = await sb.from("push_subscriptions").select("*");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });

  const results: unknown[] = [];
  for (const row of rows || []) {
    if (testUser && row.user_id !== testUser) continue;
    const tz = row.tz || "America/Mexico_City";
    const prefs = row.prefs || {};
    const last = row.last_sent || {};
    const today = localDate(tz);
    const nowMin = localHM(tz);

    let toSend: { slot: string; title: string; body: string }[] = [];
    if (test) {
      toSend = [{ slot: "test", ...pick("test") }];
    } else {
      for (const slot of ["morning", "midday", "night"]) {
        const p = prefs[slot];
        if (!p || !p.on || !p.time) continue;
        const [ph, pm] = String(p.time).split(":").map(Number);
        const slotMin = ph * 60 + pm;
        if (nowMin >= slotMin && nowMin < slotMin + WINDOW_MIN && last[slot] !== today) {
          toSend.push({ slot, ...pick(slot, prefs.name) });
        }
      }
    }

    for (const msg of toSend) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({ title: msg.title, body: msg.body, url: "./index.html", tag: msg.slot }));
        if (!test) last[msg.slot] = today;
        results.push({ user: row.user_id, slot: msg.slot, ok: true });
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) { await sb.from("push_subscriptions").delete().eq("user_id", row.user_id); }
        results.push({ user: row.user_id, slot: msg.slot, ok: false, code });
      }
    }
    if (!test && toSend.length) await sb.from("push_subscriptions").update({ last_sent: last }).eq("user_id", row.user_id);
  }

  return new Response(JSON.stringify({ sent: results }), { headers: { "Content-Type": "application/json" } });
});
