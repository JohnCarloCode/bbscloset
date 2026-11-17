// Atributos de dibujo de una prenda en Konva, compartidos por el lienzo
// (GarmentNode, react-konva) y la exportación (export/renderPng, Konva
// imperativo): misma caja, misma rotación sobre el centro y misma sombra de
// producto. Puro, sin Konva.
import type { NodeBox } from "./geometry";
import type { ProductShadow } from "./theme";

export type GarmentShapeAttrs = NodeBox & {
  scaleX: number;
  scaleY: number;
  shadowEnabled: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowForStrokeEnabled: boolean;
  perfectDrawEnabled: boolean;
};

/**
 * `shadowScale` escala desenfoque y desplazamiento de la sombra junto con la
 * prenda (la exportación reescala el conjunto: la sombra debe verse igual
 * en proporción). En pantalla es 1.
 */
export function garmentShapeAttrs(
  box: NodeBox,
  shadow: ProductShadow | null,
  shadowScale = 1,
): GarmentShapeAttrs {
  return {
    ...box,
    scaleX: 1,
    scaleY: 1,
    shadowEnabled: shadow !== null,
    shadowColor: shadow?.color,
    shadowBlur: shadow ? shadow.blur * shadowScale : undefined,
    shadowOffsetX: shadow ? shadow.offsetX * shadowScale : undefined,
    shadowOffsetY: shadow ? shadow.offsetY * shadowScale : undefined,
    // La sombra no cuenta para el clic ni para el marco del Transformer.
    shadowForStrokeEnabled: false,
    perfectDrawEnabled: false,
  };
}
