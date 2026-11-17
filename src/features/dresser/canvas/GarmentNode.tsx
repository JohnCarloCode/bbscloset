"use client";

// Una prenda del lienzo: el recorte (nunca la miniatura) con la sombra de
// producto bajo la silueta (DESIGN.md › Elevation: la única sombra del
// sistema). Avisa del aspecto real del recorte al cargarlo (onAspect) y
// registra su nodo para que OutfitCanvas le enganche el Transformer y los
// gestos. No guarda estado de posición: lo pinta todo desde el item.
import type Konva from "konva";
import { memo, useCallback, useEffect, useRef } from "react";
import { Image as KonvaImage } from "react-konva";
import type { CanvasItem } from "../model";
import { buildAlphaMask } from "./alphaMask";
import { garmentShapeAttrs } from "./garmentAttrs";
import { nodeBox, type Size } from "./geometry";
import type { ProductShadow } from "./theme";
import { useCutoutImage } from "./useCutoutImage";

export type GarmentNodeProps = {
  item: CanvasItem;
  url: string | null;
  /** Aspecto conocido (ancho/alto); hasta cargar el recorte, 1. */
  aspect: number;
  size: Size;
  shadow: ProductShadow | null;
  editable: boolean;
  onAspect: (garmentId: string, aspect: number) => void;
  onSelect: (garmentId: string) => void;
  onDragStart: (garmentId: string) => void;
  onDragEnd: (garmentId: string, node: Konva.Image) => void;
  onTransformEnd: (garmentId: string, node: Konva.Image) => void;
  registerNode: (garmentId: string, node: Konva.Image | null) => void;
};

// memo: arrastrar o mover otra prenda no repinta esta (OutfitCanvas pasa
// manejadores estables y el modelo conserva los items que no cambian).
export const GarmentNode = memo(function GarmentNode({
  item,
  url,
  aspect,
  size,
  shadow,
  editable,
  onAspect,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  registerNode,
}: GarmentNodeProps) {
  const { image } = useCutoutImage(url);
  const nodeRef = useRef<Konva.Image | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const id = item.garmentId;

  // Aspecto real del recorte, hacia arriba (autoLayout lo usa).
  useEffect(() => {
    if (!image || !image.naturalWidth || !image.naturalHeight) return;
    const real = image.naturalWidth / image.naturalHeight;
    if (Math.abs(real - aspect) > 1e-3) onAspect(id, real);
  }, [image, aspect, id, onAspect]);

  const setNode = useCallback(
    (node: Konva.Image | null) => {
      nodeRef.current = node;
      registerNode(id, node);
    },
    [id, registerNode],
  );

  // Máscara de clic con la silueta (el color clave del nodo es fijo).
  useEffect(() => {
    const node = nodeRef.current;
    maskRef.current = image && node && editable ? buildAlphaMask(image, node.colorKey) : null;
    node?.getLayer()?.batchDraw();
  }, [image, editable]);

  const hitFunc = useCallback((ctx: Konva.Context, shape: Konva.Shape) => {
    const mask = maskRef.current;
    if (mask) {
      ctx.drawImage(mask, 0, 0, shape.width(), shape.height());
      return;
    }
    ctx.beginPath();
    ctx.rect(0, 0, shape.width(), shape.height());
    ctx.closePath();
    ctx.fillStrokeShape(shape);
  }, []);

  if (!image) return null;
  const box = nodeBox(item, aspect, size);

  return (
    <KonvaImage
      ref={setNode}
      name="garment"
      id={id}
      image={image}
      // Caja y sombra compartidas con la exportación (garmentAttrs.ts).
      {...garmentShapeAttrs(box, shadow)}
      listening={editable}
      draggable={editable}
      hitFunc={hitFunc}
      onMouseDown={() => editable && onSelect(id)}
      onTouchStart={() => editable && onSelect(id)}
      onDragStart={() => onDragStart(id)}
      onDragEnd={(e) => onDragEnd(id, e.target as Konva.Image)}
      onTransformEnd={(e) => onTransformEnd(id, e.target as Konva.Image)}
    />
  );
});
