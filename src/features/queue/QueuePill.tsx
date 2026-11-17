"use client";

// queue-pill (DESIGN.md, screens.md 6): "Recortando 2 de 5" con anillo de
// progreso del recorte en marcha. Solo cuenta prendas (no el recorte en lote)
// y solo se ve mientras queda alguna en cola. Tocarla abre la hoja de la cola.
// Mientras se ve, sube los toasts con --toast-raise (en escritorio el toast no
// lo usa: la píldora va en la barra lateral).
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { pillState } from "./logic";
import { useQueueStore } from "./store";

/** Alto de la píldora (40) + separación (12). */
const TOAST_RAISE = "52px";

export function QueuePill() {
  const t = useTranslations("queue");
  const items = useQueueStore((s) => s.items);
  const openSheet = useQueueStore((s) => s.openSheet);
  const pill = useMemo(() => pillState(items), [items]);

  useEffect(() => {
    if (!pill.visible) return;
    const root = document.documentElement;
    root.style.setProperty("--toast-raise", TOAST_RAISE);
    return () => {
      root.style.removeProperty("--toast-raise");
    };
  }, [pill.visible]);

  // Región viva fija (aunque la píldora no se vea): anuncia solo el "N de M",
  // no cada tick del anillo de progreso.
  const status = (
    <span role="status" className="sr-only">
      {pill.visible ? t("pill", { current: pill.current, total: pill.total }) : ""}
    </span>
  );
  if (!pill.visible) return status;

  const pct = Math.round(pill.progress * 100);
  return (
    <>
      {status}
      <button
        type="button"
        data-queue-pill=""
        onClick={openSheet}
        aria-haspopup="dialog"
        className={
          "flex h-10 cursor-pointer items-center gap-xs rounded-pill border border-ink bg-primary " +
          "pr-md pl-[10px] text-caption text-on-primary " +
          // 40 px visibles; el ::after amplía la zona táctil a 44 px.
          "relative after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-['']"
        }
      >
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--color-ink) ${pct}%, rgba(0,0,0,0.15) 0)`,
          }}
        >
          <span className="size-3.5 rounded-full bg-primary" />
        </span>
        <span>{t("pill", { current: pill.current, total: pill.total })}</span>
      </button>
    </>
  );
}
