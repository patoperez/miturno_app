# AGENTS.md — Mi Turno

Contexto del proyecto para agentes de código.

> `CLAUDE.md` es una copia idéntica de este archivo (salvo el título). **Si actualizas uno, actualiza el otro.**

## Qué es
App personal (PWA instalable en iPhone) de identidad, hábitos, compromisos, comidas, tareas/calendario, workouts y progreso. Vanilla **HTML/CSS/JS puro**: sin framework, sin bundler, sin paso de build.

## Stack y estructura
- `index.html` — punto de entrada. Carga los scripts EN ESTE ORDEN (importa el orden):
  1. `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` (CDN)
  2. `js/config.js` — semilla de datos + constantes (`SUPABASE_URL`, `SUPABASE_KEY`, `VAPID_PUBLIC`, `ICONS`, `PALETTE`, `DEFAULT_CFG`).
  3. `js/app.js` — núcleo: estado, `render()`, todas las vistas (Hoy, Progreso, Workouts, Metas, Ajustes), modales, persistencia.
  4. `js/gym.js` — rutinas + reproductor de entrenamiento (registro de series, reanudar/finalizar).
  5. `js/reorder.js` — arrastrar para reordenar en Hoy + **init de la app** (`buildNav()`, `render()`, registro del service worker). Se carga al final para que todo esté definido.
  6. `js/sync.js` — Supabase (login correo+contraseña, sync local-first) + notificaciones Web Push.
- `css/styles.css` — estilos. Tema oscuro con variables CSS (`--bg`, `--cuerpo`, etc.).
- `sw.js` — service worker. **Red primero** para archivos propios (siempre lo último con internet), **caché primero** para CDN externos, y caché como respaldo offline. Tiene `const CACHE = "mi-turno-vN"`. También maneja `push` y `notificationclick`.
- `manifest.webmanifest`, `icons/`.
- `supabase/functions/send-reminders/index.ts` — Edge Function (Deno) que manda las notificaciones por cron.

## Modelo de datos (`CFG`)
- `identities[]` — metas, con `why` y `quotes`. Hábitos, compromisos y métricas pueden colgar de una.
- `habits[]` — `{id, name, time?, idn}`. `time` es "HH:MM" opcional; `habitsSorted()` ordena la lista de Hoy por hora (sin hora al final). Llevan racha vía `streak(id,"habits")`; el chip solo se pinta con racha ≥ 2 para no meter ruido.
- `commitments[]` — cosas que se logra NO hacer. Racha vía `streak(id)`.
- `metrics[]` — `{id, name, unit, target, idn}`. Números diarios en `LOG[d].metrics[id]`. **No suman puntos a propósito**: son medición, no cumplimiento, y meterlas al puntaje distorsionaría el historial congelado.
- `settings` — `{userName, mealView:"menu"|"fichas", unit:"kg"|"lb", notif:{enabled, morning/midday/night:{on,time}}}`. `unit` se elige desde Workouts, no desde Ajustes.
- `meals` — `{menu:[{id,name,desc}], fichas:{categories:[{id,name,quota,color}], catalog:{catId:[{food,amount,note}]}, innegociables:[{id,name}]}}`. Solo se muestra el sistema activo (`settings.mealView`).
- `activities[]` — `{id,name,type,icon,color}`. `type:"strength"` usa el reproductor de rutinas; `type:"class"` se registra por sesión (duración + intensidad + notas).
- `routines[]` — `{id,name,days:[],exercises:[{id,name,sets,reps,rest,weight,note}]}`. **Los ejercicios se identifican por nombre en texto** (`normName()`); no hay catálogo con IDs todavía.

## Datos de entrenamiento (`WORKOUTS`, clave `mt_workouts`)
Array de sesiones. Fuerza: `{id,date,activityId,type:"strength",routineId,name,duration,volume,unit,sets:[{exName,reps,weight}]}` — **una entrada por serie** en `sets`. Clase: `{id,date,activityId,type:"class",name,duration,intensity,notes}`.
`lastPerf(name)`, `exercisePR(name)` y `allLoggedExercises()` en `app.js` agregan por `normName(exName)`, así que **dos nombres distintos del mismo ejercicio parten el historial**.
El entreno en curso se persiste aparte en `mt_activeWorkout` (permite reanudar, reiniciar, finalizar o descartar).
- `LOG[d].review` — `{worked, failed, change}`. La tarjeta se renderiza domingo y lunes (`reviewDateFor`), pero **siempre escribe sobre el domingo que cerró la semana**: el lunes edita el mismo registro, no crea uno nuevo. Se lee después en Bitácora.

## Reglas / convenciones
- **SIN EMOJIS** en la UI (decisión de diseño). Usar los íconos SVG de `ICONS` en `config.js`.
- **La semilla (`DEFAULT_CFG`) viene VACÍA a propósito.** El repo es público: no debe contener metas, hábitos, compromisos ni comidas de nadie. Los datos reales llegan al iniciar sesión o por importación JSON. No volver a meter datos personales ahí.
- Todo es configurable por el usuario desde Ajustes; los datos "semilla" solo aplican la primera vez.
- Tres importadores JSON, todos con el mismo patrón: **plan** (metas/hábitos/compromisos/métricas), **comidas** y **rutinas**.
- Reusar el lenguaje visual existente (`.row`, `.sec`, `.sheet`, `.field`, `.addbtn`, `.chip`, `.streak`, `.dotc`) antes de inventar clases nuevas.
- UI en español.
- **Local-first:** los datos viven en `localStorage` bajo claves `mt_*` (`mt_cfg`, `mt_log`, `mt_tasks`, `mt_workouts`, `mt_prog`, `mt_hoyOrder`, `mt_todayRoutine`, `mt_activeWorkout`, `mt_updated`). Las fotos de metas viven en **IndexedDB** (db `miturno`, store `photos`), NO en localStorage. La nube (Supabase, tabla `app_state`) sincroniza el blob de `localStorage` con last-write-wins.
- Historial inmutable: los días pasados se "congelan" (`LOG[d].frozen/pts/max`); cambios de config solo afectan de hoy en adelante.

## IMPORTANTE — caché del service worker
La estrategia es **red primero** para los archivos propios, así que con internet la app instalada suele traer lo último al abrir. Aun así, **siempre incrementa `const CACHE = "mi-turno-vN"` al siguiente número** en cualquier cambio de HTML/CSS/JS: es lo que invalida la caché vieja, refresca la lista de precache y garantiza que el dispositivo no siga sirviendo una versión anterior en modo offline. Si el iPhone sigue mostrando algo viejo: cerrar por completo y reabrir; si persiste, quitar de la pantalla de inicio y volver a agregar (limpia el caché del SW).

## Nube y notificaciones (`js/sync.js`)
- Supabase con login correo+contraseña. Sincroniza el blob de `localStorage` a la tabla `app_state` (last-write-wins por `mt_updated`). **Local-first**: si no hay sesión, red ni `supabase-js`, la app funciona igual y `sync.js` degrada en silencio.
- Notificaciones Web Push: suscripción en `push_subscriptions`, y una Edge Function (`send-reminders`) disparada por cron cada 5 min manda mañana/tarde/noche según los horarios y zona horaria del usuario.
- `cloudSection()` y `notifSection()` viven en `sync.js` pero se pintan dentro de `renderAjustes()` (en `app.js`) con guardas `typeof … === "function"`, así que **`app.js` no debe asumir que `sync.js` está cargado**.
- Las llaves en `config.js` (`SUPABASE_URL`, `SUPABASE_KEY`, `VAPID_PUBLIC`) son públicas por diseño. La privada VAPID vive solo como secreto en Supabase; **nunca en el repo**.

## Despliegue
Repo en GitHub (`patoperez/miturno_app`) conectado a **Netlify** (auto-deploy en cada push). Sitio estático, sin comando de build, output = raíz.

## Cómo verificar sin dispositivo
No hay suite de tests. Para checar JS: `node --check js/<archivo>.js`. Para probar lógica, se usa un harness de Node que stubea `document`/`localStorage`/`window` y hace `eval` de los scripts concatenados (`config.js` + `app.js` + `gym.js`; **no** `reorder.js`, que arranca la app). `sync.js` es opcional en el harness: si se incluye, el stub necesita `document.addEventListener` y `documentElement.style.setProperty`.

Dos detalles del harness: el stub de elemento necesita `getContext()` para los `<canvas>`, y como `eval` en modo suelto deja `let`/`const` en su propio ámbito, hay que cerrar el `eval` con `;Object.assign(global,{CFG,LOG,...})` para poder inspeccionar el estado desde las pruebas.

Casos que conviene cubrir siempre: arranque en frío con `localStorage` vacío (la semilla es vacía, así que los estados vacíos importan), migración desde una config vieja sin `metrics` ni `time`, y que las métricas no alteren `maxPts()`.

## Layout / navegación
5 pestañas: Hoy · Progreso · Workouts · Metas · Ajustes (barra inferior `#nav` / `.nav`). El cuerpo (`body`) contiene `#app` (contenido con scroll) y `#nav` (barra inferior). Modales (`.ov`) y el reproductor (`.player`) son overlays `position:fixed; inset:0` que cubren toda la pantalla.
