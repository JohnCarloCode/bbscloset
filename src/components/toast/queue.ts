// Cola de toasts (lógica pura, sin React): se muestra uno cada vez, en orden
// de llegada. El primero de `items` es el visible.

/** Duración por defecto de un toast (screens.md › 1: 3,5 s). */
export const TOAST_DURATION_MS = 3500;

export type ToastOptions = {
  message: string;
  /** Texto de la acción opcional ("Deshacer", "Ver"…), en rosa. */
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

export type ToastItem = ToastOptions & { id: number; durationMs: number };

export type ToastState = { items: ToastItem[] };

export type ToastAction =
  | { type: "push"; id: number; toast: ToastOptions }
  | { type: "dismiss"; id: number }
  | { type: "clear" };

export const initialToastState: ToastState = { items: [] };

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "push": {
      const item: ToastItem = {
        ...action.toast,
        id: action.id,
        durationMs: action.toast.durationMs ?? TOAST_DURATION_MS,
      };
      return { items: [...state.items, item] };
    }
    case "dismiss": {
      const items = state.items.filter((t) => t.id !== action.id);
      return items.length === state.items.length ? state : { items };
    }
    case "clear":
      return state.items.length === 0 ? state : { items: [] };
  }
}
