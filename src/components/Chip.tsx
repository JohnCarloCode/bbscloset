// chip-filter (DESIGN.md › bb's closet components): píldora con borde fino;
// seleccionada = fondo rosa + borde negro de 2 px.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  selected?: boolean;
};

export function Chip({ selected = false, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        // 36 px visibles; el ::after amplía la zona táctil a 44 px.
        "relative inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-pill text-caption text-ink",
        "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        "disabled:cursor-not-allowed disabled:opacity-40",
        // Al pasar de 1 a 2 px de borde se quita 1 px de relleno: no salta.
        selected
          ? "border-2 border-ink bg-primary px-[13px]"
          : "border border-hairline bg-transparent px-[14px]",
        className,
      )}
      {...props}
    />
  );
}

export type ChipOption<V extends string> = {
  value: V;
  label: string;
  disabled?: boolean;
  /** Algo decorativo delante del texto (p. ej. la muestra de un color). */
  icon?: ReactNode;
};

export type ChipGroupProps<V extends string> = {
  options: ReadonlyArray<ChipOption<V>>;
  value: ReadonlyArray<V>;
  onChange: (value: V[]) => void;
  /** Nombre accesible del grupo (p. ej. "Temporada"). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
};

/** Grupo de chips con selección múltiple. Respeta el orden de `options`. */
export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  className,
  ...aria
}: ChipGroupProps<V>) {
  const toggle = (v: V) => {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(options.map((o) => o.value).filter((x) => next.includes(x)));
  };

  return (
    <div role="group" className={cx("flex flex-wrap gap-xs", className)} {...aria}>
      {options.map((o) => (
        <Chip
          key={o.value}
          selected={value.includes(o.value)}
          disabled={o.disabled}
          onClick={() => toggle(o.value)}
        >
          {o.icon}
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
