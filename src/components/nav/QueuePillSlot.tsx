// Hueco reservado para la queue-pill (DESIGN.md › queue-pill), que monta el
// paso 3.6 como hijo. Posición del prototipo: en móvil/tablet, centrada 12 px
// por encima de la barra de pestañas; en escritorio, abajo en la barra lateral
// (232 px de ancho, 76 px desde abajo: justo encima de "Añadir prenda").
// Cuando la píldora se vea en móvil, el toast debe subir 52 px (--toast-raise).
// Con la barra de selección del catálogo (3.11) sube también por encima de
// ella (--selection-bar-h, globals.css).
import type { ReactNode } from "react";

export function QueuePillSlot({ children }: { children?: ReactNode }) {
  return (
    <div
      data-queue-pill-slot=""
      className={
        "pointer-events-none fixed inset-x-0 z-45 " +
        "bottom-[calc(var(--tab-bar-h)+var(--selection-bar-h,0px)+12px)] " +
        "flex justify-center *:pointer-events-auto " +
        "desktop:right-auto desktop:bottom-[76px] desktop:w-[232px]"
      }
    >
      {children}
    </div>
  );
}
