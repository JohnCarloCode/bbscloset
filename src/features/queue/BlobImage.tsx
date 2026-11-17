"use client";

// <img> de un Blob local (miniatura o foto de la cola). La URL de objeto se
// crea en el ref y se revoca al cambiar el Blob o desmontar (React 19).
import { useCallback, type ImgHTMLAttributes } from "react";

export function BlobImage({
  blob,
  alt = "",
  ...props
}: { blob: Blob } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">) {
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img) return;
      const url = URL.createObjectURL(blob);
      img.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [blob],
  );
  // eslint-disable-next-line @next/next/no-img-element -- blob: local, sin optimizar
  return <img ref={ref} alt={alt} {...props} />;
}
