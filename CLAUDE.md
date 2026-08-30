# CLAUDE.md — Mi Turno

Contexto del proyecto para agentes de código.

> `AGENTS.md` es una copia idéntica de este archivo (salvo el título). **Si actualizas uno, actualiza el otro.**

## Qué es
App personal (PWA instalable en iPhone) de identidad, hábitos, compromisos, comidas, tareas/calendario, workouts y progreso. Vanilla **HTML/CSS/JS puro**: sin framework, sin bundler, sin paso de build.

## Stack y estructura
- `index.html` — punto de entrada. Carga los scripts EN ESTE ORDEN (importa el orden):
  1. `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` (CDN)
  2. `js/config.js` — semilla de datos + constantes (`SUPABASE_URL`, `SUPABASE_KEY`, `VAPID_PUBLIC`, `ICONS`, `PALETTE`, `DEFAULT_CFG`).
  3. `js/app.js` — núcleo: estado, `render()`, todas las vistas (Hoy, Progreso, Workouts, Metas, Ajustes), modales, persistencia.
  4. `js/gym.js` — rutinas + reproductor de entrenamiento (registro de series, reanudar/finalizar).
  5. `js/reorder.js` — **todos los gestos de Hoy**: arrastrar para reordenar secciones y deslizar horizontalmente para cambiar de día (`initSwipeHoy()`) + **init de la app** (`buildNav()`, `render()`, registro del service worker). Se carga al final para que todo esté definido.
  6. `js/sync.js` — Supabase (login correo+contraseña, sync local-first) + notificaciones Web Push.
- `css/styles.css` — estilos. Tema oscuro con variables CSS (`--bg`, `--cuerpo`, etc.).
- `sw.js` — service worker. **Red primero** para archivos propios (siempre lo último con internet), **caché primero** para CDN externos, y caché como respaldo offline. Tiene `const CACHE = "mi-turno-vN"`. También maneja `push` y `notificationclick`.
- `manifest.webmanifest`, `icons/`.
- `supabase/functions/send-reminders/index.ts` — Edge Function (Deno) que manda las notificaciones por cron.
- `supabase/migrations/*.sql` — el esquema de la base como código (ver "Supabase desde la terminal").
- `package.json` — **no hay build**; solo atajos de Supabase y `node --check`. El sitio se sirve tal cual desde la raíz.

## Modelo de datos (`CFG`)
- `identities[]` — metas, con `why` y `quotes`. Hábitos, compromisos y métricas pueden colgar de una.
- `habits[]` — `{id, name, time?, idn}`. `time` es "HH:MM" opcional; `habitsSorted()` ordena la lista de Hoy por hora (sin hora al final). Llevan racha vía `streak(id,"habits")`; el chip solo se pinta con racha ≥ 2 para no meter ruido.
- `commitments[]` — cosas que se logra NO hacer. Racha vía `streak(id)`.
- `metrics[]` — `{id, name, unit, target, idn}`. Números diarios en `LOG[d].metrics[id]`. **No suman puntos a propósito**: son medición, no cumplimiento, y meterlas al puntaje distorsionaría el historial congelado.
- `settings` — `{userName, mealView:"menu"|"fichas", unit:"kg"|"lb", notif:{enabled, morning/midday/night:{on,time}}}`. `unit` se elige desde Workouts, no desde Ajustes.
- `meals` — `{menu:[{id,name,desc}], fichas:{categories:[{id,name,quota,color}], catalog:{catId:[{food,amount,note}]}, innegociables:[{id,name}]}}`. Solo se muestra el sistema activo (`settings.mealView`).
- `activities[]` — `{id,name,type,icon,color}`. `type:"strength"` usa el reproductor de rutinas; `type:"class"` se registra por sesión (duración + intensidad + notas).
- `routines[]` — `{id,name,days:[],exercises:[{id,name,sets,reps,rest,weight,note}]}`. **Los ejercicios se identifican por nombre en texto** (`normName()`); no hay catálogo con IDs todavía.
- `LOG[d].review` — `{worked, failed, change}`. La tarjeta se renderiza domingo y lunes (`reviewDateFor`), pero **siempre escribe sobre el domingo que cerró la semana**: el lunes edita el mismo registro, no crea uno nuevo. Se lee después en Bitácora.

## Datos de entrenamiento (`WORKOUTS`, clave `mt_workouts`)
Array de sesiones. Fuerza: `{id,date,activityId,type:"strength",routineId,name,duration,volume,unit,sets:[{exName,reps,weight}]}` — **una entrada por serie** en `sets`. Clase: `{id,date,activityId,type:"class",name,duration,intensity,notes}`.
`lastPerf(name)`, `exercisePR(name)` y `allLoggedExercises()` en `app.js` agregan por `normName(exName)`, así que **dos nombres distintos del mismo ejercicio parten el historial**.
El entreno en curso se persiste aparte en `mt_activeWorkout` (permite reanudar, reiniciar, finalizar o descartar).

## Reglas / convenciones
- **SIN EMOJIS** en la UI (decisión de diseño). Usar los íconos SVG de `ICONS` en `config.js`.
- **La semilla (`DEFAULT_CFG`) viene VACÍA a propósito.** El repo es público: no debe contener metas, hábitos, compromisos ni comidas de nadie. Los datos reales llegan al iniciar sesión o por importación JSON. No volver a meter datos personales ahí.
- Todo es configurable por el usuario desde Ajustes; los datos "semilla" solo aplican la primera vez.
- Tres importadores JSON, todos con el mismo patrón: **plan** (metas/hábitos/compromisos/métricas), **comidas** y **rutinas**.
- Reusar el lenguaje visual existente (`.row`, `.sec`, `.sheet`, `.field`, `.addbtn`, `.chip`, `.streak`, `.dotc`) antes de inventar clases nuevas.
- UI en español.
- **Local-first:** los datos viven en `localStorage` bajo claves `mt_*` (`mt_cfg`, `mt_log`, `mt_tasks`, `mt_workouts`, `mt_prog`, `mt_hoyOrder`, `mt_todayRoutine`, `mt_activeWorkout`, `mt_updated`, `mt_swipeHint`). Las fotos de metas viven en **IndexedDB** (db `miturno`, store `photos`), NO en localStorage. La nube (Supabase, tabla `app_state`) sincroniza el blob de `localStorage` con last-write-wins.
- Historial inmutable **ante cambios de config**: los días pasados se "congelan" (`LOG[d].frozen/pts/max`), así que agregar o quitar hábitos no reescribe el pasado. Pero editar un día a propósito **sí** mueve su puntaje: toda mutación de un día (`toggleHabit`, `toggleCommit`, `toggleMenu`, `setFicha`, `toggleInneg`, guardar/quitar métrica, `setSleep`, `setMood`, `setJournal`) llama a `recalcDay(d)`, que recalcula **solo `pts`** con `rawPoints(d)`. `rawPoints(d)` es la **única** definición de la fórmula (hábitos + compromisos + `mealScore`) y la comparte con `pointsFor`, para que congelado y no congelado nunca diverjan. En un día no congelado `recalcDay` no hace nada: ahí `pointsFor` ya calcula en vivo.
- **`max` NUNCA encoge.** `max` es el denominador que regía **ese** día, no el de hoy. `recalcDay` hace `l.max = Math.max(l.max || maxPts(), l.pts)`: solo puede crecer, y nunca queda por debajo de los puntos del propio día. Si se pisara con `maxPts()`, borrar hábitos encogería el denominador mientras las marcas viejas siguen en `LOG[d].habits`, y el día pasaría a leerse 3/2 = **150%**. Como red extra, `maxFor(d)` devuelve al menos `pointsFor(d)`, así **ninguna vista puede pintar más de 100%** ni siquiera con historiales que ya quedaron torcidos.

## IMPORTANTE — caché del service worker
La estrategia es **red primero** para los archivos propios, así que con internet la app instalada suele traer lo último al abrir. Aun así, **siempre incrementa `const CACHE = "mi-turno-vN"` al siguiente número** en cualquier cambio de HTML/CSS/JS: es lo que invalida la caché vieja, refresca la lista de precache y garantiza que el dispositivo no siga sirviendo una versión anterior en modo offline. Si el iPhone sigue mostrando algo viejo: cerrar por completo y reabrir; si persiste, quitar de la pantalla de inicio y volver a agregar (limpia el caché del SW).

## Nube y notificaciones (`js/sync.js`)
- Supabase con login correo+contraseña. Sincroniza el blob de `localStorage` a la tabla `app_state` (last-write-wins por `mt_updated`). **Local-first**: si no hay sesión, red ni `supabase-js`, la app funciona igual y `sync.js` degrada en silencio.
- Notificaciones Web Push: suscripción en `push_subscriptions`, y una Edge Function (`send-reminders`) disparada por cron cada 5 min manda mañana/tarde/noche según los horarios y zona horaria del usuario.
- `cloudSection()` y `notifSection()` viven en `sync.js` pero se pintan dentro de `renderAjustes()` (en `app.js`) con guardas `typeof … === "function"`, así que **`app.js` no debe asumir que `sync.js` está cargado**.
- Las llaves en `config.js` (`SUPABASE_URL`, `SUPABASE_KEY`, `VAPID_PUBLIC`) son públicas por diseño. La privada VAPID vive solo como secreto en Supabase; **nunca en el repo**.

## Supabase desde la terminal
Todo cambio de base de datos, Edge Function, secreto y cron se hace por CLI y queda versionado como código. **Ya no se pega SQL en el dashboard.**

### Requisitos
- CLI por `npx`, sin instalación global: `npx supabase <cmd>` (probado con 2.116.0).
- Variables de entorno, ya definidas como variables de usuario de Windows. **Solo los nombres; nunca imprimir ni commitear sus valores:**
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_DB_PASSWORD`
  - Una terminal abierta ANTES de definirlas no las hereda: hay que reabrirla.
- Project ref: `xeerkvjlguycmdrimfbn` (proyecto `mi-turno`). El vínculo vive en `supabase/.temp/`, que está en `.gitignore`.
- `supabase/config.toml` versiona la config local, incluido `[functions.send-reminders] verify_jwt = false` (el cron llama a la función sin cabecera de autorización).

### Atajos (`package.json`)
| Comando | Qué hace |
| --- | --- |
| `npm run link` | vincula el repo con el proyecto remoto |
| `npm run db:new -- <nombre>` | crea `supabase/migrations/<ts>_<nombre>.sql` |
| `npm run db:push:dry` | muestra qué migraciones se aplicarían |
| `npm run db:push` | aplica las migraciones pendientes al remoto |
| `npm run db:status` | compara migraciones local vs. remoto |
| `npm run fn:deploy` | despliega `send-reminders` con `--no-verify-jwt` |
| `npm run fn:list` / `npm run fn:logs` | estado y logs de la función |
| `npm run secrets:list` | **nombres** de los secretos (nunca valores) |
| `npm run check` | `node --check` de todos los JS |

### Flujo para cambiar la base
1. `npm run db:new -- agrega_tal_cosa`
2. Escribir SQL **idempotente y aditivo** en el archivo nuevo.
3. `npm run db:push:dry`, revisar la lista, y luego `npm run db:push`.
4. `npm run db:status` para confirmar que local y remoto coinciden.

### Migraciones que ya existen
- `20260830120000_baseline_remote_schema.sql` — baseline: `app_state` y `push_subscriptions`, con RLS activo y sus políticas (`solo mis datos` y `solo mis notif`, ambas `for all to authenticated using (auth.uid() = user_id)`), PK y FK a `auth.users(id) on delete cascade`.
- `20260830120100_cron_send_reminders.sql` — extensiones `pg_cron` y `pg_net`, y el job `mi-turno-reminders` (`*/5 * * * *`, POST a la Edge Function, `timeout_milliseconds := 15000`). Hace `unschedule` por nombre antes de `schedule`, así que aplicarla N veces deja **exactamente un** job.

### Esta máquina no tiene Docker
`db pull`, `db diff`, `db dump` y `supabase start` **no corren**: necesitan la shadow database en Docker. Sí corren contra el remoto: `db push`, `migration list`, `functions deploy/list/download` y `secrets list`. Por eso el baseline está **escrito a mano** contra el esquema real, no generado por `db pull`. Para introspección puntual sirve la Management API: `POST https://api.supabase.com/v1/projects/<ref>/database/query` con `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`.

### Reglas de seguridad (NO negociables)
- El proyecto remoto tiene **datos personales reales** (`app_state` es todo el historial). **Nunca** `db reset`, `drop table`, `truncate` ni ninguna operación destructiva contra el remoto.
- Toda migración: **idempotente y aditiva** (`create table if not exists`, `add column if not exists`, `drop policy if exists` antes de `create policy`). Nunca borrar ni reescribir tablas existentes.
- **Nunca** imprimir, loguear ni commitear `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` ni la llave VAPID privada. El repo es **público**.
- Los secretos de la función (`VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`) ya están bien puestos y **no se rotan**. Solo se verifican con `npm run secrets:list`, que lista nombres.
- `.gitignore` cubre `.env`, `.env.*`, `supabase/.temp/`, `supabase/.branches/` y `node_modules/`.
- Ante la duda de si algo es destructivo: **preguntar antes de correrlo.**

## Despliegue
Repo en GitHub (`patoperez/miturno_app`) conectado a **Netlify** (auto-deploy en cada push). Sitio estático, sin comando de build, output = raíz.

## Cómo verificar sin dispositivo
No hay suite de tests. Para checar JS: `node --check js/<archivo>.js` (o `npm run check`, que los pasa todos). Para probar lógica, se usa un harness de Node que stubea `document`/`localStorage`/`window` y hace `eval` de los scripts concatenados (`config.js` + `app.js` + `gym.js`; **no** `reorder.js`, que arranca la app). `sync.js` es opcional en el harness: si se incluye, el stub necesita `document.addEventListener` y `documentElement.style.setProperty`.

Dos detalles del harness: el stub de elemento necesita `getContext()` para los `<canvas>`, y como `eval` en modo suelto deja `let`/`const` en su propio ámbito, hay que cerrar el `eval` con `;Object.assign(global,{CFG,LOG,...})` para poder inspeccionar el estado desde las pruebas.

Casos que conviene cubrir siempre: arranque en frío con `localStorage` vacío (la semilla es vacía, así que los estados vacíos importan), migración desde una config vieja sin `metrics` ni `time`, que las métricas no alteren `maxPts()`, que editar un día **congelado** actualice `LOG[d].pts` y que `pointsFor` lo refleje, que **borrar hábitos y luego editar un día pasado no encoja su `max`** (la regresión del 150%), que ningún día pinte más de 100%, y que no se pueda navegar al futuro.
El gesto de deslizar **no** se prueba en el harness (vive en `reorder.js`, que arranca la app): se verifica en el navegador despachando `PointerEvent`s reales sobre `#app`.

## Layout / navegación
5 pestañas: Hoy · Progreso · Workouts · Metas · Ajustes (barra inferior `#nav` / `.nav`). El cuerpo (`body`) contiene `#app` (contenido con scroll) y `#nav` (barra inferior). Modales (`.ov`) y el reproductor (`.player`) son overlays `position:fixed; inset:0` que cubren toda la pantalla.

### Hoy puede ver y corregir cualquier día pasado
- `VDAY` es el día que se está viendo. Arranca en `today()` y **no se persiste**: abrir la app siempre te para en hoy.
- `renderHoy()` pinta `VDAY`, no `today()`. Helpers: `viewDay()`, `setVDay(d)`, `goDay(±1)`, `goToday()`, `editDay(d)`.
- **Nunca se navega al futuro:** `setVDay` y `viewDay` recortan al presente, y un deslizamiento hacia el futuro estando en hoy solo rebota (`bounceHoy()`).
- **La fecha aparece UNA sola vez**, en el header. No hay barra de navegación con flechas: se quitó a propósito por redundante. Si agregas otro lugar donde se lea la fecha en Hoy, estás repitiendo lo que ya se quitó.
- **El día se cambia deslizando** sobre el contenido de Hoy. El gesto vive en `initSwipeHoy()` (`js/reorder.js`, junto al resto de gestos de la pestaña) y se engancha una sola vez a `#app`, en el init.
  - Derecha = día anterior, izquierda = día siguiente (topado en hoy).
  - Umbrales: `SWIPE_MIN` 60px y `SWIPE_RATIO` 1.5 (`|dx| > |dy| * 1.5`), `EDGE_GUARD` 24px para no pisar el gesto "atrás" de iOS.
  - Los listeners son **passive** y nunca hacen `preventDefault`: el scroll vertical nativo no se toca nunca.
  - Se decide en `pointermove`, no en `pointerup`: responde de inmediato y sobrevive a un `pointercancel` del navegador.
  - **Convivencia con el reordenamiento:** si hay un arrastre en curso (`window.__reorderDragging`) el swipe se ignora; y al revés, moverse más de 8px en **horizontal** cancela el mantener-presionado antes de que arranque. Ambos lados de esa regla tienen que quedarse.
  - Se ignora si el gesto empieza en un `textarea`/`input`/`select`, si hay un modal abierto, o si `VIEW !== "hoy"`.
- **Estar fuera de hoy tiene que notarse**, porque ya no hay barra: el greet dice "Estás editando otro día", la fecha va teñida de ámbar (`.hd .date.past`) y sale un chip **"Hoy"** (`.todaychip`) que regresa al día de hoy. Ese chip es la **única** salida de vuelta: **no quitarlo**.
- Cambiar de día se anima (`slideHoy(n)` → `.hoylist.slide-prev/.slide-next`) y topar en hoy rebota (`bounceHoy()` → `.bounce-end`). Todo se apaga con `prefers-reduced-motion`.
- La primera vez se pinta una pista discreta ("Desliza para ver otro día"); se apaga para siempre con el primer swipe (`swipeHintPending()` / `dismissSwipeHint()`, clave local `mt_swipeHint`, **fuera de `BACKUP_KEYS`**: es preferencia del dispositivo, no dato que sincronizar).
- El anillo del header usa los puntos del día **visto**: `header(title, sub, dayKey)` calcula `pointsFor(d) / maxFor(d)`. Solo Hoy pasa `dayKey`, así que las demás vistas no se enteran.
- En un día pasado, las secciones que solo tienen sentido "hoy" degradan: Workouts pasa a solo lectura (sin "Iniciar", con las filas tocables hacia `openWorkoutDetail`), "Próximas" desaparece, "Agregar tarea" arranca en el día visto y la racha de compromisos se mide al día visto (`streak(id, kind, asOf)`). La revisión semanal sigue usando `reviewDateFor`, evaluado contra `VDAY`.
- Desde el calendario de Progreso y desde la Bitácora, el modal `openDay(d)` ofrece **"Editar este día"** (`editDay(d)`), que se para en ese día y salta a Hoy. Solo aparece para días `<= today()`.
