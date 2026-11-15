# bb's closet — Preguntas abiertas

Pendientes de decidir antes de cerrar el `architecture.md` y el `database.md`. Cuando se responda una, la decisión se mueve al [spec](spec.md) y aquí se marca como resuelta.

**Estado a 06-09-2026:** ninguna de las preguntas que quedan bloquea el prototipo visual.

## Resueltas

### Modelo y arquitectura general

- [x] **¿Mono-usuario o multi-usuario?** → Multi-usuario con login, sin registro abierto (cuentas por invitación) + página de waitlist.
- [x] **¿Dónde viven los datos y las fotos?** → Backend, base de datos y almacenamiento de imágenes en la nube.
- [x] **¿Cómo se aíslan los datos entre usuarios?** → RLS en PostgreSQL, no solo comprobaciones en la aplicación.
- [x] **¿Cliente directo a la BD o API propia?** → API propia en el servidor; RLS como segunda red de seguridad.
- [x] **¿Cómo se estructuran las categorías?** → Tres niveles: hueco (cerrado, lo usa el generador), tipo de prenda (cerrado, lo elige el usuario), atributos (temporada multivalor, color, estilo).
- [x] **¿Cómo se evita que salgan dos prendas incompatibles?** → Mismo hueco = compiten, sale una; huecos distintos = se suman.

### Huecos y tipos de prenda

- [x] **¿La lista de huecos está completa?** → (06-09-2026) Sí, los nueve del spec cubren el armario. No se amplía.
- [x] **¿Cuántas piezas de joyería a la vez?** → (06-09-2026) Se mantiene la excepción en un solo hueco: **3 por defecto, configurable por el usuario hasta 10** desde ajustes. Al llegar al máximo, la nueva pieza sustituye a la más antigua.
- [x] **¿"Accesorios" se queda junto o se separa?** → (06-09-2026) Un solo hueco con una prenda a la vez, como estaba.
- [x] **Vestidos y monos (cuerpo entero):** → (06-09-2026) **Regla completa en la v1.** Poner cuerpo entero quita capa base y parte inferior, y viceversa. Capa media, exterior, calzado, bolso, joyería y accesorios sí conviven. "Outfit aleatorio" puede sacar vestidos.

### Vestidor y aleatorio

- [x] **¿Cómo se eligen las prendas al generar?** → (revisado 26-08-2026, sustituye a los checkboxes) El generador es un **vestidor** tipo dress-up game: lienzo en blanco (sin avatar) + panel de catálogo con pestañas por categoría; clic o arrastre para poner prendas. En móvil/tablet el panel es un menú desplegable.
- [x] **¿Se puede filtrar el sorteo por etiqueta?** → (revisado 26-08-2026) De momento no: el vestidor no lleva filtros ni checkboxes. Temporada, marca y etiquetas se mantienen como atributos de prenda y filtros **del catálogo**.
- [x] **¿Qué hace el aleatorio si ya hay prendas en el lienzo?** → Dos botones: **sustituir** (cambia cada prenda por otra al azar de su misma categoría; deshabilitado con el lienzo vacío) y **outfit aleatorio** (vacía el lienzo y coloca una prenda de cada categoría predeterminada).
- [x] **¿Las categorías del outfit aleatorio son fijas?** → Por defecto capa base, parte inferior, calzado y bolso; **configurables por cada usuario**.
- [x] **¿Dónde se configuran las categorías predeterminadas?** → (06-09-2026) **En el propio vestidor**, junto al botón de aleatorio, para poder ajustarlas sobre la marcha viendo el resultado.
- [x] **¿Se puede bloquear una prenda para que "sustituir" no la toque?** → (06-09-2026) **Sí, en la v1.** Cada prenda del lienzo lleva un candado.
- [x] **¿Debe "sustituir" evitar repetir el mismo resultado?** → (06-09-2026) Sí: **nunca repite la misma prenda dos pulsaciones seguidas** en un mismo hueco. Si un hueco tiene una sola prenda, se queda.
- [x] **¿Qué pasa si una categoría predeterminada está vacía?** → (06-09-2026) Se monta el outfit con las demás y se **avisa explícitamente**, con enlace al catálogo para subir una prenda de esa categoría.

### Lienzo y collage

- [x] **¿Cómo se muestra el outfit?** → Como collage de prendas recortadas con tamaños no uniformes, no como cuadrícula.
- [x] **¿El collage es editable arrastrando?** → (revisado 26-08-2026) Sí, y también en el vestidor, no solo en el favorito: mover y redimensionar (ratón y gestos táctiles). En el detalle del favorito se mantiene guardar/cancelar explícito.
- [x] **¿Se puede redimensionar en el vestidor?** → Sí: mover y redimensionar tipo collage, con ratón y con pellizco táctil.
- [x] **¿Rotación?** → (06-09-2026) **Sí.** Con tirador de giro y con dos dedos.
- [x] **¿Orden de superposición manual?** → (06-09-2026) **Sí**, traer al frente / enviar atrás. Hay un orden por defecto coherente con las capas de ropa.
- [x] **¿Deshacer?** → (06-09-2026) **Sí**, deshacer y rehacer sobre los cambios del lienzo.
- [x] **¿Botón de "volver a la colocación automática"?** → (06-09-2026) **Sí.**
- [x] **¿Con qué se implementa la edición del lienzo?** → (06-09-2026) **Konva / react-konva.** Trae Transformer (mover, redimensionar, rotar) con paridad ratón/táctil, orden de capas nativo, buena detección sobre PNG transparentes y exportación a imagen integrada. Descartado `pragmatic-drag-and-drop`: va sobre la API HTML5 de drag-and-drop (problemas conocidos en táctil) y no cubre redimensionar, rotar ni exportar.
- [x] **¿El lienzo es siempre del mismo fondo?** → (06-09-2026) Sí, **fondo fijo** definido por el diseño. No configurable.
- [x] **¿El detalle del favorito incluye panel de catálogo?** → (06-09-2026) **No.** Solo recolocar, redimensionar, rotar y reordenar lo que ya hay. Para montar otro outfit se va al vestidor.

### Prendas, fotos y atributos

- [x] **¿Se eliminan los fondos de las fotos?** → Sí, automáticamente al subir. Es requisito para que el collage funcione.
- [x] **¿Se guarda también la foto original?** → (06-09-2026) **No, solo el recorte.**
- [x] **¿Qué se hace si el recorte sale mal?** → (06-09-2026) **Cambiar la foto** de la prenda desde su ficha de edición y volver a procesarla. (No hay "reintentar" sobre la original porque no se guarda.)
- [x] **¿La prenda lleva nombre?** → (06-09-2026) **Nombre opcional**, texto libre. Si está vacío, la app muestra el tipo.
- [x] **¿Hace falta archivar prendas?** → (06-09-2026) **Sí, en la v1.** Una prenda archivada no sale en el vestidor ni en los aleatorios, pero sigue en el catálogo en una vista aparte y se puede recuperar. No afecta a los favoritos ya guardados.
- [x] **¿Quién marca la temporada?** → (06-09-2026) **El usuario, al subir la prenda.** No la deduce la IA.
- [x] **¿Hay etiquetas por prenda?** → Sí, etiquetas libres que crea el usuario, con autocompletado. La temporada queda como campo estructurado aparte.
- [x] **¿Se arranca con etiquetas sugeridas?** → (06-09-2026) **Sí**, un puñado (elegante, cómodo, curro, fiesta, findes…), descartables.
- [x] **¿Se pueden renombrar o borrar etiquetas?** → (06-09-2026) **Sí, desde una pantalla de ajustes.** Renombrar propaga a todas las prendas; borrar la quita de todas avisando de a cuántas afecta.
- [x] **¿El catálogo filtra por varias etiquetas a la vez?** → (06-09-2026) **Sí, combinando con Y**: cada etiqueta añadida acota más.
- [x] **¿Hay marca por prenda?** → Sí, campo propio de un solo valor con autocompletado, separado de las etiquetas.
- [x] **¿Marca como columna de texto o como tabla?** → (06-09-2026) **Columna de texto libre con autocompletado**, vocabulario **por usuario**. Se migrará a tabla el día que haga falta renombrar en masa o mostrar logos.
- [x] **¿Se puede editar una prenda ya subida?** → Sí: desde el catálogo, cada producto se edita individualmente.

### Favoritos

- [x] **¿El outfit en curso persiste entre sesiones?** → Sí, en localStorage, actualizado con cada cambio en el lienzo; por dispositivo, sin pasar por el servidor.
- [x] **¿Un favorito puede llevar nombre?** → (06-09-2026) **Nombre opcional.** Si se deja vacío, se identifica por la fecha.
- [x] **¿Qué pasa si se borra una prenda que está en un favorito?** → (06-09-2026) **Avisar antes de borrar**, diciendo en cuántos favoritos aparece. Si se confirma, la prenda desaparece de esos favoritos y el collage se recompone; el favorito no se borra.
- [x] **¿Se detectan duplicados de outfits?** → (06-09-2026) **No.** Se puede guardar el mismo outfit las veces que se quiera.

### Exportación

- [x] **¿Formato y proporción de salida?** → (06-09-2026) **PNG**, y el usuario **elige la proporción al exportar**: 1:1, 9:16 y 4:5. La composición se recompone para encajar.
- [x] **¿La imagen se genera en el cliente o en el servidor?** → (06-09-2026) **En el cliente**, con Konva. Instantáneo, sin coste de servidor y funciona sin conexión.
- [x] **¿Lleva marca de agua o branding?** → (06-09-2026) **No.** La imagen sale limpia.
- [x] **¿Pantalla y exportación comparten renderizado?** → (06-09-2026) Sí, resuelto por la elección de Konva.

### Plataforma

- [x] **¿El uso principal es móvil?** → (06-09-2026) **Sí, sobre todo móvil.** Diseño mobile-first; tablet y escritorio son ampliaciones. Refuerza pensar en PWA y en subir fotos con la cámara.
- [x] **¿Volumen estimado de prendas por usuario?** → (06-09-2026) **Cientos (100-500).** El catálogo necesita miniaturas, carga diferida y scroll paginado desde el principio.
- [x] **¿Idioma de la interfaz?** → (06-09-2026) **Español e inglés.** Los textos viven fuera del código desde el primer día.
- [x] **¿Qué se pide en la waitlist?** → (06-09-2026) **Solo el email.**
- [x] **¿Entra el modo inteligente en la v1?** → (06-09-2026) **No, va después de la v1.** Se diseñará con el armario ya lleno.

## Abiertas

### En standby por decisión explícita

- [ ] **¿Qué mecanismo de login?** (email + contraseña, magic link, OAuth con Google…) → **En standby desde el 06-09-2026.** No bloquea el prototipo: la pantalla se diseña con el patrón más simple y se ajusta al cerrarse.
- [ ] ¿Cómo se crea una cuenta nueva en la práctica? (invitación por email desde un panel, alta manual en BD…) — depende de la anterior.
- [ ] ¿Hace falta un **rol de administrador** para gestionar waitlist e invitaciones? Si sí, ¿cómo lo distingue RLS (claim en el JWT, tabla de roles, service key por fuera)?
- [ ] ¿La waitlist envía email de confirmación? (implica proveedor de email transaccional)
- [ ] **¿Con qué servicio se elimina el fondo?** (API tipo remove.bg o Photoroom, transformación de Cloudinary, o un modelo self-hosted tipo BiRefNet/rembg). Afecta a coste por prenda y a calidad del recorte. Se decide al montar el backend; el prototipo asume prendas ya recortadas.

### Nuevas, surgidas de las decisiones del 06-09-2026

- [ ] **Vestidos:** cuando poner un vestido va a quitar la camiseta y el pantalón que ya están en el lienzo, ¿se avisa antes o se hace en silencio y ya está? (En un dress-up game lo natural es que se haga solo, pero conviene que se *vea* que ha pasado.)
- [ ] **Joyería:** al alcanzar el máximo de piezas, ¿sustituir la más antigua en silencio o pedir al usuario que elija cuál quita?
- [ ] **Exportar a 9:16 y 4:5:** ¿cómo se recompone el collage para una proporción distinta a la del lienzo — se reescala el conjunto, o se recolocan las prendas? Afecta a si los ajustes manuales del usuario sobreviven al cambio de proporción.
- [ ] **Idioma:** ¿se traducen también los nombres de huecos y tipos de prenda al inglés? ¿Y qué pasa con las etiquetas y marcas que escribe el usuario (se quedan tal cual, se supone)?
- [ ] **Archivar:** ¿se puede archivar en lote (marcar varias prendas y archivarlas de golpe al cambiar de temporada)? Con cientos de prendas, hacerlo de una en una es tedioso.
- [ ] **Deshacer:** ¿el historial es solo de la sesión en curso o sobrevive a la recarga junto con el borrador de localStorage?
- [ ] **Ajustes:** ¿qué más acaba viviendo ahí? De momento etiquetas, máximo de joyería e idioma. ¿Merece la pena la página con solo eso, o se resuelve con un panel?

### Marca

- [ ] De momento el vestidor no lleva ningún filtro, así que la marca solo filtra el catálogo. ¿Interesa recuperarla como filtro del vestidor más adelante?
- [ ] ¿Interesa alguna vista de tipo "cuántas prendas tengo de cada marca"?

### Etiquetas

- [ ] ¿Hay un **máximo** de etiquetas por prenda?

### Collage

- [ ] **¿Cómo se implementa la composición automática?** Recomendación: una **cuadrícula con pesos de tamaño por hueco** que se recoloca sola, en lugar de plantillas dibujadas a mano para cada combinación (serían decenas).

### Fotos

- [ ] ¿Las fotos se sirven con **URLs firmadas** (caducan, control real de acceso) o desde un bucket público con rutas no adivinables?

### Modo inteligente (para después de la v1)

- [ ] **¿Qué criterios usa?** (combinación de colores, estilo casual/formal/deportivo, ocasión, temporada…)
- [ ] ¿De dónde salen esos atributos: los mete el usuario, los detecta la IA de la foto, o mixto (la IA propone y el usuario corrige)?
- [ ] ¿Reglas simples (tabla de colores que combinan) o un modelo de IA que evalúe outfits?
- [ ] ¿Filtra el azar (genera y descarta combinaciones malas) o propone directamente la mejor?
