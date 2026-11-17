import { describe, expect, it } from "vitest";
import {
  backoffDelay,
  classifyUploadError,
  createWaker,
  finishedRound,
  garmentItems,
  nextToCut,
  nextToUpload,
  pillState,
  queuePosition,
  readyAnnouncementCount,
  recoverInterrupted,
  shouldUpload,
} from "./logic";
import type { QueueItem } from "./types";

const blob = new Blob(["x"]);
let seq = 0;
function item(over: Partial<QueueItem> = {}): QueueItem {
  seq++;
  return {
    localId: `id-${seq}`,
    userId: "u1",
    kind: "garment",
    createdAt: seq,
    status: "queued",
    progress: 0,
    mode: "cut",
    source: blob,
    ...over,
  };
}
const data = { type_id: "tshirt" as const, seasons: [], tags: [] };
const readyGarment = (over: Partial<QueueItem> = {}) =>
  item({ status: "ready", cutout: blob, thumb: blob, progress: 1, garmentData: data, ...over });

describe("nextToCut", () => {
  it("coge el primer queued por orden de llegada, de cualquier tipo", () => {
    const a = item({ createdAt: 30 });
    const b = item({ createdAt: 10, kind: "batch" });
    const c = item({ createdAt: 5, status: "ready" });
    expect(nextToCut([a, b, c])?.localId).toBe(b.localId);
  });

  it("no devuelve nada si no hay queued", () => {
    expect(nextToCut([item({ status: "cutting" }), item({ status: "error" })])).toBeUndefined();
  });
});

describe("recoverInterrupted", () => {
  it("cutting vuelve a queued con el progreso a cero; el resto no cambia", () => {
    const cutting = item({ status: "cutting", progress: 0.6, stage: "cutting" });
    const ready = readyGarment();
    const [a, b] = recoverInterrupted([cutting, ready]);
    expect(a).toMatchObject({ status: "queued", progress: 0, stage: undefined });
    expect(b).toBe(ready);
  });
});

describe("queuePosition", () => {
  it("cuenta entre los pendientes (cutting incluido), de 1 en adelante", () => {
    const running = item({ status: "cutting" });
    const done = readyGarment();
    const second = item();
    const batch = item({ kind: "batch" });
    const items = [batch, second, done, running];
    expect(queuePosition(items, running.localId)).toBe(1);
    expect(queuePosition(items, second.localId)).toBe(2);
    expect(queuePosition(items, batch.localId)).toBe(3);
    expect(queuePosition(items, done.localId)).toBe(0);
  });
});

describe("pillState", () => {
  it("no cuenta el recorte en lote", () => {
    const pill = pillState([item({ kind: "batch" }), item({ kind: "batch", status: "cutting" })]);
    expect(pill.visible).toBe(false);
    expect(pill.total).toBe(0);
  });

  it("Recortando {listas + errores + 1} de {total}, con el progreso del que recorta", () => {
    const items = [
      readyGarment(),
      readyGarment({ uploaded: true }),
      item({ status: "error" }),
      item({ kind: "replace", status: "cutting", progress: 0.4 }),
      item(),
      item({ kind: "batch" }),
    ];
    expect(pillState(items)).toEqual({
      visible: true,
      current: 4,
      total: 5,
      ready: 2,
      progress: 0.4,
    });
  });

  it("se oculta cuando no queda ninguna prenda en cola", () => {
    expect(pillState([readyGarment(), item({ status: "error" })]).visible).toBe(false);
  });

  it("garmentItems excluye batch y respeta el orden de llegada", () => {
    const a = item({ createdAt: 9 });
    const b = item({ createdAt: 1, kind: "replace" });
    expect(garmentItems([a, item({ kind: "batch" }), b]).map((i) => i.localId)).toEqual([
      b.localId,
      a.localId,
    ]);
  });
});

describe("shouldUpload / nextToUpload", () => {
  it("garment: solo con recorte y tipo", () => {
    expect(shouldUpload(readyGarment())).toBe(true);
    expect(shouldUpload(readyGarment({ garmentData: undefined }))).toBe(false);
    expect(shouldUpload(readyGarment({ cutout: undefined }))).toBe(false);
    expect(shouldUpload(readyGarment({ status: "cutting" }))).toBe(false);
  });

  it("no con error de subida fijo ni ya subida", () => {
    expect(shouldUpload(readyGarment({ uploadError: "limit_reached" }))).toBe(false);
    expect(shouldUpload(readyGarment({ uploaded: true }))).toBe(false);
  });

  it("replace con garmentId; batch nunca", () => {
    expect(
      shouldUpload(readyGarment({ kind: "replace", garmentData: undefined, garmentId: "g" })),
    ).toBe(true);
    expect(shouldUpload(readyGarment({ kind: "replace", garmentData: undefined }))).toBe(false);
    expect(shouldUpload(readyGarment({ kind: "batch" }))).toBe(false);
  });

  it("de una en una, por orden de llegada", () => {
    const late = readyGarment({ createdAt: 100 });
    const early = readyGarment({ createdAt: 2 });
    expect(nextToUpload([late, item(), early])?.localId).toBe(early.localId);
  });
});

describe("finishedRound", () => {
  it("no acaba mientras haya prendas en cola o por subir", () => {
    expect(finishedRound([readyGarment({ uploaded: true }), item()])).toBeNull();
    expect(finishedRound([readyGarment({ uploaded: true }), readyGarment()])).toBeNull();
  });

  it("acaba con lo que no se puede subir solo y devuelve las subidas", () => {
    const up = readyGarment({ uploaded: true });
    const draft = readyGarment({ garmentData: undefined });
    const failed = readyGarment({ uploadError: "limit_reached" });
    const batch = item({ kind: "batch" });
    expect(finishedRound([up, draft, failed, batch])).toEqual([up]);
  });
});

describe("readyAnnouncementCount", () => {
  it("cuenta las prendas nuevas no anunciadas al guardar (sin cambios de foto)", () => {
    const pending = readyGarment({ uploaded: true });
    const announced = readyGarment({ uploaded: true, announced: true });
    const replaced = readyGarment({ uploaded: true, kind: "replace", garmentId: "g1" });
    expect(readyAnnouncementCount([pending, announced, replaced])).toBe(1);
    expect(readyAnnouncementCount([announced])).toBe(0);
  });
});

describe("backoffDelay", () => {
  it("crece al doble desde 2 s hasta 1 min", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 10].map((n) => backoffDelay(n))).toEqual([
      2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000,
    ]);
  });
});

describe("classifyUploadError", () => {
  it.each([
    ["network", 0, "retry"],
    ["storage", 0, "retry"],
    ["storage", 400, "retry"],
    ["internal", 500, "retry"],
    ["unknown", 502, "retry"],
    ["upload_missing", 409, "reupload"],
    ["conflict", 409, "done"],
    ["limit_reached", 409, "fatal"],
    ["invalid_body", 400, "fatal"],
    ["not_found", 404, "fatal"],
    ["unauthorized", 401, "stop"],
  ] as const)("%s (%i) → %s", (code, status, action) => {
    expect(classifyUploadError(code, status)).toBe(action);
  });
});

describe("createWaker", () => {
  it("wait() se resuelve con el siguiente wake()", async () => {
    const waker = createWaker();
    let woke = false;
    const p = waker.wait().then(() => (woke = true));
    await Promise.resolve();
    expect(woke).toBe(false);
    waker.wake();
    await p;
    expect(woke).toBe(true);
  });
});
