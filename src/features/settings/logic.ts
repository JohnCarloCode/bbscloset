// Lógica pura de Ajustes (paso 7.2): validar el renombrado de una etiqueta,
// acotar el máximo de joyas y guardar en serie el último valor elegido.
import { GARMENT_TAG_MAX, type TagWithCount } from "@/lib/api/types";

/** Límites de profiles.jewelry_max (spec 3.6; check de 0002_user_tables.sql). */
export const JEWELRY_MAX_MIN = 1;
export const JEWELRY_MAX_MAX = 10;

/** Acota el máximo de joyas a 1–10 (entero). */
export function clampJewelryMax(value: number): number {
  if (!Number.isFinite(value)) return JEWELRY_MAX_MIN;
  return Math.min(JEWELRY_MAX_MAX, Math.max(JEWELRY_MAX_MIN, Math.round(value)));
}

/**
 * Nombre de etiqueta limpio: recortado y con los espacios internos colapsados,
 * igual que hace la API (cleanTagNames en lib/api/garments.ts, que no se
 * importa aquí porque arrastra código de servidor).
 */
export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export type TagRenameCheck =
  | { ok: true; name: string }
  /** Mismo nombre exacto: no hay nada que guardar. */
  | { ok: false; reason: "unchanged" }
  | { ok: false; reason: "empty" | "tooLong" | "duplicate" };

/**
 * Comprueba un renombrado antes de llamar a la API. El choque con otra
 * etiqueta no distingue mayúsculas (como tags_user_name_uniq); cambiar solo
 * las mayúsculas de la propia etiqueta sí vale. La API vuelve a comprobarlo
 * (409 `conflict`).
 */
export function checkTagRename(
  tag: Pick<TagWithCount, "id" | "name">,
  raw: string,
  all: ReadonlyArray<Pick<TagWithCount, "id" | "name">>,
): TagRenameCheck {
  const name = normalizeTagName(raw);
  if (name === "") return { ok: false, reason: "empty" };
  if (name.length > GARMENT_TAG_MAX) return { ok: false, reason: "tooLong" };
  if (name === tag.name) return { ok: false, reason: "unchanged" };
  const key = name.toLowerCase();
  if (all.some((t) => t.id !== tag.id && t.name.toLowerCase() === key)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, name };
}

/**
 * Guardado optimista "del último valor": `set(v)` se aplica ya en la UI y se
 * envía; si llegan más cambios mientras hay una petición en vuelo, solo se
 * envía el último cuando termine (nunca dos a la vez, así la BD no se queda
 * con uno viejo). Si una petición falla, se vuelve al último valor confirmado
 * y se avisa con `onError`.
 */
export function createLatestSaver<T>({
  initial,
  save,
  apply,
  onError,
}: {
  initial: T;
  /** Envía el valor; devuelve el que ha quedado guardado. */
  save: (value: T) => Promise<T>;
  /** Pinta el valor (optimista o revertido). */
  apply: (value: T) => void;
  onError: (err: unknown) => void;
}) {
  let confirmed = initial;
  let desired = initial;
  let inflight = false;

  async function flush() {
    if (inflight) return;
    inflight = true;
    try {
      while (desired !== confirmed) {
        const target = desired;
        try {
          confirmed = await save(target);
        } catch (err) {
          desired = confirmed;
          apply(confirmed);
          onError(err);
          return;
        }
      }
    } finally {
      inflight = false;
    }
  }

  return {
    set(value: T): Promise<void> {
      if (value === desired) return Promise.resolve();
      desired = value;
      apply(value);
      return flush();
    },
    get value() {
      return desired;
    },
  };
}

export type LatestSaver<T> = ReturnType<typeof createLatestSaver<T>>;
