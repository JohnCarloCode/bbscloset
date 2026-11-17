// Descarga del recorte en lote (screens.md 13.3): nombres de los PNG y ZIP
// generado en el cliente con client-zip. El ZIP se escribe en streaming: cada
// PNG se pide (y se recodifica) solo cuando le toca, así que nunca hay más de
// uno recodificado a la vez en memoria.
import { downloadZip } from "client-zip";

/** "IMG_4801.HEIC" → "IMG_4801.png"; sin nombre, `fallback` + ".png". */
export function pngFileName(sourceName: string | undefined, fallback: string): string {
  const base = (sourceName ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .trim();
  return `${base || fallback}.png`;
}

/** Nombres sin repetir (sin distinguir mayúsculas): "a.png", "a (2).png"… */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export type ZipEntry = {
  name: string;
  /** El PNG; se llama justo antes de escribirlo en el ZIP. */
  png: () => Promise<Blob>;
};

/** ZIP con las entradas, en orden. Los PNG se generan de uno en uno. */
export function zipBlob(entries: readonly ZipEntry[], lastModified = new Date()): Promise<Blob> {
  async function* files() {
    for (const entry of entries) {
      yield { name: entry.name, lastModified, input: await entry.png() };
    }
  }
  return downloadZip(files()).blob();
}

/** Descarga un Blob con un <a download> temporal (fuera del documento). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  // Margen para que el navegador empiece la descarga antes de revocar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
