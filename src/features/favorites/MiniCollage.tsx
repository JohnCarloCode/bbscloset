"use client";

// Mini collage de una tarjeta de favorito (paso 5.3; decisión 8): las
// miniaturas colocadas con CSS (posición en %, `transform` para centrar y
// girar, `z-index` por orden de pintado), sin Konva. La composición sale de
// miniCollageLayout.ts (posiciones guardadas + autoLayout para las automáticas) en
// un lienzo de proporción fija 4:5 (MINI_COLLAGE_RATIO, ver allí por qué).
// El aspecto de cada miniatura se lee al cargarla (naturalWidth/Height);
// hasta entonces vale 1, y al llegar se recompone el collage.
import { memo, useCallback, useMemo, useState } from "react";
import { composeMiniCollage, MINI_COLLAGE_RATIO, pieceBox } from "./miniCollageLayout";
import type { FavoriteSummaryItem } from "@/lib/api/types";

export type MiniCollageProps = {
  items: readonly FavoriteSummaryItem[];
};

export const MiniCollage = memo(function MiniCollage({ items }: MiniCollageProps) {
  const [aspects, setAspects] = useState<Record<string, number>>({});
  // URLs que no cargan (p. ej. firmadas y caducadas): se dejan sin pintar.
  const [failed, setFailed] = useState<Record<string, string>>({});

  const pieces = useMemo(() => composeMiniCollage(items, aspects), [items, aspects]);
  const urlOf = useMemo(() => new Map(items.map((i) => [i.garment_id, i.thumbUrl])), [items]);

  const onLoad = useCallback((id: string, img: HTMLImageElement) => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const real = img.naturalWidth / img.naturalHeight;
    setAspects((a) => (a[id] === real ? a : { ...a, [id]: real }));
  }, []);

  return (
    <span
      aria-hidden="true"
      className="relative block w-full overflow-hidden bg-canvas-parchment"
      style={{ aspectRatio: MINI_COLLAGE_RATIO }}
    >
      {pieces.map((p, index) => {
        const url = urlOf.get(p.garmentId);
        if (!url || failed[p.garmentId] === url) return null;
        const box = pieceBox(p);
        const known = p.garmentId in aspects;
        return (
          // Miniatura WebP ya reducida (≤ 320 px) con URL firmada: sin next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.garmentId}
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={(e) => onLoad(p.garmentId, e.currentTarget)}
            onError={() => setFailed((f) => ({ ...f, [p.garmentId]: url }))}
            className="pointer-events-none absolute h-auto max-w-none select-none"
            style={{
              left: `${box.left}%`,
              top: `${box.top}%`,
              width: `${box.width}%`,
              zIndex: index,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
              // Hasta saber el aspecto no se ve (evita un salto al recolocar).
              opacity: known ? 1 : 0,
            }}
          />
        );
      })}
    </span>
  );
});
