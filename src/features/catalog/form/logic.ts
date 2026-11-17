// Lógica pura del formulario de prenda (GarmentForm): valores, validación,
// nombre por defecto, normalización de etiquetas y marca, sugerencias y paso
// a los datos que se mandan a la API (GarmentData). Sin React ni red, para
// probarla con Vitest y reutilizarla en añadir (3.8), editar (3.10) y
// revisar (3.12).
import type { GarmentData } from "@/features/queue/types";
import {
  GARMENT_BRAND_MAX,
  GARMENT_NAME_MAX,
  GARMENT_TAG_MAX,
  type Garment,
} from "@/lib/api/types";
import type { SolidColorFamilyId } from "@/lib/domain/colors";
import { SEASON_IDS, type SeasonId } from "@/lib/domain/seasons";
import type { GarmentTypeId } from "@/lib/domain/types";
import { colorFamily, normalizeHex } from "@/lib/imaging/colorFamily";

/** add: alta (5.3); edit: ficha (4.3); review: "por revisar" (4.4). */
export type GarmentFormMode = "add" | "edit" | "review";

/**
 * Color elegido: ninguno, un hex del selector (la familia se calcula) o
 * "Multicolor" explícito sin hex (decisión 2).
 */
export type ColorValue = { kind: "none" } | { kind: "hex"; hex: string } | { kind: "multicolor" };

export type GarmentFormValues = {
  typeId: GarmentTypeId | null;
  name: string;
  seasons: SeasonId[];
  color: ColorValue;
  brand: string;
  /** Nombres de etiqueta ya normalizados (normalizeTag). */
  tags: string[];
};

export const NO_COLOR: ColorValue = { kind: "none" };

export function emptyGarmentForm(): GarmentFormValues {
  return { typeId: null, name: "", seasons: [], color: NO_COLOR, brand: "", tags: [] };
}

/** Valores del formulario a partir de una prenda guardada (ficha, 3.10). */
export function formValuesFromGarment(g: Garment): GarmentFormValues {
  return {
    typeId: g.type_id,
    name: g.name ?? "",
    seasons: SEASON_IDS.filter((s) => g.seasons.includes(s)),
    color:
      g.color_family === "multicolor"
        ? { kind: "multicolor" }
        : g.color_hex
          ? { kind: "hex", hex: g.color_hex }
          : NO_COLOR,
    brand: g.brand ?? "",
    tags: g.tags.map((t) => t.name),
  };
}

/** Recorta y junta espacios ("  la  camisa " → "la camisa"). */
export function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export type GarmentFormErrors = Partial<Record<"type" | "name" | "brand", "required" | "tooLong">>;

/** Solo el tipo es obligatorio (spec 3.1); el resto, topes de longitud de la API. */
export function validateGarmentForm(v: GarmentFormValues): GarmentFormErrors {
  const errors: GarmentFormErrors = {};
  if (!v.typeId) errors.type = "required";
  if (cleanText(v.name).length > GARMENT_NAME_MAX) errors.name = "tooLong";
  if (cleanText(v.brand).length > GARMENT_BRAND_MAX) errors.brand = "tooLong";
  return errors;
}

export function isGarmentFormValid(v: GarmentFormValues): boolean {
  return Object.keys(validateGarmentForm(v)).length === 0;
}

/**
 * Nombre que se muestra (spec 2.3): el que puso el usuario o, si lo dejó
 * vacío, el nombre del tipo ("Camisa").
 */
export function displayName(name: string | null | undefined, typeLabel: string): string {
  const clean = cleanText(name ?? "");
  return clean === "" ? typeLabel : clean;
}

/** Familia del color elegido (la muestra en vivo); null sin color. */
export function colorFamilyOf(color: ColorValue): SolidColorFamilyId | "multicolor" | null {
  if (color.kind === "multicolor") return "multicolor";
  if (color.kind === "hex") {
    const hex = normalizeHex(color.hex);
    return hex ? colorFamily(hex) : null;
  }
  return null;
}

/** Busca un texto en una lista sin distinguir mayúsculas. */
function findIgnoringCase(list: readonly string[], value: string): string | undefined {
  const key = value.toLocaleLowerCase();
  return list.find((x) => x.toLocaleLowerCase() === key);
}

/**
 * Normaliza una etiqueta escrita: espacios recortados, sin "#" delante y en
 * minúsculas (como el prototipo). Si ya existe en el vocabulario sin
 * distinguir mayúsculas, se usa esa grafía para no crear "Elegante" junto a
 * "elegante" (spec 2.4). Devuelve null si queda vacía o es demasiado larga.
 */
export function normalizeTag(raw: string, vocabulary: readonly string[] = []): string | null {
  const clean = cleanText(raw).replace(/^#+\s*/, "");
  if (clean === "" || clean.length > GARMENT_TAG_MAX) return null;
  return findIgnoringCase(vocabulary, clean) ?? clean.toLocaleLowerCase();
}

/** Añade una etiqueta escrita a la lista (sin duplicados sin distinguir mayúsculas). */
export function addTag(tags: readonly string[], raw: string, vocabulary: readonly string[] = []) {
  const tag = normalizeTag(raw, vocabulary);
  if (!tag || findIgnoringCase(tags, tag)) return [...tags];
  return [...tags, tag];
}

export function toggleTag(tags: readonly string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

/**
 * Lista de chips de etiquetas en un orden estable (no saltan al tocarlas):
 * el vocabulario, filtrado por lo que se está escribiendo (empieza por) y
 * con como mucho `max` sin elegir, y al final las elegidas que no están en
 * él (las recién escritas). Las elegidas salen siempre.
 */
export function tagChoices(
  selected: readonly string[],
  vocabulary: readonly string[],
  query: string,
  max = 12,
): string[] {
  const q = cleanText(query)
    .replace(/^#+\s*/, "")
    .toLocaleLowerCase();
  const chosen = new Set(selected.map((t) => t.toLocaleLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  let unselected = 0;
  for (const t of vocabulary) {
    const key = t.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (chosen.has(key)) {
      // Con la grafía elegida (puede diferir en mayúsculas).
      out.push(selected.find((s) => s.toLocaleLowerCase() === key)!);
    } else if ((!q || key.startsWith(q)) && unselected < max) {
      unselected++;
      out.push(t);
    }
  }
  return [...out, ...selected.filter((s) => !seen.has(s.toLocaleLowerCase()))];
}

/** Sugerencias de marca: las ya usadas que empiezan por lo escrito (sin la exacta). */
export function brandSuggestions(brands: readonly string[], input: string, max = 6): string[] {
  const q = cleanText(input).toLocaleLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of brands) {
    const key = b.toLocaleLowerCase();
    if (seen.has(key) || key === q || (q && !key.startsWith(q))) continue;
    seen.add(key);
    out.push(b);
    if (out.length >= max) break;
  }
  return out;
}

/** Marca a guardar: limpia y, si ya existe sin distinguir mayúsculas, con su grafía. */
export function canonicalBrand(input: string, brands: readonly string[] = []): string {
  const clean = cleanText(input);
  return clean === "" ? "" : (findIgnoringCase(brands, clean) ?? clean);
}

/**
 * Datos de la prenda para la cola / POST /api/garments. Lanza si falta el
 * tipo (el botón está deshabilitado hasta elegirlo).
 */
export function toGarmentData(v: GarmentFormValues, brands: readonly string[] = []): GarmentData {
  if (!v.typeId) throw new Error("garment form: falta el tipo");
  const name = cleanText(v.name);
  const brand = canonicalBrand(v.brand, brands);
  const hex = v.color.kind === "hex" ? normalizeHex(v.color.hex) : null;
  return {
    type_id: v.typeId,
    ...(name ? { name } : {}),
    seasons: SEASON_IDS.filter((s) => v.seasons.includes(s)),
    color_hex: hex,
    color_family: v.color.kind === "multicolor" ? "multicolor" : null,
    ...(brand ? { brand } : {}),
    tags: v.tags,
  };
}

/** Cuerpo de PATCH /api/garments/[id] desde la ficha (3.10): todos los campos. */
export type GarmentPatch = {
  type_id: GarmentTypeId;
  /** null = sin nombre (se muestra el tipo). */
  name: string | null;
  seasons: SeasonId[];
  color_hex: string | null;
  color_family: "multicolor" | null;
  brand: string | null;
  tags: string[];
};

/**
 * Datos para PATCH desde la ficha. A diferencia del alta (toGarmentData),
 * los vacíos van como null para que se borren. Lanza si falta el tipo.
 */
export function toGarmentPatch(v: GarmentFormValues, brands: readonly string[] = []): GarmentPatch {
  const data = toGarmentData(v, brands);
  return {
    type_id: data.type_id,
    name: data.name ?? null,
    seasons: data.seasons,
    color_hex: data.color_hex ?? null,
    color_family: data.color_family ?? null,
    brand: data.brand ?? null,
    tags: data.tags,
  };
}

/** ¿Ha cambiado algo que se guarde? (compara lo que iría en el PATCH). */
export function formChanged(a: GarmentFormValues, b: GarmentFormValues): boolean {
  if (!a.typeId || !b.typeId) return a.typeId !== b.typeId;
  return JSON.stringify(toGarmentPatch(a)) !== JSON.stringify(toGarmentPatch(b));
}

/** Une listas sin duplicados (sin distinguir mayúsculas), respetando el orden. */
export function mergeVocabulary(...lists: ReadonlyArray<readonly string[]>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const v of list) {
      const key = v.toLocaleLowerCase();
      if (!v || seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}
