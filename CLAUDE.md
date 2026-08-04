# CLAUDE.md — Mi Turno

Contexto del proyecto para agentes de código.

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
- `sw.js` — service worker (cache-first). Tiene `const CACHE = "mi-turno-vN"`.
- `manifest.webmanifest`, `icons/`.
- `supabase/functions/send-reminders/index.ts` — Edge Function (Deno) que manda las notificaciones por cron.

## Modelo de datos (`CFG`)
- `identities[]` — metas, con `why` y `quotes`. Hábitos, compromisos y métricas pueden colgar de una.
- `habits[]` — `{id, name, time?, idn}`. `time` es "HH:MM" opcional; `habitsSorted()` ordena la lista de Hoy por hora (sin hora al final). Llevan racha vía `streak(id,"habits")`; el chip solo se pinta con racha ≥ 2 para no meter ruido.
- `commitments[]` — cosas que se logra NO hacer. Racha vía `streak(id)`.
- `metrics[]` — `{id, name, unit, target, idn}`. Números diarios en `LOG[d].metrics[id]`. **No suman puntos a propósito**: son medición, no cumplimiento, y meterlas al puntaje distorsionaría el historial congelado.
- `meals`, `activities`, `routines` — sin cambios.
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
`sw.js` es **cache-first**. Cualquier cambio en HTML/CSS/JS **NO se verá en el iPhone instalado** hasta que se suba `const CACHE = "mi-turno-vN"` al siguiente número. Siempre incrementa esa versión al hacer cambios. En el dispositivo, cerrar por completo y reabrir la app; si sigue viejo, quitar de pantalla de inicio y volver a agregar (limpia el caché del SW).

## Despliegue
Repo en GitHub (`patoperez/miturno_app`) conectado a **Netlify** (auto-deploy en cada push). Sitio estático, sin comando de build, output = raíz.

## Cómo verificar sin dispositivo
No hay suite de tests. Para checar JS: `node --check js/<archivo>.js`. Para probar lógica, se usa un harness de Node que stubea `document`/`localStorage`/`window` y hace `eval` de los scripts concatenados (`config.js` + `app.js` + `gym.js`; **no** `reorder.js`, que arranca la app).

Dos detalles del harness: el stub de elemento necesita `getContext()` para los `<canvas>`, y como `eval` en modo suelto deja `let`/`const` en su propio ámbito, hay que cerrar el `eval` con `;Object.assign(global,{CFG,LOG,...})` para poder inspeccionar el estado desde las pruebas.

Casos que conviene cubrir siempre: arranque en frío con `localStorage` vacío (la semilla es vacía, así que los estados vacíos importan), migración desde una config vieja sin `metrics` ni `time`, y que las métricas no alteren `maxPts()`.

## Layout / navegación
5 pestañas: Hoy · Progreso · Workouts · Metas · Ajustes (barra inferior `#nav` / `.nav`). El cuerpo (`body`) contiene `#app` (contenido con scroll) y `#nav` (barra inferior). Modales (`.ov`) y el reproductor (`.player`) son overlays `position:fixed; inset:0` que cubren toda la pantalla.
