"use client";

// Proveedor global de toasts con cola y hook useToast().
// toast (DESIGN.md): píldora negra, texto blanco de 14 px, rounded-lg, 3,5 s,
// acción opcional en rosa. Se sitúa sobre la barra de pestañas y sube cuando
// hay queue-pill: con el prop `raise` o con la variable CSS `--toast-raise`
// (p. ej. document.documentElement.style.setProperty("--toast-raise", "52px")).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx";
import { KEEP_INTERACTIVE_ATTR, useIsClient } from "../useModal";
import { initialToastState, toastReducer, type ToastOptions } from "./queue";

type ToastContextValue = {
  /** Encola un toast y devuelve su id. */
  show: (toast: ToastOptions) => number;
  dismiss: (id: number) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() necesita <ToastProvider> por encima");
  return ctx;
}

export type ToastProviderProps = {
  children: ReactNode;
  /** Desplazamiento extra hacia arriba en móvil/tablet (p. ej. "52px" con queue-pill). */
  raise?: string;
};

export function ToastProvider({ children, raise }: ToastProviderProps) {
  const [state, dispatch] = useReducer(toastReducer, initialToastState);
  const isClient = useIsClient();

  const nextId = useRef(1);
  const show = useCallback((toast: ToastOptions) => {
    const id = nextId.current++;
    dispatch({ type: "push", id, toast });
    return id;
  }, []);
  const dismiss = useCallback((id: number) => dispatch({ type: "dismiss", id }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);
  const value = useMemo(() => ({ show, dismiss, clear }), [show, dismiss, clear]);

  const current = state.items[0];

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isClient &&
        createPortal(
          <div
            {...{ [KEEP_INTERACTIVE_ATTR]: "" }}
            aria-live="polite"
            aria-atomic="true"
            style={raise ? ({ "--toast-raise": raise } as CSSProperties) : undefined}
            className={cx(
              "pointer-events-none fixed inset-x-md z-[70] flex justify-center",
              // 20 px sobre la barra de pestañas (--tab-bar-h, globals.css) o sobre
              // la zona segura si no hay barra; más --toast-raise con queue-pill.
              // --selection-bar-h: barra de selección del catálogo (3.11).
              "bottom-[calc(max(var(--tab-bar-h,0px),env(safe-area-inset-bottom))+20px+var(--toast-raise,0px)+var(--selection-bar-h,0px))]",
              // En escritorio queue-pill vive en la barra lateral: sin --toast-raise.
              "desktop:bottom-[calc(var(--spacing-lg)+var(--selection-bar-h,0px))]",
            )}
          >
            {current && <Toast key={current.id} {...current} onDismiss={dismiss} />}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

type ToastViewProps = ToastOptions & {
  id: number;
  durationMs: number;
  onDismiss: (id: number) => void;
};

function Toast({ id, message, actionLabel, onAction, durationMs, onDismiss }: ToastViewProps) {
  // Se pausa mientras el puntero o el foco están dentro (da tiempo a pulsar la acción).
  const [paused, setPaused] = useState(false);
  const remaining = useRef(durationMs);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, id, onDismiss]);

  return (
    <div
      className={cx(
        "pointer-events-auto flex max-w-[420px] items-center gap-md rounded-lg bg-ink px-md py-sm",
        "text-caption text-on-dark motion-safe:animate-toast-in",
      )}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      <span>{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={() => {
            onAction?.();
            onDismiss(id);
          }}
          className={cx(
            // 44 px de alto sin engordar la píldora: invade el relleno vertical.
            "-my-sm min-h-11 min-w-11 shrink-0 cursor-pointer text-caption whitespace-nowrap text-primary-on-dark",
            // Sobre negro el contorno negro no se ve: foco en blanco.
            "focus-visible:outline-on-dark",
          )}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
