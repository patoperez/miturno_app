-- =====================================================================
-- Cron · mi-turno-reminders
-- =====================================================================
-- Llama cada 5 minutos a la Edge Function send-reminders, que decide a
-- quién le toca notificación según su zona horaria y sus horarios.
--
-- IDEMPOTENTE: si el job ya existe (fue creado a mano en el dashboard),
-- primero lo quita por nombre y luego lo vuelve a crear. Aplicarla N
-- veces siempre deja EXACTAMENTE UN job llamado 'mi-turno-reminders'.
--
-- La función se despliega con --no-verify-jwt porque el cron la llama
-- sin cabecera de autorización.
-- =====================================================================

-- pg_cron ya vive en pg_catalog en este proyecto; el if not exists lo
-- vuelve un no-op. En una base nueva lo crea donde Supabase lo ponga.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'mi-turno-reminders') then
    perform cron.unschedule('mi-turno-reminders');
  end if;
end
$$;

select cron.schedule(
  'mi-turno-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url                  := 'https://xeerkvjlguycmdrimfbn.supabase.co/functions/v1/send-reminders',
    headers              := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $job$
);
