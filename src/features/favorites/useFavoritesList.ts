"use client";

// Datos del listado de favoritos (paso 5.3; screens.md 10): primera página,
// páginas siguientes por cursor y borrado. El contador sale de `total` de la
// API (no de lo cargado) y baja en uno al borrar.
// Las URLs firmadas de las miniaturas duran 1 h: si la página lleva más de
// LIST_TTL_MS abierta y vuelve a estar visible, se recarga desde el principio.
// Al volver a la página (Activity) solo se recarga si hace falta
// (listFreshness.ts: favoritos guardados o prendas eliminadas mientras tanto).
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, isApiClientError, type ApiClientErrorCode } from "@/lib/api/client";
import type { FavoriteListResponse, FavoriteSummary } from "@/lib/api/types";
import { favoritesVersion, LIST_TTL_MS, needsReload } from "./listFreshness";

/** Favoritos por página (múltiplo de 2, 3 y 4 columnas). */
export const FAVORITES_PAGE_SIZE = 24;

export type FavoritesStatus = "loading" | "ready" | "error";

export type FavoritesListState = {
  items: FavoriteSummary[];
  total: number;
  nextCursor: string | null;
  status: FavoritesStatus;
  moreStatus: "idle" | "loading" | "error";
  errorCode: ApiClientErrorCode | null;
};

const INITIAL: FavoritesListState = {
  items: [],
  total: 0,
  nextCursor: null,
  status: "loading",
  moreStatus: "idle",
  errorCode: null,
};

function url(cursor: string | null) {
  const q = new URLSearchParams({ limit: String(FAVORITES_PAGE_SIZE) });
  if (cursor) q.set("cursor", cursor);
  return `/api/favorites?${q}`;
}

export function useFavoritesList() {
  const [state, setState] = useState<FavoritesListState>(INITIAL);
  // Cada carga desde el principio invalida las respuestas de las anteriores.
  const generation = useRef(0);
  const loadedAt = useRef(0);
  const loadedVersion = useRef(0);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const load = useCallback(async () => {
    const gen = ++generation.current;
    const version = favoritesVersion();
    setState((s) => ({ ...s, status: "loading", errorCode: null }));
    try {
      const res = await apiFetch<FavoriteListResponse>(url(null));
      if (gen !== generation.current) return;
      loadedAt.current = Date.now();
      loadedVersion.current = version;
      setState({
        items: res.items,
        total: res.total,
        nextCursor: res.nextCursor,
        status: "ready",
        moreStatus: "idle",
        errorCode: null,
      });
    } catch (err) {
      if (gen !== generation.current) return;
      if (isApiClientError(err) && err.code === "unauthorized") return;
      console.warn("[favorites] no se ha podido cargar el listado", err);
      setState((s) => ({
        ...s,
        status: "error",
        errorCode: isApiClientError(err) ? err.code : "unknown",
      }));
    }
  }, []);

  const loadMore = useCallback(async () => {
    const s = stateRef.current;
    if (s.status !== "ready" || !s.nextCursor || s.moreStatus === "loading") return;
    const gen = generation.current;
    const cursor = s.nextCursor;
    setState((p) => ({ ...p, moreStatus: "loading" }));
    try {
      const res = await apiFetch<FavoriteListResponse>(url(cursor));
      if (gen !== generation.current) return;
      setState((p) => {
        // Sin duplicados (un borrado entre páginas no mueve el cursor, pero por si acaso).
        const seen = new Set(p.items.map((f) => f.id));
        return {
          ...p,
          items: [...p.items, ...res.items.filter((f) => !seen.has(f.id))],
          total: res.total,
          nextCursor: res.nextCursor,
          moreStatus: "idle",
        };
      });
    } catch (err) {
      if (gen !== generation.current) return;
      if (isApiClientError(err) && err.code === "unauthorized") return;
      console.warn("[favorites] no se ha podido cargar la página siguiente", err);
      setState((p) => ({ ...p, moreStatus: "error" }));
    }
  }, []);

  /** DELETE del favorito; si va bien, sale de la lista y baja el contador. Lanza si falla. */
  const remove = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      // Ya no existe (borrado en otra pestaña): se quita igual.
      if (!(isApiClientError(err) && err.status === 404)) throw err;
    }
    setState((s) => {
      if (!s.items.some((f) => f.id === id)) return s;
      return {
        ...s,
        items: s.items.filter((f) => f.id !== id),
        total: Math.max(0, s.total - 1),
      };
    });
  }, []);

  useEffect(() => {
    const gen = generation;
    // Al montar y al volver a la página: solo si nunca se cargó o ha cambiado algo.
    const snapshot = () => ({
      loadedAt: loadedAt.current,
      loadedVersion: loadedVersion.current,
      status: stateRef.current.status,
    });
    if (needsReload(snapshot(), favoritesVersion(), Date.now())) void load();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (loadedAt.current && Date.now() - loadedAt.current > LIST_TTL_MS) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      // Las respuestas que lleguen después de desmontar se ignoran.
      gen.current++;
    };
  }, [load]);

  return { ...state, load, loadMore, remove };
}
