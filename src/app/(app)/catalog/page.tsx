// Catálogo (screens.md 4). La pantalla es de cliente: los datos llegan por la
// API (apiFetch) y el estado vive en features/catalog/store.ts. Lee la URL con
// useSearchParams (filtros, 3.4), así que va dentro de <Suspense>
// (cacheComponents): el esqueleto sale en el HTML inicial.
import { Suspense } from "react";
import { Catalog } from "@/features/catalog/Catalog";
import { GridSkeleton } from "@/features/catalog/GarmentGrid";

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-[1200px] px-5 pt-xs pb-xl">
          <GridSkeleton />
        </main>
      }
    >
      <Catalog />
    </Suspense>
  );
}
