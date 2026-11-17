import { describe, expect, it } from "vitest";
import type { Garment } from "@/lib/api/types";
import type { GarmentData, QueueItem } from "@/features/queue/types";
import {
  garmentMatches,
  insertGarment,
  isPendingGarment,
  pendingColorFamily,
  pendingForGrid,
  pendingMatches,
  pendingPhase,
} from "./pending";
import { EMPTY_FILTERS, type CatalogQuery } from "./store";

const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TAGS = [
  { id: T1, name: "verano" },
  { id: T2, name: "oficina" },
];

const ALL: CatalogQuery = { view: "active", slot: "all", filters: EMPTY_FILTERS };
const q = (patch: Partial<CatalogQuery> & { f?: Partial<CatalogQuery["filters"]> }) => ({
  ...ALL,
  ...patch,
  filters: { ...EMPTY_FILTERS, ...patch.f },
});

const data = (patch: Partial<GarmentData> = {}): GarmentData => ({
  type_id: "tshirt",
  seasons: [],
  tags: [],
  ...patch,
});

let n = 0;
const item = (patch: Partial<QueueItem> = {}): QueueItem => ({
  localId: `l${++n}`,
  userId: "u",
  kind: "garment",
  createdAt: n,
  status: "cutting",
  progress: 0.3,
  mode: "cut",
  source: new Blob(),
  garmentData: data(),
  ...patch,
});

const garment = (id: string, created_at: string, patch: Partial<Garment> = {}): Garment => ({
  id,
  type_id: "tshirt",
  slot: "base_layer",
  name: null,
  seasons: [],
  color_hex: null,
  color_family: null,
  brand: null,
  archived: false,
  created_at,
  tags: [],
  thumbUrl: null,
  ...patch,
});

describe("isPendingGarment", () => {
  it("solo prendas nuevas con tipo y sin subir", () => {
    expect(isPendingGarment(item())).toBe(true);
    expect(isPendingGarment(item({ status: "ready", uploadError: "unknown" }))).toBe(true);
    expect(isPendingGarment(item({ uploaded: true }))).toBe(false);
    // Subida masiva sin tipo: va a la franja "por revisar" (3.12).
    expect(isPendingGarment(item({ garmentData: undefined, needsReview: true }))).toBe(false);
    expect(isPendingGarment(item({ kind: "replace", garmentId: "g" }))).toBe(false);
    expect(isPendingGarment(item({ kind: "batch" }))).toBe(false);
  });
});

describe("pendingColorFamily", () => {
  it("multicolor explícito, familia del hex o nada", () => {
    expect(pendingColorFamily(data({ color_family: "multicolor" }))).toBe("multicolor");
    expect(pendingColorFamily(data({ color_hex: "#000000" }))).toBe("black");
    expect(pendingColorFamily(data({ color_hex: null }))).toBeNull();
  });
});

describe("pendingMatches", () => {
  it("sin filtros, en uso: sí; en Archivadas: nunca", () => {
    expect(pendingMatches(data(), ALL, null)).toBe(true);
    expect(pendingMatches(data(), q({ view: "archived" }), null)).toBe(false);
  });

  it("hueco y tipos por type_id", () => {
    expect(pendingMatches(data(), q({ slot: "base_layer" }), null)).toBe(true);
    expect(pendingMatches(data(), q({ slot: "bottom" }), null)).toBe(false);
    expect(pendingMatches(data(), q({ f: { types: ["shirt", "tshirt"] } }), null)).toBe(true);
    expect(pendingMatches(data(), q({ f: { types: ["shirt"] } }), null)).toBe(false);
  });

  it("marcas con O, sin distinguir mayúsculas; sin marca no encaja", () => {
    const f = q({ f: { brands: ["Zara", "COS"] } });
    expect(pendingMatches(data({ brand: "cos" }), f, null)).toBe(true);
    expect(pendingMatches(data({ brand: "Mango" }), f, null)).toBe(false);
    expect(pendingMatches(data(), f, null)).toBe(false);
  });

  it("familias de color con O", () => {
    const f = q({ f: { colors: ["black", "multicolor"] } });
    expect(pendingMatches(data({ color_hex: "#000000" }), f, null)).toBe(true);
    expect(pendingMatches(data({ color_family: "multicolor" }), f, null)).toBe(true);
    expect(pendingMatches(data({ color_hex: "#ffffff" }), f, null)).toBe(false);
    expect(pendingMatches(data(), f, null)).toBe(false);
  });

  it("etiquetas con Y, por nombre; sin opciones cargadas no encaja", () => {
    const one = q({ f: { tags: [T1] } });
    const both = q({ f: { tags: [T1, T2] } });
    expect(pendingMatches(data({ tags: ["verano"] }), one, TAGS)).toBe(true);
    expect(pendingMatches(data({ tags: ["Verano"] }), one, TAGS)).toBe(true);
    expect(pendingMatches(data({ tags: ["verano"] }), both, TAGS)).toBe(false);
    expect(pendingMatches(data({ tags: ["verano", "oficina"] }), both, TAGS)).toBe(true);
    expect(pendingMatches(data({ tags: ["verano"] }), one, null)).toBe(false);
  });
});

describe("pendingForGrid", () => {
  it("filtra, quita las que no son pendientes y ordena de más nueva a más vieja", () => {
    const a = item({ createdAt: 10 });
    const b = item({ createdAt: 30, garmentData: data({ type_id: "jeans" }) });
    const c = item({ createdAt: 20 });
    const review = item({ createdAt: 40, garmentData: undefined, needsReview: true });
    const done = item({ createdAt: 50, uploaded: true });
    const items = [a, b, c, review, done];
    expect(pendingForGrid(items, ALL, null).map((i) => i.localId)).toEqual([
      b.localId,
      c.localId,
      a.localId,
    ]);
    expect(pendingForGrid(items, q({ slot: "bottom" }), null)).toEqual([b]);
    expect(pendingForGrid(items, q({ view: "archived" }), null)).toEqual([]);
  });

  it("las del relevo (ya subidas) siguen hasta que llega la fila real, sin duplicarse", () => {
    const a = item({ createdAt: 10 });
    const up = item({ createdAt: 20, uploaded: true });
    // Ya no está en la cola (acabó la tanda) pero sí en el relevo.
    expect(pendingForGrid([a], ALL, null, [up]).map((i) => i.localId)).toEqual([
      up.localId,
      a.localId,
    ]);
    // Sigue en la cola marcada como subida: sale una sola vez.
    expect(pendingForGrid([a, up], ALL, null, [up])).toHaveLength(2);
    // El relevo también respeta los filtros.
    expect(pendingForGrid([], q({ slot: "bottom" }), null, [up])).toEqual([]);
  });
});

describe("pendingPhase", () => {
  it("recortando, subiendo o error", () => {
    expect(pendingPhase(item({ status: "queued" }))).toBe("cutting");
    expect(pendingPhase(item({ status: "cutting" }))).toBe("cutting");
    expect(pendingPhase(item({ status: "ready" }))).toBe("uploading");
    expect(pendingPhase(item({ status: "ready", uploadError: "limit_reached" }))).toBe(
      "uploadError",
    );
    expect(pendingPhase(item({ status: "error", error: "cut_failed" }))).toBe("cutError");
  });
});

describe("garmentMatches", () => {
  const g = garment("g1", "2026-11-17T10:00:00Z", {
    brand: "Zara",
    color_family: "black",
    tags: [{ id: T1, name: "verano" }],
  });
  it("vista, hueco y filtros como la API", () => {
    expect(garmentMatches(g, ALL)).toBe(true);
    expect(garmentMatches(g, q({ view: "archived" }))).toBe(false);
    expect(garmentMatches(g, q({ slot: "bottom" }))).toBe(false);
    expect(garmentMatches(g, q({ f: { types: ["tshirt"], brands: ["Zara"] } }))).toBe(true);
    expect(garmentMatches(g, q({ f: { colors: ["white"] } }))).toBe(false);
    expect(garmentMatches(g, q({ f: { tags: [T1] } }))).toBe(true);
    expect(garmentMatches(g, q({ f: { tags: [T1, T2] } }))).toBe(false);
  });
});

describe("insertGarment", () => {
  const old1 = garment("b", "2026-11-17T09:00:00Z");
  const old2 = garment("a", "2026-11-17T08:00:00Z");

  it("la nueva va delante (created_at desc)", () => {
    const g = garment("z", "2026-11-17T10:00:00Z");
    expect(insertGarment([old1, old2], g, false).map((x) => x.id)).toEqual(["z", "b", "a"]);
  });

  it("en medio, y a igual fecha por id desc", () => {
    const mid = garment("m", "2026-11-17T08:30:00Z");
    expect(insertGarment([old1, old2], mid, true).map((x) => x.id)).toEqual(["b", "m", "a"]);
    const tie = garment("c", "2026-11-17T09:00:00Z");
    expect(insertGarment([old1, old2], tie, true).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("detrás de la última: solo si la lista está completa", () => {
    const last = garment("x", "2026-11-17T07:00:00Z");
    const list = [old1, old2];
    expect(insertGarment(list, last, false)).toBe(list);
    expect(insertGarment(list, last, true).map((x) => x.id)).toEqual(["b", "a", "x"]);
  });

  it("si ya estaba, no se duplica", () => {
    const again = { ...old1, name: "nuevo" };
    const out = insertGarment([old1, old2], again, false);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
    expect(out[0].name).toBe("nuevo");
  });
});
