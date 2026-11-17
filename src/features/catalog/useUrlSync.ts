"use client";

// Sincroniza vista, hueco y filtros del catálogo con la URL (paso 3.4), para
// que sobrevivan a una recarga y a volver atrás desde otra pantalla.
// - Al entrar (también al volver a mostrarse con Activity): si la URL trae
//   parámetros, mandan ellos; si no, se escribe en la URL lo que hubiera en el
//   store (p. ej. al volver por la barra de pestañas). Después, carga.
// - Store → URL con history.replaceState (sin recargar ni añadir entradas al
//   historial; Next lo integra con useSearchParams).
// - URL → store si cambia por fuera (un enlace a /catalog?…). Los ecos de
//   nuestras propias escrituras se ignoran.
// useSearchParams necesita un <Suspense> por encima (cacheComponents): está en
// la página.
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  catalogQueryParams,
  hasCatalogParams,
  parseCatalogQuery,
  sameQuery,
  useCatalogStore,
  type CatalogQuery,
} from "./store";

const queryOf = (s: CatalogQuery): CatalogQuery => ({
  view: s.view,
  slot: s.slot,
  filters: s.filters,
});

export function useCatalogUrlSync() {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  // Cadenas que hemos escrito y cuyo eco aún no ha llegado a useSearchParams.
  const pending = useRef(new Set<string>());

  // Entrar: URL → store (o store → URL), carga y escucha los cambios del store.
  useEffect(() => {
    const written = pending.current;
    const write = (q: CatalogQuery) => {
      const qs = catalogQueryParams(q).toString();
      if (qs === window.location.search.replace(/^\?/, "")) return;
      written.add(qs);
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    };

    const store = useCatalogStore.getState();
    const params = new URLSearchParams(window.location.search);
    if (hasCatalogParams(params) && !sameQuery(parseCatalogQuery(params), queryOf(store))) {
      store.setQuery(parseCatalogQuery(params)); // ya carga
    } else {
      write(queryOf(store));
      void store.load();
    }
    void store.loadOptions();

    const unsubscribe = useCatalogStore.subscribe((s, prev) => {
      if (s.view !== prev.view || s.slot !== prev.slot || s.filters !== prev.filters) {
        write(queryOf(s));
      }
    });
    return () => {
      unsubscribe();
      written.clear();
    };
  }, []);

  // La URL cambia por fuera mientras se ve el catálogo.
  useEffect(() => {
    if (pending.current.delete(search)) return;
    const params = new URLSearchParams(search);
    const store = useCatalogStore.getState();
    if (!hasCatalogParams(params)) {
      // /catalog a secas (barra de pestañas): se conserva lo elegido.
      const qs = catalogQueryParams(queryOf(store)).toString();
      if (qs && qs !== window.location.search.replace(/^\?/, "")) {
        pending.current.add(qs);
        window.history.replaceState(null, "", `?${qs}`);
      }
      return;
    }
    const q = parseCatalogQuery(params);
    if (!sameQuery(q, queryOf(store))) store.setQuery(q);
  }, [search]);
}
