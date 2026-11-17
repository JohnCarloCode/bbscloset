"use client";

// Selector de categoría del panel inferior (screens.md 7.3; prototipo):
// píldora "Capa base 12 ▾" que abre una lista con todas las categorías y su
// número de prendas en uso; la activa con fondo rosa. La lista se abre hacia
// arriba en los estados cerrado y medio (el panel está abajo) y hacia abajo
// en el extendido. Teclado: flechas, Inicio/Fin, Intro para elegir y Escape
// para cerrar; tocar fuera también la cierra.
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import { ChevronDownIcon } from "@/components/icons";
import { SLOT_IDS, type SlotId } from "@/lib/domain/slots";

export type CategoryPickerProps = {
  value: SlotId;
  counts: Record<SlotId, number> | null;
  onChange: (slot: SlotId) => void;
  /** Dirección en la que se abre la lista. */
  placement: "up" | "down";
};

export function CategoryPicker({ value, counts, onChange, placement }: CategoryPickerProps) {
  const t = useTranslations("dresser.panel");
  const tSlots = useTranslations("slots");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SlotId>(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const count = (slot: SlotId) => counts?.[slot] ?? 0;

  // Tocar fuera cierra la lista.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  const openList = () => {
    setActive(value);
    setOpen(true);
  };

  const choose = (slot: SlotId) => {
    setOpen(false);
    onChange(slot);
    buttonRef.current?.focus({ preventScroll: true });
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const i = SLOT_IDS.indexOf(active);
    const go = (k: number) => setActive(SLOT_IDS[(k + SLOT_IDS.length) % SLOT_IDS.length]);
    switch (e.key) {
      case "ArrowDown":
        go(i + 1);
        break;
      case "ArrowUp":
        go(i - 1);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(SLOT_IDS.length - 1);
        break;
      case "Enter":
      case " ":
        choose(active);
        break;
      case "Escape":
      case "Tab":
        setOpen(false);
        if (e.key === "Escape") buttonRef.current?.focus({ preventScroll: true });
        if (e.key === "Tab") return;
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t("category", { label: tSlots(value), count: count(value) })}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openList();
          }
        }}
        className={cx(
          "relative flex h-9 max-w-full cursor-pointer items-center gap-xs rounded-pill border border-hairline bg-canvas pr-sm pl-[16px]",
          // Zona táctil de 44 px.
          "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        )}
      >
        <span className="truncate text-[15px] leading-none font-semibold tracking-[-0.224px]">
          {tSlots(value)}
        </span>
        <span className="text-caption text-ink-muted-48">{count(value)}</span>
        <ChevronDownIcon className={cx("shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={t("categories")}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className={cx(
            "absolute left-0 z-30 max-h-[min(410px,55dvh)] w-[248px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-lg border border-hairline bg-canvas p-[6px] outline-none",
            placement === "up" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
          )}
        >
          {SLOT_IDS.map((slot) => (
            <li
              key={slot}
              id={`${listId}-${slot}`}
              role="option"
              aria-selected={slot === value}
              aria-label={t("categoryOption", { label: tSlots(slot), count: count(slot) })}
              onClick={() => choose(slot)}
              onPointerMove={() => setActive(slot)}
              className={cx(
                "flex h-11 cursor-pointer items-center justify-between rounded-md px-sm text-[15px]",
                slot === value ? "bg-primary text-ink" : "text-ink",
                slot === active && slot !== value && "bg-canvas-parchment",
              )}
            >
              <span>{tSlots(slot)}</span>
              <span className="text-caption text-ink-muted-48">{count(slot)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
