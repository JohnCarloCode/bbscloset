// Tipos de las respuestas de la API de prendas, marcas y etiquetas (paso 3.2)
// y de favoritos (paso 5.1).
// Los usan las rutas de src/app/api/ y la UI (con apiFetch).
import type { ColorFamilyId } from "@/lib/domain/colors";
import type { SeasonId } from "@/lib/domain/seasons";
import type { SlotId } from "@/lib/domain/slots";
import type { GarmentTypeId } from "@/lib/domain/types";

/** Máximo de prendas por usuario (spec 3.1, decisión 3). */
export const GARMENT_LIMIT = 500;

// Topes técnicos de longitud (la BD no los tiene; evitan textos absurdos).
// La API los valida y el formulario los usa como maxLength.
export const GARMENT_NAME_MAX = 80;
export const GARMENT_BRAND_MAX = 60;
export const GARMENT_TAG_MAX = 40;

export type TagRef = { id: string; name: string };

export type Garment = {
  id: string;
  type_id: GarmentTypeId;
  /** Hueco, deducido del tipo. */
  slot: SlotId;
  name: string | null;
  seasons: SeasonId[];
  /** Hex de 6 cifras en minúsculas, o null (sin color o multicolor). */
  color_hex: string | null;
  color_family: ColorFamilyId | null;
  brand: string | null;
  archived: boolean;
  created_at: string;
  /** Etiquetas, ordenadas por nombre. */
  tags: TagRef[];
  /** URL firmada (1 h) de la miniatura; null si no se pudo firmar. */
  thumbUrl: string | null;
  /** URL firmada del recorte: solo en el detalle o con `include=cutout`. */
  cutoutUrl?: string | null;
};

/** GET /api/garments */
export type GarmentListResponse = { items: Garment[]; nextCursor: string | null };
/** GET /api/garments?count=true (o limit=0) */
export type GarmentCountResponse = { count: number };
/** GET /api/garments?ids=true */
export type GarmentIdsResponse = { ids: string[] };

/**
 * GET /api/garments/counts. `bySlot` cuenta solo las prendas en uso y
 * `archivedBySlot` las archivadas (chips de hueco de cada vista del catálogo).
 */
export type GarmentCountsResponse = {
  inUse: number;
  archived: number;
  bySlot: Record<SlotId, number>;
  archivedBySlot: Record<SlotId, number>;
  /** Prendas en uso por familia de color; solo las familias presentes. */
  byColor: Partial<Record<ColorFamilyId, number>>;
  /** Lo mismo para las archivadas (filtro de color en la vista Archivadas). */
  archivedByColor: Partial<Record<ColorFamilyId, number>>;
};

/** Una URL firmada de subida (PUT del archivo con la cabecera Content-Type). */
export type SignedUpload = { path: string; signedUrl: string; token: string };

export type GarmentUploadSlot = { id: string; cutout: SignedUpload; thumb: SignedUpload };

/** POST /api/garments/uploads */
export type GarmentUploadsResponse = { uploads: GarmentUploadSlot[] };

/** POST /api/garments/[id]/image sin `confirm` */
export type GarmentImageUploadResponse = { cutout: SignedUpload; thumb: SignedUpload };

/** GET /api/garments/[id]/usage */
export type GarmentUsageResponse = { favorites: number; wouldEmpty: number };

/** POST /api/garments/archive */
export type GarmentArchiveResponse = { updated: number };

/** GET /api/brands */
export type BrandsResponse = { brands: string[] };

/** GET /api/tags */
/** GET/PATCH /api/me: perfil del usuario y su email (de la sesión). */
export type Me = {
  user_id: string;
  language: string;
  jewelry_max: number;
  random_slots: string[];
  created_at: string;
  email: string | null;
};

export type TagWithCount = TagRef & { count: number };
export type TagsResponse = { tags: TagWithCount[] };
/** PATCH /api/tags/[id] → TagWithCount; DELETE /api/tags/[id] → */
export type TagDeleteResponse = { affected: number };

// ---------------------------------------------------------------------------
// Favoritos (paso 5.1)

/** Tope técnico del nombre de un favorito. */
export const FAVORITE_NAME_MAX = 80;
/** Prendas por favorito (más que cualquier lienzo real del vestidor). */
export const FAVORITE_ITEMS_MAX = 30;

/**
 * Posición de una prenda en el favorito, en las unidades del lienzo
 * (src/features/dresser/model.ts). x, y, scale y rotation van juntos: o todos
 * con valor (ajuste manual) o todos null ("colócalo tú, app"). z puede ser
 * null (se usa la z por defecto del hueco).
 */
export type FavoritePosition = {
  x: number | null;
  y: number | null;
  scale: number | null;
  rotation: number | null;
  z: number | null;
};

/** Item del listado: lo justo para el mini collage. */
export type FavoriteSummaryItem = FavoritePosition & {
  garment_id: string;
  type_id: GarmentTypeId;
  slot: SlotId;
  /** URL firmada (1 h) de la miniatura; null si no se pudo firmar. */
  thumbUrl: string | null;
};

export type FavoriteSummary = {
  id: string;
  /** Nombre opcional; si es null, la UI muestra la fecha. */
  name: string | null;
  created_at: string;
  garmentCount: number;
  items: FavoriteSummaryItem[];
};

/** GET /api/favorites */
export type FavoriteListResponse = {
  items: FavoriteSummary[];
  nextCursor: string | null;
  /** Total de favoritos del usuario (contador del listado). */
  total: number;
};

/** Item del detalle: con el recorte para el lienzo. */
export type FavoriteItem = FavoritePosition & {
  garment_id: string;
  type_id: GarmentTypeId;
  slot: SlotId;
  name: string | null;
  /** Los favoritos siguen mostrando las prendas archivadas (spec 2.5). */
  archived: boolean;
  /** URL firmada (1 h) del recorte; null si no se pudo firmar. */
  cutoutUrl: string | null;
};

/** GET/PATCH /api/favorites/[id] y POST /api/favorites */
export type Favorite = {
  id: string;
  name: string | null;
  created_at: string;
  items: FavoriteItem[];
};
