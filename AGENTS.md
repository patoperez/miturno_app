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
- `routines[]` — `{id, name, days:[], blocks:[...]}`. **Una sesión tiene PARTES**, no una lista plana. Ver "Rutinas por bloques".
- `exercises[]` — **el catálogo**: `{id, name, aliases:[]}`. Ver "Catálogo de ejercicios".
- `exDismissed[]` — pares `"idA|idB"` que el usuario ya marcó como NO duplicados, para no volver a proponerlos.
- `LOG[d].review` — `{worked, failed, change}`. La tarjeta se renderiza domingo y lunes (`reviewDateFor`), pero **siempre escribe sobre el domingo que cerró la semana**: el lunes edita el mismo registro, no crea uno nuevo. Se lee después en Bitácora.

## Catálogo de ejercicios (`CFG.exercises`)
**Un ejercicio es un ID estable, NO su nombre.** Antes se agregaba por el texto (`normName`), así que "Press de pecho" y "Press pecho" partían el historial en dos y cada importación de rutina podía fragmentarlo más. `normName()` ya no existe.

- `CFG.exercises[] = {id, name, aliases:[]}`. `name` es el nombre canónico (la etiqueta que se muestra); `aliases` son las grafías alternativas que resuelven al mismo id.
- **`exKey(name)`** es la clave de comparación: sin acentos, sin mayúsculas, sin puntuación y con los espacios colapsados. `"  Préss  DE Pecho!! "` → `"press de pecho"`.
- **`findOrCreateExercise(name)`** resuelve por `exKey` contra el nombre canónico **y todos los alias**; si acierta reusa ese id, y si no crea una entrada nueva. **Todo** nombre que entra al sistema pasa por aquí: importación de JSON, editor de rutina y registro de series.
- **`setExId(s)`** da el id de una serie: `s.exId` si lo trae, y si no lo resuelve por `exName` (series heredadas anteriores al catálogo).
- Agregación: `lastPerf`, `exercisePR`, `allLoggedExercises`, `exSessions` y `exProgress` **agregan por `exId`**, nunca por texto. Aceptan un id o un nombre suelto (`toExId`) por compatibilidad.
- **Migración** (`migrateExercises()`): construye el catálogo desde `CFG.routines[].exercises[].name` **y** desde todos los `WORKOUTS[].sets[].exName`, y rellena `exId`. Es **idempotente y solo agrega**: nunca borra `exName`, nunca reescribe una serie, nunca tira un entreno. Corre en el init (`reorder.js`) y en `refreshState()` (por si un respaldo viene sin catálogo).
- **Renombrar** no toca el historial: se agrega por id. El nombre anterior queda como alias automáticamente, así que una importación con el nombre viejo sigue cayendo en el mismo ejercicio. Renombrar a un nombre que ya existe se rechaza (`"clash"`): hay que fusionar, no duplicar.
- **Fusionar** (`mergeExercises(keepId, dropId)`) mueve las series y las rutinas al id que sobrevive y deja el nombre perdedor (y sus alias) como alias. **No borra ningún entreno ni ninguna serie.**
- **Duplicados**: `dupCandidates()` solo **propone**, nunca fusiona sola. Dos señales, basta una: solape de tokens (Jaccard ≥ 0.7, sin conectores y con el plural recortado) o errata (mismo número de palabras y ≤ 1 carácter de diferencia en total, alineadas por posición). **No se usa distancia de edición sobre la cadena completa**: sobre nombres largos es engañosa — "Enfriamiento · Estiramientos (PUSH)" y "... (PULL)" se parecen 94% carácter a carácter y son ejercicios distintos. El usuario confirma o rechaza cada par en la tarjeta "Posibles duplicados" de Workouts.

## Rutinas por bloques
Una sesión no es un montón de ejercicios: es calentamiento, trabajo principal, extras (abdomen, cuello) y enfriamiento. El abdomen **no** es una sobra pegada al final, es su propia parte.

```
routine
  id, name, days[]
  blocks[]  {id, name, kind, exercises[]}
```
- `kind` ∈ **`calentamiento` | `principal` | `extra` | `enfriamiento`** (`BLOCK_KINDS`). Manda el comportamiento y el color (`BLOCK_COLOR`).
- `name` es **texto libre y es lo que se lee**. Por eso puede haber dos bloques `extra` llamados "Abdomen" y "Cuello": se leen como secciones distintas, no como sobras. Si un `kind` no se reconoce, cae en `principal`.
- **`routineBlocks(r)`** siempre devuelve bloques, incluso si la rutina todavía no migró; **`routineExercises(r)`** los aplana en orden. **Usa siempre estas dos, nunca `r.exercises` directo.**
- **`migrateRoutineBlocks()`** es aditiva e idempotente: una rutina plana pasa a tener un único bloque `principal` con **los mismos objetos** de ejercicio, así que no se pierde ni un `exId` ni una nota. Corre en el init y en `refreshState()`.
- **Borrar un bloque con ejercicios ofrece primero MUDARLOS** (`moveBlockExercises(bi, bj)`): la confirmación lista los demás bloques como filas tocables, y destruirlos queda demotado a un `.btn g` con texto rojo. Antes solo existía "Sí, borrar" y el trabajo se iba sin vuelta atrás. Mudar conserva **los mismos objetos** de ejercicio, así que `exId`, `type`, `bodyweight` y notas viajan intactos. Los bloques se reordenan con los botones subir/bajar (`moveBlock`, con `aria-label`), **no** con el mantener-presionado de Hoy. **Es a propósito, no una omisión:** el arrastre de `initReorderHoy` congela el scroll con `body.noscroll` + `#app.noscroll`, y una hoja scrollea en **su propio** contenedor (`.sheet{max-height:88vh; overflow-y:auto}`) que esas dos clases no frenan; además reordena nodos del DOM y lee el orden final de ahí, mientras que `renderRoutineEditor()` reconstruye la hoja entera en cada cambio (haría falta reordenar por índice sobre `_RT.blocks`), y el mantener-presionado pelearía con los `<input>` que tiene al lado. Con 3–6 bloques los botones son un tap y son exactos. Si algún día se unifica, hay que resolver esas cuatro cosas primero.

### El ejercicio dentro del bloque
`{id, exId, name, type, seconds, bodyweight, sets, reps, rest, weight, note}`
- **`type`** ∈ `"reps"` (por defecto) | `"tiempo"`. Con `"tiempo"` el reproductor cuenta el **intervalo de trabajo** hacia atrás y registra `secs` en vez de reps.
- **`seconds`** es la duración de la serie cuando `type` es `"tiempo"` (30 por defecto).
- **`bodyweight: true`** quita el campo de peso: basta con las reps.
- **`type` y `bodyweight` son de ESTA definición, NO del catálogo.** El catálogo (`exId`, alias, fusionar/renombrar) identifica al ejercicio y **no se fragmenta** por esto: el mismo ejercicio puede ir con peso en una rutina y a peso corporal en otra.
- Helpers: `exType`, `exIsTime`, `exIsBw`, `exSeconds`, `exTargetText`, `fmtSecs`.

### El record sigue a la medida
`exPRInfo(id)` devuelve `{kind, label, value, date}` según lo que **realmente se registró**:

| El ejercicio es… | Su record es… |
| --- | --- |
| normal | el **peso** más alto (`exercisePR`) |
| peso corporal | las **reps** más altas (`exBestReps`) |
| por tiempo | el **aguante** más largo (`exBestTime`) |

**Nunca se reporta un record de peso para algo sin peso**: `exercisePR` devuelve `null` si ninguna serie trae peso. `allLoggedExercises()` incluye los tres tipos — filtrar solo por peso dejaba fuera a la plancha y a las dominadas.
En **calentamiento y enfriamiento no se celebran records**: aguantar 20s de movilidad no es una marca, solo haría ruido.

### El reproductor entiende la estructura
- `buildPlan(r)` arma los pasos aplanados; cada uno sabe a qué bloque pertenece (`bi`, `bname`, `bkind`, `n`, `of`). `P.ei` indexa el plan.
- **El plan se CONGELA en `mt_activeWorkout` al empezar.** Antes se reconstruía desde la rutina al reanudar, así que editar la rutina a media sesión movía el entreno en curso bajo los pies: `P.ei` seguía apuntando al índice viejo y podías acabar registrando series en el ejercicio equivocado. Ahora se guarda `plan` junto a la sesión y `resumeWorkout` solo llama a `buildPlan(r)` si el guardado no lo trae (sesiones de versiones anteriores).
- La cabecera muestra **en qué parte de la sesión vas** (chip del bloque + `n/of`), no "ejercicio 3 de 14".
- Fase **`blockdone`**: terminar un bloque es un momento distinto a terminar un ejercicio (`transition`). Nunca arranca solo: siempre espera el tap.
- Un ejercicio por tiempo pasa por `set` → **`work`** → **`workalarm`**. El cronómetro de trabajo usa **la misma maquinaria que el descanso**: por marca de tiempo (`workEnd`), el mismo `tick`, la misma alarma y la misma notificación local del service worker. `workEnd` se persiste en `mt_activeWorkout` y el `visibilitychange` también lo pone al día.
- **Cortar antes registra lo que DE VERDAD aguantaste, no lo planeado.** `stopWorkEarly` mide contra `workEnd` **antes** de limpiarlo y deja el resultado en **`P.hechos`**; `finishWorkSet` prefiere `P.hechos` sobre cualquier recálculo. Antes `P.hechos` se escribía y nunca se leía, así que bajarse a los 20 de 45 segundos guardaba **45**: corrompía el historial en silencio y contaminaba el record de aguante. La pantalla `workalarm` lo dice en voz alta ("Serie cortada · de 45s", botón "Registrar 20s"): nunca se registra un número que el usuario no vio. `P.hechos` se persiste en `mt_activeWorkout` y se limpia en `startWork`, `finishWorkSet` y `continueNext`.

### Formato JSON (importar / exportar)
- El importador acepta **los dos formatos**: el nuevo con `blocks[]` y el viejo plano con `exercises[]` (que entra como un único bloque `principal`). Nada de lo que ya existe se rompe.
- **Exportar produce siempre el formato nuevo.** Los campos en su valor por defecto no se escriben, para que el JSON siga siendo legible.
- La documentación completa, con un ejemplo de sesión con los cinco bloques, está en `RUTINAS-como-importar-json.md`. Los ejemplos públicos son `ejemplo-rutina.json` y `mi-rutina-PPL.json` — **son públicos: nada personal ahí**.

## Negocio (`BIZ`, clave `mt_biz`)
Almacén propio, **aparte de `CFG`**: son datos, no configuración. `loadBiz()` / `saveBiz()` siguen el mismo patrón que `LOG`/`TASKS`/`WORKOUTS`.

```
BIZ
  projects[]  {id, name, color, status, why, nextAction, nextActionDue, updatedAt}
  leads[]     {id, name, contact, stage, value, unit, followUp, notes, projectId, stageAt, updatedAt}
  done[]      {id, projectId, text, doneAt}
  metrics[]   {id, name, unit, target, period}          period: "semana" | "mes"
  mvals{}     {metricId: {periodKey: número}}           "2026-W35" o "2026-08"
  ideas[]     {id, text, ts, status, projectId}         status: "inbox" | "guardada" | "descartada"
  focus[]     {id, date, projectId, seconds, note}
  reviews{}   {domingoYYYY-MM-DD: {moved, stuck, focus}}
```
Además, la **sesión de foco en curso** vive fuera de `BIZ`, en su propia clave `mt_focusRun` (`{projectId, startedAt, baseSeconds}`), igual que `mt_activeWorkout`. Está en `BACKUP_KEYS`.

- Los contenedores vacíos **existen desde ya** para que la siguiente entrega agregue comportamiento sin migrar nada.
- `status` es `"activo" | "pausado" | "terminado"` (`BIZ_STATUS`). `color` sale de `PALETTE`. `updatedAt` se refresca en **cada** edición vía `touchProject(p)`.
- `loadBiz()` es **tolerante**: si la clave falta, trae basura, un arreglo, o un objeto a medias, rellena cada contenedor con su tipo correcto y conserva lo que sí venía. Una instalación vieja o un respaldo anterior a esta versión no rompen la sección.
- **`mt_biz` está en `BACKUP_KEYS`.** Sin esa línea, Negocio quedaría fuera del respaldo **y** de la sincronización con Supabase (`sync.js` recorre esa misma lista) y se perdería en silencio al cambiar de dispositivo. Si agregas otro almacén, agrégalo también ahí.

### Proyectos: una sola próxima acción
La idea central es que **cada proyecto tiene UNA próxima acción**, no una lista de tareas. Un proyecto sin próxima acción está detenido, así que la tarjeta lo reclama en ámbar (`.bizna.nag`) en vez de disimularlo.
- `projectRank(p)` ordena por atención: **0** vencida, **1** para hoy, **2** sin próxima acción, **3** estancado, **4** el resto. A igualdad gana el que lleva más tiempo sin tocarse (`byAttention`).
- `isStale(p)`: **`BIZ_STALE_DAYS` = 14** días sin tocar, y solo cuenta para proyectos activos (un pausado no "se estanca"). Se pinta en ámbar (`.bizstale`) tanto en la línea de estado como en un chip junto a la acción.
- `dueState(p)` compara `nextActionDue` con `today()` como texto (`YYYY-MM-DD`): `vencida` (rojo), `hoy` (verde) o `futura`.
- Completar una acción (`completeNextAction`) la vacía y **abre de inmediato** "¿y ahora qué sigue?", para no dejar el proyecto sin siguiente paso. Salir con "Ahora no" es válido: entonces el proyecto queda reclamando.
- Guardar sin texto de acción **también limpia la fecha**: no quedan fechas huérfanas.
- Los pausados y terminados van en una sección aparte, abajo.

### `done[]`: lo que sí se cerró
Completar una acción **no la tira**: `completeNextAction` la empuja a `done` **antes** de limpiar el campo, sin agregar un solo tap. Es el equivalente de negocio a una serie registrada.
- `projectDone(id)` la devuelve por proyecto, lo más reciente primero. `done` es **append-only**, así que a igualdad de milisegundo desempata el orden de inserción: el historial nunca sale barajado.
- El detalle del proyecto pinta el bloque **"Hecho"** (`doneHistoryBlock`) con las últimas 8.
- `doneThisWeek()` cuenta desde el **lunes** de la semana en curso (`weekStartTs()`, apoyado en `weekDates()[0]`), y se muestra como `.statrow` en la pestaña de Proyectos. Es la recompensa que le faltaba al módulo: sin esto solo reclama.
- Completar un proyecto **sin** acción escrita no ensucia el historial.
- **Se puede deshacer:** tocar una línea del bloque "Hecho" la devuelve a `nextAction` (`restoreDone`) y la saca de `done`. Si ya hay una próxima acción escrita, **pregunta antes de pisarla** mostrando las dos: nunca se descarta trabajo en silencio.

### Números del negocio (`metrics[]` / `mvals{}`)
Los de `CFG.metrics` son **diarios** (peso, horas). Estos se mueven en otro reloj, así que son un almacén aparte y no una variante del diario.
- `period` es `"semana"` o `"mes"`. La clave de periodo la da `periodKey(period, fecha)`:
  - **mes** → `monthKey` → `"2026-08"`.
  - **semana** → `isoWeekKey` → `"2026-W35"`, semana **ISO 8601** (empieza en lunes, manda el jueves). Hacerlo bien importa en el cambio de año: `2025-12-29` es `2026-W01`, y `2027-01-03` sigue siendo `2026-W53`. No lo cambies por `getWeek()` casero.
- `lastNPeriods(period, n, endKey)` da los N periodos en orden cronológico y cruza el año solo; `prevPeriodKey` es el anterior.
- **REGLA DE MONEDA, no cosmética:** `unit` es la etiqueta de la unidad (MXN, USD, clientes, hrs) y **NUNCA se suman unidades distintas**. Lo freelance está en MXN y la inversión de la visa en USD: un total combinado sería un número falso. Cada número se lee solo, con su unidad pegada por `fmtNum`. El único agregado permitido es `sumByUnit(metrics)`, que devuelve `{unidad: suma}` — **si alguna vez imprimes una sola cifra que cruce unidades, está mal.**
- `fmtNum` ahora usa separadores de miles (`45,000`); la unidad va en `<i>` y se estila igual dentro y fuera de `.mval`.
- Capturar arranca en el **periodo actual** (`openBizMval`), con chips para los 4 periodos recientes.

### Ideas (`ideas[]`)
Lo único que importa es la velocidad de captura: si toma más de tres segundos, la idea se pierde. El campo `#ideaIn` vive **siempre visible** arriba de la pestaña y guarda con Enter o con un tap (`captureIdea`). Nada de modal ni de formulario.
- Orden: `inbox` primero, luego `guardada`, y `descartada` al final y atenuada.
- **Descartar es un cambio de estado, no un borrado**: siempre se puede recuperar.
- Promover (`openPromoteIdea`) la convierte en proyecto (`ideaToProject`) o en la próxima acción de uno (`ideaToNextAction`), y deja `projectId` apuntando.

### Sesiones de foco (`focus[]` + `mt_focusRun`)
- El cronómetro es **por marca de tiempo**, igual que el descanso del reproductor de gym: se guarda `startedAt` y el transcurrido se recalcula con `Date.now()` (`focusElapsed`). Un `setInterval` que suma de a uno se congela cuando se bloquea la pantalla o la app pasa a segundo plano y devolvería basura. **El intervalo aquí solo repinta el texto; la verdad siempre es el reloj.**
- La sesión en curso se persiste en `mt_focusRun`, así que sobrevive a cerrar la app. `getFocusRun()` devuelve `null` si el proyecto ya no existe, para no dejar sesiones huérfanas.
- Un `visibilitychange` repinta al volver de segundo plano. `armFocusTimer()` se llama al final de `renderNegocio`.
- También se puede registrar a mano (`openFocusManual`) para cuando se olvidó arrancarlo, y **corregirlo después**: tocar una sesión en el detalle del proyecto abre `openFocusEdit` (minutos, día y nota), con borrado confirmado. Una sesión nunca queda en el futuro.
- `focusSeconds(projectId, desde)` y `focusWeek(projectId)` alimentan el detalle del proyecto y la tarjeta de foco.

### Revisión semanal del negocio (`reviews{}`)
Hermana de la revisión de vida: **misma** regla de `reviewDateFor` (se pinta domingo y lunes, y **siempre escribe sobre el domingo que cerró la semana**, así que el lunes edita el mismo registro). Se guarda en `BIZ.reviews[domingo]`.
- Se pre-llena con hechos que la app ya sabe (`bizWeekFacts`): acciones cerradas, leads movidos, horas de foco y números capturados en esa semana. La idea es reflexionar, no tratar de acordarse.
- Se lee de vuelta en **Bitácora**, junto a la revisión de vida. `bitacoraList` mezcla las claves de `LOG` con las de `BIZ.reviews`, así que un domingo con revisión de negocio aparece aunque ese día no haya nota ni mood.

### Pipeline (`leads[]`): el mini CRM
Lo que genera ingreso y lo que más fácil se olvida. Un lead que lleva días en la misma etapa se está enfriando, así que el tiempo **en etapa** (`stageAt`) pesa tanto como la fecha de seguimiento.
- Etapas (`LEAD_STAGES`): `nuevo → contactado → llamada → propuesta → cerrado | perdido`. Las cuatro primeras son `LEAD_OPEN`, el **pipeline vivo**; `cerrado` y `perdido` salen a una sección aparte abajo.
- `stageAt` se reinicia **solo** cuando la etapa cambia de verdad — editar otros campos no lo toca, o el reloj de enfriamiento se reiniciaría solo.
- `leadStale(l)`: **`LEAD_STALE_DAYS` = 10** días en la misma etapa, y solo cuenta en el pipeline vivo.
- `followState(l)` compara `followUp` con `today()` como texto: `vencido` (rojo, `.row.leadvenc` con barra roja a la izquierda), `hoy` (verde) o `futuro`. Un cerrado o perdido ya no se persigue: devuelve `null`.
- `leadRank(l)` ordena igual que los proyectos: **0** vencido, **1** hoy, **2** sin fecha, **3** enfriándose, **4** el resto.
- **Avanzar es un tap** desde la fila (`advanceLead` → `nextStage`), y ahí mismo se ofrece la próxima fecha con atajos de un tap (`pickFollow`: mañana / 3 días / 1 semana / 2 semanas), igual que completar una acción pregunta por la siguiente. Llegar a `cerrado` no pide seguimiento.
- `value` se guarda como número o cadena vacía, nunca `NaN`, y **lleva su propia `unit`** (texto libre: MXN, USD...). **Aplica la misma regla de moneda que los números del negocio: nunca se suman unidades distintas.** `leadUnitTotals(list)` devuelve `[{unit, sum}]` y `unitTotalsText(list)` lo escribe; el hero pinta un `.stat` por unidad. **No existe un `sumValue` a secas a propósito** — un helper que sume sin mirar la unidad es justo el error que esto evita. Un lead sin unidad cae en su propio grupo (`LEAD_NO_UNIT`), no se mezcla.
- `migrateLeadUnits()` es aditiva e idempotente: a los leads de antes les pone `unit: ""`. **No les inventa una moneda.** El formulario de alta propone la unidad que más usas (`commonLeadUnit()`), vacía si aún no hay ninguna.
- **La unidad se compara normalizada** (`unitKey`, el mismo `exKey` de los ejercicios): `"usd"`, `"USD"` y `" Usd "` son la MISMA cubeta y no abren dos totales. Se conserva la grafía que escribiste; `canonicalLeadUnit()` reusa la que ya tenías y `knownLeadUnits()` lista las usadas.
- El valor se muestra con `fmtNum` (`25,000 MXN`), sin `$`: con varias monedas el símbolo es ambiguo.
- La pestaña Negocio tiene un control segmentado **Proyectos / Pipeline / Números / Ideas** (`NEGTAB`, en memoria: no agrega ninguna clave `mt_*`). Pipeline muestra en rojo los seguimientos vencidos e Ideas en ámbar los de la bandeja. La revisión semanal del negocio se pinta **arriba** del control, porque no pertenece a ninguna pestaña.

## Datos de entrenamiento (`WORKOUTS`, clave `mt_workouts`)
Array de sesiones. Fuerza: `{id,date,activityId,type:"strength",routineId,name,duration,volume,unit,sets:[{exName,exId,reps,weight}]}` — **una entrada por serie** en `sets`. Clase: `{id,date,activityId,type:"class",name,duration,intensity,notes}`.
Cada serie lleva **`exId`** (el ejercicio del catálogo) y **conserva `exName`**: el texto tal como se registró. `exName` **no se borra nunca** — es respaldo para resolver series heredadas y hace el JSON legible a ojo. Se agrega por `exId`, así que dos grafías del mismo ejercicio ya **no** parten el historial.
El entreno en curso se persiste aparte en `mt_activeWorkout` (permite reanudar, reiniciar, finalizar o descartar).

**Se puede registrar un entreno de cualquier día pasado.** El resto de la app deja corregir el pasado (VDAY, días congelados editables); los entrenos no eran la excepción por diseño sino por omisión.
- Fuerza a mano: `openManualWorkout(fecha)` — día, rutina (o ninguna), duración y series. Se agregan varias series iguales de un jalón (4×8 a 60 kg es una sola alta). **Cada serie pasa por `findOrCreateExercise`**, así que trae `exId` y alimenta records, historial y estadísticas exactamente igual que una sesión en vivo.
- Clases: `openLogSession(actId, fecha)` ya acepta fecha y ahora la muestra como campo.
- Entradas: la pestaña Workouts y la tarjeta de Workouts de un **día pasado** en Hoy.
- **Nunca al futuro, y se RECHAZA en vez de recortar:** `validPast(d)` devuelve `null` si la fecha es futura o vacía, y el alta avisa en rojo sin guardar. Escribir un entreno en el día equivocado es peor que un error visible. `clampPast` quedó solo para el valor inicial de un formulario. Aplica al alta manual, a las clases y a editar una sesión de foco.
- El alta manual también deja **editar** una serie ya agregada (`openMwEdit`), no solo borrarla, y acepta series por tiempo (`secs`).
- `markGymHabit(d)` marca el hábito de gym de **ese** día y llama a `recalcDay(d)`: un día pasado está congelado, así que sin recalcular el puntaje no se movería. Lo usan las tres rutas (en vivo, finalizar y manual).
Al registrar una serie, el reproductor compara contra el PR guardado **y** contra lo mejor de la sesión en curso; si lo supera, muestra "¡Nuevo record!" (`.pl-pr`) sin interrumpir nada, y lo resume al terminar.

## Reglas / convenciones
- **SIN EMOJIS** en la UI (decisión de diseño). Usar los íconos SVG de `ICONS` en `config.js`.
- **Selección de texto apagada por defecto.** En el PWA instalado, el long-press de iOS abre el menú Copiar/Traducir y pelea con el mantener-presionado que reordena Hoy. `body` lleva `-webkit-touch-callout:none` + `-webkit-user-select:none` (hacen falta los prefijos `-webkit-`; `user-select` a secas no basta en iOS). Se reactiva solo en `input`, `textarea`, `.reva` y **`.sel`**: si agregas texto que el usuario deba poder copiar (una nota, una bitácora), ponle la clase `.sel`.
- **La semilla (`DEFAULT_CFG`) viene VACÍA a propósito.** El repo es público: no debe contener metas, hábitos, compromisos ni comidas de nadie. Los datos reales llegan al iniciar sesión o por importación JSON. No volver a meter datos personales ahí.
- Todo es configurable por el usuario desde Ajustes; los datos "semilla" solo aplican la primera vez.
- Tres importadores JSON, todos con el mismo patrón: **plan** (metas/hábitos/compromisos/métricas), **comidas** y **rutinas**.
- Reusar el lenguaje visual existente (`.row`, `.sec`, `.sheet`, `.field`, `.addbtn`, `.chip`, `.streak`, `.dotc`) antes de inventar clases nuevas.
- **UN BOTÓN DE GUARDAR QUE NO HACE NADA ES EL PEOR FALLO POSIBLE.** El usuario culpa a la función ("la app no me deja registrar el pasado") en vez del campo que falta, y se va. **Ninguna guarda puede abortar en silencio.** Toda hoja con un botón principal lleva una ranura `${formSlot("xxxMsg")}` **justo encima del botón** (donde ya está mirando, no arriba fuera de cuadro) y cada `return` temprano se escribe `return formError("xxxMsg", "…")`, que pinta un `.ferr` rojo y devuelve `false`. `futureDateMsg` es un `formError` con el texto fijo `MSG_FUTURO`. Cuando la hoja se repinta sola (alta manual de entreno), el aviso viaja en el estado (`_MW.err`) para sobrevivir al re-render.
- **Un botón que todavía no puede guardar se ve apagado** (`.btn.p.off`), pero **sigue siendo tocable a propósito**: al tocarlo explica qué falta. Un `disabled` de verdad no puede decir por qué, que es exactamente el problema que esto resuelve.
- UI en español.
- **Local-first:** los datos viven en `localStorage` bajo claves `mt_*` (`mt_cfg`, `mt_log`, `mt_tasks`, `mt_workouts`, `mt_biz`, `mt_prog`, `mt_hoyOrder`, `mt_todayRoutine`, `mt_activeWorkout`, `mt_updated`, `mt_swipeHint`). Las fotos de metas viven en **IndexedDB** (db `miturno`, store `photos`), NO en localStorage. La nube (Supabase, tabla `app_state`) sincroniza el blob de `localStorage` con last-write-wins.
- Historial inmutable **ante cambios de config**: los días pasados se "congelan" (`LOG[d].frozen/pts/max`), así que agregar o quitar hábitos no reescribe el pasado. Pero editar un día a propósito **sí** mueve su puntaje: toda mutación de un día (`toggleHabit`, `toggleCommit`, `toggleMenu`, `setFicha`, `toggleInneg`, guardar/quitar métrica, `setSleep`, `setMood`, `setJournal`) llama a `recalcDay(d)`, que recalcula **solo `pts`** con `rawPoints(d)`. `rawPoints(d)` es la **única** definición de la fórmula (hábitos + compromisos + `mealScore`) y la comparte con `pointsFor`, para que congelado y no congelado nunca diverjan. En un día no congelado `recalcDay` no hace nada: ahí `pointsFor` ya calcula en vivo.
- **`max` NUNCA encoge.** `max` es el denominador que regía **ese** día, no el de hoy. `recalcDay` hace `l.max = Math.max(l.max || maxPts(), l.pts)`: solo puede crecer, y nunca queda por debajo de los puntos del propio día. Si se pisara con `maxPts()`, borrar hábitos encogería el denominador mientras las marcas viejas siguen en `LOG[d].habits`, y el día pasaría a leerse 3/2 = **150%**. Como red extra, `maxFor(d)` devuelve al menos `pointsFor(d)`, así **ninguna vista puede pintar más de 100%** ni siquiera con historiales que ya quedaron torcidos.

## Capturas de pantalla (`capturas/`)
Cuando se pide revisar visualmente lo construido, las capturas van a `capturas/` con nombres que se expliquen solos (`11-player-fin-de-bloque-calentamiento.png`).
- **`capturas/` está en `.gitignore` y ahí se queda.** El repo es **público**.
- **Siempre con datos de DEMO sembrados**, nunca con los datos reales: proyectos, leads, bitácora e historial no deben acabar en una imagen.
- Se generan con Chrome headless por `puppeteer-core` desde el scratchpad (fuera del repo, para no meter dependencias al `package.json`).

## IMPORTANTE — caché del service worker
La estrategia es **red primero** para los archivos propios, así que con internet la app instalada suele traer lo último al abrir. Aun así, **siempre incrementa `const CACHE = "mi-turno-vN"` al siguiente número** en cualquier cambio de HTML/CSS/JS: es lo que invalida la caché vieja, refresca la lista de precache y garantiza que el dispositivo no siga sirviendo una versión anterior en modo offline. Si el iPhone sigue mostrando algo viejo: cerrar por completo y reabrir; si persiste, quitar de la pantalla de inicio y volver a agregar (limpia el caché del SW).

## Aviso de fin de descanso (local, NO push)
Cuando el temporizador de descanso llega a cero, además de la alarma (sonido, vibración y pantalla) se dispara una **notificación LOCAL** por el service worker: `navigator.serviceWorker.getRegistration().then(reg => reg.showNotification(...))`, con el texto "Descanso terminado · Serie X de Y · &lt;ejercicio&gt;".
- **NO pasa por Supabase ni por Web Push.** El descanso dura segundos y vive en este dispositivo; mandarlo al servidor agregaría latencia y complejidad sin ganar nada. `js/gym.js` no debe tocar `pushManager`, `fetch` ni el cliente de Supabase — hay una prueba que lo verifica.
- **Degrada en silencio:** si `Notification.permission` no es `"granted"`, no se hace nada y queda la alarma de siempre. **Nunca** se pide permiso a media serie.
- `PLAYER.restNotified` evita avisos duplicados y **se persiste en `mt_activeWorkout`**, así que recargar la app no vuelve a avisar del mismo descanso. Se limpia al empezar cada descanso.
- **Puesta al día por el estrangulamiento de iOS:** una PWA en segundo plano puede tener sus timers frenados o congelados, así que `tick` quizá nunca corra. El manejador de `visibilitychange` recalcula contra el reloj real y, si el descanso ya venció, llama a `restExpired()` y marca `restNotified` **sin** soltar un aviso tardío de algo que el usuario ya está viendo en pantalla.
- Tocar la notificación enfoca la app y el service worker le manda `{type:"mt-resume-workout"}` al cliente; `gym.js` lo escucha y vuelve al reproductor (o lo reanuda desde `mt_activeWorkout` si la página se recargó).

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
Para el catálogo de ejercicios: que la migración lo construya desde rutinas **e** historial sin perder un solo entreno ni serie, que correrla dos veces no cambie nada, que importar una rutina cuyos nombres solo difieren en acentos/mayúsculas/espacios reuse el **mismo** `exId`, que `exercisePR` devuelva un único record tras fusionar dos grafías, y que renombrar conserve el historial completo.
Para las rutinas por bloques: que una rutina plana migre a un único bloque `principal` sin pérdidas y de forma idempotente, que el importador acepte los dos formatos, que exportar y reimportar conserve bloques/tipos/peso corporal, que un ejercicio por tiempo registre duración y su record sea el aguante más largo, que uno de peso corporal **nunca** reporte record de peso, y que una fecha futura se rechace.
Para estos arreglos: que un total de leads **nunca** junte dos unidades, que un entreno con fecha pasada caiga en el día correcto y alimente PRs/historial/estadísticas/hábito, que una fecha futura se recorte, y que editar o borrar una sesión de foco persista.
Para los avisos de formulario: que guardar un entreno manual **sin series** deje un `.ferr` visible y **no** guarde nada, que agregarle una serie limpie el aviso y sí guarde, y que ninguna guarda (proyecto, lead, idea, número, tarea, comida, actividad, meta, sesión, renombrar ejercicio) aborte sin dejar texto en su ranura.
Para el reproductor: que cortar una serie por tiempo a los 20 de 45 registre **20** (y que su record de aguante sea 20, no 45), y que editar la rutina a media sesión **no** mueva el plan del entreno en curso (`mt_activeWorkout` trae `plan`; un guardado sin `plan` sí lo reconstruye). Para las rutinas: que mudar los ejercicios de un bloque al borrarlo los conserve todos con su `exId` y su tipo.
Para Negocio: que restaurar una acción hecha la devuelva y pregunte al pisar otra, que las claves de periodo semanal y mensual sean correctas en el cambio de año, que dos números con unidades distintas **nunca** se sumen, que una idea se capture y persista, que una sesión de foco sobreviva un segundo plano simulado (mover `startedAt` hacia atrás) y registre la duración correcta, que la revisión escriba en el domingo correcto tanto desde domingo como desde lunes, que crear/editar/borrar un proyecto o un lead persista en `mt_biz`, que `mt_biz` sobreviva un ciclo exportar → borrar todo → restaurar (con `leads` y `done` dentro), que un `mt_hoyOrder` viejo sin la clave `biz` siga valiendo, que avanzar de etapa mueva `stageAt`, que el conteo semanal no cuente lo del domingo anterior, y que Hoy se pinte con cero proyectos, con cero leads y con varios de ambos.
El gesto de deslizar **no** se prueba en el harness (vive en `reorder.js`, que arranca la app): se verifica en el navegador despachando `PointerEvent`s reales sobre `#app`.

## Layout / navegación
5 pestañas: **Hoy · Progreso · Workouts · Negocio · Metas** (barra inferior `#nav` / `.nav`, definida en `NAV`). El cuerpo (`body`) contiene `#app` (contenido con scroll) y `#nav` (barra inferior). Modales (`.ov`) y el reproductor (`.player`) son overlays `position:fixed; inset:0` que cubren toda la pantalla.

### Ajustes vive en el header, no en la barra
La barra es para lo que se toca a diario; Ajustes se abre una vez por semana y **no gasta un lugar fijo**.
- `header()` pinta un botón `.hd-gear` dentro de `.hd-r` (el bloque derecho, junto al anillo). Está en **todas** las vistas.
- `openAjustes()` abre Ajustes y guarda la vista actual en **`LASTVIEW`**; estando ya dentro, el mismo botón **regresa** a esa vista. Dentro de Ajustes el ícono cambia a una X (`close`) y el botón se marca `.on`; si `LASTVIEW` quedara en `"ajustes"`, cae a Hoy en vez de trabarse.
- Estando en Ajustes **ninguna pestaña queda marcada**: `ajustes` ya no está en `NAV`.
- `.hd .date` bajó a **20px**: el engrane le quita ~46px de ancho a la fecha y a 22px "Domingo, 30 de agosto" ya no cabía en una línea a 375px.
- El engrane convive con el anillo de progreso y con el estado de día pasado de Hoy (`dayKey` → tinte ámbar + chip "Hoy"). **Al tocar `header()` hay que conservar las tres cosas.**

### Negocio
Pestaña `renderNegocio` (ícono `ingresos`, color `--ingresos`). Ver "Negocio (`BIZ`, clave `mt_biz`)" para el modelo.
- En **Hoy** hay una sección `biz` (`bizSection`, clave de orden **`"biz"`** en `DEFAULT_HOY_ORDER`) que es **un empujón, no la lista**: mezcla acciones de proyecto (`projectRank <= 3`) con seguimientos de pipeline vencidos o de hoy, ordenados por urgencia y con tope `BIZ_HOY_CAP` = **5** (`bizHoyItems`). Un lead vencido pesa igual que una acción vencida: los dos son deuda de ayer.
- Las dos cosas se distinguen **con palabras**, no solo con color: un proyecto dice `Proyecto · <nombre>` y la acción como título; un lead dice `Seguir a <nombre>` con `Pipeline · <etapa>`. Tocar salta a `gotoProject` o a `gotoLead` (que además cambia `NEGTAB` a pipeline).
- Se **esconde** si no hay ni proyectos activos ni leads abiertos (mismo criterio que `metricsSection`) y **en un día pasado**, como "Próximas": lo pendiente es de ahora, no hay registro de cuál era el pendiente de un martes de hace tres semanas.
- Agregar una clave a `DEFAULT_HOY_ORDER` es seguro: el cargador de `HOY_ORDER` filtra las desconocidas y **agrega al final** las que falten, así que un `mt_hoyOrder` ya guardado sigue valiendo y solo recibe la clave nueva al final.

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
