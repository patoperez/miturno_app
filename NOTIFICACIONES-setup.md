# Activar notificaciones (mañana / tarde / noche)

Las notificaciones usan Web Push: la app se suscribe en tu iPhone y una función en tu Supabase las envía a la hora que elijas, aunque la app esté cerrada. Todo el código ya está listo; faltan unos pasos de configuración en Supabase (una sola vez).

## Paso 1 — Crear la tabla de suscripciones (SQL)

Supabase → **SQL Editor → New query**, pega y **Run**:

```sql
create table if not exists public.push_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscription jsonb not null,
  prefs jsonb not null default '{}',
  tz text default 'America/Mexico_City',
  last_sent jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "solo mis notif" on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## Paso 2 — Desplegar la función `send-reminders`

Supabase → **Edge Functions → Deploy a new function** (o "Create function").

- Nombre: **send-reminders**
- Pega el contenido de `supabase/functions/send-reminders/index.ts` (está en el repo).
- Deploy.

Si te deja elegir, **desactiva "Verify JWT"** para esta función (así el cron puede llamarla). El botón de prueba desde la app funciona igual con o sin JWT.

## Paso 3 — Poner los secretos de la función

Supabase → **Edge Functions → (Secrets / Manage secrets)**, agrega:

| Nombre | Valor |
| --- | --- |
| `VAPID_PUBLIC` | `BPKN-6oj8ac8FQcdqAb8LFzPKSXL4gqebi6k4IBVyFL8IUU326ffNY9BE0w0yhF1mDbpclmqozG0Chz0cHrFDjo` |
| `VAPID_PRIVATE` | *(te la paso en el chat — es secreta, no la subas al repo)* |
| `VAPID_SUBJECT` | `mailto:patg4mer@gmail.com` |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen incluidos automáticamente en las funciones; no los agregues.

## Paso 4 — Programar el cron (cada 5 minutos)

Supabase → **Cron** (o *Database → Cron Jobs* / *Integrations → Cron*):

- Crea un job nuevo, cada **5 minutos** (`*/5 * * * *`).
- Que ejecute la **Edge Function `send-reminders`** (la UI te deja elegir "Edge Function" como tipo de job).

Si prefieres SQL (necesita las extensiones `pg_cron` y `pg_net` activas):

```sql
select cron.schedule(
  'mi-turno-reminders', '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://xeerkvjlguycmdrimfbn.functions.supabase.co/send-reminders',
       headers := jsonb_build_object('Content-Type','application/json'),
       body := '{}'::jsonb
     ); $$
);
```

## Paso 5 — Activar en la app

1. Abre la app **instalada** (desde el ícono, no en Safari) → **Ajustes → Notificaciones**.
2. Ajusta los horarios (mañana / tarde / noche) y **Activar notificaciones** (acepta el permiso).
3. Toca **Enviar notificación de prueba** — debe llegarte en segundos. Si llega, ya quedó; el cron hará el resto a tus horas.

> Importante en iPhone: las notificaciones solo funcionan con la app **agregada a la pantalla de inicio** (no en Safari normal), y necesitas iOS 16.4 o mayor.
