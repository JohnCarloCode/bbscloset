// Mini collage del listado de favoritos (paso 5.3; decisión 8): composición
// en el cliente a partir de los items del favorito, sin Konva. Función pura.
//
// - Items con posición guardada (x, y y scale no nulos): se pintan tal cual
//   (son ajustes manuales hechos en el vestidor o en el detalle).
// - Items sin posición ("colócalo tú, app"): autoLayout, igual que hace el
//   vestidor (store.ts › relayout): solo se le pasan los automáticos y los
//   manuales no cuentan para el reparto.
// - z: la guardada o, si es null, la `defaultZ` de su hueco. El orden de
//   pintado es z, luego el orden de los items (hace de placedAt, como en
//   model.ts › paintOrder) y luego el id.
// - rotation: la guardada o 0.
//
// Lienzo de referencia: las posiciones son normalizadas al lienzo donde se
// guardaron, que cambia con la pantalla. La tarjeta usa una proporción fija
// 4:5 (vertical, ancho/alto = 0.8): es la del mini collage del prototipo y la
// de reserva de la vista previa de "Guardar en favoritos", y se parece al
// lienzo del vestidor en móvil con el panel a media altura. Así las
// composiciones guardadas en móvil se ven casi igual; las guardadas en un
// lienzo muy distinto (escritorio apaisado) se deforman en x/y, nunca en el
// tamaño ni el aspecto de las prendas.
import { SLOTS, type SlotId } from "@/lib/domain/slots";
import { autoLayout, type CanvasSize } from "@/lib/layout/autoLayout";
import type { FavoritePosition } from "@/lib/api/types";

/** Ancho / alto del lienzo de referencia de la tarjeta (4:5). */
export const MINI_COLLAGE_RATIO = 4 / 5;

/** Tamaño de referencia en px para autoLayout (solo importa la proporción). */
export const MINI_COLLAGE_SIZE: CanvasSize = { width: 400, height: 500 };

export type MiniCollageInput = FavoritePosition & { garment_id: string; slot: SlotId };

export type MiniCollagePiece = {
  garmentId: string;
  /** Centro normalizado 0..1 del lienzo. */
  x: number;
  y: number;
  /** Lado mayor / lado corto del lienzo (unidades de dresser/model.ts). */
  scale: number;
  rotation: number;
  z: number;
  /** Ancho / alto de la prenda usado para dibujarla. */
  aspect: number;
  /** Posición guardada (true) o colocación automática (false). */
  manual: boolean;
};

function hasPosition(i: FavoritePosition): boolean {
  return i.x !== null && i.y !== null && i.scale !== null;
}

function safeAspect(aspect: number | undefined): number {
  return aspect !== undefined && Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
}

/**
 * Compone el collage. Devuelve las piezas en orden de pintado (de atrás
 * hacia delante): el índice en el array sirve de z-index.
 * `aspects`: ancho/alto real de cada miniatura ya cargada (1 si falta).
 */
export function composeMiniCollage(
  items: readonly MiniCollageInput[],
  aspects: Readonly<Record<string, number>> = {},
  size: CanvasSize = MINI_COLLAGE_SIZE,
): MiniCollagePiece[] {
  const order = new Map(items.map((i, k) => [i.garment_id, k]));
  const auto = items.filter((i) => !hasPosition(i));
  const laid = new Map(
    autoLayout(
      auto.map((i) => ({
        garmentId: i.garment_id,
        slotId: i.slot,
        aspect: safeAspect(aspects[i.garment_id]),
        placedAt: order.get(i.garment_id) ?? 0,
      })),
      size,
    ).map((r) => [r.garmentId, r]),
  );

  const pieces = items.map((i): MiniCollagePiece => {
    const z = i.z ?? SLOTS[i.slot].defaultZ;
    const aspect = safeAspect(aspects[i.garment_id]);
    if (hasPosition(i)) {
      return {
        garmentId: i.garment_id,
        x: i.x as number,
        y: i.y as number,
        scale: i.scale as number,
        rotation: i.rotation ?? 0,
        z,
        aspect,
        manual: true,
      };
    }
    const r = laid.get(i.garment_id);
    return {
      garmentId: i.garment_id,
      x: r?.x ?? 0.5,
      y: r?.y ?? 0.5,
      scale: r?.scale ?? 0.4,
      rotation: i.rotation ?? 0,
      z,
      aspect,
      manual: false,
    };
  });

  return pieces.sort(
    (a, b) =>
      a.z - b.z ||
      (order.get(a.garmentId) ?? 0) - (order.get(b.garmentId) ?? 0) ||
      a.garmentId.localeCompare(b.garmentId),
  );
}

/**
 * Caja CSS de una pieza en porcentajes del contenedor (lienzo con
 * proporción `ratio` = ancho/alto): left/top del centro y ancho. El alto lo
 * da `aspect-ratio` y el centrado/rotación un `transform`.
 */
export function pieceBox(
  piece: Pick<MiniCollagePiece, "x" | "y" | "scale" | "aspect">,
  ratio: number = MINI_COLLAGE_RATIO,
): { left: number; top: number; width: number } {
  // Lado corto del lienzo como fracción del ancho.
  const shortOverWidth = Math.min(1, 1 / ratio);
  const long = piece.scale * shortOverWidth; // fracción del ancho
  const width = piece.aspect >= 1 ? long : long * piece.aspect;
  return { left: piece.x * 100, top: piece.y * 100, width: width * 100 };
}
