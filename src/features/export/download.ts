// Guardar el PNG exportado (screens.md 9; plan 6.2): nombre del archivo y
// cómo se entrega según el dispositivo.
// - "share": hoja de compartir del sistema con el archivo (desde ahí se
//   guarda en Fotos). En táctil o iOS, si Web Share acepta archivos.
// - "download": <a download> con un object URL (escritorio, Android sin
//   compartir).
// - "open": iOS sin compartir archivos (iOS viejo): el PNG en una pestaña
//   nueva con una instrucción breve para guardarlo manteniéndolo pulsado.
// navigator.share y window.open necesitan el gesto del usuario: el PNG tiene
// que estar ya generado al pulsar (la hoja lo genera para la vista previa).
import { saveBlob } from "@/features/cutout/zip";
import type { ExportRatio } from "./exportGeometry";

export type SaveMethod = "share" | "download" | "open";

/** Longitud máxima de la parte del nombre que sale del favorito. */
const SLUG_MAX = 40;

/** "Cena del viernes!" → "cena-del-viernes" (sin acentos ni caracteres raros). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

/** Fecha local AAAA-MM-DD (no depende del idioma). */
export function isoDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * Nombre del PNG: `bbs-closet-<nombre o fecha>-<proporción>.png`, p. ej.
 * "bbs-closet-cena-del-viernes-4x5.png". Sin nombre (o si se queda vacío al
 * sanearlo) se usa la fecha.
 */
export function exportFileName(name: string | null | undefined, date: Date, ratio: ExportRatio) {
  const base = slugify(name ?? "") || isoDay(date);
  return `bbs-closet-${base}-${ratio.replace(":", "x")}.png`;
}

export type SaveEnv = {
  /** Web Share acepta archivos PNG (navigator.canShare({ files })). */
  canShareFiles: boolean;
  /** Puntero grueso (móvil o tableta). */
  coarse: boolean;
  /** iPhone / iPad (también el iPad que se presenta como Mac). */
  ios: boolean;
  /** El navegador entiende <a download>. */
  anchorDownload: boolean;
};

/** Qué hacer al pulsar "Descargar PNG". Pura, con tests. */
export function pickSaveMethod(env: SaveEnv): SaveMethod {
  if (env.canShareFiles && (env.coarse || env.ios)) return "share";
  // En iOS la descarga acaba en Archivos, no en Fotos: mejor la pestaña.
  if (env.ios || !env.anchorDownload) return "open";
  return "download";
}

/** Lee el entorno del navegador (solo cliente). */
export function readSaveEnv(): SaveEnv {
  let canShareFiles = false;
  try {
    const probe = new File([new Uint8Array(1)], "x.png", { type: "image/png" });
    canShareFiles =
      typeof navigator.share === "function" && !!navigator.canShare?.({ files: [probe] });
  } catch {
    canShareFiles = false;
  }
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return {
    canShareFiles,
    coarse: window.matchMedia("(pointer: coarse)").matches,
    ios,
    anchorDownload: "download" in HTMLAnchorElement.prototype,
  };
}

export type SaveResult = "shared" | "downloaded" | "opened" | "cancelled";

/**
 * Entrega el PNG. `openHint` es la instrucción de la pestaña nueva ("Mantén
 * pulsada la imagen para guardarla"). Lanza si compartir falla (no si se
 * cancela) o si el navegador bloquea la pestaña nueva.
 */
export async function savePng(
  blob: Blob,
  fileName: string,
  method: SaveMethod,
  openHint: string,
): Promise<SaveResult> {
  if (method === "share") {
    const file = new File([blob], fileName, { type: "image/png" });
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      throw err;
    }
  }
  if (method === "open") {
    openInNewTab(blob, fileName, openHint);
    return "opened";
  }
  saveBlob(blob, fileName);
  return "downloaded";
}

/** Pestaña nueva con el PNG y la instrucción debajo (sin HTML de terceros). */
function openInNewTab(blob: Blob, fileName: string, hint: string) {
  const url = URL.createObjectURL(blob);
  const win = window.open("", "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("popup_blocked");
  }
  const doc = win.document;
  doc.title = fileName;
  const meta = doc.createElement("meta");
  meta.name = "viewport";
  meta.content = "width=device-width, initial-scale=1";
  doc.head.appendChild(meta);
  doc.body.style.cssText =
    "margin:0;padding:16px;background:#f5f5f7;font:15px/1.4 -apple-system,system-ui,sans-serif;color:#1d1d1f;text-align:center";
  const img = doc.createElement("img");
  img.src = url;
  img.alt = fileName;
  img.style.cssText = "display:block;max-width:100%;height:auto;margin:0 auto 16px";
  const p = doc.createElement("p");
  p.textContent = hint;
  doc.body.append(img, p);
  // La pestaña sigue usando la URL: se libera pasado un rato.
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
}
