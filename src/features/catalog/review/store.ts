// Estado de la hoja "Por revisar" (screens.md 4.4): abierta o no, la pasada
// en curso y el borrador del formulario de la foto actual. Global para que la
// abran la franja del catálogo y el aviso de la subida masiva ("Revisar").
import { create } from "zustand";
import { useQueueStore } from "@/features/queue/store";
import { emptyGarmentForm, type GarmentFormValues } from "../form/logic";
import { startSession, type ReviewSession } from "./logic";

export type ReviewState = {
  session: ReviewSession | null;
  draft: GarmentFormValues;
  /** Abre la hoja con lo que haya por revisar (no hace nada si no hay). */
  open: () => void;
  /** Cierra la hoja; devuelve la pasada que acaba (para el aviso final). */
  close: () => ReviewSession | null;
  /** Nueva posición de la pasada; el borrador empieza de cero con cada foto. */
  setSession: (session: ReviewSession) => void;
  setDraft: (draft: GarmentFormValues) => void;
};

export const useReview = create<ReviewState>()((set, get) => ({
  session: null,
  draft: emptyGarmentForm(),

  open() {
    if (get().session) return;
    const session = startSession(useQueueStore.getState().items);
    if (session) set({ session, draft: emptyGarmentForm() });
  },

  close() {
    const { session } = get();
    set({ session: null, draft: emptyGarmentForm() });
    return session;
  },

  setSession(session) {
    const changed = session.index !== get().session?.index;
    set(changed ? { session, draft: emptyGarmentForm() } : { session });
  },

  setDraft: (draft) => set({ draft }),
}));
