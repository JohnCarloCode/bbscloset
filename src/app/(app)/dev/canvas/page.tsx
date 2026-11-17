"use client";

// Página temporal para probar el lienzo Konva (paso 4.3): carga una prenda
// real de cada hueco con recorte (include=cutout), las coloca con autoLayout
// y deja moverlas, redimensionarlas, girarlas, cambiar el orden, bloquear y
// quitar. Se borra en el paso 7.5; puede llevar literales.
// Para pruebas automáticas: window.__canvas (stage, items, exportar).
import type Konva from "konva";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { OutfitCanvasLazy, type CanvasGarment } from "@/features/dresser/canvas/OutfitCanvasLazy";
import { paintOrder, type CanvasItem, type CanvasState } from "@/features/dresser/model";
import { apiFetch } from "@/lib/api/client";
import type { GarmentListResponse } from "@/lib/api/types";
import { SLOT_IDS, SLOTS } from "@/lib/domain/slots";
import { autoLayout } from "@/lib/layout/autoLayout";

declare global {
  interface Window {
    __canvas?: {
      stage: Konva.Stage | null;
      items: CanvasItem[];
      exportPng: () => string;
    };
  }
}

type Size = { width: number; height: number };

/** Recoloca los items no manuales (la z del item manda si se reordenó). */
function relayout(items: CanvasItem[], aspects: Record<string, number>, size: Size): CanvasItem[] {
  if (size.width === 0) return items;
  const auto = items.filter((i) => !i.manual);
  const res = autoLayout(
    auto.map((i) => ({
      garmentId: i.garmentId,
      slotId: i.slotId,
      aspect: aspects[i.garmentId] ?? 1,
      placedAt: i.placedAt,
    })),
    size,
  );
  const byId = new Map(res.map((r) => [r.garmentId, r]));
  return items.map((i) => {
    const r = byId.get(i.garmentId);
    return r ? { ...i, x: r.x, y: r.y, scale: r.scale } : i;
  });
}

export default function DevCanvasPage() {
  const tTypes = useTranslations("types");
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [garments, setGarments] = useState<Record<string, CanvasGarment>>({});
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [editable, setEditable] = useState(true);
  const [wide, setWide] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [exported, setExported] = useState<string>("");
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  // Una prenda real por hueco (las que tenga el usuario).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: CanvasGarment[] = [];
      const its: CanvasItem[] = [];
      for (const slot of SLOT_IDS) {
        const res = await apiFetch<GarmentListResponse>(
          `/api/garments?archived=false&slot=${slot}&limit=1&include=cutout`,
        );
        const g = res.items[0];
        if (!g) continue;
        found.push({
          id: g.id,
          cutoutUrl: g.cutoutUrl ?? null,
          label: g.name ?? tTypes(g.type_id),
        });
        its.push({
          garmentId: g.id,
          slotId: slot,
          x: 0.5,
          y: 0.5,
          scale: 0.4,
          rotation: 0,
          z: SLOTS[slot].defaultZ,
          locked: false,
          manual: false,
          placedAt: its.length + 1,
        });
        if (its.length === 5) break;
      }
      if (cancelled) return;
      setGarments(Object.fromEntries(found.map((g) => [g.id, g])));
      setItems(its);
    })().catch((e) => setLog((l) => [...l, `error: ${String(e)}`]));
    return () => {
      cancelled = true;
    };
  }, [tTypes]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Colocación automática con los aspectos reales y el tamaño actual.
  const shown = useMemo(() => relayout(items, aspects, size), [items, aspects, size]);

  const exportPng = useCallback(() => {
    const url = stageRef.current?.toDataURL({ pixelRatio: 1 }) ?? "";
    setExported(url ? `OK: ${Math.round(url.length / 1024)} KB` : "sin stage");
    return url;
  }, []);

  useEffect(() => {
    window.__canvas = { stage: stageRef.current, items: shown, exportPng };
  });

  return (
    <main className="flex flex-col gap-md px-5 pt-lg pb-xl">
      <h1 className="text-lead font-semibold">Lienzo · dev</h1>
      <div className="flex flex-wrap gap-xs">
        <Button variant="secondary" onClick={() => setEditable((v) => !v)}>
          {editable ? "editable: sí" : "editable: no"}
        </Button>
        <Button variant="secondary" onClick={() => setWide((v) => !v)}>
          {wide ? "apaisado" : "vertical"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setItems((its) => its.map((i) => ({ ...i, manual: false, rotation: 0 })))}
        >
          Colocación automática
        </Button>
        <Button variant="secondary" onClick={() => exportPng()}>
          toDataURL
        </Button>
      </div>
      <div
        ref={boxRef}
        className={wide ? "h-[420px] w-full max-w-[900px]" : "h-[560px] w-full max-w-[402px]"}
      >
        <OutfitCanvasLazy
          items={shown}
          garments={garments}
          editable={editable}
          onStage={(s) => {
            stageRef.current = s;
          }}
          onSelect={setSelected}
          onAspect={(id, a) => setAspects((x) => ({ ...x, [id]: a }))}
          onChange={(next: CanvasState, change) => {
            setItems(next.items);
            setLog((l) => [...l.slice(-9), `${change.type} ${change.garmentId.slice(0, 8)}`]);
          }}
        />
      </div>
      <p className="text-caption">
        seleccionada: {selected ?? "—"} · export: {exported || "—"}
      </p>
      <pre className="overflow-x-auto text-[11px] leading-tight">
        {paintOrder({ items: shown })
          .map(
            (i) =>
              `${i.slotId.padEnd(12)} z=${i.z} x=${i.x.toFixed(3)} y=${i.y.toFixed(3)} s=${i.scale.toFixed(3)} r=${i.rotation.toFixed(1)} ${i.manual ? "manual" : ""} ${i.locked ? "locked" : ""}`,
          )
          .join("\n")}
      </pre>
      <pre className="text-[11px] leading-tight">{log.join("\n")}</pre>
    </main>
  );
}
