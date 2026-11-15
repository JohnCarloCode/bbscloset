# bb's closet — Especificación de producto

**Estado:** borrador (v0.7) — preguntas abiertas casi cerradas; solo queda el [modo inteligente](open-questions.md), que es posterior a la v1
**Fecha:** 2026-11-14 — detalle de cada pantalla en [screens.md](screens.md)

## 1. Visión

Web app que contiene el catálogo completo de ropa de una persona, organizado por categorías. Su feature principal es un **vestidor** tipo *dress-up game*: un lienzo donde componer outfits con las prendas del propio armario — a mano, cogiéndolas de un panel con pestañas, o con botones de aleatorio — y guardar las combinaciones que gusten como favoritas.

Es una app personal, pensada para un uso cotidiano ("¿qué me pongo hoy?") y también lúdico (descubrir combinaciones que no se te habrían ocurrido).

**El uso principal es el móvil**: se sube ropa con la cámara del teléfono y se compone el outfit a dedo. El diseño es **mobile-first**; tablet y ordenador son ampliaciones de esa base, no al revés.

## 2. Modelo del dominio

El modelo separa tres cosas que es tentador mezclar y que conviene tener sueltas: **dónde va la prenda en el cuerpo**, **qué prenda es**, y **cómo es esa prenda**.

### 2.1 Hueco (slot)

El sitio del cuerpo que la prenda ocupa. Es lo que el vestidor usa para colocar cada prenda en el lienzo y lo que los botones de aleatorio rellenan. Es una lista **cerrada del software**: el usuario nunca lo elige a mano.

| Hueco | Prendas que caben | Cuántas a la vez |
|---|---|---|
| capa base | camiseta, camisa, top, body | 1 |
| capa media | jersey, sudadera, cárdigan, chaleco | 1 |
| capa exterior | chaqueta, abrigo, cazadora, gabardina | 1 |
| parte inferior | pantalón, vaqueros, falda, short | 1 |
| cuerpo entero | vestido, mono | 1 |
| calzado | zapatillas, botas, sandalias, tacones | 1 |
| bolso | bolso de mano, mochila, bandolera | 1 |
| joyería | collar, pendientes, anillo, pulsera | varias (3 por defecto, configurable) |
| accesorios | gorro, gafas, cinturón, bufanda | 1 |

La lista de nueve huecos se da por **completa**: cubre el armario de referencia y no se prevé ampliarla.

**La regla es una sola:** prendas del **mismo hueco compiten** entre sí y solo sale una; prendas de **huecos distintos se suman** y salen a la vez. Por eso pantalón y short nunca aparecen juntos (mismo hueco), mientras que camiseta y jersey sí (huecos distintos, se llevan uno encima del otro). Rige tanto para los botones de aleatorio como para la selección manual: poner una prenda de un hueco ya ocupado sustituye a la que había.

Hay **dos excepciones** a la regla, y solo dos:

**Joyería admite varias piezas a la vez.** El máximo es **3 por defecto** y **cada usuario puede subirlo hasta 10** desde los ajustes. Al llegar al máximo, poner una pieza más sustituye a la más antigua del hueco, en silencio y sin preguntar.

**Cuerpo entero es excluyente con capa base y parte inferior.** Un vestido o un mono ocupa el torso y las piernas a la vez, así que no puede convivir con una camiseta ni con un pantalón:

- Poner una prenda de **cuerpo entero** en el lienzo **quita** automáticamente la capa base y la parte inferior que hubiera, **en silencio** (sin diálogo de aviso): es lo natural en un dress-up game y se puede deshacer.
- A la inversa, poner una **capa base** o una **parte inferior** **quita** el vestido o el mono que hubiera.
- Capa media, capa exterior, calzado, bolso, joyería y accesorios **sí** conviven con cuerpo entero: una chaqueta o unas botas sobre un vestido son perfectamente normales.
- **"Outfit aleatorio" puede sacar vestidos**: cuando lo hace, sustituye a la vez a capa base y parte inferior en las categorías predeterminadas.

La regla completa entra en la **v1**: es lo que garantiza el criterio de éxito de "nunca hay combinaciones imposibles".

### 2.2 Tipo de prenda

Lo que el usuario elige al subir la foto ("esto es una sudadera") y lo que usa para navegar el catálogo. También es una lista cerrada del software.

**Cada tipo pertenece a un único hueco, y esa relación la sabe el software.** El usuario dice "short" y el sistema ya sabe que va al hueco de la parte inferior. No hay doble entrada de datos ni posibilidad de asignarlo mal.

### 2.3 Atributos de la prenda

Características ortogonales a hueco y tipo, usadas para filtrar y para el modo inteligente:

- **Nombre** — **opcional**, texto libre ("la camisa de las flores", "vaqueros rotos"). Si se deja vacío, la app muestra el tipo de prenda en su lugar. Es opcional a propósito: subir una prenda tiene que seguir siendo rápido.
- **Temporada** — campo estructurado y **multivalor** que **marca el usuario al subir la prenda**: una camiseta puede ser verano y primavera; un jersey, otoño e invierno. Forzar un solo valor dejaría medio armario mal etiquetado. Es un campo aparte, no una etiqueta, para que el dato quede limpio de cara a los filtros del catálogo y a la futura lógica inteligente (ver 3.7).
- **Color** — **opcional**, elegido con un **selector de color** (rueda/cuadro, sin teclear). La app guarda el color exacto elegido (hex) y calcula sola su **familia de color** más cercana (negro, blanco, beige, azul, rojo… y "multicolor"), que es la que usa el filtro del catálogo. Así se elige con libertad y se filtra sin duplicados tipo "azul" / "azul marino" / "navy".
- **Marca** — un único valor por prenda, **columna de texto libre con autocompletado** sobre las marcas ya usadas (Zara, Bershka, vintage, sin marca…). El vocabulario de marcas es **por usuario**. Es un campo propio y **no una etiqueta**: es un solo valor, se filtra por él de forma natural ("todo lo de Zara") y mezclarlo con las etiquetas libres ensuciaría el vocabulario de estilos. Opcional: no todas las prendas tienen marca conocida.
- **Etiquetas libres** — ver 2.4.
- **Archivada** — ver 2.5.

### 2.4 Etiquetas

Cada prenda puede llevar **etiquetas libres que el usuario escribe**: elegante, choni, cómodo, para curro, fiesta, findes…

- A diferencia de los huecos y los tipos, que son cerrados, **las etiquetas las crea el usuario**. Los huecos y tipos tienen que ser cerrados porque el generador depende de ellos para no producir combinaciones imposibles; las etiquetas solo filtran, así que ser libres no rompe nada.
- Con **autocompletado** sobre las etiquetas que ya existen, para evitar duplicados por escritura ("elegante" / "Elegante" / "elegant").
- La app arranca con un puñado de **etiquetas sugeridas** (elegante, cómodo, curro, fiesta, findes…) para que el campo no aparezca en blanco. Son solo una sugerencia: el usuario las usa, las ignora o las borra, y crea las suyas.
- Cada usuario tiene su propio vocabulario de etiquetas.
- **Sin máximo** de etiquetas por prenda.
- Se pueden **renombrar y borrar** desde la página de ajustes (ver 3.8). Renombrar una etiqueta la cambia en todas sus prendas; borrarla la quita de todas, avisando antes de a cuántas afecta.
- **La temporada no se modela como etiqueta**, para no tener la misma información en dos sitios con el generador sin saber a cuál hacer caso.

Valor hoy: filtrar el catálogo ("todo lo elegante"). El vestidor no lleva filtros de momento (ver 3.2), pero si más adelante se quiere un "outfit elegante de verano" con un clic, las etiquetas ya lo permiten **sin necesidad de IA**.

### 2.5 Prenda archivada

Una prenda **archivada** es ropa que sigue siendo tuya pero que ahora mismo no está en circulación: el abrigo en verano, la ropa guardada en el altillo.

- **No sale en el vestidor**: ni en el panel de catálogo ni en los botones de aleatorio. Así el aleatorio no te saca el abrigón en agosto.
- **Sigue en el catálogo**, en una vista aparte, y se puede desarchivar en cualquier momento.
- No es lo mismo que borrar: no se pierde nada y los favoritos que la usan siguen intactos.

### 2.6 Outfit y favorito

- **Outfit** — un conjunto de prendas, respetando la regla de huecos, compuesto en el vestidor: a mano, con los botones de aleatorio, o mezcla de ambos.
- **Favorito** — un outfit que el usuario ha guardado para consultarlo más adelante. Puede llevar **nombre opcional** ("cena del viernes", "entrevista"); si se deja vacío, la app lo identifica por la fecha.

## 3. Features principales

### 3.1 Catálogo de ropa

- El usuario añade prendas subiendo una **foto** de cada una e indicando el **tipo** de prenda. En móvil, la foto se hace con la cámara o se elige de la galería.
- El sistema **elimina automáticamente el fondo** de la foto y guarda la prenda como recorte con transparencia. Esto no es un extra estético: es lo que permite componer los outfits como collage (ver 3.3).
  - **Solo se guarda el recorte**, no la foto original. Si un recorte sale mal, el arreglo es **cambiar la foto** de la prenda desde su ficha de edición y volver a procesarla.
  - **La foto se elige de la galería o se hace con la cámara**, a gusto del usuario.
  - Al elegir la foto, el usuario indica si hay que **recortarla** o si **ya viene recortada** (PNG con transparencia). La app detecta la transparencia y propone la opción, pero decide el usuario. Si elige no recortar una foto con fondo, la app **avisa** de que no servirá tanto en el collage, sin impedirlo.
  - El recorte tarda decenas de segundos, así que se hace **en cola, en segundo plano**, mientras el usuario rellena los datos de la prenda. Se puede **guardar la prenda antes de que acabe**: queda *pendiente* y no se usa en el vestidor hasta que termina. Un indicador global muestra la cola.
  - El recorte **solo avanza con la app abierta** (se hace en el navegador); en segundo plano se pausa y sigue al volver. Limitación aceptada.
  - Hay una **página aparte de recorte en lote**: se suben muchas fotos, se recortan y se **descargan** los PNG para usarlos después.
- El usuario puede asignar **nombre**, **temporada**, **color**, **marca** y **etiquetas libres** a cada prenda, con autocompletado sobre las marcas y etiquetas que ya usa. Todos son opcionales salvo el tipo.
- El catálogo se puede navegar y filtrar por hueco, por tipo, por marca, por color (familia) y por etiqueta. **Los filtros viven aquí**, no en el vestidor.
  - El filtro por etiquetas admite **varias a la vez y combina con Y**: "elegante" + "cómodo" muestra solo las prendas que tienen ambas. Cada filtro que añades acota más, que es lo que la gente espera.
- Se puede **archivar en lote**: el catálogo permite marcar varias prendas y archivarlas (o desarchivarlas) de golpe, pensado para el cambio de temporada.
- Cada prenda se puede **editar individualmente** (nombre, tipo, temporada, marca, etiquetas, foto), **archivar** y **eliminar**.
  - Al eliminar una prenda que aparece en algún favorito, la app **avisa en cuántos aparece y pide confirmación** (ver 3.4).
- El catálogo debe aguantar **cientos de prendas** (del orden de 100 a 500 por armario) con soltura: miniaturas, carga diferida de imágenes y scroll paginado desde el principio. Hay un **límite de 500 prendas por usuario**.

### 3.2 El vestidor (feature principal)

Página tipo *dress-up game*: un **lienzo** donde se compone el outfit y un **panel de catálogo** al lado para ir cogiendo prendas.

- El **lienzo empieza en blanco**. No hay avatar ni muñeca: solo las prendas, compuestas como collage (ver 3.3).
- El **panel de catálogo** tiene **pestañas por categoría**. Se coge una prenda y o se **arrastra** al lienzo o se **clica** y aparece directamente colocada en la posición de su hueco.
  - En **móvil y tablet** — el caso principal — es un **panel inferior desplegable** con tres alturas; extendido, pasa a **pantalla partida** (lienzo arriba, prendas abajo) para probar prendas seguidas sin cerrar el panel. Nunca scroll horizontal. En escritorio es un panel fijo junto al lienzo.
  - El panel **solo muestra prendas no archivadas**.
  - El panel **no lleva filtros ni checkboxes**: se navega por pestañas y ya. Temporada, marca y etiquetas siguen existiendo como atributos de prenda y como filtros, pero **del catálogo** (3.1), no del vestidor. Decisión de agosto de 2026, revisable más adelante.
- **La regla de huecos sigue mandando** (2.1): elegir una prenda de un hueco ya ocupado **sustituye** a la que había, y las incompatibilidades de cuerpo entero se aplican solas. Una prenda puesta también se puede **quitar** del lienzo.
- Hay **dos botones de aleatorio**, con papeles distintos:
  1. **Sustituir** — cambia cada prenda del lienzo por otra al azar **de su misma categoría**: la estructura del outfit se mantiene, las piezas rotan. Con el lienzo vacío el botón está **deshabilitado** — no hay nada que sustituir.
     - **Nunca repite la misma prenda dos pulsaciones seguidas** en un mismo hueco: cada pulsación cambia de verdad todo lo que puede cambiar. Sin esto, con pocas prendas el botón parece roto.
     - Si un hueco tiene una sola prenda disponible, esa se queda como está.
  2. **Outfit aleatorio** — vacía el lienzo (si había algo) y coloca una prenda al azar de cada una de las **categorías predeterminadas**. Por defecto son las típicas: capa base, parte inferior, calzado y bolso.
     - **Cada usuario configura su propio conjunto** de categorías predeterminadas, y lo hace **desde el propio vestidor**, junto al botón, para poder ajustarlo sobre la marcha viendo el resultado.
     - Si alguna categoría predeterminada **no tiene ninguna prenda** en el armario, la app monta el outfit con las demás y **avisa explícitamente**, con un enlace al catálogo para subir una prenda de esa categoría ("todavía no tienes bolsos — añade uno").
  - **Bloquear prendas:** cada prenda del lienzo lleva un **candado**. Las bloqueadas no las toca "sustituir": se quedan como están y solo rotan las demás. Es la feature que permite decir "el pantalón me gusta, enséñame partes de arriba". Entra en la **v1**.
  - El resultado de cualquiera de los dos es un outfit normal: se sigue editando a mano sin restricción.
- **El outfit en curso persiste en `localStorage`**: cada cambio en el lienzo actualiza la copia local y, al volver a entrar, el lienzo aparece tal como se dejó. Es persistencia **por dispositivo**: el borrador no viaja entre dispositivos; al servidor solo llegan los favoritos guardados.
- Desde el lienzo se puede **guardar como favorito** y **guardar en imagen**.

### 3.3 El lienzo (collage)

El outfit **no** se muestra como una cuadrícula de fotos con recuadros. Se muestra como un **collage**: las prendas recortadas, sin fondo, flotando sobre un lienzo limpio, cada una en su posición y con su tamaño relativo. Referencias visuales: los outfits tipo Pinterest y los *dress-up games* de los 2000 — la clienta busca explícitamente ese aire nostálgico ("muy og").

El **fondo del lienzo es fijo**, un neutro limpio definido por el diseño. No es configurable: la coherencia visual manda y es una decisión menos para el usuario.

**Colocación automática.** Es la que se aplica al clicar una prenda del panel y al usar los botones de aleatorio:

- Los tamaños **no son uniformes**: la parte inferior ocupa un bloque grande; calzado, bolso y joyería son notablemente más pequeños.
- La composición debe **recolocarse sola** según qué huecos estén ocupados: si no hay bolso, el hueco no queda vacío, el resto se reorganiza.
- Cada hueco tiene una **posición y un peso de tamaño asignados**, de modo que cualquier combinación de huecos ocupados produzca una composición equilibrada sin plantillas hechas a mano para cada caso.
- Cada hueco tiene también un **orden de superposición por defecto** coherente con cómo se lleva la ropa: la capa exterior sobre la media, la media sobre la base.

**Edición directa.** Sobre esa base, cualquier prenda del lienzo se puede manipular como en un collage de fotos, **con el ratón en ordenador y con gestos táctiles en teléfono y tablet**. Que ambas entradas funcionen igual de bien es un **requisito de primer orden del front**, no un detalle — y con el móvil como uso principal, el táctil manda:

- **Mover** arrastrando.
- **Redimensionar** con los tiradores o con pellizco.
- **Rotar**, con el tirador de giro o con dos dedos. Es lo que da el aire de collage hecho a mano.
- **Cambiar el orden de superposición** (traer al frente / enviar atrás), para forzar que la chaqueta tape a la camiseta o al revés cuando el orden por defecto no convence.
- **Deshacer y rehacer** los cambios del lienzo. El historial vale **solo para la sesión en curso**: al recargar se pierde (el borrador del lienzo sí persiste en `localStorage`).
- **Volver a la colocación automática**: un botón que descarta todos los ajustes manuales y recompone el outfit como lo haría la app sola.

### 3.4 Favoritos

**Guardar desde el vestidor.** Al guardar un favorito se persiste el lienzo **tal cual está**: qué prendas lleva y la posición, tamaño y rotación de cada una, incluidos los ajustes hechos a mano. Se puede poner un **nombre**, o dejarlo en blanco y que se identifique por la fecha.

**Se pueden guardar outfits repetidos.** La app no comprueba duplicados: si el mismo conjunto de prendas se guarda dos veces, se crean dos favoritos. Puede ser intencionado (dos composiciones distintas de las mismas prendas) y no merece la pena impedirlo.

**Listado.** Página que muestra todas las combinaciones guardadas. Desde aquí se entra al detalle de cada una y se pueden eliminar.

**Detalle del favorito.** Página de un outfit guardado donde se puede **recolocar y redimensionar** (y rotar, y cambiar el orden) lo que ya hay. **No lleva panel de catálogo**: no se añaden ni se quitan prendas. Un favorito es la foto fija de un outfit; para montar otro se va al vestidor. Lo que cambia respecto al vestidor no es solo el alcance de la edición sino el modelo de guardado: el vestidor es un borrador y persiste cada cambio en localStorage sin preguntar; el favorito es un objeto ya guardado, así que aquí los cambios se confirman de forma explícita.

**Guardado explícito, nunca automático:**

- En cuanto el usuario hace **el mínimo cambio**, aparecen los botones **guardar** y **cancelar**.
- **Guardar** persiste las posiciones. **Cancelar** vuelve al último estado guardado.
- **No hay autoguardado.** Los cambios solo se persisten cuando el usuario lo pide.
- Si el usuario intenta salir con cambios sin guardar, se le avisa.

**Prenda eliminada del catálogo.** Al borrar una prenda que aparece en favoritos, la app **avisa de en cuántos aparece y pide confirmación**. Si se confirma, la prenda desaparece de esos favoritos y el collage se recompone con las que quedan; el favorito **no** se borra, **salvo que se quede sin ninguna prenda**: un favorito vacío no sirve para nada, así que se elimina solo, y el aviso previo lo dice ("esto eliminará también 1 favorito que quedaría vacío"). (Archivar una prenda, en cambio, no afecta a los favoritos: siguen mostrándola.)

**Consecuencia en el modelo de datos:** un favorito guarda no solo *qué prendas* lleva, sino *dónde está cada una* — posición, tamaño, rotación y orden de superposición por prenda. **Vacío significa "colócalo tú, app"**: una prenda sin ajustes manuales se pinta con la colocación automática.

El outfit en curso del vestidor guarda sus posiciones solo en localStorage; pasan al servidor únicamente al guardarlo como favorito.

### 3.5 Exportar outfit como imagen

- Botón **"guardar en imagen"** en el vestidor y en el detalle del favorito.
- Descarga **la misma composición de collage** que se ve en pantalla, como imagen única en **PNG**.
- Al exportar, el usuario **elige la proporción** (cuadrado 1:1, vertical 9:16 para stories, y 4:5). El **conjunto se reescala** para encajar en la proporción elegida con márgenes, **manteniendo la composición tal cual** (incluidos los ajustes manuales); no se recolocan las prendas.
- **La imagen se genera en el cliente**, en el propio navegador: es instantáneo, no cuesta infraestructura y funciona sin conexión.
- **Sin marca de agua ni branding**: la imagen es del usuario y sale limpia.
- Es una descarga local: la app no publica nada ni gestiona el envío.
- Al ser la misma composición que en pantalla, **pantalla y exportación comparten el mismo renderizado** en lugar de mantener dos maquetaciones distintas.

### 3.6 Ajustes

Página donde vive lo que se configura una vez y no debe estorbar en el día a día:

- **Gestión de etiquetas**: renombrar (se propaga a todas las prendas) y borrar (se quita de todas, avisando de a cuántas afecta).
- **Máximo de piezas de joyería** simultáneas: 3 por defecto, hasta 10.
- **Idioma** de la interfaz (ES / EN). Se traducen los textos del software, incluidos los nombres de huecos y tipos de prenda; lo que escribe el usuario (etiquetas, marcas, nombres) se queda tal cual.

(Las categorías predeterminadas del outfit aleatorio **no** están aquí: se configuran en el propio vestidor, ver 3.2.)

### 3.7 Lógica "inteligente" de combinación — después de la v1

Además de los dos botones de aleatorio, el vestidor podrá ofrecer más adelante un modo que proponga combinaciones **con criterio** en lugar de azar puro.

- **No entra en la v1.** La v1 sale con los dos aleatorios, que ya son la gracia del vestidor. Este modo se diseñará con el armario ya lleno y sabiendo qué combinaciones chirrían de verdad en la práctica.
- Los criterios concretos y la implementación (reglas vs. IA) están por definir; ver preguntas abiertas.
- Con los filtros fuera del vestidor, este modo es también la vía natural para que temporada, etiquetas y colores vuelvan a influir en el aleatorio.

### 3.8 Cuentas y acceso

- La app tiene **login**. Cada usuario tiene su propio armario y sus propios favoritos.
- **No hay registro abierto**: las cuentas se crean por invitación.
- Hay una **página de waitlist** donde cualquier interesado puede apuntarse a la lista de espera. **Solo pide el email**: un campo y un botón, la mínima fricción posible. Al apuntarse se muestra un **mensaje de confirmación en pantalla**; **no se envía email** (sin proveedor de correo en la v1).
- **La waitlist y las invitaciones las gestiona John a mano desde el panel de Supabase** (ver la tabla de emails e invitar con "Invite user"). No hay panel de administración ni rol de admin en la app; se añadirá si la lista crece.
- **Login: email + contraseña** (decidido el 01-10-2026). Las **cuentas las crea John a mano** en la base de datos (Supabase); no hay panel de gestión de usuarios, que queda como mejora futura.

## 4. Páginas / navegación

1. **Catálogo** — el armario, navegable y filtrable por hueco, tipo, marca, color y etiqueta (varias etiquetas con Y); desde aquí se añaden prendas y se editan, archivan y eliminan individualmente. Con vista aparte para las prendas archivadas.
2. **Vestidor** — lienzo del outfit + panel de catálogo con pestañas (desplegable en móvil/tablet) + botones "sustituir" y "outfit aleatorio" (con su configuración de categorías) + "guardar en favoritos" y "guardar en imagen".
3. **Favoritos** — listado de outfits guardados.
4. **Detalle del favorito** — recolocar, redimensionar, rotar y reordenar las prendas que hay, con guardar / cancelar explícitos, y "guardar en imagen".
5. **Ajustes** — etiquetas, máximo de joyería, idioma.
6. **Login** — acceso para cuentas existentes.
7. **Waitlist** — página pública para apuntarse (solo email).
8. **Recortar fotos** — subida de varias fotos para recortarlas y descargarlas (ver 3.1). Se entra desde Ajustes (móvil) o la barra lateral (escritorio).

El detalle de cada pantalla (contenido, estados, textos) está en [screens.md](screens.md).

## 5. Fuera de alcance

- Creación de huecos o tipos de prenda por parte del usuario: ambas listas son cerradas, del software.
- Filtros (temporada, etiquetas, marca) y selección de huecos por checkbox **dentro del vestidor**: descartado de momento (agosto 2026). Los filtros viven en el catálogo; los atributos de prenda se mantienen.
- Avatar o muñeca en el lienzo: el outfit se compone sobre lienzo en blanco.
- Fondo de lienzo configurable: el fondo lo fija el diseño.
- Panel de catálogo en el detalle del favorito: allí solo se recompone lo que ya hay.
- Detección de outfits duplicados al guardar favoritos.
- Guardar la foto original de cada prenda: solo se conserva el recorte.
- Modo inteligente de combinación: queda para después de la v1.
- Borrar la cuenta y exportar los datos del usuario: se hará al abrir la app al público.

## 6. Stack técnico

Stack y decisiones técnicas (el detalle está en [architecture.md](architecture.md)):

- **API propia desde el inicio**, como rutas de servidor dentro de Next.js, con la RLS de Supabase como segunda barrera. El fondo de las fotos se elimina en el propio navegador, sin servicio externo; la IA y el email de la waitlist quedan fuera de la v1. Detalle en [architecture.md](architecture.md) y [database.md](database.md).
- **PostgreSQL**, por lo que se explica abajo.
- **Almacenamiento de imágenes en la nube** — las fotos no pueden vivir solo en el navegador.
- El modelo de datos es **multi-usuario desde el principio**, aunque las cuentas sean por invitación.
- **Interfaz en español e inglés.** Los textos viven fuera del código desde el primer día.
- **Mobile-first**, con el móvil como dispositivo principal de uso.
- **PWA instalable**, sin modo offline completo. Sin app nativa por ahora.

### 6.1 El lienzo: Konva

El lienzo se implementa con **Konva** (`react-konva`), y no con una librería de drag-and-drop al uso:

- Su *Transformer* trae mover, redimensionar y rotar con tiradores que funcionan **igual con ratón que con dedos** — que es el requisito de primer orden del front.
- Gestiona el **orden de superposición** de forma nativa.
- Detecta bien el clic sobre **PNG con transparencia**, que es exactamente lo que son las prendas recortadas.
- **Exporta el lienzo a imagen** con una llamada, lo que hace que pantalla y descarga compartan un único renderizado sin esfuerzo extra (3.5).

Se descartó `pragmatic-drag-and-drop` (Atlassian): está construida sobre la API HTML5 de drag-and-drop, que arrastra problemas conocidos en táctil (Android, pantallas táctiles de Windows), y además solo resuelve el arrastre entre zonas de destino — no redimensionar, ni rotar, ni exportar.

### 6.2 Aislamiento de datos por usuario (RLS)

El aislamiento entre armarios se hace con **Row Level Security en la base de datos**, no solo con comprobaciones en el código:

- Toda tabla con datos de usuario (prendas, favoritos, prendas de cada favorito) lleva `user_id` y políticas que restringen cada operación al usuario autenticado.
- Un bug en una query no puede filtrar el armario de otra persona: la base de datos lo impide.
- Las **fotos** se aíslan igual, con rutas prefijadas por usuario y políticas equivalentes. Van en un **bucket privado y se sirven con URLs firmadas** (caducan; control real de acceso).
- La tabla de **waitlist** es el caso especial: `INSERT` abierto a anónimos (cualquiera puede apuntarse) pero `SELECT` cerrado (nadie puede leer los emails ajenos).

Esto implica **PostgreSQL** (Supabase, Neon o similar), donde RLS es nativo y se integra con la autenticación.

## 7. Criterios de éxito

- Añadir una prenda (foto + tipo) es rápido y sin fricción desde el móvil, y el recorte del fondo sale bien sin intervención.
- Componer un outfit en el vestidor es inmediato: clicar coloca la prenda en su sitio y elegir otra del mismo hueco la sustituye — nunca hay combinaciones imposibles (dos prendas en el mismo hueco, o un vestido con pantalón).
- Los dos aleatorios hacen lo que prometen: "sustituir" mantiene la estructura del outfit rotando las piezas sin repetir la anterior y respetando los candados; "outfit aleatorio" monta uno desde cero con las categorías predeterminadas del usuario.
- Mover, redimensionar y rotar prendas funciona igual de bien con ratón que con gestos táctiles, y el móvil es el caso que mejor tiene que funcionar.
- El outfit en curso sobrevive a recargas y a cerrar el navegador (localStorage por dispositivo).
- El collage se ve bien con cualquier combinación de huecos ocupados.
- El catálogo se navega con soltura con cientos de prendas.
- Los favoritos persisten y se consultan fácilmente, y borrar una prenda nunca sorprende al usuario.
