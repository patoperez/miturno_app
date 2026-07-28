/* =====================================================================
   config.js  ·  Mi Turno
   Solo define la SEMILLA inicial y las opciones de personalización.
   Después puedes editar todo desde la app (pestaña Ajustes) sin tocar
   este archivo.
===================================================================== */

const APP_NAME = "Mi Turno";
const DEFAULT_USER_NAME = "Patricio";

/* Supabase (URL y clave pública — seguras para el navegador, protegidas por RLS) */
const SUPABASE_URL = "https://xeerkvjlguycmdrimfbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_lK_T9Z1R7-iHuykHk0NOug_nvzaHYFG";

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

/* ---------- SEMILLA inicial (solo la primera vez) ---------- */
const DEFAULT_CFG = {
  settings: { userName: DEFAULT_USER_NAME, mealView: "menu" },
  identities: [
    { id:"cuerpo", label:"El que construye su cuerpo", icon:"cuerpo", raw:"#FF5A3C",
      why:"Recomposición, luego bulk, luego cut. Un proceso de alrededor de un año para tener el cuerpo que quiero.",
      quotes:["Aún no somos quien queremos llegar a ser.","Cada comida y cada serie es un voto por el cuerpo que quiero."] },
    { id:"ingresos", label:"El que genera ingresos", icon:"ingresos", raw:"#10B981",
      why:"Trabajo remoto e ingresos en línea para ahorrar e irme a vivir a Europa. Construir el CRM y ganar libertad.",
      quotes:["La libertad se construye un día a la vez.","Europa no es un sueño, es un plan con fecha."] },
    { id:"ciber", label:"El que se mueve a ciberseguridad", icon:"ciber", raw:"#3B82F6",
      why:"Mover el rumbo de mi carrera hacia lo que de verdad me apasiona. Empezando por el homelab.",
      quotes:["Un poco de código hoy es un futuro distinto mañana.","Paso a paso: homelab primero."] },
    { id:"productividad", label:"El que aprovecha su vida", icon:"productividad", raw:"#8B5CF6",
      why:"Dejar de desperdiciar mi vida en scroll y encierro. Aprovechar el día y ser dueño de mi tiempo.",
      quotes:["No más días perdidos.","La disciplina es elegirme a mí sobre mis impulsos."] },
    { id:"lectura", label:"El que lee y crece", icon:"lectura", raw:"#F59E0B",
      why:"Alimentar mi mente. Cambiar el scroll infinito por páginas que me construyen.",
      quotes:["Leer es reprogramarme.","Treinta minutos de libro superan tres horas de scroll."] }
  ],
  habits: [
    { id:"deepwork", name:"Ollin Deep Work",          idn:"ingresos" },
    { id:"gym",      name:"Ir al gym (training plan)", idn:"cuerpo" },
    { id:"dieta",    name:"Cumplir la dieta",          idn:"cuerpo" },
    { id:"coding",   name:"Aprender coding / homelab", idn:"ciber" },
    { id:"bed23",    name:"Dormir antes de 23:00",     idn:"cuerpo" },
    { id:"leer",     name:"Leer al menos 20 min",      idn:"lectura" },
    { id:"meditar",  name:"Meditar",                   idn:"productividad" },
    { id:"skincare", name:"Higiene y skincare",        idn:"cuerpo" },
    { id:"plan",     name:"Planear el día (10 min)",   idn:"productividad" }
  ],
  commitments: [
    { id:"noporn",     name:"Sin porno",                   idn:"productividad" },
    { id:"nosub",      name:"Sin marihuana ni sustancias", idn:"productividad" },
    { id:"nofastfood", name:"Sin comida chatarra",         idn:"cuerpo" },
    { id:"nosugar",    name:"Sin azúcar",                  idn:"cuerpo" },
    { id:"nodoom",     name:"Sin doomscrolling",           idn:"productividad" }
  ],
  /* ----- Plantilla de comidas (persistente, aparece igual cada día) ----- */
  meals: {
    menu: [
      { id:"m1", name:"Desayuno", desc:"Licuado: proteína San Juan + avena + kefir + mantequilla de maní + piña" },
      { id:"m2", name:"Comida",   desc:"Proteína + carbohidrato + verduras libres" },
      { id:"m3", name:"Cena",     desc:"Proteína + carbohidrato + verduras" }
    ],
    fichas: {
      categories: [
        { id:"prot", name:"Proteína",     color:"#FF5A3C", quota:3 },
        { id:"carb", name:"Carbohidrato", color:"#F59E0B", quota:5 },
        { id:"fat",  name:"Grasa",        color:"#8B5CF6", quota:3 }
      ],
      innegociables: [
        { id:"kefir", name:"Kefir Lifeway (1 taza)" },
        { id:"yogur", name:"Yogurt griego Oikos (170 g)" },
        { id:"prots", name:"Proteína San Juan (1 scoop)" },
        { id:"pina",  name:"Piña (200 g)" },
        { id:"crea",  name:"Creatina (5 g)" }
      ],
      catalog: {
        prot: [
          {food:"Pechuga de pollo", amount:"175 g", note:"Magra"},
          {food:"Atún en agua", amount:"205 g"},
          {food:"Medallón de atún", amount:"170 g"},
          {food:"Salmón", amount:"195 g", note:"Resta 1 ficha de grasa"},
          {food:"Res magra", amount:"190 g"},
          {food:"Lomo de cerdo", amount:"190 g"},
          {food:"Pescado dorado", amount:"215 g"},
          {food:"Marlin", amount:"190 g"},
          {food:"Camarón", amount:"220 g"},
          {food:"6 claras + 2 huevos", amount:"200 g de clara"}
        ],
        carb: [
          {food:"Arroz blanco cocido", amount:"135 g"},
          {food:"Arroz integral cocido", amount:"150 g"},
          {food:"Avena cruda", amount:"65 g"},
          {food:"Papa cocida", amount:"190 g"},
          {food:"Camote cocido", amount:"185 g"},
          {food:"Pasta cocida", amount:"125 g"},
          {food:"Tortilla de maíz", amount:"3 piezas"},
          {food:"Pan integral", amount:"3 rebanadas"}
        ],
        fat: [
          {food:"Aceite de oliva", amount:"1 cda (14 g)"},
          {food:"Aguacate", amount:"90 g"},
          {food:"Almendras", amount:"28 g"},
          {food:"Nueces", amount:"22 g"},
          {food:"Mantequilla de maní", amount:"28 g"}
        ]
      }
    }
  },
  /* ----- Actividades (personalizable): fuerza y clases ----- */
  activities: [
    { id:"gym",  name:"Gym",        type:"strength", icon:"dumbbell", color:"#FF5A3C" },
    { id:"kick", name:"Kickboxing", type:"class",    icon:"boxing",   color:"#3B82F6" },
    { id:"box",  name:"Boxeo",      type:"class",    icon:"boxing",   color:"#EC4899" }
  ],
  /* ----- Rutinas de gym (ejemplo editable) ----- */
  routines: [
    { id:"push", name:"Push (ejemplo)", days:["lunes","jueves"], exercises:[
      { id:"e1", name:"Press banca", sets:4, reps:"8-10", rest:120, weight:"", note:"" },
      { id:"e2", name:"Press militar con mancuerna", sets:3, reps:"10-12", rest:90, weight:"", note:"" },
      { id:"e3", name:"Fondos en paralelas", sets:3, reps:"10", rest:90, weight:"", note:"" },
      { id:"e4", name:"Extensión de tríceps en polea", sets:3, reps:"12-15", rest:60, weight:"", note:"" }
    ]}
  ]
};
