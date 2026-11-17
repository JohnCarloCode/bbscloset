"use client";

// Vocabulario para el autocompletado del formulario de prenda:
// - marcas: GET /api/brands + las de prendas guardadas en la cola que aún no
//   se han subido (así la marca recién escrita sale ya en la siguiente);
// - etiquetas: GET /api/tags (las más usadas primero) + las de la cola + las
//   sugeridas iniciales de la interfaz (decisión 1: viven en messages y solo
//   se crean en `tags` cuando se usan en una prenda).
// Si la API falla, el formulario sigue sin sugerencias del servidor.
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueueStore } from "@/features/queue/store";
import { apiFetch } from "@/lib/api/client";
import type { BrandsResponse, TagsResponse } from "@/lib/api/types";
import { mergeVocabulary } from "./logic";

/** Claves de las etiquetas sugeridas (`garment.form.suggestedTags.*`), en orden. */
export const SUGGESTED_TAG_KEYS = ["elegant", "comfy", "work", "party", "weekend"] as const;

export type FormOptions = { brands: string[]; tags: string[] };

export function useFormOptions(): FormOptions {
  const t = useTranslations("garment.form.suggestedTags");
  const items = useQueueStore((s) => s.items);
  const [server, setServer] = useState<FormOptions>({ brands: [], tags: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      apiFetch<BrandsResponse>("/api/brands"),
      apiFetch<TagsResponse>("/api/tags"),
    ]).then(([brands, tags]) => {
      if (cancelled) return;
      setServer({
        brands: brands.status === "fulfilled" ? brands.value.brands : [],
        tags:
          tags.status === "fulfilled"
            ? [...tags.value.tags].sort((a, b) => b.count - a.count).map((x) => x.name)
            : [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const local = items.filter((i) => i.garmentData).map((i) => i.garmentData!);
    return {
      brands: mergeVocabulary(
        server.brands,
        local.flatMap((d) => (d.brand ? [d.brand] : [])),
      ),
      tags: mergeVocabulary(
        server.tags,
        local.flatMap((d) => d.tags),
        SUGGESTED_TAG_KEYS.map((k) => t(k)),
      ),
    };
  }, [items, server, t]);
}
