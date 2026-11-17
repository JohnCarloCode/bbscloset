// IndexedDB de la cola (architecture.md 4.1, "Lo pendiente vive en el
// dispositivo"): base `bbscloset`, almacén `pending`, clave `localId` e índice
// por `userId` para que dos usuarios del mismo dispositivo no vean lo del
// otro. Los items `batch` no se guardan nunca (decisión 13: solo memoria).
// Si IndexedDB no está disponible (modo privado antiguo, permisos), la cola
// sigue funcionando solo en memoria: los fallos se registran y se ignoran.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { QueueItem } from "./types";

const DB_NAME = "bbscloset";
const DB_VERSION = 1;
const STORE = "pending";

/** Lo que se guarda: sin los campos que solo tienen sentido en memoria. */
export type StoredItem = Omit<QueueItem, "stage" | "uploaded">;

interface QueueDB extends DBSchema {
  pending: { key: string; value: StoredItem; indexes: { byUser: string } };
}

let dbPromise: Promise<IDBPDatabase<QueueDB>> | null = null;

function db(): Promise<IDBPDatabase<QueueDB>> {
  dbPromise ??= openDB<QueueDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(STORE, { keyPath: "localId" });
      store.createIndex("byUser", "userId");
    },
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function warn(action: string, err: unknown) {
  console.warn(`[queue] IndexedDB: no se pudo ${action}`, err);
}

/** Items guardados de un usuario (vacío si IndexedDB falla). */
export async function loadItems(userId: string): Promise<QueueItem[]> {
  try {
    return await (await db()).getAllFromIndex(STORE, "byUser", userId);
  } catch (err) {
    warn("leer", err);
    return [];
  }
}

/** Guarda (o reemplaza) un item. Los `batch` y los ya subidos no se guardan. */
export async function saveItem(item: QueueItem): Promise<void> {
  if (item.kind === "batch" || item.uploaded) return;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stage, uploaded, ...stored } = item;
  try {
    await (await db()).put(STORE, stored);
  } catch (err) {
    warn("guardar", err);
  }
}

export async function deleteItem(localId: string): Promise<void> {
  try {
    await (await db()).delete(STORE, localId);
  } catch (err) {
    warn("borrar", err);
  }
}
