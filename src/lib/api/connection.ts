// Estado global "el servidor no puede hablar con Supabase" (paso 7.6): lo
// enciende apiFetch al recibir un 503 `service_unavailable` y lo apaga la
// siguiente respuesta buena. ConnectionNotice lo pinta como aviso con
// reintento. Sin React aquí: suscripción simple para useSyncExternalStore.

let unavailable = false;
const listeners = new Set<() => void>();

export function setServiceUnavailable(value: boolean): void {
  if (unavailable === value) return;
  unavailable = value;
  listeners.forEach((l) => l());
}

export function isServiceUnavailable(): boolean {
  return unavailable;
}

export function subscribeServiceUnavailable(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
