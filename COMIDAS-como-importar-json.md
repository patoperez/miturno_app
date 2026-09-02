# Cómo configurar tus comidas con JSON

En **Mi Turno** eliges UN solo sistema de comidas (lo pones en **Ajustes → Comidas → Sistema**; Ajustes se abre con el **engrane del header**, arriba a la derecha):

- **Menú**: tus comidas del día (Desayuno, Comida, Cena...) con su descripción. Marcas cada una como hecha.
- **Fichas**: porciones intercambiables por categoría (Proteína, Carbo, Grasa...). Cada ficha equivale a una opción de comida. Marcas fichas hasta llenar tu cuota del día.

Puedes configurarlo **a mano** desde Ajustes, o **por JSON** (Importar / Exportar). Esta guía explica el JSON.

## Dónde se importa

**Ajustes → Comidas → Importar comidas (JSON)**. Pega el JSON y presiona Importar. Reemplaza tu configuración de comidas actual.

> Truco: configura algo a mano, dale **Exportar comidas (JSON)** y verás el formato exacto ya lleno. Es la forma más fácil de aprenderlo y de respaldar.

## Estructura completa

```json
{
  "system": "fichas",
  "menu": [
    { "name": "Desayuno", "desc": "Licuado de proteína + avena + kefir" },
    { "name": "Comida", "desc": "Proteína + carbo + verduras" },
    { "name": "Cena", "desc": "Proteína + carbo + verduras" }
  ],
  "fichas": {
    "categories": [
      {
        "name": "Proteína",
        "quota": 3,
        "color": "#FF5A3C",
        "foods": [
          { "food": "Pechuga de pollo", "amount": "175 g", "note": "Magra" },
          { "food": "Atún en agua", "amount": "205 g" }
        ]
      },
      {
        "name": "Carbohidrato",
        "quota": 5,
        "color": "#F59E0B",
        "foods": [
          { "food": "Arroz blanco cocido", "amount": "135 g" }
        ]
      }
    ],
    "innegociables": [
      { "name": "Kefir Lifeway (1 taza)" },
      { "name": "Creatina (5 g)" }
    ]
  }
}
```

## Campos

| Campo | Qué es |
| --- | --- |
| `system` | Qué sistema queda activo: `"menu"` o `"fichas"`. Opcional; si lo pones, cambia el sistema automáticamente. |
| `menu` | Lista de comidas del sistema Menú. Cada una: `name` (obligatorio) y `desc` (opcional). |
| `fichas.categories` | Categorías de fichas. Cada una: `name`, `quota` (fichas por día, número), `color` (hex opcional) y `foods` (opciones). |
| `foods` | Opciones de esa categoría (lo que ves en "ver opciones"). Cada una: `food`, `amount`, y `note` opcional. |
| `fichas.innegociables` | Lista fija que marcas aparte. Cada una: `{ "name": "..." }` (o solo el texto). |

## Reglas para que no falle

- JSON válido: comillas dobles `"`, comas entre elementos, sin coma después del último.
- `quota` es un número sin comillas (`3`, no `"3"`).
- Puedes incluir solo `menu`, solo `fichas`, o ambos. Solo se muestra el que marque `system` (o el que tengas activo).
- Los colores van en hex (`"#FF5A3C"`). Si lo omites, se asigna uno por defecto.

Revisa `mis-comidas.json` en esta carpeta: es tu Plan Alimenticio actual ya convertido, listo para editar e importar.
