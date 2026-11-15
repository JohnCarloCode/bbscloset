# bb's closet — Pantallas

Qué hay en cada pantalla, sus estados y cómo se comporta. El **qué hace la app** está en [spec.md](spec.md); el **cómo se ve** (colores, tipografía, componentes) en [DESIGN.md](DESIGN.md). Este documento no repite tokens: usa los componentes de DESIGN.md por su nombre. La referencia visual navegable es el prototipo ([design/prototype/](design/prototype/), también en el artifact *BB's closet mobile prototype*).

**Estado a 14-11-2026:** todas las pantallas de la v1 descritas. Los textos del prototipo están en inglés; aquí van en castellano como referencia (la app es ES/EN).

**Reglas comunes**
- Color: rosa `#f0d7d7` solo como fondo (botón principal, estado activo, progreso); texto, enlaces, bordes y foco en negro (DESIGN.md, *Brand & Accent*).
- Móvil primero. Tres tamaños de referencia: móvil (402 px), tablet (834 px) y escritorio (1280 px).
- Nada de scroll horizontal en listas de prendas: cuadrículas con scroll vertical.
- Toda acción destructiva pide confirmación en un diálogo; las reversibles muestran un aviso breve con "Deshacer" cuando aplica.

---

## 1. Navegación

- **Móvil y tablet:** barra de pestañas inferior con 4 entradas: **Catálogo · Vestidor · Favoritos · Ajustes**. La activa en negro y negrita; el resto en gris.
- **Escritorio:** barra lateral izquierda (232 px) con el nombre de la app, las mismas 4 entradas + **Recortar fotos**, y abajo el botón principal **"Añadir prenda"**. La entrada activa lleva fondo rosa.
- **Recortar fotos** en móvil se abre desde Ajustes → *Herramientas*; mientras se está en ella, la pestaña activa es Ajustes.
- Pantalla de inicio tras el login: **Vestidor**.
- Avisos breves (*toast*): píldora negra sobre la barra de pestañas, 3,5 s, con acción opcional ("Deshacer", "Ver", "Añadir otra").

## 2. Login

- Nombre de la app, título "Entrar" y texto *"Usa el email al que te llegó la invitación."*
- Campos email y contraseña; botón principal "Entrar" y enlace **"¿Has olvidado la contraseña?"**: pide el email y responde siempre *"Si el email existe, te hemos enviado un enlace."*
- **Nueva contraseña** (`/reset-password`, desde el enlace del email): dos campos y botón "Guardar contraseña"; al terminar, entra a la app.
- Pie: *"bb's closet es solo con invitación."* + enlace "Apúntate a la lista de espera".
- Sin registro abierto: las cuentas las crea John en Supabase. Reseteo de contraseña con el email de Supabase.

## 3. Waitlist (pública)

- Collage de ejemplo arriba, titular *"Todo tu armario, listo para vestirte."* y texto explicando que es por invitación.
- Campo email + botón "Apuntarme" (deshabilitado hasta que el email tiene "@").
- Al enviar: *"Estás en la lista. Te escribiremos a {email} cuando tengas sitio."*
- Pie: "¿Ya tienes invitación? Entrar".

## 4. Catálogo

- Cabecera: título, contador (*"58 en uso · 3 archivadas"*) y botón principal "Añadir".
- Control segmentado **En uso · Archivadas (N)**.
- Fila de chips por **hueco** (Todo, Capa base, Capa media…) con su número; el activo con fondo rosa y borde negro. Los huecos sin prendas no salen.
- Botón **Filtros** (con el número de filtros activos) y debajo los filtros activos como chips quitables + "Borrar todo".
- **Cuadrícula** de tarjetas (columnas automáticas, mín. 150 px): miniatura del recorte, nombre (o el tipo si no tiene) y *hueco · marca*. Tocar una abre su ficha de edición.
- Prendas **pendientes de recorte**: miniatura atenuada, etiqueta "Recortando" con reloj y subtítulo *"Recortando…"*; tocarla abre la cola (sec. 6).
- **Vacío sin prendas:** ilustración, *"Tu armario está vacío"*, texto y botón "Añadir tu primera prenda".
- **Sin resultados:** *"Ninguna prenda coincide"* (o, en Archivadas sin filtros, *"Nada archivado"* con explicación de qué es archivar).
- Debe aguantar 100–500 prendas: miniaturas, carga diferida y scroll paginado.

### 4.1 Filtros (hoja)
- Secciones **Tipo** (según el hueco elegido), **Marca** y **Etiquetas**, en chips multiselección.
- Nota: *"Con varias etiquetas, solo salen las prendas que las tienen todas."*
- Arriba "Borrar"; abajo botón principal *"Ver 12 prendas"* con el recuento en vivo.

### 4.2 Archivar en lote (aprobado 14-11-2026)
- Enlace "Seleccionar" en la cabecera → modo selección: cada tarjeta muestra un círculo marcable y la barra inferior cambia a *"3 seleccionadas · Archivar"* (o "Desarchivar" en la vista Archivadas) + "Cancelar".
- "Seleccionar todo" en la cabecera mientras dura el modo (respeta el hueco y los filtros activos).
- Al confirmar, aviso con "Deshacer".

### 4.4 Por revisar (subida masiva, aprobado 14-11-2026)
- Si hay prendas subidas en masa sin tipo, arriba del catálogo sale una franja: *"12 prendas por revisar · Revisar"*.
- "Revisar" abre una hoja que va **de una en una**: el recorte en grande (o su estado si aún recorta), los chips de **Tipo** y, plegado, "Más datos" (nombre, temporada, color, marca, etiquetas).
- Botón principal **"Guardar y siguiente"** (se activa al elegir tipo); enlaces "Saltar" y "Descartar foto". Arriba, *"3 de 12"*.
- Al terminar: *"12 prendas añadidas."* Las que se saltan siguen en la franja.
- Mientras están por revisar no salen en la cuadrícula ni en el vestidor.

### 4.3 Ficha de prenda (editar)
- Mismo formulario que al añadir (sec. 5.3) con título "Editar prenda", enlace "Cambiar foto" y, al final, "Archivar" / "Volver a usar" y "Eliminar prenda".
- **Eliminar** avisa de en cuántos favoritos aparece y, si alguno se queda vacío, que también se borrará.
- Archivar: *"Archivada. Sigue en tus favoritos pero sale del vestidor."*

## 5. Añadir prenda (hoja a pantalla completa en móvil)

Se abre desde "Añadir" en el catálogo, desde la barra lateral o desde los avisos "todavía no tienes bolsos — añade uno".

### 5.1 Elegir foto
- Un único botón "Elegir fotos" (`<input type="file" accept="image/*" multiple>`): el móvil ofrece cámara o galería, y en la galería se pueden marcar **varias**. Con una sola foto se sigue el flujo normal (5.2–5.3); con varias, la **subida masiva** (5.5). (En el prototipo se simula con un visor de cámara: el disparador = foto con fondo; "Galería" = PNG ya recortado.)
- Consejo fijo: *"Fondo liso que contraste con la prenda y buena luz."*
- Formato no válido o más de ~10 MB → mensaje en línea, la hoja sigue abierta.

### 5.2 ¿Recortar o ya recortada?
- Miniatura (sobre cuadros si tiene transparencia) con el nombre del archivo y lo detectado: *"Fondo transparente detectado. Parece ya recortada."* / *"Esta foto tiene fondo."*
- Control segmentado **Quitar fondo · Ya está recortada**, preseleccionado según lo detectado; decide el usuario. La opción activa con fondo rosa.
- Ayuda bajo el control: *"Tarda unos 30 segundos y se hace en segundo plano mientras rellenas los datos."* / *"La foto se usa tal cual."*
- Si elige "Ya está recortada" en una foto **con fondo**: aviso con borde negro, no bloquea: *"Esta foto tiene fondo. En el collage se verá como un recuadro. Puedes usarla igualmente."*
- Botón principal "Continuar".

### 5.3 Datos de la prenda (mientras se recorta)
- Al continuar, la foto entra en la **cola de recorte** y el formulario se abre ya.
- Arriba, vista previa grande con el estado del recorte (la prenda va apareciendo a medida que avanza) y una línea de estado:
  - *"2.º en la cola. Puedes rellenar los datos mientras."*
  - *"Quitando el fondo… 45 %"* + barra rosa.
  - Primera vez en el dispositivo: *"Preparando el recorte (solo la primera vez)…"* (descarga del modelo).
  - *"Fondo quitado. Solo se guarda el recorte."*
  - Sin recorte: *"Ya recortada. Se usa tal cual."* / *"Se usa con su fondo, como elegiste."*
  - Error: *"No se pudo recortar"* + "Cambiar foto".
- Campos: **Tipo** (obligatorio, chips agrupados por hueco), y opcionales: nombre (marcador *"Se mostrará como «Camisa» si lo dejas vacío"*), temporada, color, marca (con sugerencias de las ya usadas) y etiquetas (chips + campo "Añade una etiqueta y pulsa Intro").
- Botón principal: *"Añadir a {hueco}"* (deshabilitado con *"Elige un tipo para seguir"*). Se puede pulsar **aunque el recorte no haya terminado**: la prenda se guarda como *pendiente* y queda lista sola al terminar.
- Debajo, enlace **"Guardar y añadir otra"**: guarda y vuelve a 5.1 sin cerrar.
- Aviso al guardar: *"Añadida a Capa base."* (con "Añadir otra") o, si sigue recortando, *"Guardada. {prenda} estará lista cuando acabe el recorte."*
- Cerrar sin guardar descarta la foto y su recorte.

### 5.5 Subida masiva (varias fotos)
- Tras elegir varias, una pantalla resumen: cuadrícula de miniaturas con lo detectado en cada una (*"Con fondo"* / *"Ya recortada"*) y el mismo control segmentado aplicado a **todas** ("Quitar fondo a todas" / "Ya están recortadas"); tocar una miniatura cambia solo esa.
- Límite: **30 fotos por tanda**; cuentan para el límite de 500 prendas (si no caben, se avisa de cuántas entran).
- Botón principal *"Añadir 12 fotos"*: todas entran en la cola de recorte y la hoja se cierra. No se pide ningún formulario.
- Quedan **por revisar** en el catálogo (4.4) hasta que se les pone el tipo. Se puede revisar mientras siguen recortándose.
- Recortar 20 fotos lleva unos 10 minutos con la app abierta (sec. 6).

### 5.4 Cambiar foto (desde la ficha)
Mismo flujo 5.1–5.2. El recorte nuevo sustituye al anterior al terminar; la prenda sigue usable mientras tanto con su recorte viejo.

## 6. Cola de recorte

No es una página: es un **indicador global** visible en cualquier pantalla mientras haya recortes de prendas pendientes.

- **Píldora** rosa con borde negro y anillo de progreso: *"Recortando 2 de 5"*. Móvil: centrada sobre la barra de pestañas. Escritorio: abajo en la barra lateral, encima de "Añadir prenda". Los avisos breves se desplazan hacia arriba para no taparla.
- Tocarla abre una **hoja con la lista**: miniatura, nombre (o *"Prenda nueva (sin guardar)"*), estado (*"3.º en la cola"* / *"Quitando el fondo… 40 %"* con barra / *"Lista"* / *"No se pudo recortar"*) y, en error, "Cambiar foto" o "Quitar". Subtítulo: *"2 de 5 listas · una foto cada vez"* y *"Mantén la app abierta mientras recorta."*
- Las prendas *pendientes* no se pueden poner en el vestidor ni salen en el panel ni en los aleatorios hasta que terminen.
- Al terminar todo: aviso *"5 prendas listas para el vestidor"* y la píldora desaparece.
- Se procesa **una foto a la vez** (el recorte usa toda la CPU), en orden de llegada, compartiendo la cola con la página de recorte en lote.
- El recorte **solo avanza con la app abierta**: en segundo plano se pausa y sigue al volver; si el sistema cerró la app, se repite la foto a medias (las fotos pendientes se guardan en local hasta subirse). Limitación aceptada el 14-11-2026 (ver architecture.md, sec. 8).

## 7. Vestidor

### 7.1 Cabecera y lienzo
- Título "Vestidor" y, a la derecha, iconos: **Deshacer · Rehacer | Guardar en favoritos · Guardar como imagen** (atenuados si no aplican).
- **Lienzo**: fondo neutro fijo (`#f5f5f7`), esquinas 18 px, ocupa todo el espacio libre. Las prendas se colocan solas (spec 3.3) y se editan con gestos o ratón.
- Al seleccionar una prenda: marco negro con tiradores, tirador de giro y **candado**; abajo del lienzo, botones "Traer delante · Enviar atrás · Quitar".
- Si hay ajustes manuales, arriba a la derecha aparece **"Colocación automática"** para descartarlos.
- **Lienzo vacío:** *"Un lienzo en blanco — toca una prenda de abajo o prueba Outfit aleatorio."* Sin prendas en el armario: *"Tu armario está vacío"* + "Añadir una prenda".

### 7.2 Botones de aleatorio
- Fila bajo el lienzo: **Sustituir** (secundario, borde negro) · **Outfit aleatorio** (principal) · botón redondo de ajustes.
- "Sustituir" atenuado con el lienzo vacío o con todo bloqueado.
- El botón de ajustes despliega encima los chips de **categorías del outfit aleatorio** (*"El outfit aleatorio coge una prenda de cada:"*); activo en negro.
- Avisos: sustituciones entre huecos (*"El vestido ha sustituido a la camiseta y el pantalón."* + "Deshacer"), joyería al máximo (*"Hasta 3 joyas. Se ha quitado {la más antigua}."* + "Deshacer"), categoría sin prendas (*"Todavía no tienes bolsos"* + "Añadir uno").

### 7.3 Panel de prendas (móvil y tablet)
Panel inferior con tres alturas. Nunca usa scroll horizontal.

| Estado | Qué se ve | Cómo se llega |
|---|---|---|
| **Cerrado** | Barrita de arrastre + selector de categoría ("Capa base ▾" con número) + enlace "Ver prendas". | Arrastrar hacia abajo desde *medio*. |
| **Medio** (por defecto) | Cuadrícula de 4 columnas, **una fila** visible + enlace "Ver todo (N)". Debajo del lienzo siguen los botones de aleatorio. | Al entrar; "Mostrar menos"; arrastrar abajo desde *extendido*. |
| **Extendido** | **Pantalla partida**: el lienzo arriba (~42 %) y la cuadrícula abajo (~58 %) con scroll vertical. Se ocultan los botones de aleatorio para ganar sitio. | Arrastrar arriba o tocar "Ver todo". |

- **Tocar una prenda la pone en el lienzo y el panel no se mueve**: se pueden probar prendas seguidas sin clics extra. Este es el motivo de la pantalla partida.
- La prenda que ya está en el lienzo se marca con borde negro de 2 px y nombre en negro; tocarla otra vez la quita.
- El selector de categoría abre una lista (fondo rosa en la activa) con el número de prendas de cada una.
- La barrita es un botón accesible: tocarla sube un nivel (o baja desde *extendido*); con teclado funciona igual. Arrastrar más de ~24 px cambia de nivel.
- El lienzo se reajusta solo al cambiar de tamaño (recolocación automática).
- Solo prendas en uso (no archivadas ni pendientes). Categoría vacía: *"Todavía no tienes {tops} en uso."* + "Añadir una".

### 7.4 Escritorio
Lienzo a la izquierda y panel fijo a la derecha (340 px) *"Tu armario"*: chips de categoría y cuadrícula de 3 columnas con scroll vertical.

## 8. Guardar en favoritos (hoja)

- Vista previa del collage, campo **Nombre** opcional (*"Si lo dejas vacío, se guarda como 14 nov 2026."*) y botón principal "Guardar favorito".
- Aviso *"Guardado en Favoritos."* + "Ver".

## 9. Guardar como imagen (hoja)

Desde el vestidor y desde el detalle del favorito.
- Elección de proporción en tres tarjetas: **Cuadrado 1:1 · Vertical 4:5 · Story 9:16**, con un icono de la forma.
- Vista previa con el conjunto reescalado (mantiene la composición y los ajustes manuales, con márgenes).
- Línea técnica según la proporción: *"PNG · 1080 × 1080 / 1080 × 1350 / 1080 × 1920 px · sin marca de agua"*. Botón principal "Descargar PNG".

## 10. Favoritos

- Título, contador (*"3 outfits guardados"*) y enlace "Editar".
- Cuadrícula de tarjetas: mini collage, nombre (o fecha) y *fecha · N prendas*. Tocar abre el detalle.
- Modo "Editar": cada tarjeta muestra "Eliminar" (con confirmación: *"Las prendas siguen en tu armario."*); el enlace pasa a "Hecho".
- **Vacío:** *"Todavía no hay favoritos"*, *"Los outfits que guardes desde el vestidor salen aquí, tal como los dejaste."* + "Abrir el vestidor".

## 11. Detalle del favorito

- Enlace "‹ Favoritos", título (nombre o fecha), subtítulo *"Guardado el … · N prendas"* e icono "Guardar como imagen".
- Lienzo editable igual que el del vestidor (mover, redimensionar, rotar, orden) **sin panel de prendas**.
- Ayuda: *"Arrastra para mover. Pellizca, o usa los tiradores, para cambiar tamaño y girar. Para cambiar prendas, monta un outfit nuevo en el vestidor."*
- Con el mínimo cambio aparece la barra **"Cambios sin guardar · Cancelar · Guardar"**. Salir con cambios pide confirmación (*"¿Descartar cambios?"*).

## 12. Ajustes

Página propia, en grupos tipo lista con fondo gris claro:
- **Etiquetas:** cada una con su número de prendas, "Renombrar" (en línea, con Guardar/Cancelar; si el nombre ya existe, error en línea *"Ya tienes una etiqueta con ese nombre."* y no se guarda) y "Eliminar" (avisa a cuántas prendas afecta). Nota: *"Renombrar una etiqueta la cambia en todas las prendas. Las etiquetas nuevas se crean al añadirlas a una prenda."*
- **Vestidor:** *"Joyas a la vez"* con − / + (3 por defecto, de 1 a 10). Al máximo, la nueva sustituye a la más antigua en silencio.
- **Idioma:** control segmentado English · Español. Se traducen los textos de la app (incluidos huecos y tipos); lo que escribe el usuario no.
- **Herramientas:** fila "Recortar fotos ›" con la nota *"Quita el fondo de muchas fotos a la vez y descárgalas en PNG. No se añaden a tu armario."*
- **Cuenta:** email (solo lectura) y "Cerrar sesión".

## 13. Recortar fotos (recorte en lote)

Página aparte (spec sec. 4, punto 8). Para recortar muchas fotos y **descargar los PNG**, sin crear prendas. En móvil, enlace "‹ Ajustes" arriba.

### 13.1 Vacía
- Título "Recortar fotos" y subtítulo *"Quita el fondo de muchas fotos a la vez."*
- Zona con borde discontinuo: *"Sube varias fotos"*, *"Quitamos el fondo y te las descargas en PNG."* (escritorio: *"También puedes soltarlas aquí."*), botón principal "Elegir fotos" (selección múltiple) y nota *"Hasta 30 fotos por tanda. No se añaden a tu armario."*

### 13.2 Procesando
- Subtítulo con el progreso total: *"8 de 20 listas · 1 no se pudo recortar"*; botón secundario "Añadir fotos" (deshabilitado al llegar a 30).
- Cuadrícula (3 columnas en móvil, 4 en tablet, 6 en escritorio). Cada foto con su estado: *En cola* (etiqueta blanca, atenuada), *recortando* (barra negra sobre la foto), *lista* (recorte sobre fondo de cuadros para ver la transparencia), *error* (etiqueta negra "No se pudo recortar"; tocarla ofrece quitarla).
- Tocar una lista abre una hoja con el recorte en grande, *"PNG con transparencia"*, "Quitar" y "Descargar PNG".

### 13.3 Terminado
- **"Descargar todas (N PNG)"** (principal) → un ZIP con los PNG. En móvil, si el sistema lo permite, compartir/guardar en fotos.
- "Empezar de nuevo" (enlace) vacía la página tras confirmar (avisa si no se ha descargado).
- Los recortes **no se guardan en la cuenta**: salir sin descargar pide confirmación (*"¿Salir sin descargar? Se perderán."*).

---

## Pendiente

- Añadir al prototipo la línea *"Mantén la app abierta mientras recorta."* en la hoja de la cola.
- Textos ES/EN definitivos.
