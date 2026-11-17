// Detalle del favorito (screens.md 11; paso 5.4). Pantalla de cliente: el
// favorito llega por la API (apiFetch) en FavoriteDetail. El id sale de
// useParams, que con cacheComponents suspende en rutas dinámicas: de ahí
// el Suspense (el respaldo es la pantalla vacía).
import { Suspense } from "react";
import { FavoriteDetail } from "@/features/favorites/FavoriteDetail";

export default function FavoriteOutfitPage() {
  return (
    <Suspense fallback={<main className="h-[calc(100dvh-var(--tab-bar-h))]" />}>
      <FavoriteDetail />
    </Suspense>
  );
}
