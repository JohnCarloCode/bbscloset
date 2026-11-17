// Render del PNG de exportación (spec 3.5, architecture 4.4, plan 6.1).
// Solo navegador.
//
// - Geometría: exportGeometry (pura, con tests): misma composición que en
//   pantalla, reescalada sin recolocar y centrada con márgenes.
// - Pintado: Stage de Konva fuera de pantalla (contenedor creado con
//   document.createElement, nunca adjunto) al tamaño exacto del destino y
//   `toBlob({ pixelRatio: 1 })`: el PNG sale a 1080 × N px aunque
//   Konva.pixelRatio global esté a 2 (OutfitCanvas).
// - Mismo renderizado que la pantalla: GarmentNode es react-konva, así que
//   aquí se crean nodos Konva.Image imperativos con los mismos atributos
//   (garmentAttrs.ts: caja con origen en el centro, rotación y sombra de
//   producto) y en el mismo orden (paintOrder). La sombra se escala con el
//   mismo factor que las prendas para que se vea igual en proporción.
// - Fondo y sombra salen de los tokens CSS (canvas/theme.ts), como el lienzo.
//   Sin esquinas redondeadas ni marca de agua.
// - Konva entra con import() dinámico: no va en el bundle de quien lo importe.
import { garmentShapeAttrs } from "@/features/dresser/canvas/garmentAttrs";
import type { Size } from "@/features/dresser/canvas/geometry";
import { readCanvasTheme } from "@/features/dresser/canvas/theme";
import { loadCutoutImage } from "@/features/dresser/canvas/useCutoutImage";
import type { CanvasItem } from "@/features/dresser/model";
import { EmptyCanvasError, exportGeometry, type ExportRatio } from "./exportGeometry";

export { EXPORT_SIZES, EmptyCanvasError, type ExportRatio } from "./exportGeometry";

export type ExportGarment = {
  /** URL firmada del recorte a resolución completa (nunca la miniatura). */
  cutoutUrl: string | null | undefined;
  /** Ancho/alto conocido; se sustituye por el real al cargar el recorte. */
  aspect?: number;
};

export type RenderPngInput = {
  /** Items ya resueltos (colocación automática aplicada a los no manuales). */
  items: CanvasItem[];
  garments: Record<string, ExportGarment | undefined>;
  /** Tamaño del lienzo en pantalla (px CSS). */
  canvasSize: Size;
  ratio: ExportRatio;
};

export type RenderPngResult = { blob: Blob; width: number; height: number };

/**
 * PNG del outfit. Las prendas sin recorte no se pintan (tampoco salen en
 * pantalla). Errores: EmptyCanvasError si no queda ninguna prenda;
 * "cutout_load_failed" si un recorte no carga.
 */
export async function renderPng({
  items,
  garments,
  canvasSize,
  ratio,
}: RenderPngInput): Promise<RenderPngResult> {
  const drawable = items.filter((i) => garments[i.garmentId]?.cutoutUrl);
  if (drawable.length === 0) throw new EmptyCanvasError();

  const [{ default: Konva }, images] = await Promise.all([
    import("konva"),
    Promise.all(
      drawable.map(
        async (i) =>
          [i.garmentId, await loadCutoutImage(garments[i.garmentId]!.cutoutUrl!)] as const,
      ),
    ),
  ]);
  const imageOf = new Map(images);

  // Aspecto real del recorte, como hace GarmentNode al cargarlo.
  const aspectOf = (id: string) => {
    const img = imageOf.get(id);
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0)
      return img.naturalWidth / img.naturalHeight;
    return garments[id]?.aspect;
  };
  const layout = exportGeometry(drawable, aspectOf, canvasSize, ratio);
  const theme = readCanvasTheme();

  const container = document.createElement("div");
  const stage = new Konva.Stage({ container, width: layout.width, height: layout.height });
  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    layer.add(
      new Konva.Rect({ width: layout.width, height: layout.height, fill: theme.background }),
    );
    for (const { garmentId, box } of layout.nodes) {
      layer.add(
        new Konva.Image({
          image: imageOf.get(garmentId),
          listening: false,
          ...garmentShapeAttrs(box, theme.shadow, layout.scale),
        }),
      );
    }
    const blob = (await stage.toBlob({
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      pixelRatio: 1,
      mimeType: "image/png",
    })) as Blob;
    return { blob, width: layout.width, height: layout.height };
  } finally {
    stage.destroy();
  }
}
