# bb's closet — Preguntas abiertas

Decisiones tomadas y pendientes. Ya existen el [architecture.md](architecture.md) y el [database.md](database.md). Cuando se responda una, la decisión se mueve al [spec](spec.md) y aquí se marca como resuelta.

**Estado a 25-10-2026:** todo cerrado salvo el modo inteligente, que es posterior a la v1. Nada bloquea empezar a construir.

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

- [x] **¿Color libre o paleta cerrada?** → (01-10-2026) **Selector de color (react-colorful) + familia calculada.** Se guarda el hex elegido y la app deriva la familia de color (negro, blanco, beige, azul…), que es la que filtra el catálogo. Opcional.
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

- [x] **¿Qué pasa si un favorito se queda sin prendas?** → (01-10-2026) **Se elimina solo**, avisando antes en el diálogo de borrado de la prenda.
- [x] **¿El outfit en curso persiste entre sesiones?** → Sí, en localStorage, actualizado con cada cambio en el lienzo; por dispositivo, sin pasar por el servidor.
- [x] **¿Un favorito puede llevar nombre?** → (06-09-2026) **Nombre opcional.** Si se deja vacío, se identifica por la fecha.
- [x] **¿Qué pasa si se borra una prenda que está en un favorito?** → (06-09-2026) **Avisar antes de borrar**, diciendo en cuántos favoritos aparece. Si se confirma, la prenda desaparece de esos favoritos y el collage se recompone; el favorito no se borra (salvo que se quede vacío, ver arriba; revisado 01-10-2026).
- [x] **¿Se detectan duplicados de outfits?** → (06-09-2026) **No.** Se puede guardar el mismo outfit las veces que se quiera.

### Exportación

- [x] **¿Formato y proporción de salida?** → (06-09-2026) **PNG**, y el usuario **elige la proporción al exportar**: 1:1, 9:16 y 4:5. La composición se recompone para encajar.
- [x] **¿La imagen se genera en el cliente o en el servidor?** → (06-09-2026) **En el cliente**, con Konva. Instantáneo, sin coste de servidor y funciona sin conexión.
- [x] **¿Lleva marca de agua o branding?** → (06-09-2026) **No.** La imagen sale limpia.
- [x] **¿Pantalla y exportación comparten renderizado?** → (06-09-2026) Sí, resuelto por la elección de Konva.

### Plataforma

- [x] **¿Quién gestiona la waitlist y las invitaciones?** → (01-10-2026) **John, a mano, desde el panel de Supabase.** Sin rol de administrador ni panel propio de momento; se añade si la lista crece. También responde a cómo se crea una cuenta en la práctica.
- [x] **¿El uso principal es móvil?** → (06-09-2026) **Sí, sobre todo móvil.** Diseño mobile-first; tablet y escritorio son ampliaciones. Refuerza pensar en PWA y en subir fotos con la cámara.
- [x] **¿Volumen estimado de prendas por usuario?** → (06-09-2026) **Cientos (100-500).** El catálogo necesita miniaturas, carga diferida y scroll paginado desde el principio.
- [x] **¿Idioma de la interfaz?** → (06-09-2026) **Español e inglés.** Los textos viven fuera del código desde el primer día.
- [x] **¿Qué se pide en la waitlist?** → (06-09-2026) **Solo el email.**
- [x] **¿Entra el modo inteligente en la v1?** → (06-09-2026) **No, va después de la v1.** Se diseñará con el armario ya lleno.

### Cierre del 01-10-2026

- [x] **¿Qué mecanismo de login?** → **Email + contraseña.** Las cuentas las crea John a mano en la base de datos; un panel de gestión de usuarios queda como mejora futura.
- [x] **¿La waitlist envía email de confirmación?** → **No.** Solo mensaje en pantalla; sin proveedor de correo en la v1.
- [x] **¿Con qué servicio se elimina el fondo?** → **En el navegador con `@imgly/background-removal`** (gratis). **Provisional:** se prueba con prendas reales antes de la fase 3; plan B, servicio externo.
- [x] **Vestidos:** al poner uno se quitan camiseta y pantalón **en silencio**, sin aviso; se puede deshacer.
- [x] **Joyería:** al llegar al máximo se **sustituye la más antigua en silencio**.
- [x] **Exportar a 9:16 y 4:5:** se **reescala el conjunto** manteniendo la composición y los ajustes manuales, con márgenes.
- [x] **Idioma:** se traducen los textos del software (incluidos huecos y tipos); lo que escribe el usuario se queda tal cual.
- [x] **Archivar en lote:** **sí, en la v1.**
- [x] **Deshacer:** historial **solo de la sesión**; el borrador del lienzo sí persiste.
- [x] **Ajustes:** **página propia** (etiquetas, máximo de joyería, idioma).
- [x] **Marca:** sin filtro en el vestidor ni vista "prendas por marca" por ahora; se revisa con el armario lleno.
- [x] **Etiquetas:** **sin máximo** por prenda.
- [x] **Composición automática del collage:** **cuadrícula con pesos de tamaño por hueco**, que se recoloca sola.
- [x] **Fotos:** **bucket privado con URLs firmadas.**

### Cierre del 25-10-2026

- [x] **¿PWA o solo web?** → **PWA instalable**, sin offline completo. Sin app nativa (evita pagar a Apple/Google).
- [x] **¿Qué email para el reseteo de contraseña?** → El de Supabase por ahora.
- [x] **¿Copias de seguridad?** → En standby, se añaden al final. Idea: script automático que exporta base y fotos fuera de Supabase; destino sin decidir.
- [x] **¿Despliegue?** → Vercel con URL gratuita; dominio más adelante.
- [x] **¿Galería o cámara al subir?** → Ambas; sin `capture` el móvil ofrece las dos.
- [x] **¿Y si la foto tiene fondo?** → El usuario elige "recortar" o "ya recortada" (la app lo propone detectando la transparencia). Si no recorta una foto con fondo, solo se avisa.
- [x] **¿Recorte lento (~30 s en CPU)?** → Cola en segundo plano; la GPU no funciona con `@imgly` por ahora. Mejoras pendientes: hilos con COOP/COEP; plan B, servicio externo.
- [x] **¿API propia?** → **Sí, desde el inicio**, como rutas de servidor de Next.js (sustituye a "sin API propia"). RLS se mantiene como segunda barrera.
- [x] **¿Límite de prendas por usuario?** → **500**, comprobado en la API.
- [x] **¿Borrar cuenta y exportar datos?** → Después, al hacer la app pública.
- [x] **¿Datos semilla (pesos de tamaño y orden de capas)?** → Los propone Claude y se ajustan viendo el collage real.
- [x] **¿Recorte en lote con descarga?** → **Sí, en la v1**, como página aparte que reutiliza la cola.

## Abiertas

### Modo inteligente (para después de la v1)

- [ ] **¿Qué criterios usa?** (combinación de colores, estilo casual/formal/deportivo, ocasión, temporada…)
- [ ] ¿De dónde salen esos atributos: los mete el usuario, los detecta la IA de la foto, o mixto (la IA propone y el usuario corrige)?
- [ ] ¿Reglas simples (tabla de colores que combinan) o un modelo de IA que evalúe outfits?
- [ ] ¿Filtra el azar (genera y descarta combinaciones malas) o propone directamente la mejor?
