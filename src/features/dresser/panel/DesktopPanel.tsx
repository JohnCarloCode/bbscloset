"use client";

// Panel fijo del vestidor en escritorio (≥ 1024 px; screens.md 7.4):
// columna de 340 px a la derecha con "Tu armario", chips de categoría con su
// número (en varias filas, sin scroll horizontal) y cuadrícula de 3 columnas
// con scroll vertical y paginación al bajar.
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/Chip";
import { cx } from "@/components/cx";
import { SLOT_IDS } from "@/lib/domain/slots";
import { useDresserStore, type KnownGarment } from "../store";
import { PanelGrid } from "./PanelGrid";

export type DesktopPanelProps = {
  onTap: (g: KnownGarment) => void;
  className?: string;
};

export function DesktopPanel({ onTap, className }: DesktopPanelProps) {
  const t = useTranslations("dresser.panel");
  const tSlots = useTranslations("slots");
  const slot = useDresserStore((s) => s.activeSlot);
  const setActiveSlot = useDresserStore((s) => s.setActiveSlot);
  const counts = useDresserStore((s) => s.counts);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [slot]);

  return (
    <aside
      aria-labelledby="dresser-desktop-panel-title"
      className={cx("min-h-0 w-[340px] shrink-0 flex-col border-l border-hairline", className)}
    >
      <div className="flex flex-col gap-sm px-5 pt-4 pb-sm">
        <h2 id="dresser-desktop-panel-title" className="text-body-strong">
          {t("title")}
        </h2>
        <div role="group" aria-label={t("categories")} className="flex flex-wrap gap-[6px]">
          {SLOT_IDS.map((s) => (
            <Chip
              key={s}
              selected={s === slot}
              onClick={() => setActiveSlot(s)}
              aria-label={t("categoryOption", { label: tSlots(s), count: counts?.[s] ?? 0 })}
              className="whitespace-nowrap"
            >
              <span>{tSlots(s)}</span>
              {counts && <span className="text-ink-muted-48">{counts[s]}</span>}
            </Chip>
          ))}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-5"
      >
        <PanelGrid slot={slot} columns={3} paginate scrollRoot={scrollRef} onTap={onTap} />
      </div>
    </aside>
  );
}
