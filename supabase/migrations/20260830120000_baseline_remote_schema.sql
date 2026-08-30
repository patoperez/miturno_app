-- =====================================================================
-- Baseline · esquema público de Mi Turno
-- =====================================================================
-- Refleja el estado REAL del proyecto remoto (ref xeerkvjlguycmdrimfbn)
-- en el momento de adoptar el flujo de migraciones.
--
-- Es IDEMPOTENTE y ADITIVA a propósito: se puede aplicar sobre la base
-- que ya tiene los datos reales sin tocar una sola fila. Nunca borra ni
-- reescribe tablas. Aplicarla sobre una base vacía la deja idéntica.
-- =====================================================================

-- ---------------------------------------------------------------------
-- app_state · el blob de localStorage sincronizado (last-write-wins)
-- ---------------------------------------------------------------------
create table if not exists public.app_state (
  user_id    uuid        not null,
  data       jsonb,
  updated_at timestamptz default now(),
  constraint app_state_pkey primary key (user_id),
  constraint app_state_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade
);

-- Por si la tabla ya existía sin alguna columna (aditivo, nunca destructivo).
alter table public.app_state add column if not exists data       jsonb;
alter table public.app_state add column if not exists updated_at timestamptz default now();

alter table public.app_state enable row level security;

drop policy if exists "solo mis datos" on public.app_state;
create policy "solo mis datos" on public.app_state
  as permissive for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- push_subscriptions · suscripciones Web Push + horarios por usuario
-- La Edge Function send-reminders la lee con el service role.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  user_id      uuid        not null,
  subscription jsonb       not null,
  prefs        jsonb       not null default '{}'::jsonb,
  tz           text        default 'America/Mexico_City'::text,
  last_sent    jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz default now(),
  constraint push_subscriptions_pkey primary key (user_id),
  constraint push_subscriptions_user_id_fkey foreign key (user_id)
    references auth.users (id) on delete cascade
);

alter table public.push_subscriptions add column if not exists prefs      jsonb not null default '{}'::jsonb;
alter table public.push_subscriptions add column if not exists tz         text  default 'America/Mexico_City'::text;
alter table public.push_subscriptions add column if not exists last_sent  jsonb not null default '{}'::jsonb;
alter table public.push_subscriptions add column if not exists updated_at timestamptz default now();

alter table public.push_subscriptions enable row level security;

drop policy if exists "solo mis notif" on public.push_subscriptions;
create policy "solo mis notif" on public.push_subscriptions
  as permissive for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
