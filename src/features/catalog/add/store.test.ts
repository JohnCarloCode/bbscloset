import { beforeEach, describe, expect, it, vi } from "vitest";

// La cola de verdad usa IndexedDB y canvas: aquí basta con su forma.
const queue = vi.hoisted(() => ({
  enqueue: vi.fn<(...args: unknown[]) => Promise<string>>(),
  remove: vi.fn<(localId: string) => void>(),
}));
vi.mock("@/features/queue/store", () => ({
  useQueueStore: { getState: () => queue },
}));

// Validación y transparencia sin canvas: el nombre decide el resultado.
vi.mock("@/lib/imaging/validate", async () => {
  const { ImagingError } = await import("@/lib/imaging/errors");
  return {
    validate: vi.fn(async (file: File) => {
      if (file.name.startsWith("bad")) throw new ImagingError("not_image");
      return { width: 10, height: 10 };
    }),
  };
});
vi.mock("@/lib/imaging/transparency", () => ({
  hasTransparency: vi.fn(async (file: Blob) => (file as File).name.startsWith("cut")),
}));

import { useAddGarment } from "./store";

const photo = (name = "camisa.png") => new File(["x"], name, { type: "image/png" });

beforeEach(() => {
  queue.enqueue.mockReset();
  queue.remove.mockReset();
  useAddGarment.getState().finish();
});

describe("useAddGarment", () => {
  it("abre en el paso 1 y preselecciona el modo según lo detectado", () => {
    const s = useAddGarment.getState();
    s.open();
    expect(useAddGarment.getState()).toMatchObject({ isOpen: true, step: "pick" });
    s.pickPhoto(photo(), true);
    expect(useAddGarment.getState()).toMatchObject({ step: "choose", mode: "as-is" });
    s.pickPhoto(photo("foto.jpg"), false);
    expect(useAddGarment.getState().mode).toBe("cut");
  });

  it("Continuar encola la prenda con el modo elegido y pasa al paso 3", async () => {
    queue.enqueue.mockResolvedValue("L1");
    const s = useAddGarment.getState();
    s.open();
    const file = photo();
    s.pickPhoto(file, false);
    s.setMode("as-is");
    await s.continueWith();
    expect(queue.enqueue).toHaveBeenCalledWith("garment", file, "as-is", {
      sourceName: "camisa.png",
    });
    expect(useAddGarment.getState()).toMatchObject({ step: "data", localId: "L1" });
  });

  it("cerrar sin guardar quita el item de la cola", async () => {
    queue.enqueue.mockResolvedValue("L2");
    const s = useAddGarment.getState();
    s.open();
    s.pickPhoto(photo(), false);
    await s.continueWith();
    s.close();
    expect(queue.remove).toHaveBeenCalledWith("L2");
    expect(useAddGarment.getState()).toMatchObject({ isOpen: false, localId: null, file: null });
  });

  it("finish cierra sin quitar el item (guardado en 3.8)", async () => {
    queue.enqueue.mockResolvedValue("L3");
    const s = useAddGarment.getState();
    s.open();
    s.pickPhoto(photo(), false);
    await s.continueWith();
    s.finish();
    expect(queue.remove).not.toHaveBeenCalled();
  });

  it("restart (Guardar y añadir otra) vuelve al paso 1 sin cerrar ni quitar el item", async () => {
    queue.enqueue.mockResolvedValue("L5");
    const s = useAddGarment.getState();
    s.open();
    s.pickPhoto(photo(), false);
    await s.continueWith();
    s.setDraft({ ...useAddGarment.getState().draft, typeId: "shirt", name: "flores" });
    s.restart();
    expect(queue.remove).not.toHaveBeenCalled();
    expect(useAddGarment.getState()).toMatchObject({
      isOpen: true,
      step: "pick",
      localId: null,
      draft: { typeId: null, name: "" },
    });
  });

  it("si se cierra mientras se encola, el item que llega tarde se quita", async () => {
    let resolve!: (id: string) => void;
    queue.enqueue.mockReturnValue(new Promise((r) => (resolve = r)));
    const s = useAddGarment.getState();
    s.open();
    s.pickPhoto(photo(), false);
    const pending = s.continueWith();
    s.close();
    s.open(); // otra sesión antes de que acabe
    resolve("L4");
    await pending;
    expect(queue.remove).toHaveBeenCalledWith("L4");
    expect(useAddGarment.getState()).toMatchObject({ isOpen: true, step: "pick", localId: null });
  });

  it("un error al encolar deja la hoja en el paso 2", async () => {
    queue.enqueue.mockRejectedValue(new Error("decode"));
    const s = useAddGarment.getState();
    s.open();
    s.pickPhoto(photo(), false);
    await expect(s.continueWith()).rejects.toThrow("decode");
    expect(useAddGarment.getState()).toMatchObject({ step: "choose", continuing: false });
  });

  describe("subida masiva (5.5)", () => {
    const waitChecked = () =>
      vi.waitFor(() => {
        expect(useAddGarment.getState().bulk.some((e) => e.check === "pending")).toBe(false);
      });

    it("coge las 30 primeras, comprueba cada foto y propone el modo", async () => {
      const s = useAddGarment.getState();
      s.open();
      const files = [photo("bad.txt"), photo("cut.png"), photo("a.jpg")];
      for (let i = 0; i < 30; i++) files.push(photo(`x${i}.jpg`));
      s.pickSeveral(files, null);
      expect(useAddGarment.getState()).toMatchObject({ step: "bulk", bulkDropped: 3 });
      expect(useAddGarment.getState().bulk).toHaveLength(30);
      await waitChecked();
      const [bad, cut, a] = useAddGarment.getState().bulk;
      expect(bad).toMatchObject({ check: "invalid", error: "not_image" });
      expect(cut).toMatchObject({ check: "ok", hasAlpha: true, mode: "as-is" });
      expect(a).toMatchObject({ check: "ok", hasAlpha: false, mode: "cut" });
    });

    it("añade solo las válidas que caben, por revisar, y cierra la hoja", async () => {
      queue.enqueue.mockImplementation(async () => crypto.randomUUID());
      const s = useAddGarment.getState();
      s.open();
      s.pickSeveral([photo("bad.txt"), photo("cut.png"), photo("a.jpg"), photo("b.jpg")], 2);
      await waitChecked();
      s.setBulkModeAll("cut");
      s.toggleBulkMode(useAddGarment.getState().bulk[2].id);
      const added = await s.addBulk();
      expect(added).toBe(2);
      expect(queue.enqueue).toHaveBeenCalledTimes(2);
      expect(queue.enqueue.mock.calls[0]).toEqual([
        "garment",
        expect.objectContaining({ name: "cut.png" }),
        "cut",
        { needsReview: true, sourceName: "cut.png", hasAlpha: true },
      ]);
      expect(queue.enqueue.mock.calls[1][2]).toBe("as-is");
      expect(useAddGarment.getState()).toMatchObject({ isOpen: false, bulk: [] });
    });

    it("cerrar a medias para de encolar y conserva las ya metidas", async () => {
      queue.enqueue.mockImplementation(async () => {
        useAddGarment.getState().close();
        return "L9";
      });
      const s = useAddGarment.getState();
      s.open();
      s.pickSeveral([photo("a.jpg"), photo("b.jpg")], null);
      await waitChecked();
      expect(await s.addBulk()).toBeNull();
      expect(queue.enqueue).toHaveBeenCalledTimes(1);
      expect(queue.remove).not.toHaveBeenCalled();
    });
  });
});
