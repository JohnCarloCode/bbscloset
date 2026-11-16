// Estado vacío: ilustración + título + texto + botón (como "Tu armario está vacío"
// del prototipo). Los textos y el botón llegan por props.
import type { ReactNode } from "react";
import { cx } from "./cx";

export type EmptyStateProps = {
  /** Ilustración; si falta, un recuadro neutro de 180 px. */
  illustration?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Normalmente un <Button variant="primary">. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx("flex flex-col items-center gap-[20px] px-xs py-[56px] text-center", className)}
    >
      {illustration ?? (
        <div aria-hidden="true" className="size-[180px] rounded-lg bg-canvas-parchment" />
      )}
      <div className="flex max-w-[300px] flex-col gap-xs">
        <h2 className="text-tagline">{title}</h2>
        {description && <p className="text-body text-ink-muted-80">{description}</p>}
      </div>
      {action}
    </div>
  );
}
