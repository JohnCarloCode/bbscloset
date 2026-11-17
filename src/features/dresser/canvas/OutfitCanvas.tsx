"use client";

// Lienzo del outfit (spec 3.3 y 6.1, screens.md 7.1), compartido por el
// vestidor y el detalle del favorito. Konva solo entra por OutfitCanvasLazy
// (next/dynamic, ssr: false): no importes este archivo desde una página.
//
// - Controlado: pinta `items` (unidades de model.ts) y emite el estado nuevo
//   con `onChange` al terminar cada gesto (dragend, transformend, fin del
//   pellizco), nunca durante. El padre decide si va al historial.
// - Fondo y sombra salen de los tokens CSS (theme.ts); esquinas {rounded.lg}.
// - Selección con Transformer (tiradores negros, giro, proporción fija,
//   solo esquinas; anclas de 44 px con puntero táctil), gestos de dos dedos
//   (useTouchGestures), candado HTML encima y barra "Traer delante · Enviar
//   atrás · Quitar" abajo. Tocar el fondo deselecciona.
// - Rendimiento (4.7): densidad de píxeles del lienzo limitada a 2 (móviles
//   de gama media con DPR 3) y manejadores estables para que GarmentNode
//   (memo) solo se repinte en React cuando cambia su item.
// - editable = false: sin selección ni gestos (vista previa, exportación).
import Konva from "konva";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import { cx } from "@/components/cx";
import { LockIcon } from "@/components/icons";
import {
  bringForward,
  paintOrder,
  remove,
  sendBackward,
  toggleLock,
  updateTransform,
  type CanvasItem,
  type CanvasState,
} from "../model";
import { GarmentNode } from "./GarmentNode";
import {
  MAX_SCALE,
  MIN_SCALE,
  nodeBox,
  rotatedBounds,
  transformFromNode,
  type Size,
} from "./geometry";
import type { TwoFingers } from "./gestures";
import { midpoint } from "./gestures";
import { SelectionBar } from "./SelectionBar";
import { readCanvasRadius, readCanvasTheme } from "./theme";
import { useTouchGestures } from "./useTouchGestures";

export type CanvasGarment = {
  id: string;
  /** URL firmada del recorte (nunca la miniatura). */
  cutoutUrl: string | null;
  /** Nombre para lectores de pantalla (nombre de la prenda o su tipo). */
  label: string;
  /** Ancho/alto del recorte si ya se conoce. */
  aspect?: number;
};

export type CanvasChange = {
  type: "transform" | "forward" | "backward" | "remove" | "lock";
  garmentId: string;
};

export type OutfitCanvasProps = {
  items: CanvasItem[];
  garments: Record<string, CanvasGarment>;
  editable?: boolean;
  onChange?: (next: CanvasState, change: CanvasChange) => void;
  onSelect?: (garmentId: string | null) => void;
  /** Aspecto real de un recorte al cargarlo (para autoLayout). */
  onAspect?: (garmentId: string, aspect: number) => void;
  /** Acceso al Stage (exportar a imagen, fase 6). */
  onStage?: (stage: Konva.Stage | null) => void;
  className?: string;
};

const LOCK_SIZE = 44;
const ANCHOR_SIZE = 12;
// Con puntero táctil el ancla mide 12 px pero responde en 44 (Touch Targets).
const TOUCH_ANCHOR_HIT = LOCK_SIZE - ANCHOR_SIZE;
const MIN_NODE_PX = 24;
const CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];

// Densidad máxima del lienzo: con DPR 3 el canvas tendría 9 veces los
// píxeles de CSS y cada fotograma del arrastre cuesta más. Solo cliente (ssr: false).
// La exportación a imagen (fase 6) pasa su propio pixelRatio.
const MAX_PIXEL_RATIO = 2;
if (typeof window !== "undefined")
  Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

const coarseQuery = "(pointer: coarse)";
function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia(coarseQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getCoarse = () => window.matchMedia(coarseQuery).matches;
const getCoarseServer = () => false;

export default function OutfitCanvas({
  items,
  garments,
  editable = true,
  onChange,
  onSelect,
  onAspect,
  onStage,
  className,
}: OutfitCanvasProps) {
  const t = useTranslations("dresser.canvas");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Image>());
  const [nodeVersion, setNodeVersion] = useState(0);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gesturing, setGesturing] = useState(false);
  // El pellizco corta el arrastre del primer dedo: ese dragend no emite.
  const pinchRef = useRef(false);
  const coarse = useSyncExternalStore(subscribeCoarse, getCoarse, getCoarseServer);
  // Solo cliente (ssr: false): los tokens se leen una vez al montar.
  const [theme] = useState(readCanvasTheme);
  const [radius] = useState(readCanvasRadius);

  const state = useMemo<CanvasState>(() => ({ items }), [items]);
  const ordered = useMemo(() => paintOrder(state), [state]);
  const selected = editable ? (items.find((i) => i.garmentId === selectedId) ?? null) : null;
  const selectedKey = selected?.garmentId ?? null;

  // Avisa al padre de la selección efectiva (también cuando la prenda desaparece).
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });
  useEffect(() => {
    onSelectRef.current?.(selectedKey);
  }, [selectedKey]);

  // Tamaño del contenedor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) =>
        s.width === Math.round(width) && s.height === Math.round(height)
          ? s
          : { width: Math.round(width), height: Math.round(height) },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stageCallback = useCallback(
    (s: Konva.Stage | null) => {
      setStage(s);
      onStage?.(s);
    },
    [onStage],
  );

  const aspectOf = useCallback(
    (id: string) => aspects[id] ?? garments[id]?.aspect ?? 1,
    [aspects, garments],
  );

  const handleAspect = useCallback(
    (id: string, aspect: number) => {
      setAspects((a) => (a[id] === aspect ? a : { ...a, [id]: aspect }));
      onAspect?.(id, aspect);
    },
    [onAspect],
  );

  const registerNode = useCallback((id: string, node: Konva.Image | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
    setNodeVersion((v) => v + 1);
  }, []);

  // Engancha el Transformer a la prenda seleccionada (cuando su nodo existe).
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedKey ? nodes.current.get(selectedKey) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedKey, nodeVersion, items, size]);

  const emit = useCallback(
    (next: CanvasState, change: CanvasChange) => onChange?.(next, change),
    [onChange],
  );

  /** Pasa el nodo al modelo, lo deja a escala 1 y emite el cambio. */
  const commitNode = useCallback(
    (id: string, node: Konva.Image) => {
      const item = items.find((i) => i.garmentId === id);
      if (!item || size.width === 0) return;
      const tf = transformFromNode(
        { x: node.x(), y: node.y(), scaleX: node.scaleX(), rotation: node.rotation() },
        item.scale,
        size,
      );
      const box = nodeBox(tf, aspectOf(id), size);
      node.scale({ x: 1, y: 1 });
      node.position({ x: box.x, y: box.y });
      node.size({ width: box.width, height: box.height });
      node.offset({ x: box.offsetX, y: box.offsetY });
      node.rotation(box.rotation);
      emit(updateTransform(state, id, tf), { type: "transform", garmentId: id });
    },
    [items, size, aspectOf, emit, state],
  );

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  // commitNode cambia con cada estado; los nodos reciben manejadores estables.
  const commitRef = useRef(commitNode);
  useEffect(() => {
    commitRef.current = commitNode;
  });

  const handleDragStart = useCallback((id: string) => {
    setSelectedId(id);
    setGesturing(true);
  }, []);

  const handleDragEnd = useCallback((id: string, node: Konva.Image) => {
    if (pinchRef.current) return;
    setGesturing(false);
    commitRef.current(id, node);
  }, []);

  const handleTransformEnd = useCallback((id: string, node: Konva.Image) => {
    setGesturing(false);
    commitRef.current(id, node);
  }, []);

  // Gestos de dos dedos: sobre la seleccionada o, si no hay, la que hay bajo los dedos.
  const pickTarget = (f: TwoFingers) => {
    if (selectedKey) return selectedKey;
    const hit = stage?.getIntersection(midpoint(f));
    const id = hit?.hasName("garment") ? hit.id() : null;
    if (id) setSelectedId(id);
    return id;
  };
  useTouchGestures({
    stage,
    enabled: editable,
    pickTarget,
    getNode: (id) => nodes.current.get(id) ?? null,
    getItemScale: (id) => items.find((i) => i.garmentId === id)?.scale ?? 1,
    onStart: () => {
      pinchRef.current = true;
      setGesturing(true);
    },
    onEnd: (id, node) => {
      pinchRef.current = false;
      setGesturing(false);
      commitNode(id, node);
    },
  });

  // Tocar el fondo (o fuera de las prendas) deselecciona.
  const handleStagePointer = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!editable) return;
      const target = e.target;
      if (target === target.getStage() || target.hasName("background")) setSelectedId(null);
    },
    [editable],
  );

  const labelOf = (id: string) => garments[id]?.label ?? "";
  const listLabel = useMemo(() => {
    const names = ordered.map((i) => garments[i.garmentId]?.label).filter(Boolean) as string[];
    if (names.length === 0) return t("emptyLabel");
    return t("label", { list: new Intl.ListFormat(locale, { type: "conjunction" }).format(names) });
  }, [ordered, garments, locale, t]);

  // Candado: centrado en la esquina superior izquierda de la caja (girada)
  // de la prenda, un poco por fuera, y siempre dentro del lienzo.
  let lockPos: { left: number; top: number } | null = null;
  if (selected && size.width > 0) {
    const b = rotatedBounds(selected, aspectOf(selected.garmentId), size);
    const half = LOCK_SIZE / 2;
    const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), Math.max(0, max));
    lockPos = {
      left: clamp(b.left - half - 4, size.width - LOCK_SIZE),
      top: clamp(b.top - half - 4, size.height - LOCK_SIZE),
    };
  }

  const index = selected ? ordered.findIndex((i) => i.garmentId === selected.garmentId) : -1;

  return (
    <div className={cx("relative h-full w-full", className)}>
      {/* Las clases referencian los tokens que lee theme.ts (y hacen que Tailwind los emita). */}
      <div
        ref={containerRef}
        role="img"
        aria-label={listLabel}
        className={cx(
          "absolute inset-0 overflow-hidden rounded-lg bg-canvas-parchment text-ink",
          editable && "touch-none",
        )}
      >
        <span aria-hidden="true" className="hidden bg-primary drop-shadow-product" />
        {size.width > 0 && size.height > 0 && (
          <Stage
            ref={stageCallback}
            width={size.width}
            height={size.height}
            onMouseDown={handleStagePointer}
            onTouchStart={handleStagePointer}
          >
            <Layer listening={editable}>
              <Rect
                name="background"
                width={size.width}
                height={size.height}
                cornerRadius={radius}
                fill={theme.background}
              />
              {ordered.map((item) => (
                <GarmentNode
                  key={item.garmentId}
                  item={item}
                  url={garments[item.garmentId]?.cutoutUrl ?? null}
                  aspect={aspectOf(item.garmentId)}
                  size={size}
                  shadow={theme.shadow}
                  editable={editable}
                  onAspect={handleAspect}
                  onSelect={select}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={handleTransformEnd}
                  registerNode={registerNode}
                />
              ))}
              {editable && (
                <Transformer
                  ref={transformerRef}
                  keepRatio
                  enabledAnchors={CORNERS}
                  flipEnabled={false}
                  ignoreStroke
                  rotateEnabled
                  rotateAnchorOffset={28}
                  rotationSnaps={[0, 90, 180, 270]}
                  rotationSnapTolerance={4}
                  borderStroke={theme.ink}
                  borderStrokeWidth={1.5}
                  anchorSize={ANCHOR_SIZE}
                  anchorCornerRadius={ANCHOR_SIZE / 2}
                  anchorFill={theme.ink}
                  anchorStroke={theme.ink}
                  anchorStyleFunc={(anchor) => {
                    if (coarse) anchor.hitStrokeWidth(TOUCH_ANCHOR_HIT);
                  }}
                  boundBoxFunc={(oldBox, newBox) => {
                    const short = Math.min(size.width, size.height);
                    const long = Math.max(Math.abs(newBox.width), Math.abs(newBox.height));
                    if (long < MIN_NODE_PX || long > MAX_SCALE * short || long < MIN_SCALE * short)
                      return oldBox;
                    return newBox;
                  }}
                  onTransformStart={() => setGesturing(true)}
                />
              )}
            </Layer>
          </Stage>
        )}
      </div>

      {selected && lockPos && !gesturing && (
        <button
          type="button"
          aria-pressed={selected.locked}
          aria-label={
            selected.locked
              ? t("unlock", { name: labelOf(selected.garmentId) })
              : t("lock", { name: labelOf(selected.garmentId) })
          }
          title={selected.locked ? t("lockedHint") : t("unlockedHint")}
          onClick={() =>
            emit(toggleLock(state, selected.garmentId), {
              type: "lock",
              garmentId: selected.garmentId,
            })
          }
          style={{ left: lockPos.left, top: lockPos.top }}
          className={cx(
            "absolute z-10 flex size-11 cursor-pointer items-center justify-center rounded-full text-ink",
            selected.locked
              ? "border-2 border-ink bg-primary"
              : "bg-surface-chip-translucent/64 backdrop-blur-md",
          )}
        >
          <LockIcon size={18} open={!selected.locked} />
        </button>
      )}

      {selected && (
        <SelectionBar
          className="absolute bottom-[10px] left-1/2 z-10 -translate-x-1/2"
          garmentLabel={labelOf(selected.garmentId)}
          canForward={index < ordered.length - 1}
          canBackward={index > 0}
          onForward={() =>
            emit(bringForward(state, selected.garmentId), {
              type: "forward",
              garmentId: selected.garmentId,
            })
          }
          onBackward={() =>
            emit(sendBackward(state, selected.garmentId), {
              type: "backward",
              garmentId: selected.garmentId,
            })
          }
          onRemove={() => {
            setSelectedId(null);
            emit(remove(state, selected.garmentId), {
              type: "remove",
              garmentId: selected.garmentId,
            });
          }}
        />
      )}
    </div>
  );
}
