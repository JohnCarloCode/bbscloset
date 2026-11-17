// Carga un recorte (URL firmada del cutout) como HTMLImageElement con
// crossOrigin="anonymous": el bucket privado responde con CORS y así el lienzo
// no queda "contaminado" (hace falta para la máscara de clic y para exportar).
import { useEffect, useState } from "react";

export type CutoutImage =
  | { status: "loading"; image: null }
  | { status: "loaded"; image: HTMLImageElement }
  | { status: "error"; image: null };

export function useCutoutImage(url: string | null | undefined): CutoutImage {
  const [state, setState] = useState<{ url: string | null; result: CutoutImage }>({
    url: null,
    result: { status: "loading", image: null },
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (!cancelled) setState({ url, result: { status: "loaded", image: img } });
    };
    img.onerror = () => {
      if (!cancelled) setState({ url, result: { status: "error", image: null } });
    };
    img.src = url;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [url]);

  if (!url) return { status: "error", image: null };
  // Mientras llega la nueva URL se considera cargando (no se pinta la anterior).
  return state.url === url ? state.result : { status: "loading", image: null };
}
