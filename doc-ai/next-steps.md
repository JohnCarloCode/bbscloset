# bb's closet — Próximos pasos

## Estado del despliegue (24-11-2026)

Fases 1–7 construidas en `develop` (ver [informe-noche.md](informe-noche.md)), pero **solo funcionan en local**. Estado de los entornos gratuitos:

- **Supabase** (`pongfseghyxvagviamau`, plan gratuito, Frankfurt): sano, con las migraciones 0001–0007. **Faltan 0008 y 0009.**
- **Vercel** (proyecto `bbscloset`, Hobby): conectado al repo, con preview de `develop`. **Sin variables de entorno.**

**Falta para tener el entorno de desarrollo subido** (lo hace John: Claude no puede introducir claves ni crear tokens):

1. En Vercel → *Settings → Environment Variables*, añadir en *Production* y *Preview*:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://pongfseghyxvagviamau.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la anon key (la pública, no la `service_role`).
2. Aplicar las migraciones nuevas: `supabase login`, `supabase link --project-ref pongfseghyxvagviamau` (pide la contraseña de la BD) y `supabase db push`. Los comandos de login y link los ejecuta John; el `db push` puede hacerlo Claude.
3. Redeploy del preview de `develop` para que coja las variables.
4. Supabase → *Authentication → URL Configuration*: añadir la URL del preview y `/reset-password` en *Redirect URLs*; pegar la plantilla de email de recuperar contraseña (`supabase/README.md`).
5. Crear un usuario de prueba (*Authentication → Users → Add user*, "auto confirm").
6. Comprobar en el preview: `/login` carga y `/api/me` da 401.

El resto de pendientes (pruebas en móvil, fotos de prueba, licencia AGPL, fase 8) está en [informe-noche.md](informe-noche.md).

**Estado a 14-11-2026:** documentación cerrada (spec v0.7, DESIGN, [screens.md](screens.md), architecture, database) y prototipo visual al día en `design/prototype/` (copia del artifact *BB's closet mobile prototype*). Prueba del recorte de fondo hecha en `pruebas/recorte/`. Nada de la app está construido todavía.

**Cambios del 14-11-2026:**
- Color de marca: rosa `#f0d7d7` solo como fondo; negro para texto, enlaces, bordes y foco (accesibilidad). En DESIGN.md.
- Vestidor en móvil: panel inferior de tres alturas con pantalla partida al extenderlo.
- Pantallas nuevas definidas y en el prototipo: elegir recortar / ya recortada, formulario mientras recorta, cola de recorte global y página de recorte en lote.
- Nuevo [screens.md](screens.md) con todas las pantallas; DESIGN.md solo guarda el sistema visual y sus componentes.
- Limitación aceptada: el recorte solo avanza con la app abierta.
- Se mantiene PWA (no React Native): gratis en Android e iPhone sin cuenta de desarrollador.

**Plan de construcción paso a paso:** [plan.md](plan.md) (9 fases, 58 pasos). Las dudas que salieron al escribirlo están resueltas (15-11-2026).

## Siguiente sesión, en orden

1. **Crear los proyectos:** Supabase (plan gratuito), Vercel (Hobby) y el repo de Next.js + TypeScript + Tailwind.
2. **Ejecutar el esquema** de [database.md](database.md) como migraciones en `supabase/`. Hay que escribir además:
   - Los datos semilla: tipos de prenda por hueco (los del spec) y valores de `size_weight` y `default_z` (los propone Claude y se ajustan viendo el collage).
   - Los dos triggers (crear `profiles` y borrar favoritos vacíos) y las políticas de integridad entre tablas.
   - En las políticas RLS, usar `(select auth.uid())` en lugar de `auth.uid()` por rendimiento.
3. **Construir por fases** (detalle en [architecture.md](architecture.md), sec. 9):
   1. Base: proyecto, tokens de [DESIGN.md](DESIGN.md), Supabase conectado, API propia (rutas de Next.js), textos ES/EN, PWA (`manifest` + icono).
   2. Cuentas: login (email + contraseña) y waitlist.
   3. Catálogo: subir prenda con recorte en cola, listar, filtrar, editar, archivar (también en lote), eliminar. Incluye la página de recorte en lote con descarga.
   4. Vestidor: lienzo (Konva), panel, colocación automática, aleatorios, candados, borrador local.
   5. Favoritos: guardar, listar, detalle con guardar / cancelar.
   6. Exportar a imagen.
   7. Ajustes y pulido.

## Pendiente menor

- **Archivar en lote** y **subida masiva** (aprobados 14-11-2026): definidos en [screens.md](screens.md) (4.2, 4.4 y 5.5) y en el prototipo.
- **Recorte:** medir el tiempo en móvil real; probar hilos (COOP/COEP) si hace falta; plan B, recortar en servidor (servicio de pago o servidor propio, p. ej. `rembg`), que además quitaría la limitación de tener la app abierta.
- **Copias de seguridad:** en standby, se añaden al final.
- **Modo inteligente** de combinación: después de la v1 (preguntas en [open-questions.md](open-questions.md)).
- **Dominio propio:** más adelante; de momento URL gratuita de Vercel.
- **Panel de gestión de usuarios, borrar cuenta y exportar datos:** al abrir la app al público. De momento las cuentas las crea John a mano en Supabase.
- **Prototipo:** las prendas son rectángulos de colores; el diseño real con recortes se verá distinto. El collage del prototipo se ve algo caótico y la composición automática debería ordenarlo. El recorte simulado tarda ~3 s (el real ~30 s).
