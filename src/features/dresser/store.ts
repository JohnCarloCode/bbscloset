// Estado del vestidor (paso 4.4; screens.md 7, spec.md 3.2): lienzo, prendas
// conocidas, panel de prendas (altura, categoría activa) y su caché de datos.
//
// - Lienzo: `canvas` es el estado presente y `past`/`future` su historial de
//   sesión (4.6, lógica pura en history.ts). Toda mutación que el usuario
//   pueda deshacer pasa por `commit(next)`, que crea un paso y vacía
//   `future`. Lo que solo recoloca (cambio de tamaño del lienzo, aspecto real
//   de un recorte) usa `relayoutPresent`, que sustituye el presente sin crear
//   un paso nuevo. La selección no forma parte del historial.
// - Borrador (4.6, draft.ts): al entrar (`enter`) se averigua el usuario, se
//   restaura su borrador de localStorage (sin historial) y se comprueban las
//   prendas del lienzo contra la API: las borradas o archivadas se quitan en
//   silencio (decisión 10) de todo el historial. La escritura del borrador la
//   hace Dresser (useDraftWriter) con cada cambio del presente.
// - Colocación: los items no manuales se recolocan con autoLayout (4.2) con
//   el tamaño del lienzo y los aspectos conocidos; los manuales conservan su
//   transformación. La z siempre es la del item (puede venir de un cambio de
//   orden a mano).
// - Datos del panel: la lista de prendas en uso de cada hueco (con miniaturas
//   firmadas) se pide por páginas y se guarda para toda la sesión. Los
//   recortes no: se piden aparte solo para las prendas del lienzo (Dresser).
import { create } from "zustand";
import { onGarmentChanged, type GarmentChange } from "@/features/catalog/garmentChanged";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import { getMe, invalidateMe } from "@/lib/api/me";
import type { Garment, GarmentCountsResponse, GarmentListResponse } from "@/lib/api/types";
import { isSlotId, type SlotId } from "@/lib/domain/slots";
import { slotOfType, type GarmentTypeId } from "@/lib/domain/types";
import { autoLayout, type CanvasSize } from "@/lib/layout/autoLayout";
import {
  EMPTY_CANVAS,
  hasItem,
  hasManual,
  JEWELRY_MAX_DEFAULT,
  reslot,
  resetManual,
  toggle,
  type CanvasItem,
  type CanvasState,
  type PlaceEvents,
} from "./model";
import { readDraft } from "./draft";
import {
  HISTORY_LIMIT,
  mapHistory,
  push,
  redo as redoHistory,
  replacePresent,
  undo as undoHistory,
  type History,
} from "./history";
import { randomOutfit, substitute, substituteSlots, type GarmentPool } from "./random";

/** Lo que el vestidor sabe de una prenda (panel y lienzo). */
export type KnownGarment = {
  id: string;
  typeId: GarmentTypeId;
  slot: SlotId;
  /** URL firmada de la miniatura (panel). */
  thumbUrl: string | null;
  /** URL firmada del recorte: undefined = aún no pedida; null = no hay. */
  cutoutUrl?: string | null;
  /** Nombre de la prenda; null → la UI usa el tipo traducido. */
  label: string | null;
  /** Ancho / alto del recorte, cuando se conoce. */
  aspect?: number;
};

export type DrawerState = "closed" | "half" | "expanded";
export const DRAWER_LEVELS: readonly DrawerState[] = ["closed", "half", "expanded"];

/** Página del panel: múltiplo de 4 (móvil) y de 3 (escritorio). */
export const PANEL_PAGE_SIZE = 48;
/** Las URLs firmadas duran 1 h: pasado este tiempo la lista se vuelve a pedir. */
export const LIST_TTL_MS = 50 * 60 * 1000;

export type SlotList = {
  ids: string[];
  nextCursor: string | null;
  status: "loading" | "ready" | "error";
  loadingMore: boolean;
  fetchedAt: number;
};

export type TapResult = { events: PlaceEvents; removed: CanvasItem | null };

/** Categorías del "Outfit aleatorio" por defecto (database.md 3). */
export const DEFAULT_RANDOM_SLOTS: SlotId[] = ["base_layer", "bottom", "footwear", "bag"];
/** Pasos que guarda el historial en cada sentido. */
export const UNDO_LIMIT = HISTORY_LIMIT;

/** Ids de las prendas en uso de un hueco, para los aleatorios. */
type PoolEntry = { ids: string[]; fetchedAt: number };

export function toKnownGarment(g: Garment): KnownGarment {
  return {
    id: g.id,
    typeId: g.type_id,
    slot: g.slot,
    thumbUrl: g.thumbUrl,
    ...(g.cutoutUrl !== undefined ? { cutoutUrl: g.cutoutUrl } : {}),
    label: g.name,
  };
}

/**
 * Recoloca los items no manuales con autoLayout; los manuales se quedan
 * como están. La z y la rotación de cada item no se tocan. Sin tamaño de
 * lienzo (aún no medido) devuelve el estado tal cual.
 */
export function relayout(
  state: CanvasState,
  aspectOf: (garmentId: string) => number | undefined,
  size: CanvasSize,
): CanvasState {
  if (!(size.width > 0) || !(size.height > 0)) return state;
  const auto = state.items.filter((i) => !i.manual);
  if (auto.length === 0) return state;
  const res = autoLayout(
    auto.map((i) => ({
      garmentId: i.garmentId,
      slotId: i.slotId,
      aspect: aspectOf(i.garmentId) ?? 1,
      placedAt: i.placedAt,
    })),
    size,
  );
  const byId = new Map(res.map((r) => [r.garmentId, r]));
  let changed = false;
  const items = state.items.map((i) => {
    const r = byId.get(i.garmentId);
    if (!r || (r.x === i.x && r.y === i.y && r.scale === i.scale)) return i;
    changed = true;
    return { ...i, x: r.x, y: r.y, scale: r.scale };
  });
  return changed ? { items } : state;
}

export type DresserState = {
  /** Estado presente del lienzo. */
  canvas: CanvasState;
  /** Prendas conocidas por id (las del panel y las del lienzo). */
  garments: Record<string, KnownGarment>;
  /** Tamaño medido del lienzo en px (0 hasta medirlo). */
  canvasSize: CanvasSize;
  /** Prenda seleccionada en el lienzo. */
  selectedId: string | null;
  jewelryMax: number;

  drawer: DrawerState;
  activeSlot: SlotId;
  /** Prendas en uso por hueco (GET /api/garments/counts); null hasta cargarlas. */
  counts: Record<SlotId, number> | null;
  countsError: boolean;
  lists: Partial<Record<SlotId, SlotList>>;
  /** Categorías predeterminadas del "Outfit aleatorio" (profiles.random_slots). */
  randomSlots: SlotId[];
  /** Ids en uso por hueco para los aleatorios (completos, sin paginar). */
  pools: Partial<Record<SlotId, PoolEntry>>;
  /** Estados anteriores del lienzo (deshacer). */
  past: CanvasState[];
  /** Estados deshechos (rehacer); una acción nueva los descarta. */
  future: CanvasState[];
  /** Usuario cuyo borrador está cargado (null hasta saberlo; no se escribe nada antes). */
  draftOwner: string | null;
  /** Comprobando las prendas del lienzo contra la API (no se piden recortes sueltos). */
  syncing: boolean;

  /** Único punto de entrada de los cambios del lienzo que van al historial. */
  commit: (next: CanvasState) => void;
  /** Vuelve al estado anterior del lienzo. */
  undo: () => void;
  /** Rehace el último paso deshecho. */
  redo: () => void;
  /** "Colocación automática": descarta los ajustes manuales (entra en el historial). */
  autoArrange: () => void;
  /** Al entrar al vestidor: usuario, borrador y prendas del lienzo comprobadas. */
  enter: () => Promise<void>;
  /** Carga el borrador del usuario (sin historial) si aún no es el suyo. */
  openDraft: (userId: string) => void;
  /** Comprueba las prendas del lienzo (y trae sus recortes); quita las que ya no valen. */
  syncCanvasGarments: () => Promise<void>;
  /**
   * Pone cada item del lienzo (y del historial) en el hueco del tipo que
   * tiene ahora su prenda, con la regla de huecos (`reslot`). Sin paso nuevo.
   */
  reslotCanvas: () => void;
  /** "Sustituir": devuelve cuántas prendas han cambiado. */
  runSubstitute: (rng?: () => number) => Promise<{ changed: number }>;
  /** "Outfit aleatorio": devuelve las categorías sin prendas (para el aviso). */
  runRandomOutfit: (rng?: () => number) => Promise<{ empty: SlotId[]; placed: number }>;
  /** Cambia las categorías del aleatorio (optimista; si falla, vuelve atrás y lanza). */
  setRandomSlots: (slots: SlotId[]) => Promise<void>;
  /** Ids en uso de los huecos pedidos (de la caché o de la API). */
  loadPool: (slots: SlotId[]) => Promise<GarmentPool>;
  /** Recoloca el presente sin crear un paso de historial. */
  relayoutPresent: () => void;
  /** Tocar una prenda del panel: la pone o, si ya está, la quita. */
  tapGarment: (g: KnownGarment) => TapResult;
  setCanvasSize: (size: CanvasSize) => void;
  setAspect: (garmentId: string, aspect: number) => void;
  /** Guarda el recorte de una prenda (y la registra si no se conocía). */
  setCutout: (garment: KnownGarment) => void;
  setSelected: (garmentId: string | null) => void;
  setJewelryMax: (max: number) => void;

  setDrawer: (drawer: DrawerState) => void;
  /** Sube (+1) o baja (-1) un nivel del panel. */
  stepDrawer: (dir: 1 | -1) => void;
  setActiveSlot: (slot: SlotId) => void;

  /** Perfil (máximo de joyas, categorías del aleatorio); devuelve el id del usuario. */
  loadProfile: () => Promise<string | null>;
  loadCounts: () => Promise<void>;
  /** Primera página del hueco si no está en caché (o ha caducado). */
  loadSlot: (slot: SlotId, force?: boolean) => Promise<void>;
  loadMore: (slot: SlotId) => Promise<void>;
  /** Marca las listas como caducadas y recarga los recuentos (p. ej. al subir una prenda). */
  invalidate: () => void;
  /** Quita prendas del lienzo y de todo su historial, sin crear un paso (decisión 10). */
  dropGarments: (ids: ReadonlySet<string>) => void;
  /**
   * Prendas cambiadas en el catálogo (GARMENT_CHANGED_EVENT, 5.5): listas y
   * aleatorios caducados y, si se han borrado o archivado, fuera del lienzo.
   */
  garmentsChanged: (ids: readonly string[], change: GarmentChange) => void;
};

const initial = {
  canvas: EMPTY_CANVAS,
  garments: {} as Record<string, KnownGarment>,
  canvasSize: { width: 0, height: 0 },
  selectedId: null,
  jewelryMax: JEWELRY_MAX_DEFAULT,
  drawer: "half" as DrawerState,
  activeSlot: "base_layer" as SlotId,
  counts: null,
  countsError: false,
  lists: {},
  randomSlots: DEFAULT_RANDOM_SLOTS,
  pools: {},
  past: [] as CanvasState[],
  future: [] as CanvasState[],
  draftOwner: null as string | null,
  syncing: false,
};

// Peticiones en vuelo por hueco: evita pedir dos veces la misma página.
const inflight = new Set<string>();
// Categorías del aleatorio: lo último confirmado por el servidor y el guardado en curso.
const randomSaved: { value: SlotId[] | null; saving: Promise<void> | null } = {
  value: null,
  saving: null,
};

function sameSlots(a: readonly SlotId[], b: readonly SlotId[]): boolean {
  return a.length === b.length && a.every((s) => b.includes(s));
}

function listUrl(slot: SlotId, cursor?: string | null): string {
  const p = new URLSearchParams({ archived: "false", slot, limit: String(PANEL_PAGE_SIZE) });
  if (cursor) p.set("cursor", cursor);
  return `/api/garments?${p}`;
}

function mergeGarments(
  known: Record<string, KnownGarment>,
  items: Garment[],
): Record<string, KnownGarment> {
  const next = { ...known };
  for (const g of items) {
    const prev = next[g.id];
    // Conserva lo que el lienzo ya sabe (recorte y aspecto).
    next[g.id] = { ...toKnownGarment(g), cutoutUrl: prev?.cutoutUrl, aspect: prev?.aspect };
  }
  return next;
}

/** Lienzo + historial del store como History (history.ts). */
function historyOf(s: Pick<DresserState, "past" | "canvas" | "future">): History<CanvasState> {
  return { past: s.past, present: s.canvas, future: s.future };
}

function fromHistory(h: History<CanvasState>) {
  return { past: h.past, canvas: h.present, future: h.future };
}

/**
 * Mismo lienzo a la vista (para fundir pasos al podar el historial). La
 * posición de los items automáticos no cuenta: la recalcula la colocación
 * automática al volver a ese paso.
 */
function sameCanvas(a: CanvasState, b: CanvasState): boolean {
  return (
    a.items.length === b.items.length &&
    a.items.every((i, k) => {
      const j = b.items[k];
      return (
        i.garmentId === j.garmentId &&
        i.rotation === j.rotation &&
        i.z === j.z &&
        i.locked === j.locked &&
        i.manual === j.manual &&
        (!i.manual || (i.x === j.x && i.y === j.y && i.scale === j.scale))
      );
    })
  );
}

/** Sin ninguna prenda en uso (false mientras no se sepa). */
export const selectClosetEmpty = (s: Pick<DresserState, "counts">) =>
  s.counts !== null && Object.values(s.counts).every((n) => n === 0);

export const useDresserStore = create<DresserState>()((set, get) => {
  const aspectOf = (id: string) => get().garments[id]?.aspect;

  /** Deshacer / rehacer: el estado al que se vuelve se recoloca con el tamaño actual. */
  const travel = (step: (h: History<CanvasState>) => History<CanvasState>) => {
    const s = get();
    const h = step(historyOf(s));
    if (h.present === s.canvas) return;
    const canvas = relayout(h.present, aspectOf, s.canvasSize);
    set({
      ...fromHistory({ ...h, present: canvas }),
      ...(s.selectedId && !canvas.items.some((i) => i.garmentId === s.selectedId)
        ? { selectedId: null }
        : {}),
    });
  };

  return {
    ...initial,

    commit: (next) => {
      const s = get();
      if (next === s.canvas) return;
      set(fromHistory(push(historyOf(s), relayout(next, aspectOf, s.canvasSize), UNDO_LIMIT)));
    },

    undo: () => travel(undoHistory),
    redo: () => travel(redoHistory),

    autoArrange: () => {
      const { canvas } = get();
      if (hasManual(canvas)) get().commit(resetManual(canvas));
    },

    enter: async () => {
      const userId = await get().loadProfile();
      if (userId) get().openDraft(userId);
      await get().syncCanvasGarments();
    },

    openDraft: (userId) => {
      const s = get();
      if (s.draftOwner === userId) return;
      if (s.draftOwner !== null) {
        // Otra cuenta en el mismo dispositivo: nada de lo anterior vale.
        inflight.clear();
        randomSaved.value = null;
        randomSaved.saving = null;
        set({ ...initial, canvasSize: s.canvasSize });
      } else if (s.canvas.items.length > 0 || s.past.length > 0) {
        // Ya ha empezado a vestir antes de saber quién es: se queda lo suyo
        // (y será lo que se guarde).
        set({ draftOwner: userId });
        return;
      }
      const draft = readDraft(userId);
      if (!draft || draft.canvas.items.length === 0) {
        set({ draftOwner: userId });
        return;
      }
      // Prendas del borrador: tipo y aspecto para nombrarlas y recolocarlas
      // ya; miniatura y recorte llegan con syncCanvasGarments.
      const garments = { ...get().garments };
      for (const [id, info] of Object.entries(draft.garments)) {
        const prev = garments[id];
        if (prev) {
          if (prev.aspect === undefined && info.aspect)
            garments[id] = { ...prev, aspect: info.aspect };
        } else if (info.typeId) {
          garments[id] = {
            id,
            typeId: info.typeId,
            slot: slotOfType(info.typeId),
            thumbUrl: null,
            label: null,
            ...(info.aspect ? { aspect: info.aspect } : {}),
          };
        }
      }
      set({ garments, draftOwner: userId });
      // Sin historial: el borrador es el punto de partida de la sesión.
      set({
        canvas: relayout(draft.canvas, aspectOf, get().canvasSize),
        past: [],
        future: [],
        selectedId: null,
      });
    },

    syncCanvasGarments: async () => {
      const requested = [...new Set(get().canvas.items.map((i) => i.garmentId))];
      if (requested.length === 0) return;
      set({ syncing: true });
      try {
        const p = new URLSearchParams({
          archived: "false",
          include: "cutout",
          limit: String(requested.length),
          id: requested.join(","),
        });
        const page = await apiFetch<GarmentListResponse>(`/api/garments?${p}`);
        const found = new Set(page.items.map((g) => g.id));
        const gone = new Set(requested.filter((id) => !found.has(id)));
        const known = { ...get().garments };
        for (const g of page.items) {
          known[g.id] = {
            ...toKnownGarment(g),
            cutoutUrl: g.cutoutUrl ?? null,
            aspect: known[g.id]?.aspect,
          };
        }
        set({ garments: known });
        // Borradas o archivadas: fuera en silencio.
        if (gone.size > 0) get().dropGarments(gone);
        // Tipo cambiado en el catálogo: cada item al hueco de su tipo nuevo (7.6).
        get().reslotCanvas();
      } catch {
        // Sin red: se queda el lienzo tal cual (los recortes se reintentan sueltos).
      } finally {
        set({ syncing: false });
      }
    },

    runSubstitute: async (rng = Math.random) => {
      const pool = await get().loadPool(substituteSlots(get().canvas));
      // El lienzo puede haber cambiado mientras llegaba la lista: se usa el actual.
      const res = substitute(get().canvas, pool, rng);
      if (res.changed > 0) get().commit(res.state);
      return { changed: res.changed };
    },

    runRandomOutfit: async (rng = Math.random) => {
      const slots = get().randomSlots;
      const pool = await get().loadPool(slots);
      const res = randomOutfit(pool, slots, get().jewelryMax, rng);
      // Si no sale nada (todas vacías) no se vacía el lienzo: solo el aviso.
      if (res.state.items.length > 0) get().commit(res.state);
      return { empty: res.empty, placed: res.state.items.length };
    },

    setRandomSlots: (slots) => {
      if (!randomSaved.value) randomSaved.value = get().randomSlots;
      set({ randomSlots: slots });
      // Un guardado cada vez y en orden: si cambian mientras tanto, al acabar
      // se envía lo último (dos PATCH en paralelo podrían llegar al revés).
      randomSaved.saving ??= (async () => {
        try {
          for (;;) {
            const want = get().randomSlots;
            if (sameSlots(want, randomSaved.value!)) return;
            const me = await apiFetch<{ random_slots: string[] }>("/api/me", {
              method: "PATCH",
              json: { random_slots: want },
            });
            invalidateMe();
            randomSaved.value = me.random_slots.filter(isSlotId);
          }
        } catch (err) {
          // Vuelve a lo último que el servidor ha confirmado.
          set({ randomSlots: randomSaved.value! });
          throw err;
        } finally {
          randomSaved.saving = null;
        }
      })();
      return randomSaved.saving;
    },

    loadPool: async (slots) => {
      const s = get();
      const out: GarmentPool = {};
      const missing: SlotId[] = [];
      for (const slot of slots) {
        const cached = s.pools[slot];
        const list = s.lists[slot];
        if (cached && Date.now() - cached.fetchedAt < LIST_TTL_MS) out[slot] = cached.ids;
        else if (s.counts?.[slot] === 0) out[slot] = [];
        // La lista del panel ya cargada entera vale igual.
        else if (
          list?.status === "ready" &&
          !list.nextCursor &&
          Date.now() - list.fetchedAt < LIST_TTL_MS
        )
          out[slot] = list.ids;
        else missing.push(slot);
      }
      if (missing.length === 0) return out;
      // Una petición ligera por hueco (solo ids, sin URLs firmadas), en paralelo.
      const fetched = await Promise.all(
        missing.map(async (slot) => {
          const p = new URLSearchParams({ archived: "false", slot, ids: "true" });
          const res = await apiFetch<{ ids: string[] }>(`/api/garments?${p}`);
          return [slot, res.ids] as const;
        }),
      );
      const now = Date.now();
      const pools = { ...get().pools };
      for (const [slot, ids] of fetched) {
        out[slot] = ids;
        pools[slot] = { ids, fetchedAt: now };
      }
      set({ pools });
      return out;
    },

    relayoutPresent: () => {
      const { canvas, canvasSize } = get();
      const next = relayout(canvas, aspectOf, canvasSize);
      if (next !== canvas) set({ canvas: next });
    },

    tapGarment: (g) => {
      const s = get();
      if (s.garments[g.id] !== g) {
        const prev = s.garments[g.id];
        set({
          garments: {
            ...s.garments,
            [g.id]: {
              ...g,
              cutoutUrl: g.cutoutUrl ?? prev?.cutoutUrl,
              aspect: g.aspect ?? prev?.aspect,
            },
          },
        });
      }
      const res = toggle(get().canvas, { id: g.id, typeId: g.typeId }, get().jewelryMax);
      get().commit(res.state);
      if (res.removed && get().selectedId === g.id) set({ selectedId: null });
      return { events: res.events, removed: res.removed };
    },

    setCanvasSize: (size) => {
      const prev = get().canvasSize;
      if (prev.width === size.width && prev.height === size.height) return;
      set({ canvasSize: size });
      get().relayoutPresent();
    },

    setAspect: (garmentId, aspect) => {
      const g = get().garments[garmentId];
      if (!g || g.aspect === aspect || !(aspect > 0)) return;
      set({ garments: { ...get().garments, [garmentId]: { ...g, aspect } } });
      get().relayoutPresent();
    },

    setCutout: (garment) => {
      const prev = get().garments[garment.id];
      set({
        garments: {
          ...get().garments,
          [garment.id]: { ...garment, ...prev, cutoutUrl: garment.cutoutUrl ?? null },
        },
      });
    },

    setSelected: (selectedId) => set({ selectedId }),
    setJewelryMax: (jewelryMax) => set({ jewelryMax }),

    setDrawer: (drawer) => set({ drawer }),
    stepDrawer: (dir) => {
      const i = DRAWER_LEVELS.indexOf(get().drawer);
      const next = DRAWER_LEVELS[Math.max(0, Math.min(DRAWER_LEVELS.length - 1, i + dir))];
      set({ drawer: next });
    },
    setActiveSlot: (activeSlot) => set({ activeSlot }),

    loadProfile: async () => {
      try {
        const me = await getMe();
        const randomSlots = me.random_slots.filter(isSlotId);
        // Si hay un guardado en curso, no se pisa lo que el usuario acaba de elegir.
        if (!randomSaved.saving) {
          randomSaved.value = randomSlots;
          set({ randomSlots });
        }
        set({ jewelryMax: me.jewelry_max });
        return me.user_id;
      } catch {
        // Sin perfil se queda el máximo por defecto (3).
        return null;
      }
    },

    loadCounts: async () => {
      if (inflight.has("counts")) return;
      inflight.add("counts");
      try {
        const res = await apiFetch<GarmentCountsResponse>("/api/garments/counts");
        set({ counts: res.bySlot, countsError: false });
      } catch (err) {
        if (!(isApiClientError(err) && err.code === "unauthorized")) set({ countsError: true });
      } finally {
        inflight.delete("counts");
      }
    },

    loadSlot: async (slot, force = false) => {
      const cached = get().lists[slot];
      const fresh = cached && Date.now() - cached.fetchedAt < LIST_TTL_MS;
      if (!force && cached && (cached.status === "loading" || (cached.status === "ready" && fresh)))
        return;
      const key = `list:${slot}`;
      if (inflight.has(key)) return;
      inflight.add(key);
      // Mientras recarga (caducada) se sigue viendo la lista anterior.
      if (!cached || cached.status === "error")
        set((s) => ({
          lists: {
            ...s.lists,
            [slot]: {
              ids: [],
              nextCursor: null,
              status: "loading",
              loadingMore: false,
              fetchedAt: 0,
            },
          },
        }));
      try {
        const page = await apiFetch<GarmentListResponse>(listUrl(slot));
        set((s) => ({
          garments: mergeGarments(s.garments, page.items),
          lists: {
            ...s.lists,
            [slot]: {
              ids: page.items.map((g) => g.id),
              nextCursor: page.nextCursor,
              status: "ready",
              loadingMore: false,
              fetchedAt: Date.now(),
            },
          },
        }));
      } catch (err) {
        if (isApiClientError(err) && err.code === "unauthorized") return;
        set((s) => ({
          lists: {
            ...s.lists,
            [slot]: s.lists[slot]?.ids.length
              ? s.lists[slot]
              : { ids: [], nextCursor: null, status: "error", loadingMore: false, fetchedAt: 0 },
          },
        }));
      } finally {
        inflight.delete(key);
      }
    },

    loadMore: async (slot) => {
      const list = get().lists[slot];
      if (!list || list.status !== "ready" || !list.nextCursor || list.loadingMore) return;
      const cursor = list.nextCursor;
      const patch = (p: Partial<SlotList>) =>
        set((s) => {
          const cur = s.lists[slot];
          return cur ? { lists: { ...s.lists, [slot]: { ...cur, ...p } } } : {};
        });
      patch({ loadingMore: true });
      try {
        const page = await apiFetch<GarmentListResponse>(listUrl(slot, cursor));
        const cur = get().lists[slot];
        // La lista se ha recargado mientras tanto: esta página ya no vale.
        if (!cur || cur.nextCursor !== cursor) return;
        const seen = new Set(cur.ids);
        set((s) => ({ garments: mergeGarments(s.garments, page.items) }));
        patch({
          ids: [...cur.ids, ...page.items.map((g) => g.id).filter((id) => !seen.has(id))],
          nextCursor: page.nextCursor,
          loadingMore: false,
        });
      } catch {
        patch({ loadingMore: false });
      }
    },

    reslotCanvas: () => {
      const s = get();
      const typeOf = (id: string) => s.garments[id]?.typeId;
      const fix = (c: CanvasState) => reslot(c, typeOf, s.jewelryMax);
      if (fix(s.canvas) === s.canvas && ![...s.past, ...s.future].some((c) => fix(c) !== c)) return;
      const h = mapHistory(historyOf(s), fix, sameCanvas);
      set({
        ...fromHistory(replacePresent(h, relayout(h.present, aspectOf, s.canvasSize))),
        ...(s.selectedId && !h.present.items.some((i) => i.garmentId === s.selectedId)
          ? { selectedId: null }
          : {}),
      });
    },

    dropGarments: (gone) => {
      const s = get();
      if (
        ![s.canvas, ...s.past, ...s.future].some((c) => c.items.some((i) => gone.has(i.garmentId)))
      )
        return;
      // También del historial: deshacer no debe volver a traerlas. No es un paso nuevo.
      const drop = (c: CanvasState) =>
        c.items.some((i) => gone.has(i.garmentId))
          ? { items: c.items.filter((i) => !gone.has(i.garmentId)) }
          : c;
      const h = mapHistory(historyOf(s), drop, sameCanvas);
      set({
        ...fromHistory(replacePresent(h, relayout(h.present, aspectOf, s.canvasSize))),
        ...(s.selectedId && gone.has(s.selectedId) ? { selectedId: null } : {}),
      });
    },

    garmentsChanged: (ids, change) => {
      if (change === "deleted" || change === "archived") {
        const gone = new Set(ids);
        get().dropGarments(gone);
        // Fuera ya del panel, sin esperar a que se vuelva a pedir la lista.
        set((s) => ({
          lists: Object.fromEntries(
            Object.entries(s.lists).map(([slot, l]) => [
              slot,
              l.ids.some((id) => gone.has(id))
                ? { ...l, ids: l.ids.filter((id) => !gone.has(id)) }
                : l,
            ]),
          ),
        }));
      }
      // Editada y en el lienzo: puede haber cambiado de tipo (y de hueco), de
      // nombre o de foto. Se vuelve a pedir (syncCanvasGarments la recoloca).
      if (change === "updated" && ids.some((id) => hasItem(get().canvas, id)))
        void get().syncCanvasGarments();
      const s = get();
      // Sin nada cargado todavía no hay caché que invalidar.
      if (s.counts === null && Object.keys(s.lists).length === 0) {
        if (Object.keys(s.pools).length > 0) set({ pools: {} });
        return;
      }
      s.invalidate();
    },

    invalidate: () => {
      // Se marcan caducadas (se siguen viendo hasta que llegue la recarga).
      set((s) => ({
        lists: Object.fromEntries(
          Object.entries(s.lists).map(([slot, l]) => [slot, { ...l, fetchedAt: 0 }]),
        ),
        pools: {},
      }));
      void get().loadCounts();
    },
  };
});

// Cambios hechos en el catálogo mientras el vestidor está oculto (Activity)
// o sin montar: el store vive toda la sesión, así que escucha aquí.
onGarmentChanged(({ ids, change }) => useDresserStore.getState().garmentsChanged(ids, change));

/** Solo para tests: vuelve al estado inicial. */
export function resetDresserStoreForTests() {
  inflight.clear();
  randomSaved.value = null;
  randomSaved.saving = null;
  useDresserStore.setState(initial);
}
