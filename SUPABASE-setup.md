# Conectar Mi Turno con Supabase (2 pasos)

La app ya trae tu URL y clave pública. Solo faltan dos cosas que se hacen una vez en el panel de Supabase.

## Paso 1 — Crear la tabla (SQL)

En Supabase: **SQL Editor → New query**, pega esto y dale **Run**:

```sql
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb,
  updated_at timestamptz default now()
);

alter table public.app_state enable row level security;

create policy "solo mis datos" on public.app_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Esto crea una tabla donde se guarda tu estado y una regla (RLS) para que **cada quien solo vea sus propios datos**.

## Paso 2 — Quitar la confirmación de correo (para entrar sin fricción)

En Supabase: **Authentication → Sign In / Providers → Email** y **desactiva "Confirm email"** (o "Confirmations"). Guarda.

> Esto permite que crees tu cuenta y entres al instante, sin tener que abrir un enlace de correo (que en el iPhone se abre en Safari y no en la app instalada). Como es tu app privada, es seguro.

## Listo — Cómo se usa en la app

1. Abre la app → **Ajustes → Nube**.
2. Pon tu correo y una contraseña (mín. 6 caracteres) → **Crear cuenta**.
3. En tus otros dispositivos, entra con el mismo correo y contraseña → **Entrar**, y tus datos aparecen.

A partir de ahí todo se sincroniza solo cuando hay conexión, y sigue funcionando offline. Las **fotos de las metas se quedan en cada dispositivo** (no viajan a la nube, para no gastar espacio).
