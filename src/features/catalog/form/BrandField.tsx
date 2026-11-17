"use client";

// Marca (spec 2.3): texto libre con sugerencias de las marcas ya usadas.
// Las sugerencias son botones bajo el campo (como el prototipo): funcionan
// igual en móvil que con teclado y lector, sin desplegables nativos.
import { useId } from "react";
import { useTranslations } from "next-intl";
import { TextField } from "@/components/TextField";
import { GARMENT_BRAND_MAX } from "@/lib/api/types";
import { brandSuggestions, canonicalBrand } from "./logic";

export type BrandFieldProps = {
  value: string;
  onChange: (brand: string) => void;
  /** Marcas ya usadas (useFormOptions). */
  brands: readonly string[];
  error?: string;
};

export function BrandField({ value, onChange, brands, error }: BrandFieldProps) {
  const t = useTranslations("garment.form");
  const listId = useId();
  const suggestions = brandSuggestions(brands, value);

  return (
    <div className="flex flex-col gap-xs">
      <TextField
        label={t("brand")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Al salir, la grafía de una marca ya usada ("zara" → "Zara"): sin duplicados.
        onBlur={() => {
          const canonical = canonicalBrand(value, brands);
          if (canonical !== value) onChange(canonical);
        }}
        placeholder={t("brandPlaceholder")}
        maxLength={GARMENT_BRAND_MAX}
        autoComplete="off"
        autoCapitalize="words"
        error={error}
      />
      {suggestions.length > 0 && (
        <ul aria-label={t("brandSuggestions")} id={listId} className="flex flex-wrap gap-[6px]">
          {suggestions.map((b) => (
            <li key={b}>
              <button
                type="button"
                onClick={() => onChange(b)}
                className="relative min-h-8 cursor-pointer rounded-pill bg-canvas-parchment px-sm text-[13px] text-ink after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
              >
                {b}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
