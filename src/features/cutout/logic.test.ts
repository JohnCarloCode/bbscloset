import { describe, expect, it } from "vitest";
import type { QueueItem } from "@/features/queue/types";
import { batchItems, isLeavingClick, summarize } from "./logic";

let t = 0;
function item(status: QueueItem["status"], kind: QueueItem["kind"] = "batch"): QueueItem {
  t++;
  return {
    localId: `id-${t}`,
    userId: "u",
    kind,
    createdAt: t,
    status,
    progress: 0,
    mode: "cut",
    source: new Blob(),
  };
}

describe("batchItems", () => {
  it("solo los batch, por orden de llegada", () => {
    const a = item("queued");
    const g = item("queued", "garment");
    const b = item("ready");
    expect(batchItems([b, g, a]).map((i) => i.localId)).toEqual([a.localId, b.localId]);
  });
});

describe("summarize", () => {
  it("cuenta listas y errores; ocupada si queda alguna por recortar", () => {
    const items = [item("ready"), item("error"), item("cutting"), item("queued")];
    expect(summarize(items, new Set())).toEqual({
      total: 4,
      ready: 1,
      failed: 1,
      busy: true,
      unsaved: true,
    });
  });

  it("sin descargar mientras quede alguna lista sin descargar", () => {
    const [a, b] = [item("ready"), item("ready")];
    const err = item("error");
    expect(summarize([a, b, err], new Set([a.localId])).unsaved).toBe(true);
    expect(summarize([a, b, err], new Set([a.localId, b.localId])).unsaved).toBe(false);
    expect(summarize([err], new Set()).unsaved).toBe(false);
    expect(summarize([], new Set()).unsaved).toBe(false);
  });
});

describe("isLeavingClick", () => {
  const click = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  const loc = { origin: "http://localhost:3100", pathname: "/cutout" };
  const a = (href: string, extra: Partial<{ target: string; hasDownload: boolean }> = {}) => ({
    href,
    target: "",
    hasDownload: false,
    ...extra,
  });

  it("enlace interno a otra ruta: sí", () => {
    expect(isLeavingClick(click, a("/catalog"), loc)).toBe(true);
    expect(isLeavingClick(click, a("http://localhost:3100/settings"), loc)).toBe(true);
  });

  it("misma ruta, otro origen, pestaña nueva o descarga: no", () => {
    expect(isLeavingClick(click, a("/cutout"), loc)).toBe(false);
    expect(isLeavingClick(click, a("/cutout?x=1"), loc)).toBe(false);
    expect(isLeavingClick(click, a("https://example.com/"), loc)).toBe(false);
    expect(isLeavingClick(click, a("/catalog", { target: "_blank" }), loc)).toBe(false);
    expect(isLeavingClick(click, a("blob:x", { hasDownload: true }), loc)).toBe(false);
    expect(isLeavingClick({ ...click, metaKey: true }, a("/catalog"), loc)).toBe(false);
    expect(isLeavingClick({ ...click, button: 1 }, a("/catalog"), loc)).toBe(false);
    expect(isLeavingClick({ ...click, defaultPrevented: true }, a("/catalog"), loc)).toBe(false);
  });
});
