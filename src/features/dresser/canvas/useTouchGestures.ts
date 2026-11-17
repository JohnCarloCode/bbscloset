"use client";

// Gestos de dos dedos sobre el lienzo (pellizcar = escalar, girar = rotar; el
// punto medio arrastra). El Transformer de Konva no los trae, así que se
// escuchan los touch nativos del contenedor del Stage. Durante el gesto se
// cambian los atributos del nodo directamente (sin estado de React); al
// soltar, `onEnd` pasa el nodo para emitir un único cambio.
// La matemática está en gestures.ts (con tests). No comprobado en móvil real.
import type Konva from "konva";
import { useEffect, useRef } from "react";
import { clampScale } from "./geometry";
import { twoFingerTransform, type GestureNode, type TwoFingers } from "./gestures";

type Options = {
  stage: Konva.Stage | null;
  enabled: boolean;
  /** Prenda sobre la que actúa el gesto: la seleccionada o la que hay bajo los dedos. */
  pickTarget: (fingers: TwoFingers) => string | null;
  getNode: (garmentId: string) => Konva.Image | null;
  /** Escala del item (modelo) al empezar, para limitar la escala final. */
  getItemScale: (garmentId: string) => number;
  onStart: (garmentId: string) => void;
  onEnd: (garmentId: string, node: Konva.Image) => void;
};

type Active = {
  id: string;
  node: Konva.Image;
  start: TwoFingers;
  startNode: GestureNode;
  itemScale: number;
  wasDraggable: boolean;
};

function fingers(e: TouchEvent, el: HTMLElement): TwoFingers {
  const r = el.getBoundingClientRect();
  const p = (t: Touch) => ({ x: t.clientX - r.left, y: t.clientY - r.top });
  return { a: p(e.touches[0]), b: p(e.touches[1]) };
}

export function useTouchGestures(options: Options) {
  // Las callbacks cambian en cada render; los listeners leen siempre las últimas.
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  const { stage, enabled } = options;

  useEffect(() => {
    if (!stage || !enabled) return;
    const el = stage.container();
    let active: Active | null = null;

    const finish = () => {
      if (!active) return;
      const a = active;
      active = null;
      a.node.draggable(a.wasDraggable);
      opts.current.onEnd(a.id, a.node);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2 || active) return;
      const f = fingers(e, el);
      const id = opts.current.pickTarget(f);
      const node = id ? opts.current.getNode(id) : null;
      if (!id || !node) return;
      e.preventDefault();
      // onStart va antes de cortar el arrastre del primer dedo: así su
      // dragend sabe que hay un gesto en marcha y no emite cambio.
      opts.current.onStart(id);
      const wasDraggable = node.draggable();
      if (node.isDragging()) node.stopDrag();
      node.draggable(false);
      active = {
        id,
        node,
        start: f,
        startNode: { x: node.x(), y: node.y(), rotation: node.rotation(), scale: node.scaleX() },
        itemScale: opts.current.getItemScale(id),
        wasDraggable,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length < 2) return;
      e.preventDefault();
      const a = active;
      // La escala del nodo es relativa a la del item: se limita en unidades del modelo.
      const next = twoFingerTransform(
        a.start,
        fingers(e, el),
        a.startNode,
        (s) => clampScale(s * a.itemScale) / a.itemScale,
      );
      a.node.position({ x: next.x, y: next.y });
      a.node.rotation(next.rotation);
      a.node.scale({ x: next.scale, y: next.scale });
      a.node.getLayer()?.batchDraw();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (active && e.touches.length < 2) finish();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      // Al desmontar no se emite nada: solo se deja el nodo como estaba.
      if (active) active.node.draggable(active.wasDraggable);
      active = null;
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [stage, enabled]);
}
