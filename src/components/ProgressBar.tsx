// progress-bar (DESIGN.md): 4 px, píldora.
// Sobre blanco: pista divider-soft y relleno rosa. Sobre foto: pista blanca al 80 % y relleno negro.
import { cx } from "./cx";

export type ProgressBarProps = {
  /** 0–100. */
  value: number;
  tone?: "light" | "photo";
  /** Nombre accesible (p. ej. "Recortando"). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Texto accesible del valor (p. ej. "2 de 5"); si no, el lector lee el %. */
  valueText?: string;
  className?: string;
};

export function ProgressBar({
  value,
  tone = "light",
  valueText,
  className,
  ...aria
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={valueText}
      className={cx(
        "h-1 w-full overflow-hidden rounded-pill",
        tone === "light" ? "bg-divider-soft" : "bg-canvas/80",
        className,
      )}
      {...aria}
    >
      <div
        className={cx(
          "h-full rounded-pill motion-safe:transition-[width] motion-safe:duration-300",
          tone === "light" ? "bg-primary" : "bg-ink",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
