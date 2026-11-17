"use client";

// Panel inferior del vestidor en móvil y tablet (`bottom-drawer` y
// `split-view` de DESIGN.md; screens.md 7.3). Tres alturas:
// - cerrado: barrita + selector de categoría + "Ver prendas";
// - medio (por defecto): una fila de 4 prendas + "Ver todo (N)";
// - extendido: pantalla partida, el panel ocupa ~58 % de la columna y la
//   cuadrícula tiene scroll vertical (y pide más páginas al bajar).
// La barrita es un botón de 24 px de alto a todo el ancho: tocarla (o Intro/
// Espacio) sube un nivel, o baja desde extendido; flechas arriba/abajo
// también; arrastrarla más de 24 px sube o baja un nivel. Tocar una prenda
// nunca cambia la altura. Nunca hay scroll horizontal.
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import type { SlotId } from "@/lib/domain/slots";
import { useDresserStore, type KnownGarment } from "../store";
import { CategoryPicker } from "./CategoryPicker";
import { PanelGrid } from "./PanelGrid";

/** Distancia mínima de arrastre de la barrita para cambiar de nivel (px). */
export const DRAG_THRESHOLD = 24;
/** Prendas visibles en el estado medio (una fila de 4). */
const HALF_ROW = 4;

export type BottomDrawerProps = {
  onTap: (g: KnownGarment) => void;
  className?: string;
};

export function BottomDrawer({ onTap, className }: BottomDrawerProps) {
  const t = useTranslations("dresser.panel");
  const drawer = useDresserStore((s) => s.drawer);
  const stepDrawer = useDresserStore((s) => s.stepDrawer);
  const setDrawer = useDresserStore((s) => s.setDrawer);
  const slot = useDresserStore((s) => s.activeSlot);
  const setActiveSlot = useDresserStore((s) => s.setActiveSlot);
  const counts = useDresserStore((s) => s.counts);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const gridId = "dresser-drawer-grid";

  const expanded = drawer === "expanded";
  const count = counts?.[slot] ?? 0;

  // Al cambiar de categoría, la cuadrícula vuelve arriba.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [slot]);

  const handleLabel =
    drawer === "closed" ? t("handleShow") : expanded ? t("handleCollapse") : t("handleExpand");
  const actionLabel =
    drawer === "closed"
      ? t("showGarments")
      : expanded
        ? t("showLess")
        : count > HALF_ROW
          ? t("seeAllCount", { count })
          : t("seeAll");

  const onPickSlot = (s: SlotId) => {
    setActiveSlot(s);
    if (drawer === "closed") setDrawer("half");
  };

  return (
    <section
      className={cx(
        "relative flex min-h-0 flex-col border-t border-hairline bg-canvas",
        // Pantalla partida: el panel ocupa ~58 % y el lienzo se encoge encima.
        expanded ? "mt-sm flex-[0_0_58%]" : "flex-none",
        "[interpolate-size:allow-keywords] motion-safe:transition-[flex-basis] motion-safe:duration-200 motion-safe:ease-out",
        className,
      )}
    >
      <button
        type="button"
        aria-label={handleLabel}
        aria-expanded={drawer !== "closed"}
        aria-controls={drawer !== "closed" ? gridId : undefined}
        onPointerDown={(e) => {
          dragged.current = false;
          dragStart.current = e.clientY;
          // Para recibir el pointerup aunque el dedo salga de la barrita.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Puntero ya inactivo: sin captura, el pointerup puede no llegar.
          }
        }}
        onPointerUp={(e) => {
          const start = dragStart.current;
          dragStart.current = null;
          if (start === null) return;
          const dy = e.clientY - start;
          if (Math.abs(dy) < DRAG_THRESHOLD) return;
          dragged.current = true;
          stepDrawer(dy < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
        onClick={() => {
          // El click que sigue a un arrastre ya ha cambiado de nivel.
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          stepDrawer(expanded ? -1 : 1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            stepDrawer(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
        className="block h-6 w-full shrink-0 cursor-grab touch-none"
      >
        <span
          aria-hidden="true"
          className="mx-auto mt-[9px] block h-[5px] w-9 rounded-pill bg-ink-muted-48"
        />
      </button>

      <div className="flex shrink-0 items-center justify-between gap-sm px-4 pb-[10px]">
        <CategoryPicker
          value={slot}
          counts={counts}
          onChange={onPickSlot}
          placement={expanded ? "down" : "up"}
        />
        <button
          type="button"
          onClick={() => setDrawer(drawer === "half" ? "expanded" : "half")}
          className="shrink-0 cursor-pointer py-xs text-caption whitespace-nowrap text-ink underline underline-offset-2"
        >
          {actionLabel}
        </button>
      </div>

      {drawer !== "closed" && (
        <div
          id={gridId}
          ref={scrollRef}
          className={cx(
            "px-4",
            expanded
              ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-5"
              : "pb-[14px]",
          )}
        >
          <PanelGrid
            slot={slot}
            columns={4}
            limit={expanded ? undefined : HALF_ROW}
            paginate={expanded}
            scrollRoot={scrollRef}
            onTap={onTap}
          />
        </div>
      )}
    </section>
  );
}
