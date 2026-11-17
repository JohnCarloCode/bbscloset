// Historial de deshacer / rehacer del lienzo (paso 4.6; spec 3.3). Solo
// funciones puras sobre { past, present, future }: el store las usa con el
// estado del lienzo, pero no dependen de él.
//
// - `push`: una acción discreta (poner, quitar, sustituir, aleatorio, fin de
//   un gesto, orden, candado). Guarda el presente en `past` y vacía `future`.
// - `replacePresent`: cambia el presente sin crear un paso (recolocación por
//   tamaño o aspecto, restaurar el borrador).
// - El historial es solo de la sesión: no se guarda en ningún sitio.

export type History<T> = { past: T[]; present: T; future: T[] };

/** Pasos que se guardan como máximo en cada sentido. */
export const HISTORY_LIMIT = 50;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function canUndo<T>(h: History<T>): boolean {
  return h.past.length > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.future.length > 0;
}

/** Nuevo paso: el presente pasa a `past` y `future` se vacía. Sin cambio, no hace nada. */
export function push<T>(h: History<T>, next: T, limit = HISTORY_LIMIT): History<T> {
  if (Object.is(next, h.present)) return h;
  return { past: [...h.past, h.present].slice(-limit), present: next, future: [] };
}

/** Vuelve al estado anterior; el presente pasa a `future`. */
export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

/** Rehace el último paso deshecho; el presente vuelve a `past`. */
export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** Sustituye el presente sin crear un paso (no toca past ni future). */
export function replacePresent<T>(h: History<T>, present: T): History<T> {
  return Object.is(present, h.present) ? h : { ...h, present };
}

/**
 * Aplica `fn` a todos los estados (p. ej. quitar prendas que ya no existen,
 * para que deshacer no las vuelva a traer). Los pasos que quedan iguales que
 * su vecino se funden, para que deshacer siempre cambie algo.
 */
export function mapHistory<T>(
  h: History<T>,
  fn: (state: T) => T,
  equals: (a: T, b: T) => boolean = Object.is,
): History<T> {
  const present = fn(h.present);
  const dedupe = (states: T[], anchor: T, fromEnd: boolean) => {
    const out: T[] = [];
    let last = anchor;
    const ordered = fromEnd ? [...states].reverse() : states;
    for (const s of ordered.map(fn)) {
      if (equals(s, last)) continue;
      out.push(s);
      last = s;
    }
    return fromEnd ? out.reverse() : out;
  };
  return {
    past: dedupe(h.past, present, true),
    present,
    future: dedupe(h.future, present, false),
  };
}
