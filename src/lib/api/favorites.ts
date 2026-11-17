// Consultas de favoritos (paso 5.1). Las rutas de src/app/api/favorites/**
// solo validan y llaman aquí. Todo va con el cliente del usuario: la RLS (0004)
// impide ver o enlazar prendas y favoritos ajenos. Crear y reemplazar items va
// por las RPC de 0009 (`security invoker`), cada una en una sola transacción:
// así el trigger diferido de 0005 no borra el favorito al reemplazar sus items.
import { z } from "zod";
import { MAX_SCALE, MIN_SCALE, normalizeRotation } from "@/features/dresser/canvas/geometry";
import { SLOTS } from "@/lib/domain/slots";
import { slotOfType, type GarmentTypeId } from "@/lib/domain/types";
import type { Json } from "@/lib/supabase/types";
import { createSignedUrls } from "@/lib/storage/sign";
import { applyCursor, decodeCursor, encodeCursor } from "./cursor";
import { ApiError } from "./errors";
import type { ServerSupabase } from "./with-user";
import {
  FAVORITE_ITEMS_MAX,
  FAVORITE_NAME_MAX,
  type Favorite,
  type FavoriteItem,
  type FavoriteListResponse,
  type FavoritePosition,
  type FavoriteSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Constantes y validación

export const DEFAULT_FAVORITES_PAGE_SIZE = 24;
export const MAX_FAVORITES_PAGE_SIZE = 100;

/**
 * Rangos razonables de las posiciones (unidades de dresser/model.ts):
 * el centro puede quedar algo fuera del lienzo; scale dentro de los límites
 * del lienzo; rotation en grados (se guarda normalizada a (-180, 180]).
 */
export const POSITION_LIMITS = {
  xy: { min: -1, max: 2 },
  scale: { min: MIN_SCALE, max: MAX_SCALE },
  rotation: { min: -360, max: 360 },
  z: { min: -10_000, max: 10_000 },
} as const;

// Errores de las RPC de 0009 y de Postgres.
const NOT_FOUND = "P0002";
const INVALID_PARAMETER = "22023";
const FOREIGN_KEY_VIOLATION = "23503";
const RLS_VIOLATION = "42501";

/** Id de favorito de la ruta; si no es un uuid, el favorito no existe (404). */
export function favoriteId(params: { id: string }): string {
  if (!z.uuid().safeParse(params.id).success) throw notFound();
  return params.id;
}

function notFound() {
  return new ApiError(404, "not_found", "Favorite not found");
}

function invalidGarments(message: string, details?: unknown) {
  return new ApiError(400, "invalid_garments", message, details);
}

const coord = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();

const itemSchema = z.strictObject({
  garment_id: z.uuid(),
  x: coord(POSITION_LIMITS.xy.min, POSITION_LIMITS.xy.max),
  y: coord(POSITION_LIMITS.xy.min, POSITION_LIMITS.xy.max),
  scale: coord(POSITION_LIMITS.scale.min, POSITION_LIMITS.scale.max),
  rotation: coord(POSITION_LIMITS.rotation.min, POSITION_LIMITS.rotation.max),
  z: z.number().int().min(POSITION_LIMITS.z.min).max(POSITION_LIMITS.z.max).nullable().optional(),
  // El candado es estado del vestidor: favorite_items no tiene columna, se ignora.
  locked: z.boolean().optional(),
});
type ItemInput = z.output<typeof itemSchema>;

/** Item ya normalizado, tal como se guarda en favorite_items. */
export type FavoriteItemInput = FavoritePosition & { garment_id: string };

/**
 * x, y y scale van juntos: si falta alguno, el item es automático (todo a
 * null, también rotation). Con los tres, rotation por defecto 0 y normalizada.
 * z se guarda tal cual (null = la de su hueco).
 */
export function normalizeItem(item: ItemInput): FavoriteItemInput {
  const { x, y, scale } = item;
  const manual = typeof x === "number" && typeof y === "number" && typeof scale === "number";
  return {
    garment_id: item.garment_id,
    x: manual ? x : null,
    y: manual ? y : null,
    scale: manual ? scale : null,
    rotation: manual ? normalizeRotation(item.rotation ?? 0) : null,
    z: item.z ?? null,
  };
}

const itemsSchema = z
  .array(itemSchema)
  .min(1)
  .max(FAVORITE_ITEMS_MAX)
  .refine((items) => new Set(items.map((i) => i.garment_id)).size === items.length, {
    message: "Duplicate garment_id",
  })
  .transform((items) => items.map(normalizeItem));

/** Nombre opcional: recorta espacios y deja null si queda vacío. */
const nameSchema = z
  .string()
  .max(FAVORITE_NAME_MAX * 2)
  .nullable()
  .transform((v) => {
    const clean = v?.trim().replace(/\s+/g, " ") ?? "";
    return clean === "" ? null : clean;
  })
  .refine((v) => v === null || v.length <= FAVORITE_NAME_MAX, {
    message: `Max ${FAVORITE_NAME_MAX} characters`,
  });

export const createFavoriteSchema = z.strictObject({
  name: nameSchema.optional(),
  items: itemsSchema,
});
export type CreateFavoriteInput = z.output<typeof createFavoriteSchema>;

export const patchFavoriteSchema = z
  .strictObject({
    name: nameSchema.optional(),
    items: itemsSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.items !== undefined, {
    message: "At least one field is required",
  });
export type PatchFavoriteInput = z.output<typeof patchFavoriteSchema>;

const listQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_FAVORITES_PAGE_SIZE)
    .default(DEFAULT_FAVORITES_PAGE_SIZE),
});
export type FavoriteListQuery = z.output<typeof listQuerySchema>;

/** Valida los parámetros de GET /api/favorites. Lanza 400 `invalid_query`. */
export function parseFavoriteListQuery(params: URLSearchParams): FavoriteListQuery {
  const result = listQuerySchema.safeParse(Object.fromEntries(params));
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new ApiError(400, "invalid_query", "Invalid query parameters", details);
  }
  return result.data;
}

/** ¿Son las mismas prendas (sin importar el orden)? */
export function sameGarments(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return (
    sa.size === a.length &&
    sb.size === b.length &&
    sa.size === sb.size &&
    b.every((id) => sa.has(id))
  );
}

// ---------------------------------------------------------------------------
// Filas → respuesta

const positionOf = (r: FavoritePosition): FavoritePosition => ({
  x: r.x,
  y: r.y,
  scale: r.scale,
  rotation: r.rotation,
  z: r.z,
});

/** Orden estable de los items: por hueco (como el panel) y luego por id. */
function byGarmentSlot<T extends { garment_id: string; type_id: GarmentTypeId }>(a: T, b: T) {
  return (
    SLOTS[slotOfType(a.type_id)].sortOrder - SLOTS[slotOfType(b.type_id)].sortOrder ||
    a.garment_id.localeCompare(b.garment_id)
  );
}

const SUMMARY_COLUMNS =
  "id, name, created_at, favorite_items(garment_id, x, y, scale, rotation, z, garments(type_id, thumb_path))";

const DETAIL_COLUMNS =
  "id, name, created_at, favorite_items(garment_id, x, y, scale, rotation, z, garments(type_id, name, archived, image_path))";

type ItemRow<G> = FavoritePosition & { garment_id: string; garments: G | null };
type SummaryRow = {
  id: string;
  name: string | null;
  created_at: string;
  favorite_items: ItemRow<{ type_id: string; thumb_path: string }>[];
};
type DetailRow = {
  id: string;
  name: string | null;
  created_at: string;
  favorite_items: ItemRow<{
    type_id: string;
    name: string | null;
    archived: boolean;
    image_path: string;
  }>[];
};

// ---------------------------------------------------------------------------
// Listado

export async function listFavorites(
  supabase: ServerSupabase,
  userId: string,
  q: FavoriteListQuery,
): Promise<FavoriteListResponse> {
  const cursor = q.cursor ? decodeCursor(q.cursor) : null;

  const [page, total] = await Promise.all([
    applyCursor(supabase.from("favorites").select(SUMMARY_COLUMNS), cursor).limit(q.limit + 1),
    supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (page.error) throw page.error;
  if (total.error) throw total.error;

  const rows = (page.data as unknown as SummaryRow[]).slice(0, q.limit);
  // Todas las miniaturas de la página en una sola llamada.
  const thumbs = rows.flatMap((r) => r.favorite_items.flatMap((i) => i.garments?.thumb_path ?? []));
  const urls = await createSignedUrls(supabase, [...new Set(thumbs)]);

  const items: FavoriteSummary[] = rows.map((r) => {
    const favItems = r.favorite_items
      .filter((i) => i.garments)
      .map((i) => {
        const type = i.garments!.type_id as GarmentTypeId;
        return {
          garment_id: i.garment_id,
          type_id: type,
          slot: slotOfType(type),
          thumbUrl: urls[i.garments!.thumb_path] ?? null,
          ...positionOf(i),
        };
      })
      .sort(byGarmentSlot);
    return {
      id: r.id,
      name: r.name,
      created_at: r.created_at,
      garmentCount: favItems.length,
      items: favItems,
    };
  });

  const last = rows.at(-1);
  return {
    items,
    nextCursor: page.data.length > q.limit && last ? encodeCursor(last) : null,
    total: total.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Un favorito

/** El favorito con sus items y los recortes firmados; null si no existe (o es ajeno). */
export async function getFavorite(supabase: ServerSupabase, id: string): Promise<Favorite | null> {
  const { data, error } = await supabase
    .from("favorites")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const paths = row.favorite_items.flatMap((i) => i.garments?.image_path ?? []);
  const urls = await createSignedUrls(supabase, paths);

  const items: FavoriteItem[] = row.favorite_items
    .filter((i) => i.garments)
    .map((i) => {
      const g = i.garments!;
      const type = g.type_id as GarmentTypeId;
      return {
        garment_id: i.garment_id,
        type_id: type,
        slot: slotOfType(type),
        name: g.name,
        archived: g.archived,
        cutoutUrl: urls[g.image_path] ?? null,
        ...positionOf(i),
      };
    })
    .sort(byGarmentSlot);

  return { id: row.id, name: row.name, created_at: row.created_at, items };
}

async function requireFavorite(supabase: ServerSupabase, id: string): Promise<Favorite> {
  const favorite = await getFavorite(supabase, id);
  if (!favorite) throw notFound();
  return favorite;
}

// ---------------------------------------------------------------------------
// Crear, editar, borrar

/** Lanza 400 `invalid_garments` si alguna prenda no existe o es de otro usuario. */
async function assertOwnGarments(supabase: ServerSupabase, ids: string[]) {
  const { data, error } = await supabase.from("garments").select("id").in("id", ids);
  if (error) throw error;
  const found = new Set(data.map((g) => g.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) throw invalidGarments("Unknown garments", { missing });
}

/** Errores de las RPC que se deben a las prendas (carrera con un borrado, RLS). */
function isGarmentError(code: string | undefined) {
  return code === FOREIGN_KEY_VIOLATION || code === RLS_VIOLATION;
}

const asJson = (items: FavoriteItemInput[]) => items as unknown as Json;

export async function createFavorite(
  supabase: ServerSupabase,
  input: CreateFavoriteInput,
): Promise<Favorite> {
  await assertOwnGarments(
    supabase,
    input.items.map((i) => i.garment_id),
  );

  const { data: id, error } = await supabase.rpc("create_favorite", {
    // Los tipos generados no marcan los argumentos como opcionales/nulos.
    p_name: (input.name ?? null) as string,
    p_items: asJson(input.items),
  });
  if (isGarmentError(error?.code)) throw invalidGarments("Unknown garments");
  if (error) throw error;

  return requireFavorite(supabase, id);
}

/**
 * Cambia el nombre y/o las posiciones. `items` debe traer exactamente las
 * prendas que ya tiene el favorito (no se añaden ni se quitan desde el detalle).
 */
export async function updateFavorite(
  supabase: ServerSupabase,
  id: string,
  input: PatchFavoriteInput,
): Promise<Favorite> {
  if (input.items) {
    const { data, error } = await supabase
      .from("favorites")
      .select("id, favorite_items(garment_id)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    const current = data.favorite_items.map((i) => i.garment_id);
    const next = input.items.map((i) => i.garment_id);
    if (!sameGarments(current, next)) {
      throw invalidGarments("Garments cannot be added or removed", { current });
    }
  }

  const { error } = await supabase.rpc("update_favorite", {
    p_id: id,
    p_set_name: input.name !== undefined,
    p_name: (input.name ?? null) as string,
    p_items: (input.items ? asJson(input.items) : null) as Json,
  });
  if (error?.code === NOT_FOUND) throw notFound();
  if (error?.code === INVALID_PARAMETER) {
    // Ha cambiado el conjunto entre la comprobación y la RPC (prenda borrada).
    throw invalidGarments("Garments cannot be added or removed");
  }
  if (isGarmentError(error?.code)) throw invalidGarments("Unknown garments");
  if (error) throw error;

  return requireFavorite(supabase, id);
}

/** Borra el favorito (sus items caen en cascada). 404 si no existe o es ajeno. */
export async function deleteFavorite(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase.from("favorites").delete().eq("id", id).select("id");
  if (error) throw error;
  if (data.length === 0) throw notFound();
}
