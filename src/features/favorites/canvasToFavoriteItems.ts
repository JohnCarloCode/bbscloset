// Lienzo del vestidor → items de POST /api/favorites (paso 5.2; spec 3.4).
// Función pura, sin React ni red.
// - Item manual (movido, redimensionado o rotado a mano): se guardan x, y,
//   scale y rotation tal cual (el favorito conserva la composición).
// - Item automático: x, y, scale y rotation a null ("colócalo tú, app"); el
//   favorito lo recolocará con autoLayout al pintarlo.
// - z: siempre la del item (puede venir de "Traer delante · Enviar atrás").
//   En la BD, z null significaría "la de su hueco"; aquí nunca se manda null.
// - El candado es estado del vestidor y no se manda.
import { clampScale, normalizeRotation } from "@/features/dresser/canvas/geometry";
import type { CanvasState } from "@/features/dresser/model";

export type FavoriteItemPayload = {
  garment_id: string;
  x: number | null;
  y: number | null;
  scale: number | null;
  rotation: number | null;
  z: number;
};

// Mismos rangos que valida la API (POSITION_LIMITS en lib/api/favorites.ts,
// que no se importa aquí porque arrastra código de servidor).
const XY_MIN = -1;
const XY_MAX = 2;
const Z_LIMIT = 10_000;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function canvasToFavoriteItems(canvas: CanvasState): FavoriteItemPayload[] {
  return canvas.items.map((item) => {
    const z = clamp(Math.round(item.z), -Z_LIMIT, Z_LIMIT);
    if (!item.manual) {
      return { garment_id: item.garmentId, x: null, y: null, scale: null, rotation: null, z };
    }
    return {
      garment_id: item.garmentId,
      x: clamp(item.x, XY_MIN, XY_MAX),
      y: clamp(item.y, XY_MIN, XY_MAX),
      scale: clampScale(item.scale),
      rotation: normalizeRotation(item.rotation),
      z,
    };
  });
}
