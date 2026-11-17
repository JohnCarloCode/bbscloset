// Estado de la cola de recorte (zustand): la lista vive en memoria y se copia
// a IndexedDB en cada cambio de estado (no en cada tick de progreso). El
// runner (runner.ts) y la subida (upload.ts) la leen y la cambian con
// `patch`; la UI usa las acciones públicas.
import { create } from "zustand";
import { isImagingError } from "@/lib/imaging/errors";
import { shrink } from "@/lib/imaging/shrink";
import { validate } from "@/lib/imaging/validate";
import { deleteItem, loadItems, saveItem } from "./db";
import { finishedRound, readyAnnouncementCount, recoverInterrupted } from "./logic";
import type { EnqueueExtras, GarmentData, QueueItem, QueueKind, QueueMode } from "./types";

/** Evento de `window` cuando una prenda se sube (el catálogo refresca, paso 3.9). */
export const GARMENT_SAVED_EVENT = "bbs:garment-saved";
export type GarmentSavedDetail = { localId: string; garmentId: string; kind: QueueKind };

export type QueueState = {
  /** Usuario actual; null hasta que QueueProvider lo conoce. */
  userId: string | null;
  items: QueueItem[];
  /** Hoja de la cola abierta (la abren la píldora y las tarjetas pendientes). */
  sheetOpen: boolean;

  /** Carga los pendientes del usuario y recupera los recortes a medias. */
  init: (userId: string) => Promise<void>;
  /** Reduce la foto y la mete en la cola. Devuelve el localId. */
  enqueue: (
    kind: QueueKind,
    file: Blob,
    mode: QueueMode,
    extras?: EnqueueExtras,
  ) => Promise<string>;
  /**
   * Datos del formulario (tipo incluido): con recorte, la subida sale ya; si
   * no, el item queda pendiente y se sube al terminar. `announced`: la UI ya
   * avisó de que está lista (no entra en "N prendas listas").
   */
  setGarmentData: (localId: string, data: GarmentData, opts?: { announced?: boolean }) => void;
  remove: (localId: string) => void;
  /** Vuelve a recortar un item con error (o reintenta su subida). */
  retry: (localId: string) => void;
  /**
   * "Cambiar foto" en un item con error: nueva foto, vuelve a la cola. Si la
   * foto no vale, el item sigue en error con el motivo (not_image, too_large…).
   */
  replaceSource: (localId: string, file: Blob) => Promise<void>;
  openSheet: () => void;
  closeSheet: () => void;

  /** Interno (runner y subida): cambia campos; `persist` lo copia a IndexedDB. */
  patch: (localId: string, changes: Partial<QueueItem>, persist?: boolean) => QueueItem | undefined;
  /** Interno: subida hecha. Sale de IndexedDB y queda en memoria hasta acabar la tanda. */
  markUploaded: (localId: string) => void;
  /**
   * Interno: si la tanda acabó, quita de memoria las prendas subidas y
   * devuelve cuántas anunciar como listas (0 si nada; ver readyAnnouncementCount).
   */
  settleRound: () => number;
};

// createdAt estrictamente creciente aunque se encolen varias en el mismo ms.
let lastCreatedAt = 0;
function nextCreatedAt(): number {
  lastCreatedAt = Math.max(Date.now(), lastCreatedAt + 1);
  return lastCreatedAt;
}

export const useQueueStore = create<QueueState>()((set, get) => {
  const find = (localId: string) => get().items.find((i) => i.localId === localId);

  const patch: QueueState["patch"] = (localId, changes, persist = true) => {
    const current = find(localId);
    if (!current) return undefined;
    const next = { ...current, ...changes };
    set((s) => ({ items: s.items.map((i) => (i.localId === localId ? next : i)) }));
    if (persist) void saveItem(next);
    return next;
  };

  return {
    userId: null,
    items: [],
    sheetOpen: false,

    async init(userId) {
      if (get().userId === userId) return;
      // Otro usuario: fuera todo lo de memoria (también los `batch`).
      set({ userId, items: [], sheetOpen: false });
      const stored = await loadItems(userId);
      if (get().userId !== userId) return;
      const recovered = recoverInterrupted(stored);
      recovered.forEach((item, i) => {
        if (item.status !== stored[i].status) void saveItem(item);
      });
      lastCreatedAt = Math.max(lastCreatedAt, ...recovered.map((i) => i.createdAt));
      // Lo encolado mientras cargaba (raro) se conserva.
      set((s) => ({ items: [...recovered, ...s.items.filter((i) => i.userId === userId)] }));
    },

    async enqueue(kind, file, mode, extras = {}) {
      const userId = get().userId;
      if (!userId) throw new Error("queue: sin usuario");
      const source = await shrink(file);
      const item: QueueItem = {
        ...extras,
        localId: crypto.randomUUID(),
        userId,
        kind,
        createdAt: nextCreatedAt(),
        status: "queued",
        progress: 0,
        mode,
        source,
      };
      if (get().userId !== userId) throw new Error("queue: el usuario cambió");
      set((s) => ({ items: [...s.items, item] }));
      void saveItem(item);
      return item.localId;
    },

    setGarmentData(localId, data, opts) {
      // Con tipo deja de estar "por revisar"; un error de subida previo se reintenta.
      patch(localId, {
        garmentData: data,
        needsReview: false,
        uploadError: undefined,
        announced: opts?.announced ?? false,
      });
    },

    remove(localId) {
      set((s) => ({ items: s.items.filter((i) => i.localId !== localId) }));
      void deleteItem(localId);
    },

    retry(localId) {
      const item = find(localId);
      if (!item) return;
      if (item.status === "error") {
        patch(localId, { status: "queued", progress: 0, stage: undefined, error: undefined });
      } else if (item.uploadError) {
        patch(localId, { uploadError: undefined });
      }
    },

    async replaceSource(localId, file) {
      if (!find(localId)) return;
      let source: Blob;
      try {
        if (file instanceof File) await validate(file);
        source = await shrink(file);
      } catch (err) {
        // Foto no válida: sigue en error, con el motivo de la nueva.
        patch(localId, { error: isImagingError(err) ? err.code : "decode_failed" });
        return;
      }
      patch(localId, {
        source,
        // Entra como una foto nueva: al final de la cola.
        createdAt: nextCreatedAt(),
        status: "queued",
        progress: 0,
        stage: undefined,
        error: undefined,
        uploadError: undefined,
        cutout: undefined,
        thumb: undefined,
        cutoutSize: undefined,
      });
    },

    openSheet: () => set({ sheetOpen: true }),
    closeSheet: () => set({ sheetOpen: false }),

    patch,

    markUploaded(localId) {
      if (patch(localId, { uploaded: true }, false)) void deleteItem(localId);
    },

    settleRound() {
      const uploaded = finishedRound(get().items);
      if (!uploaded?.length) return 0;
      const gone = new Set(uploaded.map((i) => i.localId));
      set((s) => ({ items: s.items.filter((i) => !gone.has(i.localId)) }));
      return readyAnnouncementCount(uploaded);
    },
  };
});
