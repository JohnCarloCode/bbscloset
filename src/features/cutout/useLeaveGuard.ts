"use client";

// Aviso al salir del recorte en lote con fotos sin descargar (screens.md
// 13.3, decisión 13: solo viven en memoria). Recargar o cerrar: el aviso
// del navegador (`beforeunload`). Navegación interna: los <Link> de la
// barra de pestañas, la barra lateral y "‹ Ajustes" están en otros
// componentes, así que se interceptan en captura los clics en enlaces
// internos (antes que el router) y la página pide confirmación con su Dialog.
// No cubre "Atrás" del navegador ni las navegaciones por código.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLeavingClick } from "./logic";

export function useLeaveGuard(active: boolean) {
  const router = useRouter();
  /** Destino del clic retenido (null = sin diálogo). */
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Navegadores antiguos necesitan returnValue.
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const anchor = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const leaving = isLeavingClick(
        e,
        { href: anchor.href, target: anchor.target, hasDownload: anchor.hasAttribute("download") },
        window.location,
      );
      if (!leaving) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(anchor.href);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const stay = useCallback(() => setPendingHref(null), []);
  const leave = useCallback(() => {
    if (!pendingHref) return;
    const url = new URL(pendingHref);
    setPendingHref(null);
    router.push(url.pathname + url.search + url.hash);
  }, [pendingHref, router]);

  return { leaving: pendingHref !== null, stay, leave };
}
