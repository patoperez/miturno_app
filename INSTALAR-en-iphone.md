# Instalar "Mi Turno" en tu iPhone

La app es una PWA: para instalarla en el iPhone solo necesitamos ponerla en línea con HTTPS (gratis) y luego agregarla a la pantalla de inicio. Son ~5 minutos.

---

## Paso 1 — Subirla en línea (gratis, sin código)

La forma más fácil es **Netlify Drop** (arrastrar y soltar, sin instalar nada).

1. En tu computadora, abre **https://app.netlify.com/drop**
2. Crea una cuenta gratis (con tu correo o con Google/GitHub). Es gratis y no pide tarjeta.
3. Arrastra la carpeta **day2day_app** completa a la zona que dice "Drag and drop your site folder here".
4. Espera unos segundos. Netlify te dará una dirección tipo **https://algo-random-1234.netlify.app**
5. (Opcional) En *Site settings → Change site name* puedes ponerle un nombre más bonito, por ejemplo `mi-turno-pato.netlify.app`.

> Esa dirección es tuya y queda en HTTPS. Ese es el enlace que usarás en el iPhone.

### Alternativa: GitHub Pages
Si prefieres GitHub: crea un repositorio, sube los archivos de la carpeta, y en *Settings → Pages* activa la rama principal. Te da una URL `https://tuusuario.github.io/repo`. Netlify es más simple para empezar.

---

## Paso 2 — Instalarla en el iPhone

1. En tu iPhone, abre esa dirección **en Safari** (tiene que ser Safari, no Chrome).
2. Toca el botón de **Compartir** (el cuadro con la flecha hacia arriba).
3. Baja y toca **"Agregar a pantalla de inicio"**.
4. Ponle el nombre **Mi Turno** y toca **Agregar**.
5. Ciérrala y ábrela desde el **ícono nuevo** en tu pantalla de inicio.

Ahora se abre a pantalla completa, con su ícono propio, sin barra de Safari. Funciona offline y tus datos se guardan en el teléfono.

---

## Notas

- **Para actualizarla más adelante** (cuando le agreguemos cosas), solo vuelves a arrastrar la carpeta en Netlify Drop sobre el mismo sitio, o lo automatizamos con GitHub.
- **Tus datos** viven en el teléfono por ahora. Por eso el siguiente paso será un **respaldo** y luego **Supabase** para la nube y las notificaciones.
- **Notificaciones:** iOS solo las permite en apps instaladas (agregadas a la pantalla de inicio). Cuando montemos Supabase, te pedirá permiso de notificaciones; acéptalo.
- Ábrela **una vez desde el ícono** después de instalar, para que se guarde offline.
