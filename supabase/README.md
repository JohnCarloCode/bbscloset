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

## Aplicar en el proyecto remoto

Con la CLI (pide la contraseña de la base de datos):

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

Sin CLI: abrir *SQL Editor* en el panel de Supabase y pegar y ejecutar los archivos **en orden** (0001 → 0007). En ese caso la CLI no sabrá que están aplicados; no mezcles los dos métodos en el mismo proyecto.

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

Después de cada migración (con el proyecto enlazado):

```bash
supabase gen types typescript --linked > src/lib/supabase/types.ts
```

## Local (opcional, requiere Docker)

`supabase start` levanta Supabase en local y aplica las migraciones; `supabase db reset` las vuelve a aplicar desde cero; `supabase stop` lo para. En `config.toml` el registro público está desactivado, igual que en el proyecto remoto.

## Notas para la app

- `color_hex` solo acepta minúsculas (`#aabbcc`): normalizar antes de guardar.
- Waitlist: insertar sin pedir la fila de vuelta (sin `.select()`), porque no hay permiso de lectura.
- El favorito vacío se borra al final de la transacción: si se reemplazan todos sus items, hacerlo en una sola transacción (función RPC) o insertar los nuevos antes de borrar los viejos.
