"use client";

// Hoja modal. Móvil: hoja inferior (o pantalla completa con `fullScreen`).
// Tablet y escritorio: centrada, 520 px de ancho máximo (como el prototipo).
// Cierre accesible: botón, Escape y toque en el fondo; foco atrapado y devuelto al cerrar.
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { cx } from "./cx";
import { CloseIcon } from "./icons";
import { useIsClient, useModal } from "./useModal";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** aria-label del botón de cerrar (p. ej. "Cerrar"). */
  closeLabel: string;
  /** Solo móvil: ocupa toda la pantalla (Añadir prenda, Por revisar). */
  fullScreen?: boolean;
  /** Pie fijo (botón principal, etc.). */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  fullScreen = false,
  footer,
  children,
  className,
}: SheetProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(open, panelRef, onClose);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className={cx(
        "fixed inset-0 z-50 flex items-end justify-center bg-surface-black/32",
        "motion-safe:animate-fade-in tablet:items-center tablet:p-lg",
      )}
      onMouseDown={(e) => {
        // Solo el fondo, no los clics que empiezan dentro de la hoja.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          "flex w-full flex-col overflow-hidden bg-canvas focus:outline-none",
          "motion-safe:animate-sheet-up tablet:motion-safe:animate-pop-in",
          "tablet:max-h-[92dvh] tablet:max-w-[520px] tablet:rounded-lg",
          fullScreen ? "h-dvh max-h-dvh tablet:h-auto" : "max-h-[92dvh] rounded-t-lg",
          className,
        )}
      >
        <div
          className={cx(
            "flex h-14 shrink-0 items-center justify-between gap-sm pr-sm pl-[20px]",
            // A pantalla completa respeta la muesca del móvil.
            fullScreen && "box-content pt-[env(safe-area-inset-top)] tablet:pt-0",
          )}
        >
          <h2 id={titleId} className="min-w-0 truncate text-tagline">
            {title}
          </h2>
          <Button
            variant="icon-circular"
            iconSurface="plain"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <CloseIcon />
          </Button>
        </div>
        <div
          className={cx(
            "min-h-0 flex-1 overflow-y-auto px-[20px]",
            footer ? "pb-md" : "pb-[calc(24px+env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-[20px] pt-xs pb-[calc(16px+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
