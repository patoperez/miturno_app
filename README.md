# Mi Turno

App personal de construcción de identidad, hábitos y entrenamiento. PWA (funciona offline, instalable en el iPhone). Sin dependencias ni build: HTML, CSS y JavaScript puro.

## Qué hace

- **Hoy:** hábitos, compromisos (con racha), comidas (menú o fichas), tareas, sueño, mood y bitácora. Secciones reordenables arrastrando.
- **Progreso:** vista semana / mes / bitácora, con calendario de puntos + agenda y líneas de progreso.
- **Workouts:** rutinas de fuerza con reproductor (registro de peso/reps por serie, descansos, reanudar/finalizar), historial, records, tira semanal y actividades multideporte (kickboxing, boxeo, etc.).
- **Metas:** identidades con su "para qué" y frases.
- **Ajustes:** todo personalizable (identidades, hábitos, compromisos, comidas por menú o por fichas, import/export JSON).

Los datos se guardan localmente en el dispositivo. El historial de días pasados queda congelado (los cambios de configuración solo aplican de hoy en adelante).

## Estructura

```
index.html              Punto de entrada
css/styles.css          Estilos
js/config.js            Semilla y opciones (identidades, hábitos, comidas, rutinas...)
js/app.js               Núcleo y vistas
js/gym.js               Rutinas + reproductor de entrenamiento
js/reorder.js           Arrastrar para reordenar + init
manifest.webmanifest    Config PWA
sw.js                   Service worker (offline)
icons/                  Íconos de la app
```

## Desplegar (Cloudflare Pages)

Es un sitio estático: sin comando de build. Output directory = raíz (`/`).

## Correr en local

Abrir `index.html` en el navegador (o servir la carpeta con cualquier servidor estático).
