// Estado del catálogo (screens.md 4) en un store de zustand: vista (en uso /
// archivadas), hueco, filtros (3.4), selección (3.11), recuentos y la lista
// paginada por cursor. Las acciones piden los datos con apiFetch.
//
// - Cambiar vista, hueco o filtros reinicia la lista y descarta las
//   respuestas que lleguen tarde (cada carga lleva un número de petición).
// - Vista, hueco y filtros se reflejan en la URL (useUrlSync.ts) con las
//   funciones puras `parseCatalogQuery` / `catalogQueryParams`.
// - Las URLs firmadas de las miniaturas caducan en 1 h: `loadedAt` guarda
//   cuándo se pidió la primera página para poder renovarlas (paso 7.6) con
//   `refresh()`, que vuelve a pedir recuentos y lista sin tocar los filtros.
// - La ficha (3.10) cambia la lista sin recargarla: `updateGarment` (editar,
//   archivar, cambiar foto) y `removeGarment` (eliminar), y después pide de
//   nuevo los recuentos.
// - Selección en lote (3.11): `selectAll` pide a la API todos los ids con la
//   vista, el hueco y los filtros vigentes (también los no cargados aún);
//   `setArchived` archiva o desarchiva por tandas (POST /api/garments/archive)
//   y quita de la lista las que ya no encajan. Cambiar de vista sale del modo.
// - Las tres avisan con GARMENT_CHANGED_EVENT (garmentChanged.ts, 5.5) para
//   que el vestidor y los favoritos no se queden con datos viejos.
import { create } from "zustand";
import { apiFetch, isApiClientError, type ApiClientErrorCode } from "@/lib/api/client";
import type {
  BrandsResponse,
  Garment,
  GarmentArchiveResponse,
  GarmentCountsResponse,
  GarmentIdsResponse,
  GarmentListResponse,
  TagWithCount,
  TagsResponse,
} from "@/lib/api/types";
import { COLOR_FAMILY_IDS, type ColorFamilyId } from "@/lib/domain/colors";
import { SLOT_IDS, isSlotId, type SlotId } from "@/lib/domain/slots";
import { isGarmentTypeId, slotOfType, type GarmentTypeId } from "@/lib/domain/types";
import { changeOf, emitGarmentChanged } from "./garmentChanged";
import { garmentMatches, insertGarment } from "./pending";

export type CatalogView = "active" | "archived";
/** Chip de hueco elegido: uno de los 9 o "all" (Todo). */
export type SlotFilter = SlotId | "all";

/**
 * Filtros de la hoja (3.4, screens.md 4.1): tipo, marca, color y etiquetas,
 * todos multiselección. Mismos parámetros que GET /api/garments: tipos, marcas
 * y familias de color se combinan con O dentro de su sección; las etiquetas,
 * con Y. El color no sale en screens 4.1 ni en el prototipo, pero la spec
 * (3.1, "filtrable por hueco, tipo, marca, color y etiqueta") lo exige.
 */
export type CatalogFilters = {
  types: GarmentTypeId[];
  brands: string[];
  /** Familias de color; se combinan con O. */
  colors: ColorFamilyId[];
  /** Ids de etiqueta; se combinan con Y. */
  tags: string[];
};

export const EMPTY_FILTERS: CatalogFilters = { types: [], brands: [], colors: [], tags: [] };

/** Lo que va en la URL: vista, hueco y filtros. */
export type CatalogQuery = { view: CatalogView; slot: SlotFilter; filters: CatalogFilters };

/** Opciones de la hoja de filtros: marcas y etiquetas del usuario. */
export type FilterOptions = { brands: string[]; tags: TagWithCount[] };

/** Prendas por página (el máximo de la API es 100; 24 es su valor por defecto). */
export const PAGE_SIZE = 24;

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type CatalogState = {
  view: CatalogView;
  slot: SlotFilter;
  filters: CatalogFilters;

  counts: GarmentCountsResponse | null;
  items: Garment[];
  nextCursor: string | null;
  /** Primera página (y recuentos). */
  status: LoadStatus;
  /** Páginas siguientes: "loading" mientras se pide, "error" si falló. */
  moreStatus: LoadStatus;
  /** Código del último error (para elegir el texto). */
  errorCode: ApiClientErrorCode | null;
  /** Momento (ms) en que se pidió la primera página: las URLs firmadas duran 1 h. */
  loadedAt: number | null;

  /** Marcas y etiquetas para la hoja y los chips activos (null = sin pedir). */
  options: FilterOptions | null;

  /** Modo selección para archivar en lote (3.11). */
  selecting: boolean;
  selectedIds: string[];
  /** Ids de "Seleccionar todo" con la vista/hueco/filtros vigentes (null = sin pedir). */
  allIds: string[] | null;

  setView: (view: CatalogView) => void;
  setSlot: (slot: SlotFilter) => void;
  setFilters: (filters: Partial<CatalogFilters>) => void;
  clearFilters: () => void;
  /** Vista, hueco y filtros de golpe (p. ej. desde la URL) y recarga. */
  setQuery: (query: CatalogQuery) => void;
  /** Pide las marcas y etiquetas del usuario (si fallan, se queda como estaba). */
  loadOptions: () => Promise<void>;
  /** Recuentos + primera página con la vista, el hueco y los filtros actuales. */
  load: () => Promise<void>;
  /** Siguiente página (si hay y no se está pidiendo ya). */
  loadMore: () => Promise<void>;
  /** Vuelve a pedir todo sin cambiar vista ni filtros (p. ej. URLs caducadas). */
  refresh: () => Promise<void>;
  /**
   * Una prenda recién subida (3.9): si encaja con la vista y los filtros, se
   * mete en su sitio de la lista (`created_at desc`) sin recargar ni vaciar.
   */
  insertSaved: (garment: Garment) => void;
  /** Vuelve a pedir solo los recuentos (cabecera y chips). */
  reloadCounts: () => Promise<void>;
  /**
   * Una prenda cambiada desde la ficha (3.10): sustituye a la de la lista en
   * su sitio, o sale si ya no encaja (archivada, otro hueco…). Actualiza los
   * recuentos y, si estaban cargadas, las marcas y etiquetas de los filtros.
   */
  updateGarment: (garment: Garment) => void;
  /** Una prenda eliminada (3.10): fuera de la lista y de la selección. */
  removeGarment: (id: string) => void;
  /** Entra o sale del modo selección (siempre con la selección vacía). */
  setSelecting: (selecting: boolean) => void;
  toggleSelected: (id: string) => void;
  setSelected: (ids: string[]) => void;
  /**
   * "Seleccionar todo": pide a la API los ids de la vista, el hueco y los
   * filtros vigentes y los marca. Lanza ApiClientError si falla.
   */
  selectAll: () => Promise<void>;
  /**
   * Archiva (`archived` = true) o desarchiva las prendas `ids` en tandas de
   * hasta 500. Después quita de la lista las que ya no encajan con la vista;
   * si alguna vuelve a encajar (deshacer), recarga la lista. Pide de nuevo los
   * recuentos. Devuelve cuántas filas cambió. Lanza ApiClientError si falla.
   */
  setArchived: (ids: string[], archived: boolean) => Promise<number>;
};

/** Parámetros de GET /api/garments para el estado dado. */
export function listParams(
  state: Pick<CatalogState, "view" | "slot" | "filters">,
  cursor?: string | null,
): URLSearchParams {
  const p = new URLSearchParams();
  if (state.view === "archived") p.set("archived", "true");
  if (state.slot !== "all") p.set("slot", state.slot);
  const { types, brands, colors, tags } = state.filters;
  for (const t of types) p.append("type", t);
  for (const b of brands) p.append("brand", b);
  for (const c of colors) p.append("color", c);
  for (const t of tags) p.append("tags", t);
  p.set("limit", String(PAGE_SIZE));
  if (cursor) p.set("cursor", cursor);
  return p;
}

/** Parámetros de GET /api/garments para el recuento "Ver N prendas" (count=true). */
export function countParams(state: Pick<CatalogState, "view" | "slot" | "filters">) {
  const p = listParams(state);
  p.delete("limit");
  p.set("count", "true");
  return p;
}

/** Parámetros de GET /api/garments?ids=true ("Seleccionar todo", 3.11). */
export function idsParams(state: Pick<CatalogState, "view" | "slot" | "filters">) {
  const p = listParams(state);
  p.delete("limit");
  p.set("ids", "true");
  return p;
}

/** Ids por tandas de `size` (POST /api/garments/archive admite hasta 500). */
export function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

/** ¿Están marcados todos los ids de "Seleccionar todo"? (para ofrecer "Quitar selección"). */
export function isAllSelected(selected: readonly string[], all: readonly string[] | null): boolean {
  if (!all || all.length === 0) return false;
  const set = new Set(selected);
  return all.every((id) => set.has(id));
}

/** Tope de ids por petición de POST /api/garments/archive (MAX_ARCHIVE_IDS). */
export const ARCHIVE_BATCH = 500;

/** Número de filtros activos de la hoja (botón "Filtros · N", 3.4). */
export function activeFilterCount(filters: CatalogFilters): number {
  return filters.types.length + filters.brands.length + filters.colors.length + filters.tags.length;
}

// ---------------------------------------------------------------------------
// URL ⇄ estado (3.4). Parámetros de la página: view=archived, slot, type,
// brand, color y tags (repetidos). Lo que vale por defecto no se escribe.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_KEYS = ["view", "slot", "type", "brand", "color", "tags"] as const;
/** Topes al leer la URL (la API admite como mucho esto). */
const MAX_URL_BRANDS = 50;
const MAX_URL_TAGS = 20;
const MAX_BRAND_LENGTH = 120;

const unique = <T>(xs: T[]) => [...new Set(xs)];

/** ¿La URL trae algún parámetro del catálogo? */
export function hasCatalogParams(params: URLSearchParams): boolean {
  return URL_KEYS.some((k) => params.has(k));
}

/**
 * Lee vista, hueco y filtros de la URL. Ignora lo que no sea válido: huecos o
 * tipos desconocidos, tipos de otro hueco, etiquetas que no son uuid…
 */
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const view: CatalogView = params.get("view") === "archived" ? "archived" : "active";
  const rawSlot = params.get("slot");
  const slot: SlotFilter = isSlotId(rawSlot) ? rawSlot : "all";
  const types = unique(params.getAll("type").flatMap((v) => v.split(","))).filter(
    (t): t is GarmentTypeId => isGarmentTypeId(t) && (slot === "all" || slotOfType(t) === slot),
  );
  const brands = unique(
    params
      .getAll("brand")
      .map((b) => b.trim())
      .filter((b) => b.length > 0 && b.length <= MAX_BRAND_LENGTH),
  ).slice(0, MAX_URL_BRANDS);
  // En el orden de COLOR_FAMILY_IDS (como los chips de la hoja).
  const wanted = new Set(params.getAll("color").flatMap((v) => v.split(",")));
  const colors = COLOR_FAMILY_IDS.filter((c) => wanted.has(c));
  const tags = unique(
    params
      .getAll("tags")
      .flatMap((v) => v.split(","))
      .map((t) => t.trim().toLowerCase())
      .filter((t) => UUID_RE.test(t)),
  ).slice(0, MAX_URL_TAGS);
  return { view, slot, filters: { types, brands, colors, tags } };
}

/** Parámetros de la URL para vista, hueco y filtros (vacío = todo por defecto). */
export function catalogQueryParams(query: CatalogQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.view === "archived") p.set("view", "archived");
  if (query.slot !== "all") p.set("slot", query.slot);
  for (const t of query.filters.types) p.append("type", t);
  for (const b of query.filters.brands) p.append("brand", b);
  for (const c of query.filters.colors) p.append("color", c);
  for (const t of query.filters.tags) p.append("tags", t);
  return p;
}

/** ¿Dos estados piden lo mismo? (compara su forma en la URL). */
export function sameQuery(a: CatalogQuery, b: CatalogQuery): boolean {
  return catalogQueryParams(a).toString() === catalogQueryParams(b).toString();
}

/** Recuentos por hueco de la vista. */
export function slotCounts(
  counts: GarmentCountsResponse,
  view: CatalogView,
): Record<SlotId, number> {
  return view === "archived" ? counts.archivedBySlot : counts.bySlot;
}

/**
 * Familias de color de la hoja de filtros, en el orden del dominio: las que
 * tiene alguna prenda de la vista, más las ya elegidas (para poder quitarlas).
 * Sin recuentos todavía, las 13.
 */
export function colorOptions(
  counts: GarmentCountsResponse | null,
  view: CatalogView,
  selected: readonly ColorFamilyId[],
): ColorFamilyId[] {
  if (!counts) return [...COLOR_FAMILY_IDS];
  const byColor = view === "archived" ? counts.archivedByColor : counts.byColor;
  return COLOR_FAMILY_IDS.filter((c) => (byColor[c] ?? 0) > 0 || selected.includes(c));
}

/**
 * Chips de hueco visibles: "Todo" siempre, y los huecos con prendas en la
 * vista (o el elegido, aunque se haya quedado a cero), en el orden de spec 2.1.
 */
export function visibleSlotChips(
  counts: GarmentCountsResponse,
  view: CatalogView,
  current: SlotFilter,
): Array<{ slot: SlotFilter; count: number }> {
  const bySlot = slotCounts(counts, view);
  const total = view === "archived" ? counts.archived : counts.inUse;
  return [
    { slot: "all" as SlotFilter, count: total },
    ...SLOT_IDS.filter((s) => bySlot[s] > 0 || s === current).map((s) => ({
      slot: s as SlotFilter,
      count: bySlot[s],
    })),
  ];
}

/**
 * Lista tras cambiar una prenda (3.10): si encaja con la vista y los filtros,
 * va en su sitio (`created_at desc`; una que vuelve, p. ej. al deshacer el
 * archivado, entra si cae dentro de lo cargado); si no, sale. Devuelve la
 * misma lista si no cambia.
 */
export function applyGarmentChange(
  items: readonly Garment[],
  garment: Garment,
  query: CatalogQuery,
  complete: boolean,
): Garment[] {
  if (!garmentMatches(garment, query)) return withoutGarment(items, garment.id);
  // Ya estaba: se sustituye en el mismo sitio (el orden no cambia al editar).
  if (items.some((g) => g.id === garment.id)) {
    return items.map((g) => (g.id === garment.id ? garment : g));
  }
  return insertGarment(items, garment, complete);
}

/** Lista sin la prenda `id` (la misma si no estaba). */
export function withoutGarment(items: readonly Garment[], id: string): Garment[] {
  const rest = items.filter((g) => g.id !== id);
  return rest.length === items.length ? (items as Garment[]) : rest;
}

function errorCodeOf(err: unknown): ApiClientErrorCode {
  return isApiClientError(err) ? err.code : "unknown";
}

// Número de la carga en curso: las respuestas de cargas anteriores se ignoran.
let generation = 0;
let controller: AbortController | null = null;

const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

export const useCatalogStore = create<CatalogState>()((set, get) => {
  /** Cambia vista/hueco/filtros, vacía la selección y recarga. */
  const changeQuery = (patch: Partial<Pick<CatalogState, "view" | "slot" | "filters">>) => {
    set({ ...patch, selectedIds: [], allIds: null });
    void get().load();
  };

  return {
    view: "active",
    slot: "all",
    filters: EMPTY_FILTERS,
    counts: null,
    options: null,
    items: [],
    nextCursor: null,
    status: "idle",
    moreStatus: "idle",
    errorCode: null,
    loadedAt: null,
    selecting: false,
    selectedIds: [],
    allIds: null,

    setView: (view) => {
      if (view === get().view) return;
      // Los tipos y el hueco dependen de lo que haya en cada vista: se vuelve a "Todo".
      // Cambiar de vista también sale del modo selección (3.11).
      set({ selecting: false });
      changeQuery({ view, slot: "all" });
    },
    setSlot: (slot) => {
      if (slot === get().slot) return;
      // Cambiar de hueco reinicia los tipos (3.4).
      changeQuery({ slot, filters: { ...get().filters, types: [] } });
    },
    setFilters: (filters) => changeQuery({ filters: { ...get().filters, ...filters } }),
    clearFilters: () => changeQuery({ filters: EMPTY_FILTERS }),
    setQuery: ({ view, slot, filters }) => changeQuery({ view, slot, filters }),

    loadOptions: async () => {
      try {
        const [b, t] = await Promise.all([
          apiFetch<BrandsResponse>("/api/brands"),
          apiFetch<TagsResponse>("/api/tags"),
        ]);
        set({ options: { brands: b.brands, tags: t.tags } });
        // Etiquetas de la URL que ya no existen: fuera (si no, nada coincidiría).
        const known = new Set(t.tags.map((x) => x.id));
        const { filters } = get();
        if (filters.tags.some((id) => !known.has(id))) {
          get().setFilters({ tags: filters.tags.filter((id) => known.has(id)) });
        }
      } catch {
        // Sin opciones la hoja enseña lo que tenga; los chips activos siguen.
      }
    },

    load: async () => {
      const id = ++generation;
      controller?.abort();
      const ac = new AbortController();
      controller = ac;
      set({
        status: "loading",
        moreStatus: "idle",
        errorCode: null,
        items: [],
        nextCursor: null,
        loadedAt: Date.now(),
      });
      try {
        const [counts, page] = await Promise.all([
          apiFetch<GarmentCountsResponse>("/api/garments/counts", { signal: ac.signal }),
          apiFetch<GarmentListResponse>(`/api/garments?${listParams(get())}`, {
            signal: ac.signal,
          }),
        ]);
        if (id !== generation) return;
        set({ counts, items: page.items, nextCursor: page.nextCursor, status: "ready" });
      } catch (err) {
        if (id !== generation || isAbort(err)) return;
        // Sesión caducada: apiFetch ya navega al login; no se enseña nada.
        if (isApiClientError(err) && err.code === "unauthorized") return;
        set({ status: "error", errorCode: errorCodeOf(err) });
      }
    },

    loadMore: async () => {
      const { status, moreStatus, nextCursor } = get();
      if (status !== "ready" || moreStatus === "loading" || !nextCursor) return;
      const id = generation;
      set({ moreStatus: "loading", errorCode: null });
      try {
        const page = await apiFetch<GarmentListResponse>(
          `/api/garments?${listParams(get(), nextCursor)}`,
          { signal: controller?.signal },
        );
        if (id !== generation) return;
        // Por si una prenda ya estaba (p. ej. creada entre página y página).
        const seen = new Set(get().items.map((g) => g.id));
        set({
          items: [...get().items, ...page.items.filter((g) => !seen.has(g.id))],
          nextCursor: page.nextCursor,
          moreStatus: "idle",
        });
      } catch (err) {
        if (id !== generation || isAbort(err)) return;
        if (isApiClientError(err) && err.code === "unauthorized") return;
        set({ moreStatus: "error", errorCode: errorCodeOf(err) });
      }
    },

    refresh: () => get().load(),

    insertSaved: (garment) => {
      const { status, items, nextCursor } = get();
      if (status !== "ready" || !garmentMatches(garment, get())) return;
      const next = insertGarment(items, garment, nextCursor === null);
      if (next !== items) set({ items: next });
    },

    reloadCounts: async () => {
      const id = generation;
      try {
        const counts = await apiFetch<GarmentCountsResponse>("/api/garments/counts");
        // Una carga nueva trae sus propios recuentos.
        if (id === generation && get().status === "ready") set({ counts });
      } catch {
        // Se quedan los de antes; la próxima carga los corrige.
      }
    },

    updateGarment: (garment) => {
      const { status, items, nextCursor, selectedIds } = get();
      const prev = items.find((g) => g.id === garment.id);
      emitGarmentChanged([garment.id], changeOf(garment, prev?.archived));
      if (status === "ready") {
        const next = applyGarmentChange(items, garment, get(), nextCursor === null);
        if (next !== items) {
          const ids = new Set(next.map((g) => g.id));
          set({ items: next, selectedIds: selectedIds.filter((id) => ids.has(id)) });
        }
      }
      void get().reloadCounts();
      if (get().options) void get().loadOptions();
    },

    removeGarment: (id) => {
      const { items, selectedIds } = get();
      emitGarmentChanged([id], "deleted");
      const next = withoutGarment(items, id);
      if (next !== items) set({ items: next, selectedIds: selectedIds.filter((x) => x !== id) });
      void get().reloadCounts();
      if (get().options) void get().loadOptions();
    },

    setSelecting: (selecting) => set({ selecting, selectedIds: [], allIds: null }),
    toggleSelected: (id) =>
      set(({ selectedIds }) => ({
        selectedIds: selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      })),
    setSelected: (ids) => set({ selectedIds: ids }),

    selectAll: async () => {
      const id = generation;
      const { ids } = await apiFetch<GarmentIdsResponse>(`/api/garments?${idsParams(get())}`);
      // Si entretanto cambió la vista, el hueco o los filtros, no vale.
      if (id !== generation || !get().selecting) return;
      set({ selectedIds: ids, allIds: ids });
    },

    setArchived: async (ids, archived) => {
      let updated = 0;
      const done: string[] = [];
      try {
        for (const part of chunk(ids, ARCHIVE_BATCH)) {
          const res = await apiFetch<GarmentArchiveResponse>("/api/garments/archive", {
            method: "POST",
            json: { ids: part, archived },
          });
          updated += res.updated;
          done.push(...part);
        }
      } finally {
        // Un solo aviso con las tandas que sí se han guardado.
        emitGarmentChanged(done, archived ? "archived" : "unarchived");
      }
      const { view, items, selectedIds, allIds, status } = get();
      const fits = archived === (view === "archived");
      const changed = new Set(ids);
      if (fits) {
        // Vuelven a encajar con la vista (deshacer): se recarga la lista para
        // que entren en su sitio.
        if (status === "ready" || status === "error") void get().load();
        else void get().reloadCounts();
      } else {
        set({
          items: items.filter((g) => !changed.has(g.id)),
          selectedIds: selectedIds.filter((x) => !changed.has(x)),
          allIds: allIds && allIds.filter((x) => !changed.has(x)),
        });
        void get().reloadCounts();
      }
      if (get().options) void get().loadOptions();
      return updated;
    },
  };
});
