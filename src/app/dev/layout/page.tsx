"use client";

// Página temporal para afinar la colocación automática (plan 4.2): pinta las
// 20 combinaciones de huecos más típicas con rectángulos del aspecto real de
// cada prenda, en tres tamaños de lienzo. Se borra en el paso 7.5; como
// /dev/tokens, puede llevar literales.
import { useTranslations } from "next-intl";
import type { SlotId } from "@/lib/domain/slots";
import { autoLayout, type CanvasSize, type LayoutInput } from "@/lib/layout/autoLayout";

// Aspectos realistas (ancho/alto del recorte).
const ASPECT: Record<SlotId, number> = {
  base_layer: 1.1,
  mid_layer: 0.95,
  outer_layer: 0.75,
  bottom: 0.45,
  full_body: 0.5,
  footwear: 1.6,
  bag: 1,
  jewelry: 1,
  accessories: 1.3,
};

const COLOR: Record<SlotId, string> = {
  base_layer: "#f3c6c6",
  mid_layer: "#e7b07a",
  outer_layer: "#8aa6c8",
  bottom: "#5f7799",
  full_body: "#c9a0dc",
  footwear: "#3a3a3c",
  bag: "#c79a5b",
  jewelry: "#d4af55",
  accessories: "#7fb59a",
};

type Combo = { name: string; slots: SlotId[]; jewels?: number };

const COMBOS: Combo[] = [
  { name: "base + inferior + calzado", slots: ["base_layer", "bottom", "footwear"] },
  { name: "+ exterior", slots: ["outer_layer", "base_layer", "bottom", "footwear"] },
  { name: "+ bolso", slots: ["base_layer", "bottom", "footwear", "bag"] },
  {
    name: "media + base + inferior + calzado",
    slots: ["mid_layer", "base_layer", "bottom", "footwear"],
  },
  {
    name: "3 capas + inferior + calzado",
    slots: ["outer_layer", "mid_layer", "base_layer", "bottom", "footwear"],
  },
  { name: "vestido + calzado", slots: ["full_body", "footwear"] },
  { name: "vestido + calzado + bolso", slots: ["full_body", "footwear", "bag"] },
  {
    name: "vestido + exterior + calzado + bolso",
    slots: ["outer_layer", "full_body", "footwear", "bag"],
  },
  { name: "vestido + calzado + 2 joyas", slots: ["full_body", "footwear"], jewels: 2 },
  {
    name: "todos (sin vestido) + 3 joyas",
    slots: ["outer_layer", "mid_layer", "base_layer", "bottom", "footwear", "bag", "accessories"],
    jewels: 3,
  },
  {
    name: "todos con vestido + 3 joyas",
    slots: ["outer_layer", "mid_layer", "full_body", "footwear", "bag", "accessories"],
    jewels: 3,
  },
  {
    name: "base + inferior + calzado + 3 joyas",
    slots: ["base_layer", "bottom", "footwear"],
    jewels: 3,
  },
  { name: "base + inferior + accesorio", slots: ["base_layer", "bottom", "accessories"] },
  { name: "base + inferior", slots: ["base_layer", "bottom"] },
  { name: "base + calzado (sin inferior)", slots: ["base_layer", "footwear"] },
  { name: "inferior + calzado + bolso", slots: ["bottom", "footwear", "bag"] },
  { name: "solo 3 joyas", slots: [], jewels: 3 },
  { name: "solo accesorios", slots: ["accessories"] },
  { name: "solo calzado", slots: ["footwear"] },
  { name: "bolso + accesorio + 10 joyas", slots: ["bag", "accessories"], jewels: 10 },
];

const CANVASES: { name: string; size: CanvasSize }[] = [
  { name: "móvil 402×560", size: { width: 402, height: 560 } },
  { name: "escritorio 900×640", size: { width: 900, height: 640 } },
  { name: "pantalla partida 402×260", size: { width: 402, height: 260 } },
];

function inputs(combo: Combo): LayoutInput[] {
  const items: LayoutInput[] = combo.slots.map((slotId, k) => ({
    garmentId: slotId,
    slotId,
    aspect: ASPECT[slotId],
    placedAt: k,
  }));
  for (let k = 0; k < (combo.jewels ?? 0); k++) {
    items.push({ garmentId: `jewelry-${k}`, slotId: "jewelry", aspect: 1, placedAt: 100 + k });
  }
  return items;
}

function Canvas({ combo, size }: { combo: Combo; size: CanvasSize }) {
  const t = useTranslations("slots");
  const items = inputs(combo);
  const res = autoLayout(items, size);
  const short = Math.min(size.width, size.height);
  const drawn = res
    .map((r, k) => ({ r, item: items[k] }))
    .sort((a, b) => a.r.z - b.r.z || a.item.placedAt - b.item.placedAt);
  return (
    <div
      className="relative shrink-0 overflow-hidden border border-hairline bg-canvas"
      style={{ width: size.width, height: size.height }}
    >
      {drawn.map(({ r, item }) => {
        const long = r.scale * short;
        const w = item.aspect >= 1 ? long : long * item.aspect;
        const h = item.aspect >= 1 ? long / item.aspect : long;
        return (
          <div
            key={item.garmentId}
            className="absolute flex items-center justify-center overflow-hidden rounded-sm text-[10px] leading-tight text-white"
            style={{
              left: r.x * size.width - w / 2,
              top: r.y * size.height - h / 2,
              width: w,
              height: h,
              background: COLOR[item.slotId],
              opacity: 0.88,
              outline: "1px solid rgba(0,0,0,0.25)",
              textShadow: "0 0 2px rgba(0,0,0,0.6)",
            }}
          >
            <span className="px-0.5 text-center">
              {t(item.slotId)} · z{r.z}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function DevLayoutPage() {
  return (
    <main className="p-lg">
      <h1 className="mb-md text-xl font-semibold">Colocación automática (4.2)</h1>
      <p className="mb-lg text-sm text-ink-muted-48">
        Rectángulos con el aspecto real de cada hueco. Combinaciones × lienzos.
      </p>
      <div className="flex flex-col gap-xl">
        {COMBOS.map((combo, k) => (
          <section key={combo.name} data-combo={k}>
            <h2 className="mb-sm text-sm font-semibold">
              {k + 1}. {combo.name}
            </h2>
            <div className="flex flex-wrap items-start gap-md">
              {CANVASES.map((c) => (
                <figure key={c.name} className="flex flex-col gap-xs">
                  <Canvas combo={combo} size={c.size} />
                  <figcaption className="text-xs text-ink-muted-48">{c.name}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
