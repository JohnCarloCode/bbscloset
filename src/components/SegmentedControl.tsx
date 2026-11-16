"use client";

// segmented-control (DESIGN.md): pista gris en píldora con 3 px de relleno.
// - `emphasis`: segmento activo rosa y peso 600 (elecciones que importan, p. ej. modo de recorte).
// - `neutral`: segmento activo blanco (cambios de vista: En rotación / Archivadas, idioma).
// Accesible como radiogroup: un solo tabulador, flechas para moverse.
import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type SegmentedOption<V extends string> = { value: V; label: string; disabled?: boolean };

export type SegmentedControlProps<V extends string> = {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (value: V) => void;
  variant?: "emphasis" | "neutral";
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  variant = "neutral",
  disabled = false,
  className,
  ...aria
}: SegmentedControlProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((o) => !o.disabled && !disabled);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key) || enabled.length === 0) return;
    e.preventDefault();
    const current = enabled.findIndex((o) => o.value === value);
    let next = current;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    else {
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
      next = (current + step + enabled.length) % enabled.length;
    }
    const target = enabled[next];
    onChange(target.value);
    refs.current[options.indexOf(target)]?.focus();
  };

  // Si el valor no coincide con ninguna opción, el primer segmento recibe el tabulador.
  const tabStop = options.some((o) => o.value === value) ? value : enabled[0]?.value;

  return (
    <div
      role="radiogroup"
      aria-disabled={disabled || undefined}
      className={cx("flex rounded-pill bg-segmented-track p-[3px]", className)}
      {...aria}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        const isDisabled = disabled || o.disabled;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={isDisabled}
            tabIndex={o.value === tabStop ? 0 : -1}
            onClick={() => !checked && onChange(o.value)}
            onKeyDown={onKeyDown}
            className={cx(
              // 38 px + 3 px de pista arriba y abajo = 44 px de objetivo táctil.
              "relative h-[38px] min-w-0 flex-1 cursor-pointer rounded-pill px-sm text-caption text-ink",
              "after:absolute after:inset-x-0 after:-inset-y-[3px] after:content-['']",
              "disabled:cursor-not-allowed disabled:opacity-40",
              checked && variant === "emphasis" && "bg-primary font-semibold",
              checked && variant === "neutral" && "bg-canvas",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
