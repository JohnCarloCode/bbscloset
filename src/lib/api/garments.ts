// Consultas de prendas, marcas y etiquetas (paso 3.2). Las rutas de
// src/app/api/garments/**, /api/brands y /api/tags solo validan y llaman aquí.
// Todo va con el cliente del usuario: la RLS (0004) y las políticas de
// Storage (0007) son la segunda barrera. Las funciones RPC de 0008 son
// `security invoker`, así que también respetan la RLS.
import { z } from "zod";
import { COLOR_FAMILY_IDS, type ColorFamilyId } from "@/lib/domain/colors";
import { SEASON_IDS, type SeasonId } from "@/lib/domain/seasons";
import { SLOT_IDS, type SlotId } from "@/lib/domain/slots";
import { GARMENT_TYPE_IDS, slotOfType, typesOfSlot, type GarmentTypeId } from "@/lib/domain/types";
import { colorFamily, normalizeHex } from "@/lib/imaging/colorFamily";
import { createSignedUrls, GARMENTS_BUCKET } from "@/lib/storage/sign";
import { applyCursor, decodeCursor, encodeCursor } from "./cursor";
import { ApiError } from "./errors";
import type { ServerSupabase } from "./with-user";
import {
  GARMENT_BRAND_MAX,
  GARMENT_LIMIT,
  GARMENT_NAME_MAX,
  GARMENT_TAG_MAX,
  type Garment,
  type GarmentCountsResponse,
  type GarmentUploadSlot,
  type GarmentUsageResponse,
  type SignedUpload,
  type TagWithCount,
} from "./types";

// ---------------------------------------------------------------------------
// Constantes y validación

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;
/** Fotos por tanda (spec 3.1, subida masiva). */
export const MAX_UPLOADS_PER_REQUEST = 30;
/** Ids por petición de archivado en lote (como mucho, el armario entero). */
export const MAX_ARCHIVE_IDS = GARMENT_LIMIT;

// Topes técnicos de longitud: en types.ts, porque el formulario también los usa.
const NAME_MAX = GARMENT_NAME_MAX;
const BRAND_MAX = GARMENT_BRAND_MAX;
/** Marcas a la vez en el filtro del catálogo. */
const BRANDS_FILTER_MAX = 50;
const TAG_MAX = GARMENT_TAG_MAX;
const TAGS_PER_GARMENT_MAX = 100;

// Violación de clave única en Postgres.
const UNIQUE_VIOLATION = "23505";

/** Rutas en Storage de una prenda (database.md 6). */
export function garmentPaths(userId: string, garmentId: string) {
  return {
    cutout: `${userId}/${garmentId}/cutout.webp`,
    thumb: `${userId}/${garmentId}/thumb.webp`,
  };
}

/** Id de prenda de la ruta (/api/garments/[id]); si no es un uuid, la prenda no existe (404). */
export function garmentId(params: { id: string }): string {
  if (!z.uuid().safeParse(params.id).success) {
    throw new ApiError(404, "not_found", "Garment not found");
  }
  return params.id;
}

/** Texto opcional: recorta espacios y deja null si queda vacío. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max * 2)
    .nullable()
    .transform((v) => {
      const clean = v?.trim().replace(/\s+/g, " ") ?? "";
      return clean === "" ? null : clean;
    })
    .refine((v) => v === null || v.length <= max, { message: `Max ${max} characters` });

/** Nombres de etiqueta: recortados, sin vacíos y únicos sin distinguir mayúsculas. */
export function cleanTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (name === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

const tagsSchema = z
  .array(z.string().max(TAG_MAX * 2))
  .max(TAGS_PER_GARMENT_MAX)
  .transform(cleanTagNames)
  .refine((names) => names.every((n) => n.length <= TAG_MAX), {
    message: `Tags must have at most ${TAG_MAX} characters`,
  });

const seasonsSchema = z
  .array(z.enum(SEASON_IDS))
  .max(SEASON_IDS.length * 2)
  .transform((s) => SEASON_IDS.filter((id) => s.includes(id)));

const garmentFields = {
  type_id: z.enum(GARMENT_TYPE_IDS),
  name: optionalText(NAME_MAX),
  seasons: seasonsSchema,
  /** Hex del selector (`#abc`, `#AABBCC`…); se guarda normalizado. */
  color_hex: z.string().max(16).nullable(),
  /** Solo "multicolor" explícito (decisión 2); el resto se calcula del hex. */
  color_family: z.literal("multicolor").nullable(),
  brand: optionalText(BRAND_MAX),
  tags: tagsSchema,
};

export const createGarmentSchema = z.strictObject({
  id: z.uuid(),
  type_id: garmentFields.type_id,
  name: garmentFields.name.optional(),
  seasons: garmentFields.seasons.default([]),
  color_hex: garmentFields.color_hex.optional(),
  color_family: garmentFields.color_family.optional(),
  brand: garmentFields.brand.optional(),
  tags: garmentFields.tags.default([]),
});
export type CreateGarmentInput = z.output<typeof createGarmentSchema>;

export const patchGarmentSchema = z
  .strictObject({
    type_id: garmentFields.type_id.optional(),
    name: garmentFields.name.optional(),
    seasons: garmentFields.seasons.optional(),
    color_hex: garmentFields.color_hex.optional(),
    color_family: garmentFields.color_family.optional(),
    brand: garmentFields.brand.optional(),
    tags: garmentFields.tags.optional(),
    archived: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: "At least one field is required",
  });
export type PatchGarmentInput = z.output<typeof patchGarmentSchema>;

/**
 * Color a guardar a partir de lo que llega en el cuerpo:
 *   - color_family "multicolor" → sin hex (no se admiten los dos a la vez);
 *   - color_hex → hex normalizado + familia calculada;
 *   - null en cualquiera de los dos → sin color;
 *   - nada → undefined (no se toca).
 */
export function resolveColor(
  hex: string | null | undefined,
  family: "multicolor" | null | undefined,
): { color_hex: string | null; color_family: ColorFamilyId | null } | undefined {
  if (family === "multicolor") {
    if (hex) throw new ApiError(400, "invalid_body", "color_hex not allowed with multicolor");
    return { color_hex: null, color_family: "multicolor" };
  }
  if (typeof hex === "string") {
    const normalized = normalizeHex(hex);
    if (!normalized) throw new ApiError(400, "invalid_body", "Invalid color_hex");
    return { color_hex: normalized, color_family: colorFamily(normalized) };
  }
  if (hex === null || family === null) return { color_hex: null, color_family: null };
  return undefined;
}

// ---------------------------------------------------------------------------
// Parámetros del listado

const boolParam = z.enum(["true", "false"]).transform((v) => v === "true");

const listQuerySchema = z.object({
  archived: boolParam.default(false),
  slot: z.enum(SLOT_IDS).optional(),
  type: z.array(z.enum(GARMENT_TYPE_IDS)).max(GARMENT_TYPE_IDS.length).default([]),
  // Varias marcas se combinan con O (screens.md 4.1: chips multiselección).
  brand: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(BRAND_MAX * 2),
    )
    .max(BRANDS_FILTER_MAX)
    .default([]),
  // Varias familias de color se combinan con O, como las marcas.
  color: z.array(z.enum(COLOR_FAMILY_IDS)).max(COLOR_FAMILY_IDS.length).default([]),
  tags: z.array(z.uuid()).max(TAGS_PER_GARMENT_MAX).default([]),
  // Prendas concretas (en O), p. ej. las del borrador del vestidor (4.6).
  id: z.array(z.uuid()).max(MAX_PAGE_SIZE).default([]),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(0).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  count: boolParam.default(false),
  ids: boolParam.default(false),
  include: z.array(z.enum(["cutout"])).default([]),
});
export type GarmentListQuery = z.output<typeof listQuerySchema>;

// Parámetros que admiten varios valores: repetidos (?type=a&type=b) o
// separados por comas (?type=a,b). `brand` también admite varios, pero solo
// repetido: una marca puede llevar comas.
const MULTI_PARAMS = ["type", "color", "tags", "id", "include"] as const;
const REPEATED_PARAMS = ["brand"] as const;

/** Valida los parámetros de GET /api/garments. Lanza 400 `invalid_query`. */
export function parseListQuery(params: URLSearchParams): GarmentListQuery {
  const raw: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    if ((MULTI_PARAMS as readonly string[]).includes(key)) {
      raw[key] = params
        .getAll(key)
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter(Boolean);
    } else if ((REPEATED_PARAMS as readonly string[]).includes(key)) {
      raw[key] = params.getAll(key);
    } else {
      raw[key] = params.get(key);
    }
  }
  const result = listQuerySchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new ApiError(400, "invalid_query", "Invalid query parameters", details);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Filas → respuesta

// Columnas de una prenda; `tags` se embebe a través de garment_tags (n:m).
const GARMENT_COLUMNS =
  "id, type_id, name, seasons, color_hex, color_family, brand, archived, created_at, image_path, thumb_path, tags(id, name)";

type GarmentRow = {
  id: string;
  type_id: string;
  name: string | null;
  seasons: string[];
  color_hex: string | null;
  color_family: string | null;
  brand: string | null;
  archived: boolean;
  created_at: string;
  image_path: string;
  thumb_path: string;
  tags: { id: string; name: string }[];
};

async function toGarments(
  supabase: ServerSupabase,
  rows: GarmentRow[],
  withCutout: boolean,
): Promise<Garment[]> {
  const paths = rows.flatMap((r) => (withCutout ? [r.thumb_path, r.image_path] : [r.thumb_path]));
  const urls = await createSignedUrls(supabase, paths);
  return rows.map((r) => {
    const type = r.type_id as GarmentTypeId;
    const garment: Garment = {
      id: r.id,
      type_id: type,
      slot: slotOfType(type),
      name: r.name,
      seasons: r.seasons as SeasonId[],
      color_hex: r.color_hex,
      color_family: r.color_family as ColorFamilyId | null,
      brand: r.brand,
      archived: r.archived,
      created_at: r.created_at,
      tags: [...r.tags].sort((a, b) => a.name.localeCompare(b.name)),
      thumbUrl: urls[r.thumb_path] ?? null,
    };
    if (withCutout) garment.cutoutUrl = urls[r.image_path] ?? null;
    return garment;
  });
}

// ---------------------------------------------------------------------------
// Listado

/** Tipos que pasan los filtros de hueco y tipo; null = sin filtro. */
function allowedTypes(slot: SlotId | undefined, types: GarmentTypeId[]): GarmentTypeId[] | null {
  if (!slot && types.length === 0) return null;
  const inSlot = slot ? typesOfSlot(slot) : GARMENT_TYPE_IDS;
  return types.length > 0 ? types.filter((t) => inSlot.includes(t)) : inSlot;
}

// Lo mínimo de un filtro de PostgREST que usa applyFilters. Los métodos
// genéricos de postgrest-js no encajan con un tipo estructural: se convierte
// dentro y se devuelve la consulta con su tipo original.
type Filterable = {
  eq(column: string, value: string | boolean): Filterable;
  in(column: string, values: readonly string[]): Filterable;
};

/** Aplica los filtros (salvo etiquetas, que van en la RPC) a una consulta. */
function applyFilters<Q>(query: Q, f: GarmentListQuery, types: string[] | null): Q {
  let q = (query as unknown as Filterable).eq("archived", f.archived);
  if (types) q = q.in("type_id", types);
  if (f.brand.length > 0) q = q.in("brand", f.brand);
  if (f.color.length > 0) q = q.in("color_family", f.color);
  if (f.id.length > 0) q = q.in("id", f.id);
  return q as unknown as Q;
}

/** Prendas que tienen todas las etiquetas `tags` (0008_garment_functions.sql). */
function garmentsWithTags(supabase: ServerSupabase, tags: string[], head = false) {
  return supabase.rpc(
    "garments_with_all_tags",
    { p_tag_ids: tags },
    head ? { count: "exact", head: true } : undefined,
  );
}

export async function countGarments(supabase: ServerSupabase, f: GarmentListQuery) {
  const types = allowedTypes(f.slot, f.type);
  if (types?.length === 0) return 0;
  const query = garmentsWithTags(supabase, f.tags, true).select("id");
  const { count, error } = await applyFilters(query, f, types);
  if (error) throw error;
  return count ?? 0;
}

export async function listGarmentIds(supabase: ServerSupabase, f: GarmentListQuery) {
  const types = allowedTypes(f.slot, f.type);
  if (types?.length === 0) return [];
  // Con RPC, PostgREST solo ordena por columnas seleccionadas.
  const query = garmentsWithTags(supabase, f.tags).select("id, created_at");
  const filtered = applyFilters(query, f, types);
  const { data, error } = await applyCursor(filtered, null);
  if (error) throw error;
  return data.map((r) => r.id);
}

export async function listGarments(supabase: ServerSupabase, f: GarmentListQuery) {
  const types = allowedTypes(f.slot, f.type);
  if (types?.length === 0) return { items: [], nextCursor: null };
  const cursor = f.cursor ? decodeCursor(f.cursor) : null;

  const query = garmentsWithTags(supabase, f.tags).select(GARMENT_COLUMNS);
  const filtered = applyFilters(query, f, types);
  // Se pide una fila de más para saber si hay página siguiente.
  const { data, error } = await applyCursor(filtered, cursor).limit(f.limit + 1);
  if (error) throw error;

  const rows = data as unknown as GarmentRow[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: await toGarments(supabase, page, f.include.includes("cutout")),
    nextCursor: rows.length > f.limit && last ? encodeCursor(last) : null,
  };
}

/** Recuento por hueco y por familia de color (en uso y archivadas) y totales. */
export async function garmentCounts(
  supabase: ServerSupabase,
  userId: string,
): Promise<GarmentCountsResponse> {
  // Como mucho 500 filas de tres columnas: se cuenta aquí.
  const { data, error } = await supabase
    .from("garments")
    .select("type_id, archived, color_family")
    .eq("user_id", userId);
  if (error) throw error;

  const zeros = () => Object.fromEntries(SLOT_IDS.map((s) => [s, 0])) as Record<SlotId, number>;
  const bySlot = zeros();
  const archivedBySlot = zeros();
  // Solo las familias presentes (las prendas sin color no cuentan).
  const byColor: Partial<Record<ColorFamilyId, number>> = {};
  const archivedByColor: Partial<Record<ColorFamilyId, number>> = {};
  let inUse = 0;
  let archived = 0;
  for (const row of data) {
    const slot = slotOfType(row.type_id as GarmentTypeId);
    const family = row.color_family as ColorFamilyId | null;
    const colors = row.archived ? archivedByColor : byColor;
    if (family) colors[family] = (colors[family] ?? 0) + 1;
    if (row.archived) {
      archived++;
      archivedBySlot[slot]++;
    } else {
      inUse++;
      bySlot[slot]++;
    }
  }
  return { inUse, archived, bySlot, archivedBySlot, byColor, archivedByColor };
}

// ---------------------------------------------------------------------------
// Una prenda

/** Una prenda con etiquetas y URLs de miniatura y recorte; null si no existe (o es ajena). */
export async function getGarment(supabase: ServerSupabase, id: string): Promise<Garment | null> {
  const { data, error } = await supabase
    .from("garments")
    .select(GARMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [garment] = await toGarments(supabase, [data as unknown as GarmentRow], true);
  return garment;
}

async function requireGarmentPaths(supabase: ServerSupabase, id: string) {
  const { data, error } = await supabase
    .from("garments")
    .select("id, image_path, thumb_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, "not_found", "Garment not found");
  return data;
}

// ---------------------------------------------------------------------------
// Storage

async function signUpload(supabase: ServerSupabase, path: string): Promise<SignedUpload> {
  // upsert: permite repetir la subida (reintentos) y sobrescribir al cambiar la foto.
  const { data, error } = await supabase.storage
    .from(GARMENTS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  return { path: data.path, signedUrl: data.signedUrl, token: data.token };
}

/** Rutas que no existen en Storage. */
async function missingFiles(supabase: ServerSupabase, paths: string[]): Promise<string[]> {
  const bucket = supabase.storage.from(GARMENTS_BUCKET);
  const results = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await bucket.exists(path);
      // exists() da error con 400/404 cuando el archivo no está.
      return data && !error ? null : path;
    }),
  );
  return results.filter((p): p is string => p !== null);
}

/** Borrado de limpieza: si falla, se registra y se sigue. */
async function removeFilesQuietly(supabase: ServerSupabase, paths: string[]) {
  const { error } = await supabase.storage.from(GARMENTS_BUCKET).remove(paths);
  if (error) console.error("[api] storage cleanup failed", paths, error.message);
}

async function countAll(supabase: ServerSupabase, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("garments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

function limitReached(current: number) {
  return new ApiError(409, "limit_reached", "Garment limit reached", {
    limit: GARMENT_LIMIT,
    current,
  });
}

/**
 * Reserva `count` ids de prenda y devuelve, para cada uno, las URLs firmadas
 * de subida del recorte y la miniatura. Comprueba el límite de 500.
 */
export async function reserveUploads(
  supabase: ServerSupabase,
  userId: string,
  count: number,
): Promise<GarmentUploadSlot[]> {
  const current = await countAll(supabase, userId);
  if (current + count > GARMENT_LIMIT) throw limitReached(current);

  return Promise.all(
    Array.from({ length: count }, async () => {
      const id = crypto.randomUUID();
      const paths = garmentPaths(userId, id);
      const [cutout, thumb] = await Promise.all([
        signUpload(supabase, paths.cutout),
        signUpload(supabase, paths.thumb),
      ]);
      return { id, cutout, thumb };
    }),
  );
}

// ---------------------------------------------------------------------------
// Crear, editar, borrar

async function setTags(supabase: ServerSupabase, garmentId: string, names: string[]) {
  const { error } = await supabase.rpc("set_garment_tags", {
    p_garment_id: garmentId,
    p_names: names,
  });
  if (error?.code === "P0002") throw new ApiError(404, "not_found", "Garment not found");
  if (error) throw error;
}

/**
 * Crea la prenda tras subir sus dos archivos. Si algo falla después de
 * comprobarlos, los borra (salvo si el id ya era una prenda: 409 `conflict`).
 */
export async function createGarment(
  supabase: ServerSupabase,
  userId: string,
  input: CreateGarmentInput,
): Promise<Garment> {
  const color = resolveColor(input.color_hex, input.color_family) ?? {
    color_hex: null,
    color_family: null,
  };
  const paths = garmentPaths(userId, input.id);
  const files = [paths.cutout, paths.thumb];

  // ¿Ya existe? (un reintento tras una respuesta perdida). Sus archivos son los mismos: no se tocan.
  const { data: existing, error: existingError } = await supabase
    .from("garments")
    .select("id")
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new ApiError(409, "conflict", "Garment already exists");

  const missing = await missingFiles(supabase, files);
  if (missing.length > 0) {
    throw new ApiError(409, "upload_missing", "Uploaded files not found", { missing });
  }

  try {
    const current = await countAll(supabase, userId);
    if (current + 1 > GARMENT_LIMIT) throw limitReached(current);

    const { error } = await supabase.from("garments").insert({
      id: input.id,
      user_id: userId,
      type_id: input.type_id,
      name: input.name ?? null,
      seasons: input.seasons,
      ...color,
      brand: input.brand ?? null,
      image_path: paths.cutout,
      thumb_path: paths.thumb,
    });
    if (error?.code === UNIQUE_VIOLATION) {
      // Otra petición la ha creado a la vez: sus archivos son estos, no se borran.
      throw new ApiError(409, "conflict", "Garment already exists");
    }
    if (error) throw error;

    try {
      if (input.tags.length > 0) await setTags(supabase, input.id, input.tags);
    } catch (err) {
      // Sin la fila no quedan garment_tags (on delete cascade).
      await supabase.from("garments").delete().eq("id", input.id);
      throw err;
    }
  } catch (err) {
    if (!(err instanceof ApiError && err.code === "conflict")) {
      await removeFilesQuietly(supabase, files);
    }
    throw err;
  }

  const garment = await getGarment(supabase, input.id);
  if (!garment) throw new Error("Garment not found after insert");
  return garment;
}

/** Edita una prenda; `tags` reemplaza el conjunto entero. Devuelve la prenda. */
export async function updateGarment(
  supabase: ServerSupabase,
  id: string,
  input: PatchGarmentInput,
): Promise<Garment> {
  const { tags, color_hex, color_family, ...rest } = input;
  const changes = {
    ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
    ...resolveColor(color_hex, color_family),
  };

  if (Object.keys(changes).length > 0) {
    const { data, error } = await supabase
      .from("garments")
      .update(changes)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "not_found", "Garment not found");
  }
  if (tags) await setTags(supabase, id, tags);

  const garment = await getGarment(supabase, id);
  if (!garment) throw new ApiError(404, "not_found", "Garment not found");
  return garment;
}

/** Borra primero los archivos de Storage y después la fila. */
export async function deleteGarment(supabase: ServerSupabase, id: string) {
  const row = await requireGarmentPaths(supabase, id);
  const { error: storageError } = await supabase.storage
    .from(GARMENTS_BUCKET)
    .remove([row.image_path, row.thumb_path]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("garments").delete().eq("id", id);
  if (error) throw error;
}

/** Archiva o desarchiva varias prendas. Devuelve cuántas filas se han actualizado. */
export async function archiveGarments(
  supabase: ServerSupabase,
  ids: string[],
  archived: boolean,
): Promise<number> {
  // Por tandas: los ids viajan en la URL de PostgREST.
  const CHUNK = 100;
  let updated = 0;
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("garments")
      .update({ archived })
      .in("id", unique.slice(i, i + CHUNK))
      .select("id");
    if (error) throw error;
    updated += data.length;
  }
  return updated;
}

/**
 * En cuántos favoritos aparece la prenda y cuántos se quedarían vacíos
 * (y se borrarían, trigger de 0005) si se elimina.
 */
export async function garmentUsage(
  supabase: ServerSupabase,
  id: string,
): Promise<GarmentUsageResponse> {
  await requireGarmentPaths(supabase, id);

  const { data: items, error } = await supabase
    .from("favorite_items")
    .select("favorite_id")
    .eq("garment_id", id);
  if (error) throw error;
  const favoriteIds = [...new Set(items.map((i) => i.favorite_id))];
  if (favoriteIds.length === 0) return { favorites: 0, wouldEmpty: 0 };

  const { data: others, error: othersError } = await supabase
    .from("favorite_items")
    .select("favorite_id")
    .in("favorite_id", favoriteIds)
    .neq("garment_id", id);
  if (othersError) throw othersError;
  const withOthers = new Set(others.map((o) => o.favorite_id));
  return {
    favorites: favoriteIds.length,
    wouldEmpty: favoriteIds.filter((f) => !withOthers.has(f)).length,
  };
}

/** URLs firmadas para sobrescribir recorte y miniatura (cambiar la foto). */
export async function signImageReplacement(supabase: ServerSupabase, id: string) {
  const row = await requireGarmentPaths(supabase, id);
  const [cutout, thumb] = await Promise.all([
    signUpload(supabase, row.image_path),
    signUpload(supabase, row.thumb_path),
  ]);
  return { cutout, thumb };
}

/** Tras sobrescribir: comprueba que los dos archivos están y devuelve la prenda con URLs nuevas. */
export async function confirmImageReplacement(supabase: ServerSupabase, id: string) {
  const row = await requireGarmentPaths(supabase, id);
  const missing = await missingFiles(supabase, [row.image_path, row.thumb_path]);
  if (missing.length > 0) {
    throw new ApiError(409, "upload_missing", "Uploaded files not found", { missing });
  }
  const garment = await getGarment(supabase, id);
  if (!garment) throw new ApiError(404, "not_found", "Garment not found");
  return garment;
}

// ---------------------------------------------------------------------------
// Marcas y etiquetas

/** Marcas distintas del usuario, ordenadas; con `prefix`, solo las que empiezan así. */
export async function listBrands(
  supabase: ServerSupabase,
  userId: string,
  prefix?: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("garments")
    .select("brand")
    .eq("user_id", userId)
    .not("brand", "is", null);
  if (error) throw error;

  const needle = prefix?.trim().toLocaleLowerCase();
  const brands = new Set<string>();
  for (const { brand } of data) {
    if (brand && (!needle || brand.toLocaleLowerCase().startsWith(needle))) brands.add(brand);
  }
  return [...brands].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Etiquetas del usuario con su número de prendas (en uso y archivadas), por nombre. */
export async function listTags(supabase: ServerSupabase, userId: string): Promise<TagWithCount[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, garment_tags(count)")
    .eq("user_id", userId);
  if (error) throw error;
  return data
    .map((t) => ({
      id: t.id,
      name: t.name,
      count: (t.garment_tags as unknown as { count: number }[])[0]?.count ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
