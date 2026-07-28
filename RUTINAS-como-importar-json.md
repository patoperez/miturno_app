# Cómo importar tu rutina de gym con JSON

Esta guía te dice exactamente cómo armar el archivo JSON para importar tus rutinas a **Mi Turno** sin errores. No hay límites: pon los ejercicios, series y descansos que quieras.

## Dónde se importa

En la app: **Ajustes → Rutinas de gym → Importar JSON**. Pega ahí el texto y presiona **Importar**.

## Estructura básica

Una rutina se ve así:

```json
{
  "name": "Push A",
  "days": ["lunes", "jueves"],
  "exercises": [
    { "name": "Press banca", "sets": 4, "reps": "8-10", "rest": 120, "weight": "60 kg", "note": "Baja controlado" },
    { "name": "Press militar con mancuerna", "sets": 3, "reps": "10-12", "rest": 90 },
    { "name": "Fondos en paralelas", "sets": 3, "reps": "10", "rest": 90 }
  ]
}
```

## Campos

### De la rutina

| Campo | Obligatorio | Qué es |
| --- | --- | --- |
| `name` | Recomendado | Nombre de la rutina (ej. "Push A"). Si falta, se llama "Rutina importada". |
| `days` | Opcional | Días de la semana en que aparece sola como "rutina de hoy". Usa exactamente: `lunes`, `martes`, `miércoles`, `jueves`, `viernes`, `sábado`, `domingo`. Puedes dejarlo vacío `[]` y elegirla manualmente. |
| `exercises` | **Sí** | Lista de ejercicios en orden. Debe existir aunque sea con uno. |

### De cada ejercicio

| Campo | Obligatorio | Qué es |
| --- | --- | --- |
| `name` | Sí | Nombre del ejercicio. |
| `sets` | Sí | Número de series (entero, mínimo 1). |
| `reps` | Sí | Repeticiones. Puede ser número (`10`) o texto/rango (`"8-10"`, `"al fallo"`). Ponlo entre comillas si usas rango. |
| `rest` | Sí | Segundos de descanso entre series (entero). Ej. `90` = 1:30. Usa `0` si no quieres descanso. |
| `weight` | Opcional | Peso objetivo como texto (`"60 kg"`, `"cuerpo"`). |
| `note` | Opcional | Nota corta (técnica, tempo, etc.). |

## Importar varias rutinas de una vez

Puedes pegar un **arreglo** de rutinas:

```json
[
  { "name": "Push", "days": ["lunes"], "exercises": [ { "name": "Press banca", "sets": 4, "reps": "8-10", "rest": 120 } ] },
  { "name": "Pull", "days": ["martes"], "exercises": [ { "name": "Dominadas", "sets": 4, "reps": "max", "rest": 120 } ] }
]
```

O envolverlas en `routines`:

```json
{ "routines": [ { "name": "Legs", "days": ["miércoles"], "exercises": [ { "name": "Sentadilla", "sets": 5, "reps": "5", "rest": 180 } ] } ] }
```

## Reglas para que no falle

- Todo el archivo debe ser **JSON válido**: comillas dobles `"` (no `'`), comas entre elementos, sin coma después del último elemento.
- `sets` y `rest` deben ser números **sin comillas** (`4`, no `"4"`). Si los pones con comillas igual los interpreto, pero mejor sin.
- `reps` con rango va entre comillas: `"8-10"`.
- Los acentos en `days` importan: `miércoles`, `sábado`.
- Si un ejercicio no trae `rest`, se asume `0`; si no trae `sets`, se asume `1`. Mejor especifícalos.

## Consejo

Puedes construir una rutina a mano en la app, y luego usar **Exportar JSON** (dentro del editor de esa rutina) para ver el formato exacto ya lleno con tus datos. Es la forma más fácil de aprender la estructura y de respaldar tus rutinas.

Revisa `ejemplo-rutina.json` en esta misma carpeta como plantilla lista para editar.
