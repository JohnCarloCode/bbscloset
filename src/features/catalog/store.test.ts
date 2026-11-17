import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Garment, GarmentCountsResponse } from "@/lib/api/types";
import { SLOT_IDS, type SlotId } from "@/lib/domain/slots";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  ARCHIVE_BATCH,
  activeFilterCount,
  applyGarmentChange,
  catalogQueryParams,
  chunk,
  colorOptions,
  countParams,
  hasCatalogParams,
  idsParams,
  isAllSelected,
  listParams,
  parseCatalogQuery,
  sameQuery,
  useCatalogStore,
  visibleSlotChips,
  withoutGarment,
  type CatalogQuery,
} from "./store";

const T1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const zeros = () => Object.fromEntries(SLOT_IDS.map((s) => [s, 0])) as Record<SlotId, number>;

function counts(
  bySlot: Partial<Record<SlotId, number>>,
  archivedBySlot = {},
  byColor: GarmentCountsResponse["byColor"] = {},
  archivedByColor: GarmentCountsResponse["archivedByColor"] = {},
): GarmentCountsResponse {
  const b = { ...zeros(), ...bySlot };
  const a = { ...zeros(), ...archivedBySlot };
  const sum = (r: Record<string, number>) => Object.values(r).reduce((x, y) => x + y, 0);
  return {
    inUse: sum(b),
    archived: sum(a),
    bySlot: b,
    archivedBySlot: a,
    byColor,
    archivedByColor,
  };
}

const garment = (id: string): Garment => ({
  id,
  type_id: "tshirt",
  slot: "base_layer",
  name: null,
  seasons: [],
  color_hex: null,
  color_family: null,
  brand: null,
  archived: false,
  created_at: "2026-11-17T00:00:00Z",
  tags: [],
  thumbUrl: null,
});

describe("listParams", () => {
  it("vista en uso, Todo y sin filtros: solo el límite", () => {
    const p = listParams({ view: "active", slot: "all", filters: EMPTY_FILTERS });
    expect(p.toString()).toBe(`limit=${PAGE_SIZE}`);
  });

  it("archivadas, hueco, filtros y cursor", () => {
    const p = listParams(
      {
        view: "archived",
        slot: "bottom",
        filters: {
          types: ["jeans", "skirt"],
          brands: ["Zara", "Mango, Inc."],
          colors: ["red", "multicolor"],
          tags: ["t1", "t2"],
        },
      },
      "abc",
    );
    expect(p.get("archived")).toBe("true");
    expect(p.get("slot")).toBe("bottom");
    expect(p.getAll("type")).toEqual(["jeans", "skirt"]);
    expect(p.getAll("brand")).toEqual(["Zara", "Mango, Inc."]);
    expect(p.getAll("color")).toEqual(["red", "multicolor"]);
    expect(p.getAll("tags")).toEqual(["t1", "t2"]);
    expect(p.get("cursor")).toBe("abc");
  });
});

describe("countParams", () => {
  it("count=true con los mismos filtros y sin límite", () => {
    const p = countParams({
      view: "active",
      slot: "all",
      filters: { types: [], brands: [], colors: ["blue"], tags: [T1, T2] },
    });
    expect(p.get("count")).toBe("true");
    expect(p.has("limit")).toBe(false);
    expect(p.getAll("color")).toEqual(["blue"]);
    expect(p.getAll("tags")).toEqual([T1, T2]);
  });
});

describe("URL del catálogo", () => {
  const parse = (qs: string) => parseCatalogQuery(new URLSearchParams(qs));

  it("sin parámetros: valores por defecto, y por defecto no se escribe nada", () => {
    const q = parse("");
    expect(q).toEqual({ view: "active", slot: "all", filters: EMPTY_FILTERS });
    expect(catalogQueryParams(q).toString()).toBe("");
    expect(hasCatalogParams(new URLSearchParams(""))).toBe(false);
    expect(hasCatalogParams(new URLSearchParams("slot=bag"))).toBe(true);
  });

  it("ida y vuelta conserva vista, hueco y filtros", () => {
    const q: CatalogQuery = {
      view: "archived",
      slot: "bottom",
      filters: {
        types: ["jeans", "skirt"],
        brands: ["Zara", "H&M, vintage"],
        colors: ["black", "multicolor"],
        tags: [T1, T2],
      },
    };
    const qs = catalogQueryParams(q).toString();
    expect(new URLSearchParams(qs).getAll("color")).toEqual(["black", "multicolor"]);
    expect(parse(qs)).toEqual(q);
    expect(sameQuery(parse(qs), q)).toBe(true);
    expect(activeFilterCount(q.filters)).toBe(8);
  });

  it("ignora valores inválidos, duplicados y tipos de otro hueco", () => {
    const q = parse(
      `view=x&slot=nope&type=jeans&type=jeans&type=pijama&brand=%20&brand=Zara&brand=Zara&tags=no-uuid&tags=${T1.toUpperCase()}`,
    );
    expect(q.view).toBe("active");
    expect(q.slot).toBe("all");
    expect(q.filters).toEqual({ types: ["jeans"], brands: ["Zara"], colors: [], tags: [T1] });
    // Con hueco, solo los tipos de ese hueco.
    expect(parse("slot=footwear&type=jeans&type=sneakers").filters.types).toEqual(["sneakers"]);
  });

  it("colores: repetidos o con comas, sin duplicados ni desconocidos, en orden del dominio", () => {
    expect(parse("color=multicolor&color=red,navy&color=red&color=black").filters.colors).toEqual([
      "black",
      "red",
      "multicolor",
    ]);
    expect(hasCatalogParams(new URLSearchParams("color=red"))).toBe(true);
  });

  it("el orden de los parámetros importa para sameQuery solo si cambia el filtro", () => {
    const a = parse(`tags=${T1}&tags=${T2}`);
    expect(sameQuery(a, parse(`tags=${T1}&tags=${T2}`))).toBe(true);
    expect(sameQuery(a, parse(`tags=${T1}`))).toBe(false);
  });
});

describe("colorOptions", () => {
  const c = counts({ base_layer: 3 }, { bag: 1 }, { red: 2, black: 1 }, { pink: 1 });

  it("sin recuentos: las 13 familias", () => {
    expect(colorOptions(null, "active", [])).toHaveLength(13);
  });

  it("solo las familias con prendas en la vista, en orden del dominio", () => {
    expect(colorOptions(c, "active", [])).toEqual(["black", "red"]);
    expect(colorOptions(c, "archived", [])).toEqual(["pink"]);
  });

  it("las elegidas siguen aunque no queden prendas", () => {
    expect(colorOptions(c, "active", ["blue"])).toEqual(["black", "red", "blue"]);
  });
});

describe("visibleSlotChips", () => {
  const c: GarmentCountsResponse = counts({ base_layer: 3, footwear: 2 }, { bag: 1 });

  it("Todo siempre y solo los huecos con prendas, en orden", () => {
    expect(visibleSlotChips(c, "active", "all")).toEqual([
      { slot: "all", count: 5 },
      { slot: "base_layer", count: 3 },
      { slot: "footwear", count: 2 },
    ]);
  });

  it("en Archivadas cuenta las archivadas", () => {
    expect(visibleSlotChips(c, "archived", "all")).toEqual([
      { slot: "all", count: 1 },
      { slot: "bag", count: 1 },
    ]);
  });

  it("el hueco elegido sigue aunque se quede a cero", () => {
    expect(visibleSlotChips(c, "active", "jewelry").map((x) => x.slot)).toContain("jewelry");
  });
});

describe("applyGarmentChange / withoutGarment (ficha, 3.10)", () => {
  const active: CatalogQuery = { view: "active", slot: "all", filters: EMPTY_FILTERS };
  const at = (id: string, day: number): Garment => ({
    ...garment(id),
    created_at: `2026-11-${String(day).padStart(2, "0")}T00:00:00Z`,
  });
  const list = [at("c", 3), at("b", 2), at("a", 1)];
  const ids = (xs: Garment[]) => xs.map((g) => g.id);

  it("editar sustituye a la prenda en su sitio", () => {
    const next = applyGarmentChange(list, { ...at("b", 2), name: "Nueva" }, active, true);
    expect(ids(next)).toEqual(["c", "b", "a"]);
    expect(next[1].name).toBe("Nueva");
  });

  it("archivar la saca de la vista En uso; deshacer la devuelve a su sitio", () => {
    const archived = applyGarmentChange(list, { ...at("b", 2), archived: true }, active, true);
    expect(ids(archived)).toEqual(["c", "a"]);
    const back = applyGarmentChange(archived, at("b", 2), active, true);
    expect(ids(back)).toEqual(["c", "b", "a"]);
  });

  it("cambiar el tipo a otro hueco la saca del hueco filtrado", () => {
    const q: CatalogQuery = { ...active, slot: "base_layer" };
    const g = { ...at("b", 2), type_id: "jeans" as const, slot: "bottom" as const };
    expect(ids(applyGarmentChange(list, g, q, true))).toEqual(["c", "a"]);
  });

  it("deja de cumplir un filtro de etiquetas: sale", () => {
    const q: CatalogQuery = { ...active, filters: { ...EMPTY_FILTERS, tags: [T1] } };
    const tagged = list.map((g) => ({ ...g, tags: [{ id: T1, name: "x" }] }));
    expect(ids(applyGarmentChange(tagged, at("b", 2), q, true))).toEqual(["c", "a"]);
  });

  it("una que no estaba y cae detrás de lo cargado no entra si la lista no está completa", () => {
    const short = [at("c", 3), at("b", 2)];
    expect(applyGarmentChange(short, at("a", 1), active, false)).toBe(short);
    expect(ids(applyGarmentChange(short, at("a", 1), active, true))).toEqual(["c", "b", "a"]);
  });

  it("sin cambios devuelve la misma lista", () => {
    expect(applyGarmentChange(list, { ...at("z", 5), archived: true }, active, true)).toBe(list);
    expect(withoutGarment(list, "z")).toBe(list);
    expect(ids(withoutGarment(list, "b"))).toEqual(["c", "a"]);
  });
});

describe("selección en lote (3.11): funciones puras", () => {
  it("idsParams pide ids=true con los filtros y sin límite ni cursor", () => {
    const p = idsParams({
      view: "archived",
      slot: "outer_layer",
      filters: { ...EMPTY_FILTERS, brands: ["Zara"] },
    });
    expect(p.get("ids")).toBe("true");
    expect(p.get("archived")).toBe("true");
    expect(p.get("slot")).toBe("outer_layer");
    expect(p.getAll("brand")).toEqual(["Zara"]);
    expect(p.has("limit")).toBe(false);
  });

  it("chunk parte en tandas", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 500)).toEqual([]);
  });

  it("isAllSelected compara con los ids de Seleccionar todo", () => {
    expect(isAllSelected(["a", "b"], null)).toBe(false);
    expect(isAllSelected([], [])).toBe(false);
    expect(isAllSelected(["b", "a"], ["a", "b"])).toBe(true);
    expect(isAllSelected(["a"], ["a", "b"])).toBe(false);
  });
});

describe("useCatalogStore", () => {
  const initial = useCatalogStore.getState();
  const fetchMock = vi.fn();

  beforeEach(() => {
    useCatalogStore.setState(initial, true);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url, "http://x");
      if (u.pathname === "/api/garments/counts") {
        return Response.json(counts({ base_layer: 30 }));
      }
      const cursor = u.searchParams.get("cursor");
      return Response.json(
        cursor
          ? { items: [garment("c"), garment("b")], nextCursor: null }
          : { items: [garment("a"), garment("b")], nextCursor: "next" },
      );
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("carga recuentos y primera página, y pagina por cursor sin duplicar", async () => {
    await useCatalogStore.getState().load();
    let s = useCatalogStore.getState();
    expect(s.status).toBe("ready");
    expect(s.counts?.inUse).toBe(30);
    expect(s.items.map((g) => g.id)).toEqual(["a", "b"]);
    expect(s.nextCursor).toBe("next");

    await s.loadMore();
    s = useCatalogStore.getState();
    expect(s.items.map((g) => g.id)).toEqual(["a", "b", "c"]);
    expect(s.nextCursor).toBeNull();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toContain("cursor=next");

    // Sin cursor no hay más peticiones.
    const calls = fetchMock.mock.calls.length;
    await s.loadMore();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("cambiar de hueco reinicia la lista y pide con ese hueco", async () => {
    await useCatalogStore.getState().load();
    useCatalogStore.getState().setSlot("bottom");
    expect(useCatalogStore.getState().items).toEqual([]);
    await vi.waitFor(() => expect(useCatalogStore.getState().status).toBe("ready"));
    const listCall = fetchMock.mock.calls.map((c) => c[0] as string).at(-1);
    expect(listCall).toContain("slot=bottom");
  });

  it("cambiar de hueco vacía los tipos pero conserva marcas, colores y etiquetas", () => {
    useCatalogStore.getState().setQuery({
      view: "active",
      slot: "bottom",
      filters: { types: ["jeans"], brands: ["Zara"], colors: ["red"], tags: [T1] },
    });
    useCatalogStore.getState().setSlot("footwear");
    expect(useCatalogStore.getState().filters).toEqual({
      types: [],
      brands: ["Zara"],
      colors: ["red"],
      tags: [T1],
    });
  });

  it("insertSaved mete la prenda subida delante sin vaciar y reloadCounts actualiza la cabecera", async () => {
    await useCatalogStore.getState().load();
    const fresh = { ...garment("z"), created_at: "2026-11-18T00:00:00Z" };
    useCatalogStore.getState().insertSaved(fresh);
    expect(useCatalogStore.getState().items.map((g) => g.id)).toEqual(["z", "a", "b"]);
    // Otra vista: no entra.
    useCatalogStore.setState({ view: "archived" });
    useCatalogStore.getState().insertSaved({ ...fresh, id: "y" });
    expect(useCatalogStore.getState().items.map((g) => g.id)).toEqual(["z", "a", "b"]);

    fetchMock.mockImplementation(async () => Response.json(counts({ base_layer: 31 })));
    await useCatalogStore.getState().reloadCounts();
    expect(useCatalogStore.getState().counts?.inUse).toBe(31);
    expect(useCatalogStore.getState().status).toBe("ready");
  });

  it("updateGarment y removeGarment cambian la lista y piden los recuentos", async () => {
    await useCatalogStore.getState().load();
    useCatalogStore.setState({ selectedIds: ["a", "b"] });
    fetchMock.mockClear();

    useCatalogStore.getState().updateGarment({ ...garment("a"), name: "Camiseta" });
    expect(useCatalogStore.getState().items.map((g) => g.name)).toEqual(["Camiseta", null]);

    useCatalogStore.getState().updateGarment({ ...garment("a"), archived: true });
    expect(useCatalogStore.getState().items.map((g) => g.id)).toEqual(["b"]);
    expect(useCatalogStore.getState().selectedIds).toEqual(["b"]);

    useCatalogStore.getState().removeGarment("b");
    expect(useCatalogStore.getState().items).toEqual([]);
    expect(useCatalogStore.getState().selectedIds).toEqual([]);

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.includes("/api/garments/counts"))).toHaveLength(3);
  });

  it("modo selección: marcar, desmarcar y salir vacía la selección", () => {
    const st = useCatalogStore.getState();
    st.setSelecting(true);
    st.toggleSelected("a");
    st.toggleSelected("b");
    st.toggleSelected("a");
    expect(useCatalogStore.getState()).toMatchObject({ selecting: true, selectedIds: ["b"] });
    useCatalogStore.getState().setSelecting(false);
    expect(useCatalogStore.getState()).toMatchObject({ selecting: false, selectedIds: [] });
  });

  it("cambiar de vista sale del modo; cambiar de hueco solo vacía la selección", async () => {
    await useCatalogStore.getState().load();
    useCatalogStore.getState().setSelecting(true);
    useCatalogStore.getState().setSelected(["a"]);
    useCatalogStore.getState().setSlot("outer_layer");
    expect(useCatalogStore.getState()).toMatchObject({ selecting: true, selectedIds: [] });
    useCatalogStore.getState().setSelected(["a"]);
    useCatalogStore.getState().setView("archived");
    expect(useCatalogStore.getState()).toMatchObject({ selecting: false, selectedIds: [] });
  });

  it("selectAll pide los ids con los filtros vigentes (también los no cargados)", async () => {
    await useCatalogStore.getState().load();
    useCatalogStore.setState({ slot: "outer_layer" });
    useCatalogStore.getState().setSelecting(true);
    fetchMock.mockImplementation(async () => Response.json({ ids: ["a", "b", "x"] }));
    await useCatalogStore.getState().selectAll();
    const s = useCatalogStore.getState();
    expect(s.selectedIds).toEqual(["a", "b", "x"]);
    expect(isAllSelected(s.selectedIds, s.allIds)).toBe(true);
    const url = fetchMock.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("ids=true");
    expect(url).toContain("slot=outer_layer");
  });

  it("selectAll ignora la respuesta si cambió la consulta entretanto", async () => {
    await useCatalogStore.getState().load();
    useCatalogStore.getState().setSelecting(true);
    let resolve!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (resolve = r)));
    const p = useCatalogStore.getState().selectAll();
    useCatalogStore.getState().setSlot("bottom");
    resolve(Response.json({ ids: ["a"] }));
    await p;
    expect(useCatalogStore.getState().selectedIds).toEqual([]);
  });

  it("setArchived archiva por tandas, quita las tarjetas y pide los recuentos", async () => {
    await useCatalogStore.getState().load();
    useCatalogStore.getState().setSelecting(true);
    useCatalogStore.getState().setSelected(["a"]);
    fetchMock.mockClear();
    const bodies: unknown[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/garments/archive")) {
        const body = JSON.parse(String(init?.body)) as { ids: string[] };
        bodies.push(body);
        return Response.json({ updated: body.ids.length });
      }
      return Response.json(counts({ base_layer: 29 }, { base_layer: 1 }));
    });
    const many = ["a", ...Array.from({ length: ARCHIVE_BATCH }, (_, i) => `z${i}`)];
    const updated = await useCatalogStore.getState().setArchived(many, true);
    expect(updated).toBe(ARCHIVE_BATCH + 1);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ archived: true });
    const s = useCatalogStore.getState();
    expect(s.items.map((g) => g.id)).toEqual(["b"]);
    expect(s.selectedIds).toEqual([]);
    await vi.waitFor(() => expect(useCatalogStore.getState().counts?.archived).toBe(1));
  });

  it("deshacer (setArchived inverso en la misma vista) recarga la lista", async () => {
    await useCatalogStore.getState().load();
    await useCatalogStore.getState().setArchived(["a"], true);
    expect(useCatalogStore.getState().items.map((g) => g.id)).toEqual(["b"]);
    fetchMock.mockClear();
    await useCatalogStore.getState().setArchived(["a"], false);
    await vi.waitFor(() => expect(useCatalogStore.getState().status).toBe("ready"));
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls[0]).toContain("/api/garments/archive");
    expect(urls.some((u) => u.startsWith("/api/garments?"))).toBe(true);
    expect(useCatalogStore.getState().items.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("setArchived lanza si la API falla y no toca la lista", async () => {
    await useCatalogStore.getState().load();
    fetchMock.mockImplementation(async () =>
      Response.json({ error: { code: "internal", message: "x" } }, { status: 500 }),
    );
    await expect(useCatalogStore.getState().setArchived(["a"], true)).rejects.toThrow();
    expect(useCatalogStore.getState().items.map((g) => g.id)).toEqual(["a", "b"]);
  });

  it("un error de red deja el estado de error con su código", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await useCatalogStore.getState().load();
    expect(useCatalogStore.getState()).toMatchObject({ status: "error", errorCode: "network" });
  });
});
