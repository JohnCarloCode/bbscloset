"use client";

// Diálogo de confirmación (screens.md › Reglas comunes: toda acción
// destructiva pide confirmación). La acción destructiva va en píldora negra;
// el foco empieza en "Cancelar" para que Intro no borre nada por accidente.
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { cx } from "./cx";
import { useIsClient, useModal } from "./useModal";

export type DialogProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Acción destructiva (borrar, archivar…): botón negro. Si no, rosa. */
  destructive?: boolean;
  /** Deshabilita la confirmación (p. ej. mientras se procesa). */
  confirmDisabled?: boolean;
};

export function Dialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  confirmDisabled = false,
}: DialogProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useModal(open, panelRef, onCancel);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-black/32 p-lg motion-safe:animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          "flex w-full max-w-[320px] flex-col gap-xs rounded-lg bg-canvas px-[20px] pt-lg pb-md",
          "text-center focus:outline-none motion-safe:animate-pop-in",
        )}
      >
        <h2 id={titleId} className="font-sans text-body-strong">
          {title}
        </h2>
        {description && (
          <p id={descId} className="text-caption text-pretty text-ink-muted-80">
            {description}
          </p>
        )}
        <div className="mt-sm flex flex-col gap-xs">
          <Button
            variant={destructive ? "destructive" : "primary"}
            fullWidth
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="min-h-11 w-full cursor-pointer rounded-pill text-body text-ink"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
