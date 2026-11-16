// notice-inline (DESIGN.md): aviso no bloqueante dentro de un formulario.
// Borde negro de 1 px, rounded-md, icono de aviso negro, texto de 14 px, sin rellenos de color.
import type { ReactNode } from "react";
import { cx } from "./cx";
import { WarningIcon } from "./icons";

export type NoticeInlineProps = {
  children: ReactNode;
  /** "status" si aparece de forma dinámica y debe anunciarse. */
  role?: "status" | "note";
  id?: string;
  className?: string;
};

export function NoticeInline({ children, role = "note", id, className }: NoticeInlineProps) {
  return (
    <div
      id={id}
      role={role}
      className={cx(
        "flex items-start gap-[10px] rounded-md border border-ink px-[14px] py-sm text-ink",
        className,
      )}
    >
      <WarningIcon className="mt-px shrink-0" />
      <div className="text-caption">{children}</div>
    </div>
  );
}
