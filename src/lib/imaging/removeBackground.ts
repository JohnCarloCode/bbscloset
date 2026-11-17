// Quitar el fondo en el navegador con @imgly/background-removal
// (architecture.md 4.1 paso 3 y sec. 8, prueba del 25-10).
// - Modelo isnet_quint8 en CPU: la GPU no funciona con esta librería.
// - El módulo (y onnxruntime-web) se carga con import() dinámico solo cuando
//   hay algo que recortar: va en un chunk aparte, fuera del bundle inicial.
// - El modelo y el runtime wasm se descargan de la CDN de img.ly
//   (staticimgly.com) la primera vez; después los sirve la caché HTTP.
// - Sin cabeceras COOP/COEP no hay SharedArrayBuffer: un solo hilo (~30 s
//   por foto). No hace falta configuración especial en Next/Turbopack.
// - Corre en el hilo principal: bloquea la página mientras infiere. Un Web
//   Worker se probó en el paso 3.14 y se descartó: en `next build` la
//   inferencia dentro del worker iba ~6 veces más lenta (ver
//   pruebas/recorte/resultados-3.14.md).
import { ImagingError } from "./errors";

type Imgly = typeof import("@imgly/background-removal");

export type CutoutProgress =
  /** Descarga del modelo/runtime ("Preparando el recorte (solo la primera vez)…"). */
  | { stage: "preparing"; fraction: number | null }
  /** Recorte en marcha ("Quitando el fondo… 45 %"). */
  | { stage: "cutting"; fraction: number };

export type OnCutoutProgress = (progress: CutoutProgress) => void;

type ImglyProgress = (key: string, current: number, total: number) => void;

/** Duración esperada de la inferencia hasta medir la primera (sec. 8: 26–35 s). */
const DEFAULT_INFERENCE_MS = 30_000;
const TICK_MS = 250;

/**
 * Fracción estimada del recorte (pura). La librería solo avisa en 4 pasos y
 * la inferencia es casi todo el tiempo, así que durante ella se avanza por
 * tiempo transcurrido frente a la última duración medida, sin pasar de 0,9.
 */
export function estimateCutFraction(elapsedMs: number, expectedMs: number): number {
  const k = expectedMs > 0 ? elapsedMs / expectedMs : 0;
  return Math.min(0.9, 0.05 + 0.85 * Math.max(0, k));
}

/** Suma el progreso de varios archivos descargados (pura). null si aún no hay totales. */
export function downloadFraction(files: Map<string, { loaded: number; total: number }>) {
  let loaded = 0;
  let total = 0;
  for (const f of files.values()) {
    loaded += f.loaded;
    total += f.total;
  }
  return total > 0 ? Math.min(1, loaded / total) : null;
}

let modulePromise: Promise<Imgly> | null = null;
let ready = false;
let lastInferenceMs = DEFAULT_INFERENCE_MS;
// La librería memoiza la sesión por JSON de la configuración, también si
// falla: tras un fallo cambiamos `fetchArgs` para forzar un intento nuevo.
let attempt = 0;

// La memoización guarda la configuración de la primera llamada, `progress`
// incluido (el JSON no lo distingue): sin este relevo, el progreso de cada
// recorte iba al callback de la precarga. Se le pasa siempre el mismo relevo,
// que avisa al callback de la tarea en curso (paso 3.14).
let currentProgress: ImglyProgress | null = null;
const progressRelay: ImglyProgress = (key, current, total) =>
  currentProgress?.(key, current, total);

function config() {
  return {
    model: "isnet_quint8" as const,
    device: "cpu" as const,
    output: { format: "image/png" as const },
    fetchArgs: attempt ? { cache: "reload" as const, attempt } : {},
    progress: progressRelay,
  };
}

function loadModule(): Promise<Imgly> {
  modulePromise ??= import("@imgly/background-removal").catch((err) => {
    modulePromise = null;
    throw err;
  });
  return modulePromise;
}

/** ¿Ya está descargado y listo el modelo en esta sesión? */
export function isCutoutReady(): boolean {
  return ready;
}

/**
 * Carga el módulo y el modelo (idempotente). Avisa del progreso de descarga.
 * Lanza ImagingError("model_load_failed") si no se puede (p. ej. sin red).
 */
export async function preloadCutout(onProgress?: OnCutoutProgress): Promise<void> {
  if (ready) return;
  const files = new Map<string, { loaded: number; total: number }>();
  onProgress?.({ stage: "preparing", fraction: null });
  try {
    const imgly = await loadModule();
    currentProgress = (key, current, total) => {
      if (!key.startsWith("fetch:")) return;
      files.set(key, { loaded: current, total });
      onProgress?.({ stage: "preparing", fraction: downloadFraction(files) });
    };
    await imgly.preload(config());
    ready = true;
  } catch (cause) {
    attempt++;
    throw new ImagingError("model_load_failed", { cause });
  } finally {
    currentProgress = null;
  }
}

/**
 * Quita el fondo y devuelve un PNG con transparencia del mismo tamaño.
 * Llama a `onProgress` con "preparing" (solo si hay que cargar el modelo) y
 * después con "cutting" (0–1). Errores: model_load_failed, cut_failed.
 */
export async function removeBackground(blob: Blob, onProgress?: OnCutoutProgress): Promise<Blob> {
  await preloadCutout(onProgress);
  const imgly = await loadModule();

  let fraction = 0;
  const report = (f: number) => {
    fraction = Math.max(fraction, f);
    onProgress?.({ stage: "cutting", fraction });
  };
  let inferenceStart = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stopTimer = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  report(0);
  try {
    currentProgress = (key) => {
      if (key === "compute:inference") {
        inferenceStart = performance.now();
        report(estimateCutFraction(0, lastInferenceMs));
        timer = setInterval(
          () => report(estimateCutFraction(performance.now() - inferenceStart, lastInferenceMs)),
          TICK_MS,
        );
      } else if (key === "compute:mask") {
        stopTimer();
        if (inferenceStart) lastInferenceMs = performance.now() - inferenceStart;
        report(0.95);
      }
    };
    const out = await imgly.removeBackground(blob, config());
    report(1);
    return out;
  } catch (cause) {
    throw new ImagingError("cut_failed", { cause });
  } finally {
    currentProgress = null;
    stopTimer();
  }
}
