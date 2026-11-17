// Estado de la hoja "Añadir prenda" (screens.md 5): abierta o no, el paso y
// la foto elegida. Es global para que la abran el catálogo, la barra lateral,
// el vestidor ("Añadir una", 4.4) y los toasts ("Añadir otra", 3.8); la hoja
// se monta una sola vez en el layout de (app) (AddGarmentSheet).
// Con varias fotos, la pantalla resumen de la subida masiva (5.5, paso 3.12).
import { create } from "zustand";
import { useQueueStore } from "@/features/queue/store";
import type { QueueMode } from "@/features/queue/types";
import { isImagingError } from "@/lib/imaging/errors";
import { hasTransparency } from "@/lib/imaging/transparency";
import { validate } from "@/lib/imaging/validate";
import { emptyGarmentForm, type GarmentFormValues } from "../form/logic";
import { capBatch, detectedMode, fittingIds, type BulkEntry } from "./bulk";

/**
 * pick = 5.1 Elegir foto; choose = 5.2 ¿Recortar?; data = 5.3 (paso 3.8);
 * bulk = 5.5 resumen de la subida masiva (paso 3.12).
 */
export type AddGarmentStep = "pick" | "choose" | "data" | "bulk";

export type AddGarmentState = {
  isOpen: boolean;
  step: AddGarmentStep;
  /** Foto elegida en el paso 1. */
  file: File | null;
  /** Lo detectado: la foto tiene fondo transparente. */
  hasAlpha: boolean;
  /** Elección del paso 2; se preselecciona según lo detectado. */
  mode: QueueMode;
  /** Item de la cola creado al continuar (paso 3). */
  localId: string | null;
  /** Encolando (reducir la foto lleva un momento). */
  continuing: boolean;
  /** Datos del formulario del paso 3 (aquí para que el pie de la hoja vea el tipo). */
  draft: GarmentFormValues;

  /** Subida masiva: las fotos de la tanda (como mucho 30). */
  bulk: BulkEntry[];
  /** Fotos que sobraron del tope de 30 (se avisa). */
  bulkDropped: number;
  /** Sitio libre bajo el límite de 500 al elegirlas (null = no se sabe). */
  bulkRoom: number | null;
  /** Modo elegido para todas (se aplica también a las que aún se comprueban). */
  bulkAll: QueueMode | null;
  /** Metiendo las fotos en la cola: cuántas van de cuántas. */
  bulkAdding: { done: number; total: number } | null;

  /** Abre la hoja en el paso 1. */
  open: () => void;
  /** Cierra sin guardar: descarta la foto y su item de la cola (y su recorte). */
  close: () => void;
  /**
   * Cierra conservando el item de la cola (el paso 3.8 lo usa tras guardar
   * los datos: la cola lo sube cuando tenga recorte y tipo).
   */
  finish: () => void;
  /**
   * "Guardar y añadir otra": conserva el item guardado en la cola y vuelve
   * al paso 1 sin cerrar la hoja.
   */
  restart: () => void;
  /** Paso 1 → 2 con una foto ya validada. */
  pickPhoto: (file: File, hasAlpha: boolean) => void;
  setMode: (mode: QueueMode) => void;
  setDraft: (draft: GarmentFormValues) => void;
  /**
   * Paso 2 → 3: mete la foto en la cola con el modo elegido. Lanza si la
   * foto no se puede reducir (la hoja sigue en el paso 2 con el error).
   */
  continueWith: () => Promise<void>;

  /**
   * Paso 1 → resumen de la subida masiva con varias fotos (se usan las 30
   * primeras). Las comprueba de una en una (validate + transparencia).
   * `room`: sitio libre bajo el límite de 500 (null si no se sabe).
   */
  pickSeveral: (files: File[], room: number | null) => void;
  /** Tocar una miniatura: cambia solo esa (quitar fondo ↔ tal cual). */
  toggleBulkMode: (id: string) => void;
  /** Control segmentado: el mismo modo para todas. */
  setBulkModeAll: (mode: QueueMode) => void;
  /**
   * "Añadir 12 fotos": las mete en la cola por revisar (`needsReview`, sin
   * datos), de una en una para no congelar la pantalla, y cierra la hoja.
   * Devuelve cuántas entraron, o null si se cerró la hoja a medias (las ya
   * metidas se quedan por revisar).
   */
  addBulk: () => Promise<number | null>;
};

const initial = {
  step: "pick" as const,
  file: null,
  hasAlpha: false,
  mode: "cut" as QueueMode,
  localId: null,
  continuing: false,
  bulk: [] as BulkEntry[],
  bulkDropped: 0,
  bulkRoom: null,
  bulkAll: null,
  bulkAdding: null,
};

// El borrador se crea en cada reinicio (no se comparte entre aperturas).
const fresh = () => ({ ...initial, draft: emptyGarmentForm() });

// Cada apertura es una sesión: si la hoja se cierra mientras se encola, el
// item que llega tarde se borra de la cola.
let session = 0;

/** Deja respirar al navegador (pintar, eventos) entre foto y foto. */
const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

export const useAddGarment = create<AddGarmentState>()((set, get) => ({
  isOpen: false,
  ...fresh(),

  open() {
    if (get().isOpen) return;
    session++;
    set({ isOpen: true, ...fresh() });
  },

  close() {
    const { localId } = get();
    session++;
    if (localId) useQueueStore.getState().remove(localId);
    set({ isOpen: false, ...fresh() });
  },

  finish() {
    session++;
    set({ isOpen: false, ...fresh() });
  },

  restart() {
    session++;
    set({ isOpen: true, ...fresh() });
  },

  pickPhoto(file, hasAlpha) {
    set({ step: "choose", file, hasAlpha, mode: hasAlpha ? "as-is" : "cut" });
  },

  setMode: (mode) => set({ mode }),

  setDraft: (draft) => set({ draft }),

  async continueWith() {
    const { file, mode, continuing } = get();
    if (!file || continuing) return;
    const mine = session;
    set({ continuing: true });
    let localId: string;
    try {
      localId = await useQueueStore.getState().enqueue("garment", file, mode, {
        sourceName: file.name,
      });
    } catch (err) {
      if (mine === session) set({ continuing: false });
      throw err;
    }
    if (mine !== session) {
      // Cerrada (o reabierta) mientras se encolaba: fuera de la cola.
      useQueueStore.getState().remove(localId);
      return;
    }
    set({ step: "data", localId, continuing: false });
  },

  pickSeveral(files, room) {
    const mine = session;
    const { files: kept, dropped } = capBatch(files);
    const bulk: BulkEntry[] = kept.map((file) => ({
      id: crypto.randomUUID(),
      file,
      check: "pending",
      hasAlpha: false,
      mode: "cut",
    }));
    set({ step: "bulk", bulk, bulkDropped: dropped, bulkRoom: room, bulkAll: null });

    // Una a una: decodificar 30 fotos a la vez saturaría el móvil.
    void (async () => {
      for (const { id, file } of bulk) {
        let change: Partial<BulkEntry>;
        try {
          await validate(file);
          const hasAlpha = await hasTransparency(file);
          change = { check: "ok", hasAlpha };
        } catch (err) {
          change = { check: "invalid", error: isImagingError(err) ? err.code : "decode_failed" };
        }
        if (mine !== session) return;
        set((s) => ({
          bulk: s.bulk.map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...change,
                  mode: s.bulkAll ?? detectedMode(change.hasAlpha ?? false),
                }
              : e,
          ),
        }));
        await yieldToBrowser();
      }
    })();
  },

  toggleBulkMode(id) {
    set((s) => ({
      bulk: s.bulk.map((e) =>
        e.id === id && e.check === "ok" ? { ...e, mode: e.mode === "cut" ? "as-is" : "cut" } : e,
      ),
    }));
  },

  setBulkModeAll(mode) {
    set((s) => ({ bulkAll: mode, bulk: s.bulk.map((e) => ({ ...e, mode })) }));
  },

  async addBulk() {
    const { bulk, bulkRoom, bulkAdding } = get();
    if (bulkAdding || bulk.some((e) => e.check === "pending")) return null;
    const fitting = fittingIds(bulk, bulkRoom);
    const chosen = bulk.filter((e) => fitting.has(e.id));
    if (chosen.length === 0) return null;
    const mine = session;
    set({ bulkAdding: { done: 0, total: chosen.length } });
    let added = 0;
    for (const [i, entry] of chosen.entries()) {
      try {
        // enqueue reduce la foto (shrink): una cada vez y con respiro entre medias.
        await useQueueStore.getState().enqueue("garment", entry.file, entry.mode, {
          needsReview: true,
          sourceName: entry.file.name,
          hasAlpha: entry.hasAlpha,
        });
        added++;
      } catch (err) {
        // No se pudo reducir (rara vez, ya validada): no entra.
        console.warn("[add-garment] no se pudo encolar", entry.file.name, err);
      }
      if (mine !== session) return null;
      set({ bulkAdding: { done: i + 1, total: chosen.length } });
      await yieldToBrowser();
      if (mine !== session) return null;
    }
    get().finish();
    return added;
  },
}));
