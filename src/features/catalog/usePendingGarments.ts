"use client";

// Prendas pendientes de la cola para la cuadrícula del catálogo (paso 3.9).
// Fusiona los items locales con la vista y los filtros (pending.ts) y, cuando
// una se sube (GARMENT_SAVED_EVENT), pide la fila real, precarga su miniatura
// y la mete en la lista del store; mientras tanto la tarjeta pendiente sigue
// en su sitio ("handoff"), así no hay hueco ni salto. Después se actualizan
// los recuentos de la cabecera y los chips (decisión 4: solo cuentan lo
// subido).
// Un cambio de foto (`replace`, paso 3.10) también avisa al subirse: se vuelve
// a pedir la prenda (URLs firmadas nuevas, con otro token, para que no se use
// la miniatura vieja de la caché) y se sustituye su tarjeta.
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { apiFetch } from "@/lib/api/client";
import type { Garment } from "@/lib/api/types";
import {
  GARMENT_SAVED_EVENT,
  useQueueStore,
  type GarmentSavedDetail,
} from "@/features/queue/store";
import type { QueueItem } from "@/features/queue/types";
import { pendingForGrid } from "./pending";
import { useCatalogStore } from "./store";

/** Tope de espera de la miniatura antes de cambiar la tarjeta. */
const PRELOAD_TIMEOUT_MS = 3_000;

/** Precarga la miniatura firmada para que la tarjeta real salga ya pintada. */
function preload(url: string | null): Promise<void> {
  if (!url) return Promise.resolve();
  const img = new Image();
  img.src = url;
  const timeout = new Promise<void>((r) => window.setTimeout(r, PRELOAD_TIMEOUT_MS));
  return Promise.race([img.decode().catch(() => undefined), timeout]);
}

export function usePendingGarments(): QueueItem[] {
  const items = useQueueStore((s) => s.items);
  const query = useCatalogStore(
    useShallow((s) => ({ view: s.view, slot: s.slot, filters: s.filters })),
  );
  const tags = useCatalogStore((s) => s.options?.tags ?? null);
  const [handoff, setHandoff] = useState<QueueItem[]>([]);

  useEffect(() => {
    const onSaved = (e: Event) => {
      const { localId, garmentId, kind } = (e as CustomEvent<GarmentSavedDetail>).detail;
      if (kind === "replace") {
        void (async () => {
          try {
            const garment = await apiFetch<Garment>(`/api/garments/${garmentId}`);
            await preload(garment.thumbUrl);
            useCatalogStore.getState().updateGarment(garment);
          } catch {
            // Se queda la miniatura vieja hasta la próxima carga.
          }
        })();
        return;
      }
      if (kind !== "garment") return;
      const item = useQueueStore.getState().items.find((i) => i.localId === localId);
      if (item) setHandoff((h) => [...h.filter((x) => x.localId !== localId), item]);
      void (async () => {
        try {
          const garment = await apiFetch<Garment>(`/api/garments/${garmentId}`);
          await preload(garment.thumbUrl);
          useCatalogStore.getState().insertSaved(garment);
        } catch {
          // Sin la fila (red, sesión…): sale en la próxima carga del catálogo.
        } finally {
          setHandoff((h) => h.filter((x) => x.localId !== localId));
          void useCatalogStore.getState().reloadCounts();
        }
      })();
    };
    window.addEventListener(GARMENT_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(GARMENT_SAVED_EVENT, onSaved);
  }, []);

  return useMemo(() => pendingForGrid(items, query, tags, handoff), [items, query, tags, handoff]);
}
