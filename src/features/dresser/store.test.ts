import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { autoLayout } from "@/lib/layout/autoLayout";
import type { GarmentTypeId } from "@/lib/domain/types";
import { slotOfType } from "@/lib/domain/types";
import { serializeDraft } from "./draft";
import { toggleLock, updateTransform } from "./model";
import { relayout, resetDresserStoreForTests, useDresserStore, type KnownGarment } from "./store";

const SIZE = { width: 400, height: 600 };

function g(id: string, typeId: GarmentTypeId, aspect?: number): KnownGarment {
  return { id, typeId, slot: slotOfType(typeId), thumbUrl: null, label: null, aspect };
}

const store = () => useDresserStore.getState();
const items = () => store().canvas.items;
const item = (id: string) => items().find((i) => i.garmentId === id)!;

beforeEach(() => {
  resetDresserStoreForTests();
  store().setCanvasSize(SIZE);
});

describe("tapGarment", () => {
  it("pone la prenda y la vuelve a quitar al tocarla otra vez", () => {
    const tee = g("tee", "tshirt");
    const r1 = store().tapGarment(tee);
    expect(r1.removed).toBeNull();
    expect(items().map((i) => i.garmentId)).toEqual(["tee"]);
    expect(store().garments.tee).toBeDefined();

    const r2 = store().tapGarment(tee);
    expect(r2.removed?.garmentId).toBe("tee");
    expect(items()).toEqual([]);
  });

  it("sustituye en el mismo hueco y devuelve los eventos", () => {
    store().tapGarment(g("tee", "tshirt"));
    const r = store().tapGarment(g("shirt", "shirt"));
    expect(r.events.replaced.map((i) => i.garmentId)).toEqual(["tee"]);
    expect(items().map((i) => i.garmentId)).toEqual(["shirt"]);
  });

  it("el vestido quita capa base y parte inferior", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().tapGarment(g("jeans", "jeans"));
    const r = store().tapGarment(g("dress", "dress"));
    expect(r.events.removedByFullBody.map((i) => i.garmentId).sort()).toEqual(["jeans", "tee"]);
    expect(items().map((i) => i.garmentId)).toEqual(["dress"]);
  });

  it("respeta jewelryMax del perfil", () => {
    store().setJewelryMax(2);
    store().tapGarment(g("j1", "ring"));
    store().tapGarment(g("j2", "ring"));
    const r = store().tapGarment(g("j3", "necklace"));
    expect(r.events.jewelryDropped?.garmentId).toBe("j1");
    expect(items().map((i) => i.garmentId)).toEqual(["j2", "j3"]);
  });

  it("aplica la colocación automática con el tamaño del lienzo y los aspectos", () => {
    store().tapGarment(g("tee", "tshirt", 0.8));
    store().tapGarment(g("jeans", "jeans", 0.5));
    const expected = autoLayout(
      items().map((i) => ({
        garmentId: i.garmentId,
        slotId: i.slotId,
        aspect: i.garmentId === "tee" ? 0.8 : 0.5,
        placedAt: i.placedAt,
      })),
      SIZE,
    );
    for (const e of expected) {
      expect(item(e.garmentId)).toMatchObject({ x: e.x, y: e.y, scale: e.scale });
    }
  });

  it("quitar la prenda seleccionada limpia la selección", () => {
    const tee = g("tee", "tshirt");
    store().tapGarment(tee);
    store().setSelected("tee");
    store().tapGarment(tee);
    expect(store().selectedId).toBeNull();
  });
});

describe("recolocación", () => {
  it("conserva la transformación y la z de los manuales y mueve los no manuales", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().tapGarment(g("jeans", "jeans"));
    // El usuario mueve la camiseta y la sube de capa.
    const moved = updateTransform(store().canvas, "tee", {
      x: 0.1,
      y: 0.2,
      scale: 0.3,
      rotation: 15,
    });
    store().commit({
      items: moved.items.map((i) => (i.garmentId === "tee" ? { ...i, z: 99 } : i)),
    });
    const jeansBefore = item("jeans");

    // Pantalla partida: el lienzo cambia de tamaño.
    store().setCanvasSize({ width: 400, height: 260 });

    expect(item("tee")).toMatchObject({
      x: 0.1,
      y: 0.2,
      scale: 0.3,
      rotation: 15,
      z: 99,
      manual: true,
    });
    const jeans = item("jeans");
    expect(jeans.manual).toBe(false);
    expect(jeans.z).toBe(jeansBefore.z);
    expect(jeans.scale).not.toBe(jeansBefore.scale);
  });

  it("recoloca al conocer el aspecto real de un recorte", () => {
    store().tapGarment(g("jeans", "jeans"));
    const before = item("jeans");
    store().setAspect("jeans", 0.4);
    expect(store().garments.jeans.aspect).toBe(0.4);
    expect(item("jeans")).not.toEqual(before);
  });

  it("sin tamaño de lienzo no cambia nada", () => {
    const state = { items: [{ ...emptyItem(), x: 0.3 }] };
    expect(relayout(state, () => 1, { width: 0, height: 0 })).toBe(state);
  });

  it("la z del item manda aunque no sea manual", () => {
    const state = { items: [{ ...emptyItem(), z: 7 }] };
    const next = relayout(state, () => 1, SIZE);
    expect(next.items[0].z).toBe(7);
    expect(next.items[0].x).not.toBe(0.3);
  });
});

describe("panel", () => {
  it("empieza en medio y la barrita sube y baja un nivel sin pasarse", () => {
    expect(store().drawer).toBe("half");
    store().stepDrawer(1);
    expect(store().drawer).toBe("expanded");
    store().stepDrawer(1);
    expect(store().drawer).toBe("expanded");
    store().stepDrawer(-1);
    store().stepDrawer(-1);
    expect(store().drawer).toBe("closed");
    store().stepDrawer(-1);
    expect(store().drawer).toBe("closed");
  });

  it("tocar prendas no cambia la altura del panel", () => {
    store().setDrawer("expanded");
    for (const [id, type] of [
      ["a", "tshirt"],
      ["b", "jeans"],
      ["c", "shirt"],
      ["d", "dress"],
      ["e", "sneakers"],
    ] as const)
      store().tapGarment(g(id, type));
    expect(store().drawer).toBe("expanded");
  });
});

function emptyItem() {
  return {
    garmentId: "x",
    slotId: "bottom" as const,
    x: 0.3,
    y: 0.5,
    scale: 0.4,
    rotation: 0,
    z: 30,
    locked: false,
    manual: false,
    placedAt: 1,
  };
}

describe("deshacer mínimo y aleatorios (4.5)", () => {
  afterEach(() => vi.unstubAllGlobals());

  // Listas de los huecos ya en caché: los aleatorios no piden nada a la red.
  const seedPools = (pools: Record<string, string[]>) =>
    useDresserStore.setState({
      pools: Object.fromEntries(
        Object.entries(pools).map(([slot, ids]) => [slot, { ids, fetchedAt: Date.now() }]),
      ),
    });

  it("commit guarda el estado anterior y undo lo restaura", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().tapGarment(g("dress", "dress"));
    expect(items().map((i) => i.garmentId)).toEqual(["dress"]);
    store().undo();
    expect(items().map((i) => i.garmentId)).toEqual(["tee"]);
    store().undo();
    expect(items()).toEqual([]);
    store().undo();
    expect(items()).toEqual([]);
  });

  it("el candado pasa por commit (se puede deshacer)", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().commit(toggleLock(store().canvas, "tee"));
    expect(item("tee").locked).toBe(true);
    store().undo();
    expect(item("tee").locked).toBe(false);
  });

  it("Sustituir con 2 camisetas alterna en cada pulsación", async () => {
    seedPools({ base_layer: ["t1", "t2"] });
    store().tapGarment(g("t1", "tshirt"));
    const seen: string[] = [];
    for (let k = 0; k < 10; k++) {
      const r = await store().runSubstitute();
      expect(r.changed).toBe(1);
      seen.push(items()[0].garmentId);
    }
    expect(seen).toEqual(["t2", "t1", "t2", "t1", "t2", "t1", "t2", "t1", "t2", "t1"]);
  });

  it("Sustituir respeta el candado del pantalón", async () => {
    seedPools({ base_layer: ["t1", "t2"], bottom: ["p1", "p2"] });
    store().tapGarment(g("t1", "tshirt"));
    store().tapGarment(g("p1", "trousers"));
    store().commit(toggleLock(store().canvas, "p1"));
    await store().runSubstitute();
    expect(
      items()
        .map((i) => i.garmentId)
        .sort(),
    ).toEqual(["p1", "t2"]);
  });

  it("Outfit aleatorio vacía el lienzo y devuelve las categorías sin prendas", async () => {
    seedPools({ base_layer: ["t1"], bottom: ["p1"], footwear: [], bag: [] });
    store().tapGarment(g("hat", "hat"));
    const r = await store().runRandomOutfit(() => 0);
    expect(r.empty).toEqual(["footwear", "bag"]);
    expect(items().map((i) => i.garmentId)).toEqual(["t1", "p1"]);
  });

  it("loadPool pide solo ids de los huecos que faltan", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      Response.json({ ids: url.includes("slot=bag") ? [] : ["x"] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    useDresserStore.setState({ counts: { ...zeroCounts(), base_layer: 1, bag: 2 } });
    const pool = await store().loadPool(["base_layer", "bag", "footwear"]);
    expect(pool).toEqual({ base_layer: ["x"], bag: [], footwear: [] });
    // footwear tiene 0 en los recuentos: no se pide.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("ids=true");
    // Segunda vez, de la caché.
    await store().loadPool(["base_layer"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("setRandomSlots vuelve atrás si falla el guardado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    await expect(store().setRandomSlots(["bag"])).rejects.toBeTruthy();
    expect(store().randomSlots).toEqual(["base_layer", "bottom", "footwear", "bag"]);
  });
});

describe("setRandomSlots en orden", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dos cambios seguidos: un PATCH cada vez y el último gana", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body.random_slots);
        await new Promise((r) => setTimeout(r, 5));
        return Response.json({ random_slots: body.random_slots, jewelry_max: 3 });
      }),
    );
    const p1 = store().setRandomSlots(["bag"]);
    const p2 = store().setRandomSlots(["bag", "jewelry"]);
    await Promise.all([p1, p2]);
    expect(bodies).toEqual([["bag"], ["bag", "jewelry"]]);
    expect(store().randomSlots).toEqual(["bag", "jewelry"]);
  });
});

describe("historial (4.6)", () => {
  const ids = () => items().map((i) => i.garmentId);

  it("rehacer tras deshacer; una acción nueva vacía future", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().tapGarment(g("jeans", "jeans"));
    store().undo();
    expect(ids()).toEqual(["tee"]);
    expect(store().future).toHaveLength(1);
    store().redo();
    expect(ids()).toEqual(["tee", "jeans"]);
    expect(store().future).toHaveLength(0);
    store().undo();
    store().tapGarment(g("bag", "handbag"));
    expect(store().future).toEqual([]);
    store().redo();
    expect(ids()).toEqual(["tee", "bag"]);
  });

  it("el fin de un gesto es un paso; los reajustes por tamaño o aspecto no", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().commit(updateTransform(store().canvas, "tee", { x: 0.1, y: 0.1 }));
    expect(store().past).toHaveLength(2);
    store().setCanvasSize({ width: 800, height: 500 });
    store().setAspect("tee", 0.5);
    expect(store().past).toHaveLength(2);
    store().undo();
    expect(item("tee").manual).toBe(false);
    store().redo();
    expect(item("tee")).toMatchObject({ manual: true, x: 0.1, y: 0.1 });
  });

  it("la selección no forma parte del historial, pero se suelta si la prenda desaparece", () => {
    store().tapGarment(g("tee", "tshirt"));
    store().setSelected("tee");
    store().tapGarment(g("jeans", "jeans"));
    store().undo();
    expect(store().selectedId).toBe("tee");
    store().undo();
    expect(store().selectedId).toBeNull();
  });

  it("Colocación automática quita los ajustes manuales y se puede deshacer", () => {
    store().tapGarment(g("tee", "tshirt"));
    const auto = item("tee");
    store().commit(updateTransform(store().canvas, "tee", { x: 0.9, rotation: 30 }));
    const steps = store().past.length;
    store().autoArrange();
    expect(item("tee")).toMatchObject({ manual: false, x: auto.x, y: auto.y, rotation: 0 });
    expect(store().past).toHaveLength(steps + 1);
    store().undo();
    expect(item("tee")).toMatchObject({ manual: true, x: 0.9 });
    // Sin ajustes manuales no hace nada.
    store().redo();
    store().autoArrange();
    expect(store().past).toHaveLength(steps + 1);
  });
});

describe("borrador (4.6)", () => {
  const U1 = "11111111-1111-1111-1111-111111111111";
  const TEE = "6f1c2a4e-0b7d-4a51-9c3e-2d8f5b6a7c10";
  const JEANS = "0e2d4f6a-8b1c-4d3e-a5f7-9b0c2d4e6f81";
  const BAG = "3a5c7e9b-1d2f-4b6a-8c0e-5f7a9b1c3d52";
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Guarda como borrador lo que hay ahora en el lienzo y vacía el store. */
  function saveAndReset() {
    const { canvas, garments } = store();
    storage.set(
      `bbscloset:draft:${U1}`,
      serializeDraft(canvas, (id) => garments[id] && { typeId: garments[id].typeId }),
    );
    resetDresserStoreForTests();
    store().setCanvasSize(SIZE);
  }

  it("restaura el lienzo sin historial, con el tipo de cada prenda", () => {
    store().tapGarment(g(TEE, "tshirt"));
    store().tapGarment(g(JEANS, "jeans"));
    store().commit(updateTransform(store().canvas, JEANS, { x: 0.7, y: 0.8 }));
    const before = store().canvas;
    saveAndReset();

    store().openDraft(U1);
    expect(store().draftOwner).toBe(U1);
    expect(store().canvas).toEqual(before);
    expect(store().past).toEqual([]);
    expect(store().future).toEqual([]);
    expect(store().garments[TEE]).toMatchObject({ typeId: "tshirt", slot: "base_layer" });
  });

  it("si ya ha empezado a vestir, no pisa lo suyo; otro usuario empieza de cero", () => {
    store().tapGarment(g(TEE, "tshirt"));
    saveAndReset();
    store().tapGarment(g(BAG, "handbag"));
    store().openDraft(U1);
    expect(items().map((i) => i.garmentId)).toEqual([BAG]);
    expect(store().past).toHaveLength(1);

    store().openDraft("22222222-2222-2222-2222-222222222222");
    expect(items()).toEqual([]);
    expect(store().past).toEqual([]);
    expect(store().garments).toEqual({});
  });

  it("syncCanvasGarments quita en silencio las que ya no valen, también del historial", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      Response.json({
        items: [TEE, BAG]
          .filter((id) => url.includes(id))
          .map((id) => ({
            id,
            type_id: id === TEE ? "tshirt" : "handbag",
            slot: id === TEE ? "base_layer" : "bag",
            name: null,
            thumbUrl: "http://t",
            cutoutUrl: "http://c",
          })),
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    store().tapGarment(g(TEE, "tshirt"));
    store().tapGarment(g(JEANS, "jeans"));
    store().tapGarment(g(BAG, "handbag"));

    await store().syncCanvasGarments();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("archived=false");
    expect(url).toContain("include=cutout");
    expect(decodeURIComponent(url)).toContain(`id=${TEE},${JEANS},${BAG}`);

    expect(items().map((i) => i.garmentId)).toEqual([TEE, BAG]);
    expect(store().garments[TEE].cutoutUrl).toBe("http://c");
    // El paso "poner los vaqueros" ya no existe: deshacer quita el bolso.
    store().undo();
    expect(items().map((i) => i.garmentId)).toEqual([TEE]);
    store().undo();
    expect(items()).toEqual([]);
    expect(store().syncing).toBe(false);
  });

  it("sin red deja el lienzo como está", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    store().tapGarment(g(TEE, "tshirt"));
    await store().syncCanvasGarments();
    expect(items().map((i) => i.garmentId)).toEqual([TEE]);
    expect(store().syncing).toBe(false);
  });
});

function zeroCounts() {
  return {
    base_layer: 0,
    mid_layer: 0,
    outer_layer: 0,
    bottom: 0,
    full_body: 0,
    footwear: 0,
    bag: 0,
    jewelry: 0,
    accessories: 0,
  };
}

describe("prendas cambiadas en el catálogo (5.5)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const list = (ids: string[]) => ({
    ids,
    nextCursor: null,
    status: "ready" as const,
    loadingMore: false,
    fetchedAt: Date.now(),
  });

  it("borrada: fuera del lienzo, del historial y del panel; listas y aleatorios caducados", () => {
    const fetchMock = vi.fn(async () => Response.json({ bySlot: zeroCounts() }));
    vi.stubGlobal("fetch", fetchMock);
    store().tapGarment(g("tee", "tshirt"));
    store().tapGarment(g("jeans", "jeans"));
    store().tapGarment(g("bag", "handbag"));
    store().setSelected("jeans");
    useDresserStore.setState({
      counts: zeroCounts(),
      lists: { bottom: list(["jeans", "chinos"]), bag: list(["bag"]) },
      pools: { bottom: { ids: ["jeans", "chinos"], fetchedAt: Date.now() } },
    });

    store().garmentsChanged(["jeans"], "deleted");

    expect(items().map((i) => i.garmentId)).toEqual(["tee", "bag"]);
    expect(store().selectedId).toBeNull();
    expect(store().lists.bottom?.ids).toEqual(["chinos"]);
    expect(store().lists.bottom?.fetchedAt).toBe(0);
    expect(store().lists.bag?.fetchedAt).toBe(0);
    expect(store().pools).toEqual({});
    expect(fetchMock).toHaveBeenCalledWith("/api/garments/counts", expect.anything());
    // Deshacer no la vuelve a traer.
    store().undo();
    expect(items().map((i) => i.garmentId)).toEqual(["tee"]);
  });

  it("archivada: también sale del lienzo; editada o desarchivada: solo caduca la caché", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ bySlot: zeroCounts() })),
    );
    store().tapGarment(g("tee", "tshirt"));
    store().tapGarment(g("jeans", "jeans"));
    useDresserStore.setState({ counts: zeroCounts(), lists: { bottom: list(["jeans"]) } });

    store().garmentsChanged(["tee"], "updated");
    store().garmentsChanged(["jeans"], "unarchived");
    expect(items().map((i) => i.garmentId)).toEqual(["tee", "jeans"]);
    expect(store().lists.bottom?.ids).toEqual(["jeans"]);
    expect(store().lists.bottom?.fetchedAt).toBe(0);

    store().garmentsChanged(["jeans"], "archived");
    expect(items().map((i) => i.garmentId)).toEqual(["tee"]);
    expect(store().lists.bottom?.ids).toEqual([]);
  });

  it("sin nada cargado no pide nada", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    store().garmentsChanged(["x"], "deleted");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
