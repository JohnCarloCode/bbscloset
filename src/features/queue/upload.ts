// Subida automática de lo recortado (decisión 5: el navegador sube directo a
// Storage con URLs firmadas que da la API). Una subida cada vez:
// - garment con recorte y tipo: POST /api/garments/uploads {count:1} → PUT de
//   cutout y thumb → POST /api/garments con el id reservado → fuera de
//   IndexedDB y evento GARMENT_SAVED_EVENT.
// - replace: POST /api/garments/[id]/image → PUT → {confirm:true}.
// - batch: nunca.
// Sin red o con fallos del servidor se reintenta con espera creciente (y en
// cuanto vuelve el evento `online`). Los errores que no se arreglan solos
// (límite de 500…) quedan en el item como `uploadError`.
import { apiFetch, isApiClientError, type ApiClientErrorCode } from "@/lib/api/client";
import type {
  GarmentImageUploadResponse,
  GarmentUploadsResponse,
  SignedUpload,
} from "@/lib/api/types";
import { backoffDelay, classifyUploadError, createWaker, nextToUpload } from "./logic";
import { GARMENT_SAVED_EVENT, useQueueStore, type GarmentSavedDetail } from "./store";
import type { QueueItem } from "./types";

/** Fallo del PUT a Storage (status 0 = sin red). */
class StorageUploadError extends Error {
  constructor(readonly status: number) {
    super(`Storage upload failed (${status})`);
  }
}

async function putSigned(target: SignedUpload, blob: Blob): Promise<void> {
  let res: Response;
  try {
    res = await fetch(target.signedUrl, {
      method: "PUT",
      // WebP, o PNG en Safari (encode.ts): el tipo real del archivo.
      headers: { "Content-Type": blob.type || "image/webp" },
      body: blob,
    });
  } catch {
    throw new StorageUploadError(0);
  }
  if (!res.ok) throw new StorageUploadError(res.status);
}

async function uploadGarment(item: QueueItem): Promise<string> {
  const { patch } = useQueueStore.getState();
  let id = item.garmentId;
  if (!id) {
    const { uploads } = await apiFetch<GarmentUploadsResponse>("/api/garments/uploads", {
      method: "POST",
      json: { count: 1 },
    });
    const slot = uploads[0];
    await putSigned(slot.cutout, item.cutout!);
    await putSigned(slot.thumb, item.thumb!);
    id = slot.id;
    // Archivos ya en Storage: si falla el POST, el reintento solo crea la fila.
    patch(item.localId, { garmentId: id });
  }
  try {
    await apiFetch("/api/garments", { method: "POST", json: { ...item.garmentData, id } });
  } catch (err) {
    // conflict: la prenda ya existe (se perdió la respuesta de un intento anterior).
    if (!(isApiClientError(err) && err.code === "conflict")) throw err;
  }
  return id;
}

async function uploadReplacement(item: QueueItem): Promise<string> {
  const id = item.garmentId!;
  const path = `/api/garments/${encodeURIComponent(id)}/image`;
  const urls = await apiFetch<GarmentImageUploadResponse>(path, { method: "POST" });
  await putSigned(urls.cutout, item.cutout!);
  await putSigned(urls.thumb, item.thumb!);
  await apiFetch(path, { method: "POST", json: { confirm: true } });
  return id;
}

function failure(err: unknown): { code: ApiClientErrorCode | "storage"; status: number } {
  if (err instanceof StorageUploadError) return { code: "storage", status: err.status };
  if (isApiClientError(err)) return { code: err.code, status: err.status };
  return { code: "unknown", status: 0 };
}

/** Arranca el bucle de subida. Devuelve la función que lo para. */
export function startUploader(): () => void {
  let stopped = false;
  let attempt = 0;
  const waker = createWaker();
  const unsubscribe = useQueueStore.subscribe((s, prev) => {
    if (s.items !== prev.items) waker.wake();
  });
  // Espera entre reintentos; se corta al volver la red (`online`) o al parar.
  let cancelSleep: (() => void) | null = null;
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = window.setTimeout(done, ms);
      function done() {
        window.clearTimeout(timer);
        cancelSleep = null;
        resolve();
      }
      cancelSleep = done;
    });
  const onOnline = () => {
    cancelSleep?.();
    waker.wake();
  };
  window.addEventListener("online", onOnline);

  void (async () => {
    await Promise.resolve();
    while (!stopped) {
      const store = useQueueStore.getState();
      const item = nextToUpload(store.items);
      if (!item) {
        await waker.wait();
        continue;
      }
      if (!navigator.onLine) {
        await sleep(backoffDelay(Math.max(1, attempt)));
        continue;
      }
      try {
        const garmentId =
          item.kind === "replace" ? await uploadReplacement(item) : await uploadGarment(item);
        attempt = 0;
        const still = useQueueStore.getState().items.some((i) => i.localId === item.localId);
        if (still) useQueueStore.getState().markUploaded(item.localId);
        window.dispatchEvent(
          new CustomEvent<GarmentSavedDetail>(GARMENT_SAVED_EVENT, {
            detail: { localId: item.localId, garmentId, kind: item.kind },
          }),
        );
      } catch (err) {
        const { code, status } = failure(err);
        const action = classifyUploadError(code, status);
        console.warn(`[queue] subida fallida (${code}) → ${action}`, err);
        if (action === "stop") return;
        if (action === "done") {
          attempt = 0;
          store.markUploaded(item.localId);
        } else if (action === "fatal") {
          attempt = 0;
          store.patch(item.localId, { uploadError: code === "storage" ? "unknown" : code });
        } else if (action === "reupload") {
          // Faltan los archivos: se reservan otra vez y se suben de nuevo.
          store.patch(item.localId, {
            garmentId: item.kind === "garment" ? undefined : item.garmentId,
          });
          attempt++;
          if (attempt > 1) await sleep(backoffDelay(attempt - 1));
        } else {
          attempt++;
          await sleep(backoffDelay(attempt));
        }
      }
    }
  })();

  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener("online", onOnline);
    cancelSleep?.();
    waker.wake();
  };
}
