# supabase/

Esquema de la base de datos de bb's closet como migraciones versionadas. La referencia es [doc-ai/database.md](../doc-ai/database.md).

| Migración | Qué hace |
|---|---|
| `0001_closed_lists.sql` | `slots` y `garment_types` (solo lectura) + semilla: 9 huecos y 33 tipos |
| `0002_user_tables.sql` | `profiles`, `garments`, `tags`, `garment_tags`, `favorites`, `favorite_items` |
| `0003_indexes.sql` | Índices de database.md sec. 4 |
| `0004_rls.sql` | RLS "own rows" en las tablas de usuario, con integridad entre tablas |
| `0005_triggers.sql` | Crear `profiles` al crear usuario; borrar el favorito que se queda vacío |
| `0006_waitlist.sql` | Lista de espera: insert anónimo, sin lectura |
| `0007_storage.sql` | Bucket privado `garments` y políticas por carpeta `{user_id}/…` |
| `0008_garment_functions.sql` | RPC `security invoker` (respetan la RLS): `garments_with_all_tags` (filtro de etiquetas con Y) y `set_garment_tags` (crear/unir etiquetas y reemplazar las de una prenda en una transacción) |
| `0009_favorite_functions.sql` | RPC `security invoker`: `create_favorite` (favorito + items en una transacción) y `update_favorite` (nombre y/o reemplazo de items con las mismas prendas, en una transacción para que el trigger de 0005 no borre el favorito) |

## Aplicar en el proyecto remoto

Con la CLI (pide la contraseña de la base de datos):

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

Sin CLI: abrir *SQL Editor* en el panel de Supabase y pegar y ejecutar los archivos **en orden** (0001 → 0009). En ese caso la CLI no sabrá que están aplicados; no mezcles los dos métodos en el mismo proyecto.

Cambios futuros: siempre como migración nueva (`supabase migration new <nombre>`), nunca editando una ya aplicada.

## Comprobar

En el SQL Editor:

```sql
select count(*) from garment_types;          -- 33
select * from slots order by sort_order;      -- 9 filas, de base_layer a accessories
select id, public from storage.buckets;       -- garments | false
```

Tras crear un usuario en *Authentication → Users*: `select * from profiles;` muestra su fila con `language = 'es'`, `jewelry_max = 3` y `random_slots` por defecto.

## Regenerar los tipos de TypeScript

`src/lib/supabase/types.ts` (tipo `Database`, lo usan los clientes de `src/lib/supabase/`) se genera; no se edita a mano. Después de cada migración:

```bash
npm run gen:types   # contra el Supabase LOCAL (supabase start), con las mismas migraciones
```

John, contra el remoto (de solo lectura, no cambia nada en el proyecto):

```bash
supabase gen types typescript --project-id <ref-del-proyecto> > src/lib/supabase/types.ts && npx prettier --write src/lib/supabase/types.ts
```

## Local (opcional, requiere Docker)

`supabase start` levanta Supabase en local y aplica las migraciones; `supabase db reset` las vuelve a aplicar desde cero; `supabase stop` lo para. En `config.toml` el registro público está desactivado, igual que en el proyecto remoto.

- Puertos locales en el rango **5562x** (API `http://127.0.0.1:55621`, BD `55622`, Studio `55623`, Mailpit `55624`) para no chocar con otros proyectos en los puertos por defecto.
- `site_url` local: `http://localhost:3100` (arrancar la app con `npx next dev -p 3100`).
- `seed.sql` crea dos usuarios de prueba **solo locales** (`test@bbscloset.test`, `test2@bbscloset.test`; contraseñas en el comentario del seed). `supabase db push` no aplica el seed.
- Para que `next dev` use el local, crear `.env.development.local` (ignorado) con `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55621` y la `ANON_KEY` que imprime `supabase status`.

## Notas para la app

- `color_hex` solo acepta minúsculas (`#aabbcc`): normalizar antes de guardar.
- Waitlist: insertar sin pedir la fila de vuelta (sin `.select()`), porque no hay permiso de lectura.
- `tags` se crean y enlazan solo con `set_garment_tags` (0008): reutiliza la etiqueta existente por `lower(name)` y conserva su escritura original.
- Con RPC que devuelven `setof garments`, PostgREST solo ordena por columnas que estén en el `select` (p. ej. `select("id, created_at")` para ordenar por `created_at`).
- El favorito vacío se borra al final de la transacción: si se reemplazan todos sus items, hacerlo en una sola transacción (función RPC) o insertar los nuevos antes de borrar los viejos.
- Favoritos: se crean con `create_favorite` y se editan con `update_favorite` (0009), que reemplaza los items en la misma transacción y solo admite las mismas prendas que ya tiene el favorito.

## Email de recuperar contraseña (paso 2.3) — [John]

La app admite dos tipos de enlace en `/reset-password`:

- **Plantilla por defecto** (`{{ .ConfirmationURL }}`, flujo PKCE): funciona, pero **solo si el enlace se abre en el mismo navegador** en el que se pidió (el `code_verifier` vive en una cookie de ese navegador). Si se abre en otro (p. ej. se pidió en el Safari del móvil y se abre en Gmail o en el portátil), la pantalla dice que el enlace ya no sirve.
- **Plantilla propia con `token_hash`** (recomendada): la app la canjea con `verifyOtp` y funciona en cualquier navegador. Es la que usa el Supabase local (`config.toml` → `[auth.email.template.recovery]`, archivo `templates/recovery.html`).

En el proyecto remoto, en *Authentication → Email Templates → Reset password*:

- **Subject:** `Recupera tu contraseña de bb's closet`
- **Body** (pegar tal cual):

```html
<h2>Recupera tu contraseña de bb's closet</h2>
<p>Hemos recibido una petición para cambiar la contraseña de tu cuenta.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Crear una contraseña nueva</a></p>
<p>El enlace caduca en una hora y solo se puede usar una vez. Si no has pedido el cambio, ignora este email: tu contraseña no cambia.</p>
```

Y en *Authentication → URL Configuration → Redirect URLs*, que estén las URLs de `/reset-password` de producción y de las previews de Vercel (p. ej. `https://<app>.vercel.app/**` y `https://*-<equipo>.vercel.app/**`). **Importante:** `{{ .RedirectTo }}` es la URL que pide la app (`<origen>/reset-password`); si no está permitida, Supabase pone la *Site URL* y el enlace llevaría a la portada sin poder cambiar la contraseña.

Límite: con el email de Supabase (sin SMTP propio) se envían pocos emails por hora; vale para el uso actual (architecture.md 8).

## Invitar a alguien de la waitlist (paso 2.5) — [John]

El registro público está desactivado: las altas se hacen a mano desde el panel de Supabase.

1. **Ver quién espera:** *Table Editor → waitlist* (ordenar por `created_at`). La app no puede leer esta tabla (sin policy de `select`); solo el panel o el SQL Editor.
2. **Crear la cuenta**, una de dos:
   - *Authentication → Users → Invite user* con su email: Supabase le envía un email para fijar la contraseña. El trigger crea su fila en `profiles` (idioma `es`, 3 joyas).
   - *Authentication → Users → Add user* con email y contraseña, marcando **Auto Confirm User**, y pasarle la contraseña por un canal privado.
3. **Quitarla de la waitlist:** borrar su fila en *Table Editor → waitlist* (no hay columna de estado).
4. **Comprobar:** en *Table Editor → profiles* aparece su `user_id`. Al entrar en la app ve su armario vacío y nada del resto (RLS).

Prueba recomendada (pendiente): invitar un segundo email propio, entrar con él y comprobar que no ve las prendas ni los favoritos del usuario de prueba. En local, la separación entre usuarios ya está comprobada por API con `test@` y `test2@` del `seed.sql`.
