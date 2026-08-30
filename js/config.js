/* =====================================================================
   config.js  ·  Mi Turno
   Solo define la SEMILLA inicial y las opciones de personalización.
   Después puedes editar todo desde la app (pestaña Ajustes) sin tocar
   este archivo.
===================================================================== */

const APP_NAME = "Mi Turno";
const DEFAULT_USER_NAME = "tú";

/* =====================================================================
   ↓↓↓  CONFIGURACIÓN PERSONAL — LO ÚNICO QUE DEBES CAMBIAR  ↓↓↓
   Si estás montando TU PROPIA copia de la app, reemplaza estos tres
   valores por los tuyos. Vienen explicados en INSTALAR-TU-COPIA.md
   Los tres son públicos y seguros para el navegador.
===================================================================== */

/* 1 y 2: de tu proyecto de Supabase (Project Settings → API) */
const SUPABASE_URL = "https://xeerkvjlguycmdrimfbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_lK_T9Z1R7-iHuykHk0NOug_nvzaHYFG";

/* 3: tu llave PÚBLICA de notificaciones (ábrela con generar-llaves.html) */
const VAPID_PUBLIC = "BPKN-6oj8ac8FQcdqAb8LFzPKSXL4gqebi6k4IBVyFL8IUU326ffNY9BE0w0yhF1mDbpclmqozG0Chz0cHrFDjo";

/* =====================================================================
   ↑↑↑  FIN DE LA CONFIGURACIÓN PERSONAL  ↑↑↑
===================================================================== */

/* ---------- Íconos de línea (SVG path, viewBox 0 0 24 24) ---------- */
const ICONS = {
  // Identidades
  cuerpo:        "M3 12h3l2 6 4-14 2 8h5",
  ingresos:      "M3 17l6-6 4 4 8-8 M15 7h6v6",
  ciber:         "M12 3l7 3v5c0 4.2-3 7.3-7 9-4-1.7-7-4.8-7-9V6z",
  productividad: "M13 2L4 14h7l-1 8 9-12h-7z",
  lectura:       "M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z",
  heart:         "M12 21C7 17 3 13 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 13 17 17 12 21z",
  star:          "M12 3l2.7 6.3 6.3.5-4.8 4.1 1.5 6.1L12 17l-5.7 3 1.5-6.1L3 9.8l6.3-.5z",
  code:          "M8 8l-4 4 4 4 M16 8l4 4-4 4 M13 5l-2 14",
  mountain:      "M3 20l6-11 4 6 3-4 5 9z",
  leaf:          "M4 20C4 10 12 4 20 4c0 8-6 16-16 16z M8 16c3.5-3.5 6-6 9-8",
  sun:           "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M12 2v2 M12 20v2 M4 12H2 M22 12h-2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5",
  moon:          "M20 14a8 8 0 1 1-9.5-9.8A6 6 0 0 0 20 14z",
  target:        "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 12m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0",
  dumbbell:      "M3 9v6 M6 6v12 M18 6v12 M21 9v6 M6 12h12",
  // Interfaz
  check:    "M4 12l5 5L20 6",
  plus:     "M12 5v14 M5 12h14",
  minus:    "M5 12h14",
  trash:    "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  clock:    "M12 7v5l3 2 M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0",
  chevron:  "M6 9l6 6 6-6",
  chevleft: "M15 6l-6 6 6 6",
  chevright:"M9 6l6 6-6 6",
  flame:    "M12 2c.5 3 3 4 3 7.5 0 2 1 2.5 1 4a4 4 0 0 1-8 0c0-2 1-3 2-4 .3 1.5 1.5 1.3 1.5 0C12.5 7 12 5 12 2z",
  edit:     "M4 20h4L18 10l-4-4L4 16z",
  book:     "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z M18 3v16",
  list:     "M8 6h13 M8 12h13 M8 18h13 M3.5 6h.01 M3.5 12h.01 M3.5 18h.01",
  grid:     "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  calendar: "M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4",
  chart:    "M4 20V4 M4 20h16 M8 16v-4 M12 16V8 M16 16v-6",
  sliders:  "M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M13 4v4 M7 10v4 M15 16v4",
  close:    "M6 6l12 12 M18 6L6 18",
  meal:     "M5 3v8a2 2 0 0 0 4 0V3 M7 11v10 M17 3c-2 0-3 2-3 5s1 4 3 4v9",
  water:    "M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z",
  play:     "M7 5l12 7-12 7z",
  pause:    "M8 5v14 M16 5v14",
  skipfwd:  "M6 5l9 7-9 7z M18 5v14",
  pin:      "M12 2a6 6 0 0 0-6 6c0 4 6 12 6 12s6-8 6-12a6 6 0 0 0-6-6z M12 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0",
  download: "M12 3v12 M7 10l5 5 5-5 M4 21h16",
  upload:   "M12 21V9 M7 14l5-5 5 5 M4 3h16",
  boxing:   "M7 10V7a3 3 0 0 1 6 0v3 M7 10h9a3 3 0 0 1 3 3v2a4 4 0 0 1-4 4H10a3 3 0 0 1-3-3z M7 13h3",
  run:      "M13 4a1.6 1.6 0 1 0 .01-.01 M9 21l2-5 3 2 1 3 M6 12l3-3 4 1 3-3 M9 9l-2 4",
  bike:     "M6 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M6 18l4-8h5l3 8 M10 10l2-4h3 M9 6h4",
  trophy:   "M8 4h8v4a4 4 0 0 1-8 0z M8 6H5v1a3 3 0 0 0 3 3 M16 6h3v1a3 3 0 0 0-3 3 M10 14h4l1 6H9z",
  timer2:   "M10 2h4 M12 14l3-3 M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"
};

const ICON_CHOICES = ["cuerpo","ingresos","ciber","productividad","lectura",
  "heart","star","code","mountain","leaf","sun","moon","flame","book","target","dumbbell"];

const PALETTE = ["#FF5A3C","#F97316","#F59E0B","#FACC15","#22C55E","#10B981",
  "#14B8A6","#3B82F6","#6366F1","#8B5CF6","#EC4899","#F43F5E"];

const SLEEP_RANGES = ["8h+","7h","6h","5h","4h","3h","3h-"];
const WEEKDAYS = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"];

/* =====================================================================
   SEMILLA inicial — solo se usa la PRIMERA vez que abres la app.
   Viene vacía a propósito: Mi Turno no supone nada sobre tu vida.
   Configuras tus metas, hábitos, compromisos y comidas desde Ajustes,
   o los importas por JSON. Si inicias sesión, se descarga lo tuyo.
===================================================================== */
const DEFAULT_CFG = {
  settings: {
    userName: DEFAULT_USER_NAME, mealView: "menu",
    notif: { enabled: false, morning: { on: true, time: "07:30" }, midday: { on: true, time: "15:00" }, night: { on: true, time: "21:30" } }
  },
  /* Tus metas. Cada hábito y compromiso puede colgar de una. */
  identities: [],
  /* Cosas que quieres HACER cada día. */
  habits: [],
  /* Cosas que quieres NO hacer. Llevan racha. */
  commitments: [],
  /* Números que registras cada día (peso, horas de estudio, pantalla...). */
  metrics: [],
  /* Comidas: en modo "menu" marcas comidas; en "fichas", porciones por categoría. */
  meals: {
    menu: [
      { id: "m1", name: "Desayuno", desc: "" },
      { id: "m2", name: "Comida", desc: "" },
      { id: "m3", name: "Cena", desc: "" }
    ],
    fichas: { categories: [], innegociables: [], catalog: {} }
  },
  /* Actividades: "strength" usa el reproductor de rutinas; "class" se registra por sesión. */
  activities: [
    { id: "gym", name: "Gym", type: "strength", icon: "dumbbell", color: "#FF5A3C" }
  ],
  /* Rutinas de gym. Se crean desde Workouts o se importan por JSON. */
  routines: [],
  /* Catálogo de ejercicios: {id, name, aliases[]}. Es la identidad estable de
     un ejercicio; el nombre es solo la etiqueta que se muestra. Se llena solo
     con lo que registras o importas. */
  exercises: [],
  /* Pares de ejercicios que ya dijiste que NO son duplicados. */
  exDismissed: []
};
