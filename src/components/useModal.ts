"use client";

// Comportamiento común de Sheet y Dialog: foco atrapado, Escape, bloqueo del
// scroll de fondo, resto de la página inerte y devolución del foco al cerrar.
// Admite modales apilados (un Dialog sobre un Sheet): solo responde el de arriba.
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Atributo para los nodos de <body> que no deben quedar inertes (p. ej. los toasts). */
export const KEEP_INTERACTIVE_ATTR = "data-modal-keep-interactive";

const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = "";

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0,
  );
}

const noopSubscribe = () => () => {};

/** true solo en el cliente, tras hidratar (para los portales). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useModal(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  // El portal solo existe en el cliente: el efecto se repite cuando aparece.
  const isClient = useIsClient();
  // onClose cambia en cada render del padre: se guarda en una ref.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!open || !isClient || !container) return;

    const id = Symbol("modal");
    stack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Resto de <body> inerte (lectores de pantalla y teclado).
    const portalRoot = container.closest("body > *");
    const madeInert: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el === portalRoot || el.hasAttribute("inert") || el.hasAttribute(KEEP_INTERACTIVE_ATTR))
        continue;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      el.setAttribute("inert", "");
      madeInert.push(el);
    }

    if (scrollLocks++ === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    // Foco inicial: el primer elemento con [data-autofocus] o el contenedor.
    const auto = container.querySelector<HTMLElement>("[data-autofocus]");
    (auto ?? container).focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === container || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = stack.indexOf(id);
      if (i !== -1) stack.splice(i, 1);
      for (const el of madeInert) el.removeAttribute("inert");
      if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, isClient, containerRef]);
}
