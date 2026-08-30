# Rutinas de gym: cómo importarlas por JSON

Sirve para armar una rutina afuera (en un editor, o pidiéndosela a una IA) y meterla a la app de un jalón.

**Dónde:** pestaña **Workouts** → *Rutinas de fuerza* → **Importar JSON**. Pegas el texto y listo.

---

## Lo importante primero

Una sesión no es una lista plana de ejercicios: tiene **partes**. El calentamiento, el trabajo principal, el abdomen, el cuello y el enfriamiento son bloques distintos, y el abdomen no es un "extra tirado al final" — es su propia parte de la sesión.

Por eso una rutina se escribe así:

```json
{
  "name": "Push A",
  "days": ["lunes", "jueves"],
  "blocks": [
    { "name": "Calentamiento", "kind": "calentamiento", "exercises": [ ... ] },
    { "name": "Push",          "kind": "principal",     "exercises": [ ... ] },
    { "name": "Abdomen",       "kind": "extra",         "exercises": [ ... ] },
    { "name": "Cuello",        "kind": "extra",         "exercises": [ ... ] },
    { "name": "Enfriamiento",  "kind": "enfriamiento",  "exercises": [ ... ] }
  ]
}
```

---

## La rutina

| Campo | Obligatorio | Qué es |
| --- | --- | --- |
| `name` | sí | Cómo se llama la rutina ("Push A", "Pierna"). |
| `days` | no | Días en que toca. En minúsculas y en español: `lunes`, `martes`, `miércoles`, `jueves`, `viernes`, `sábado`, `domingo`. Lo que no sea un día válido se ignora. |
| `blocks` | sí* | Las partes de la sesión, en el orden en que las haces. |

\* Si no pones `blocks`, puedes usar el **formato viejo** con `exercises` directo (ver abajo).

## El bloque

| Campo | Obligatorio | Qué es |
| --- | --- | --- |
| `name` | no | **Lo que lees en la app.** Texto libre: "Calentamiento", "Push", "Abdomen", "Cuello", "Movilidad". Si no lo pones, se usa el nombre del tipo. |
| `kind` | no | El **tipo** de bloque. Manda el color y el comportamiento. Uno de: `calentamiento`, `principal`, `extra`, `enfriamiento`. Si falta o no se reconoce, queda en `principal`. |
| `exercises` | sí | Los ejercicios de ese bloque. |

**`name` y `kind` son cosas distintas a propósito.** Puedes tener dos bloques `extra` llamados "Abdomen" y "Cuello": la app los muestra como dos secciones separadas, cada una con su nombre, no como un montón de sobras.

## El ejercicio

| Campo | Obligatorio | Por defecto | Qué es |
| --- | --- | --- | --- |
| `name` | sí | — | Nombre del ejercicio. |
| `sets` | no | `1` | Cuántas series. |
| `rest` | no | `0` | Segundos de descanso entre series. |
| `type` | no | `"reps"` | `"reps"` o `"tiempo"`. Ver abajo. |
| `reps` | no | `"-"` | Repeticiones objetivo. Texto libre: `"8"`, `"8-10"`, `"al fallo"`. Se ignora si `type` es `"tiempo"`. |
| `seconds` | no | `30` | Cuántos segundos dura la serie. **Solo si `type` es `"tiempo"`.** |
| `bodyweight` | no | `false` | `true` si no hay peso externo que anotar (dominadas, fondos, plancha). |
| `weight` | no | `""` | Peso sugerido, como texto: `"60 kg"`, `"barra"`. Se ignora si `bodyweight` es `true`. |
| `note` | no | `""` | Recordatorio de técnica o tempo. |

### `type: "tiempo"` — lo que se mide en segundos

Una plancha no son repeticiones, son segundos. Con `type: "tiempo"`:

- el reproductor **cuenta el tiempo de trabajo hacia atrás**, no solo el descanso;
- al llegar a cero suena la alarma y (si diste permiso) llega una notificación;
- se registra la **duración**, no las reps;
- el **record es el aguante más largo**.

```json
{ "name": "Plancha", "sets": 3, "type": "tiempo", "seconds": 45, "rest": 45 }
```

### `bodyweight: true` — lo que no lleva peso

Con peso corporal el reproductor **no pide peso**: solo anotas las reps.

- el **record son las reps más altas**;
- la app **nunca** te reporta un record de peso para algo que no lleva peso.

```json
{ "name": "Dominadas", "sets": 4, "reps": "6-10", "rest": 120, "bodyweight": true }
```

### Los records, según cómo se mide

| El ejercicio es… | Su record es… |
| --- | --- |
| normal (peso + reps) | el **peso** más alto |
| `bodyweight: true` | las **reps** más altas |
| `type: "tiempo"` | el **aguante** más largo |

---

## Ejemplo completo

Una sesión con calentamiento, bloque principal, abdomen, cuello y enfriamiento — con un ejercicio por tiempo y varios de peso corporal:

```json
{
  "name": "Push A",
  "days": ["lunes", "jueves"],
  "blocks": [
    {
      "name": "Calentamiento",
      "kind": "calentamiento",
      "exercises": [
        { "name": "Movilidad de hombro", "sets": 1, "type": "tiempo", "seconds": 180, "rest": 0, "note": "Sin prisa" },
        { "name": "Series de aproximacion", "sets": 2, "reps": "12", "rest": 45, "weight": "barra" }
      ]
    },
    {
      "name": "Push",
      "kind": "principal",
      "exercises": [
        { "name": "Press banca", "sets": 4, "reps": "8-10", "rest": 120, "weight": "60 kg", "note": "Baja controlado, pausa abajo" },
        { "name": "Press militar de pie", "sets": 3, "reps": "8-10", "rest": 120 },
        { "name": "Elevaciones laterales", "sets": 4, "reps": "12-15", "rest": 60 },
        { "name": "Fondos en paralelas", "sets": 3, "reps": "10", "rest": 90, "bodyweight": true }
      ]
    },
    {
      "name": "Abdomen",
      "kind": "extra",
      "exercises": [
        { "name": "Plancha", "sets": 3, "type": "tiempo", "seconds": 45, "rest": 45 },
        { "name": "Elevacion de piernas colgado", "sets": 3, "reps": "12", "rest": 60, "bodyweight": true }
      ]
    },
    {
      "name": "Cuello",
      "kind": "extra",
      "exercises": [
        { "name": "Flexion de cuello", "sets": 2, "reps": "15", "rest": 30, "bodyweight": true },
        { "name": "Extension de cuello", "sets": 2, "reps": "15", "rest": 30, "bodyweight": true }
      ]
    },
    {
      "name": "Enfriamiento",
      "kind": "enfriamiento",
      "exercises": [
        { "name": "Estiramiento de pectoral", "sets": 2, "type": "tiempo", "seconds": 30, "rest": 15 },
        { "name": "Respiracion", "sets": 1, "type": "tiempo", "seconds": 120, "rest": 0 }
      ]
    }
  ]
}
```

---

## Varias rutinas de un jalón

Tres formas, todas válidas:

```json
{ "routines": [ { ... }, { ... } ] }
```

```json
[ { ... }, { ... } ]
```

O una sola rutina suelta, como el ejemplo de arriba.

Ver `mi-rutina-PPL.json` para un Push/Pull/Legs completo.

---

## El formato viejo sigue funcionando

Si tienes JSON de antes con la lista plana de ejercicios, **se importa igual**. Entra como un único bloque `principal` y no se pierde nada:

```json
{
  "name": "Push A",
  "days": ["lunes"],
  "exercises": [
    { "name": "Press banca", "sets": 4, "reps": "8-10", "rest": 120 }
  ]
}
```

Al **exportar** (desde el editor de la rutina) siempre sale el formato nuevo con bloques.

---

## Detalles que conviene saber

- **Los nombres se resuelven contra tu catálogo de ejercicios.** Si escribes "PRESS BANCA" o "Préss bánca" y ya tienes "Press banca", la app reusa el mismo ejercicio: acentos, mayúsculas y espacios de más no cuentan. Tu historial y tus records **no se parten** por reimportar.
- `type` y `bodyweight` son de **esa línea de la rutina**, no del catálogo. El mismo ejercicio puede aparecer con peso en una rutina y a peso corporal en otra sin duplicarse en el catálogo.
- Importar **agrega** rutinas, no reemplaza las que ya tienes.
- Si el JSON está mal, la app te lo dice y no importa nada.
- Cada rutina necesita `blocks` o `exercises`. Sin ninguno de los dos, se ignora.
