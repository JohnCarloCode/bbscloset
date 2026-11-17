// Tipos de la cola de recorte global (paso 3.6, screens.md 6).
// Lo pendiente vive en el dispositivo (architecture.md 4.1): estos items
// nunca tocan el esquema de Supabase; solo se suben cuando tienen recorte y
// tipo.
import type { ApiClientErrorCode } from "@/lib/api/client";
import type { GarmentTypeId } from "@/lib/domain/types";
import type { SeasonId } from "@/lib/domain/seasons";
import type { ImagingErrorCode } from "@/lib/imaging/errors";

/**
 * - garment: prenda nueva (formulario 5.3 o subida masiva "por revisar").
 * - replace: "Cambiar foto" de una prenda existente (`garmentId`).
 * - batch: recorte en lote (13); solo en memoria (decisión 13), nunca se sube.
 */
export type QueueKind = "garment" | "replace" | "batch";
export type QueueStatus = "queued" | "cutting" | "ready" | "error";
/** cut: quitar el fondo; as-is: "ya está recortada" (se usa tal cual). */
export type QueueMode = "cut" | "as-is";

/** Datos del formulario de la prenda (los de POST /api/garments menos `id`). */
export type GarmentData = {
  type_id: GarmentTypeId;
  name?: string;
  seasons: SeasonId[];
  color_hex?: string | null;
  color_family?: "multicolor" | null;
  brand?: string;
  /** Nombres de etiqueta. */
  tags: string[];
};

export type QueueItem = {
  localId: string;
  /** Dueño del item: dos usuarios pueden compartir el dispositivo. */
  userId: string;
  kind: QueueKind;
  /** Orden de llegada (ms, estrictamente creciente en la sesión). */
  createdAt: number;
  status: QueueStatus;
  /** 0–1 del recorte en marcha. */
  progress: number;
  /** Fase del recorte en marcha: "preparing" = descarga del modelo (solo memoria). */
  stage?: "preparing" | "cutting";
  mode: QueueMode;
  /** Foto reducida (PNG, lado máx. 1200). */
  source: Blob;
  /** Nombre del archivo original (para listas como la del recorte en lote). */
  sourceName?: string;
  cutout?: Blob;
  thumb?: Blob;
  cutoutSize?: { width: number; height: number };
  garmentData?: GarmentData;
  /**
   * replace: la prenda a la que se cambia la foto. garment: el id reservado
   * cuyos archivos ya están en Storage (falta crear la fila).
   */
  garmentId?: string;
  /** Subida masiva: sin tipo todavía (franja "por revisar", screens.md 4.4). */
  needsReview?: boolean;
  /**
   * La foto original tenía transparencia (lo detectado al elegirla). La
   * revisión (4.4) lo usa para la línea de estado de "ya recortada".
   */
  hasAlpha?: boolean;
  /** Error del recorte (status "error"). */
  error?: ImagingErrorCode;
  /**
   * Ya anunciada al guardar ("Añadida a Capa base.", paso 3.8): no cuenta en
   * el aviso de fin de tanda "N prendas listas para el vestidor".
   */
  announced?: boolean;
  /** Error de subida que no se reintenta solo (p. ej. limit_reached). */
  uploadError?: ApiClientErrorCode;
  /**
   * Ya subida: se borró de IndexedDB y solo sigue en memoria hasta que
   * acaba la tanda (para contar "5 prendas listas").
   */
  uploaded?: boolean;
};

/** Lo que se puede pasar al encolar. */
export type EnqueueExtras = Pick<
  QueueItem,
  "garmentData" | "garmentId" | "needsReview" | "sourceName" | "hasAlpha"
>;
