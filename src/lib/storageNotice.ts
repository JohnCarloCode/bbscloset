// Almacenamiento del dispositivo no disponible (paso 7.6): localStorage o
// IndexedDB llenos o bloqueados (modo privado, permisos). La app sigue sin
// borrador del vestidor ni cola persistente; quien falla lo avisa aquí y
// AppNotices enseña un toast, una sola vez por sesión (por carga de la página).

let reported = false;
const listeners = new Set<() => void>();

export function reportStorageUnavailable(): void {
  if (reported) return;
  reported = true;
  listeners.forEach((l) => l());
}

export function isStorageUnavailable(): boolean {
  return reported;
}

export function subscribeStorageUnavailable(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Solo para tests. */
export function resetStorageNoticeForTests(): void {
  reported = false;
}
