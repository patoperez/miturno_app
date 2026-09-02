# Mi Turno

App personal de construcción de identidad, hábitos, negocio y entrenamiento. PWA: funciona offline y se instala en el iPhone. Sin dependencias ni paso de build — HTML, CSS y JavaScript puro servido desde la raíz.

## Qué hace

Cinco pestañas abajo; **Ajustes** vive en el engrane del header (no gasta un lugar en la barra).

- **Hoy** — hábitos, compromisos (con racha), comidas (menú o fichas), tareas, sueño, mood y bitácora. Las secciones se reordenan arrastrando, y **se desliza horizontalmente para ver y corregir cualquier día pasado**. Nunca se navega al futuro.
- **Progreso** — semana / mes / bitácora, con calendario de puntos, agenda y líneas de progreso.
- **Workouts** — rutinas **por bloques** (calentamiento, principal, extras como abdomen o cuello, y enfriamiento), con reproductor que registra serie por serie, mide descansos y se puede reanudar. Los ejercicios se miden por **reps, por tiempo o a peso corporal**, y el record sigue a la medida: peso máximo, aguante más largo o más reps. Hay un **catálogo de ejercicios con IDs estables**, así que "Press de pecho" y "Press pecho" son el mismo ejercicio y no parten el historial. También se puede **registrar un entreno de un día pasado** que se olvidó anotar. Más actividades por sesión (kickboxing, boxeo...).
- **Negocio** — proyectos con **una sola próxima acción** cada uno (un proyecto sin ella está detenido y la tarjeta lo reclama), un **pipeline** tipo mini CRM por etapas, **números** semanales o mensuales, bandeja de **ideas** y **sesiones de foco** cronometradas. Cierra con una revisión semanal.
- **Metas** — identidades con su "para qué" y sus frases.

## Datos

Local-first: todo vive en el dispositivo (`localStorage`, y las fotos en IndexedDB). Con cuenta de Supabase se sincroniza entre dispositivos; sin conexión, sin sesión o sin servidor, la app funciona igual.

El historial de días pasados queda **congelado**: cambiar la configuración no reescribe el pasado. Editar un día a propósito sí mueve su puntaje, pero su denominador nunca encoge.

> **Una regla que no es cosmética:** los valores con unidad (MXN, USD, clientes, horas) **nunca se suman entre unidades distintas**. Un total que mezcle monedas es un número falso.

## Estructura

```
index.html              Punto de entrada
css/styles.css          Estilos
js/config.js            Semilla, constantes e íconos
js/app.js               Núcleo, estado y vistas
js/gym.js               Rutinas + reproductor de entrenamiento
js/reorder.js           Gestos de Hoy (arrastrar, deslizar) + init
js/sync.js              Supabase (login, sync) + notificaciones push
sw.js                   Service worker (offline y notificaciones)
manifest.webmanifest    Config PWA
icons/                  Íconos de la app
tests/                  Suite de pruebas (ver abajo)
supabase/               Migraciones SQL y la Edge Function de recordatorios
```

Los scripts se cargan en ese orden y el orden importa.

## Correr en local

Abrir `index.html` en el navegador, o servir la carpeta con cualquier servidor estático:

```bash
npx --yes http-server . -p 4200 -c-1
```

## Pruebas

```bash
npm test
```

Revisa la sintaxis de todos los JS y corre las suites de `tests/`. Sale distinto de cero si algo falla. Para una sola: `node tests/run.js hojas`.

No hace falta `npm install`: no hay dependencias. Las pruebas usan un harness propio que stubea el DOM y evalúa los scripts de la app.

## Desplegar

Sitio estático conectado a **Netlify**, con auto-deploy en cada push a `main`. Sin comando de build; el output es la raíz (`/`).

## Documentación

- `CLAUDE.md` / `AGENTS.md` — contexto técnico completo (son copias idénticas).
- `INSTALAR-en-iphone.md` — poner la app en línea e instalarla en el iPhone.
- `SUPABASE-setup.md` — cuenta y sincronización en la nube.
- `NOTIFICACIONES-setup.md` — recordatorios por Web Push.
- `RUTINAS-como-importar-json.md` y `COMIDAS-como-importar-json.md` — formatos de importación.
