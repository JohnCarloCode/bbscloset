// Bucle de recorte: una foto cada vez (el recorte usa toda la CPU), en orden
// de llegada y compartido por prendas y recorte en lote (screens.md 6).
// - Solo avanza con la app visible: con la pestaña oculta no empieza el
//   siguiente; el recorte en marcha no se puede pausar (lo frena el propio
//   navegador) y, si el sistema mata la app, se repite al volver (init).
// - El progreso va al store en memoria; IndexedDB solo se toca al cambiar de
//   estado (cutting, ready, error).
// - Sin red y sin el modelo descargado (7.6): la foto vuelve a la cola, sin
//   error, y el bucle espera al evento `online`.
import { toCutoutAndThumb } from "@/lib/imaging/encode";
import { isImagingError } from "@/lib/imaging/errors";
import { removeBackground, type CutoutProgress } from "@/lib/imaging/removeBackground";
import { createWaker, nextToCut } from "./logic";
import { useQueueStore } from "./store";
import type { QueueItem } from "./types";

/** Cada cuánto como mucho se publica el progreso en el store. */
const PROGRESS_THROTTLE_MS = 200;

// Recorte en marcha (de cualquier bucle): si el runner se para y vuelve a
// arrancar, el nuevo espera a que acabe el anterior para no recortar dos a la vez.
let inFlight: Promise<unknown> = Promise.resolve();

/** Devuelve true si no se ha podido recortar por falta de red (hay que esperarla). */
async function cut(item: QueueItem, isCurrent: () => boolean): Promise<boolean> {
  const { patch } = useQueueStore.getState();
  patch(item.localId, { status: "cutting", progress: 0, stage: undefined, error: undefined });

  let last = 0;
  const onProgress = (p: CutoutProgress) => {
    const now = performance.now();
    if (now - last < PROGRESS_THROTTLE_MS && p.fraction !== 1) return;
    last = now;
    patch(
      item.localId,
      { stage: p.stage, progress: p.stage === "cutting" ? p.fraction : 0 },
      false,
    );
  };

  try {
    const png = item.mode === "cut" ? await removeBackground(item.source, onProgress) : item.source;
    const { cutout, thumb, width, height } = await toCutoutAndThumb(png);
    // Quitado o con otra foto mientras recortaba: se descarta el resultado.
    if (!isCurrent()) return false;
    patch(item.localId, {
      status: "ready",
      progress: 1,
      stage: undefined,
      cutout: cutout.blob,
      thumb: thumb.blob,
      cutoutSize: { width, height },
    });
    return false;
  } catch (err) {
    console.warn("[queue] recorte fallido", err);
    if (!isCurrent()) return false;
    // El modelo no se ha podido descargar porque no hay red: a esperar, sin error.
    if (isImagingError(err) && err.code === "model_load_failed" && !navigator.onLine) {
      patch(item.localId, { status: "queued", progress: 0, stage: undefined });
      return true;
    }
    patch(item.localId, {
      status: "error",
      progress: 0,
      stage: undefined,
      error: isImagingError(err) ? err.code : "cut_failed",
    });
    return false;
  }
}

/** Arranca el bucle de recorte. Devuelve la función que lo para. */
export function startRunner(): () => void {
  let stopped = false;
  const waker = createWaker();
  const unsubscribe = useQueueStore.subscribe((s, prev) => {
    if (s.items !== prev.items) waker.wake();
  });
  const onVisibility = () => waker.wake();
  document.addEventListener("visibilitychange", onVisibility);
  // Sin red y sin modelo: se para hasta que vuelva la red.
  let waitingForNetwork = false;
  const onOnline = () => {
    waitingForNetwork = false;
    waker.wake();
  };
  window.addEventListener("online", onOnline);

  void (async () => {
    // Un tick de margen: con StrictMode el efecto se monta, desmonta y
    // vuelve a montar seguido, y solo debe correr el último bucle.
    await Promise.resolve();
    while (!stopped) {
      await inFlight;
      if (stopped) break;
      if (document.visibilityState === "hidden") {
        await waker.wait();
        continue;
      }
      if (waitingForNetwork && !navigator.onLine) {
        await waker.wait();
        continue;
      }
      waitingForNetwork = false;
      const item = nextToCut(useQueueStore.getState().items);
      if (!item) {
        await waker.wait();
        continue;
      }
      // Sigue siendo el mismo item con la misma foto (no quitado ni cambiado).
      const isCurrent = () => {
        const now = useQueueStore.getState().items.find((i) => i.localId === item.localId);
        return !!now && now.source === item.source && now.status === "cutting";
      };
      const running = cut(item, isCurrent);
      inFlight = running;
      if (await running) waitingForNetwork = true;
    }
  })();

  return () => {
    stopped = true;
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("online", onOnline);
    waker.wake();
  };
}
