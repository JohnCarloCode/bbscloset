// Carga un recorte (URL firmada del cutout) como HTMLImageElement con
// crossOrigin="anonymous": el bucket privado responde con CORS y así el lienzo
// no queda "contaminado" (hace falta para la máscara de clic y para exportar).
// Si no carga (p. ej. la URL firmada ha caducado tras 1 h), se pide una URL
// nueva con refreshSignedUrl y se reintenta una vez (7.6).
import { useEffect, useState } from "react";
import { refreshSignedUrl } from "@/lib/storage/refresh";

export type CutoutImage =
  | { status: "loading"; image: null }
  | { status: "loaded"; image: HTMLImageElement }
  | { status: "error"; image: null };

/** Una carga suelta, cancelable. */
function loadOnce(url: string, onDone: (img: HTMLImageElement | null) => void): () => void {
  const img = new window.Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.onload = () => onDone(img);
  img.onerror = () => onDone(null);
  img.src = url;
  return () => {
    img.onload = null;
    img.onerror = null;
  };
}

export function useCutoutImage(url: string | null | undefined): CutoutImage {
  const [state, setState] = useState<{ url: string | null; result: CutoutImage }>({
    url: null,
    result: { status: "loading", image: null },
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let cancelLoad = loadOnce(url, (img) => {
      if (cancelled) return;
      if (img) {
        setState({ url, result: { status: "loaded", image: img } });
        return;
      }
      // Segundo intento con una URL firmada nueva.
      void refreshSignedUrl(url).then((fresh) => {
        if (cancelled) return;
        if (!fresh) {
          setState({ url, result: { status: "error", image: null } });
          return;
        }
        cancelLoad = loadOnce(fresh, (retry) => {
          if (cancelled) return;
          setState({
            url,
            result: retry ? { status: "loaded", image: retry } : { status: "error", image: null },
          });
        });
      });
    });
    return () => {
      cancelled = true;
      cancelLoad();
    };
  }, [url]);

  if (!url) return { status: "error", image: null };
  // Mientras llega la nueva URL se considera cargando (no se pinta la anterior).
  return state.url === url ? state.result : { status: "loading", image: null };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    loadOnce(url, (img) => (img ? resolve(img) : reject(new Error("cutout_load_failed"))));
  });
}

/**
 * Lo mismo sin React (exportación): promesa con el recorte cargado con
 * crossOrigin="anonymous". Si falla, renueva la URL firmada y reintenta una vez.
 */
export async function loadCutoutImage(url: string): Promise<HTMLImageElement> {
  try {
    return await loadImage(url);
  } catch (err) {
    const fresh = await refreshSignedUrl(url);
    if (!fresh) throw err;
    return loadImage(fresh);
  }
}
