import { describe, expect, it } from "vitest";
import { previewStatus } from "./previewStatus";

const base = { progress: 0, mode: "cut" as const };

describe("previewStatus", () => {
  it("en cola: posición y barra a 0", () => {
    expect(previewStatus({ ...base, status: "queued" }, 2)).toMatchObject({
      key: "queue.status.position",
      values: { position: 2 },
      progress: 0,
    });
  });

  it("recortando: primera vez (modelo) o con %", () => {
    expect(previewStatus({ ...base, status: "cutting", stage: "preparing" }, 1).key).toBe(
      "queue.status.preparing",
    );
    expect(
      previewStatus({ ...base, status: "cutting", stage: "cutting", progress: 0.456 }, 1),
    ).toMatchObject({ key: "queue.status.cutting", values: { percent: 46 }, progress: 45.6 });
  });

  it("listo: fondo quitado o ya recortada (con o sin transparencia)", () => {
    expect(previewStatus({ ...base, status: "ready" }, 0)).toMatchObject({
      key: "queue.status.done",
      progress: null,
    });
    expect(previewStatus({ ...base, mode: "as-is", status: "ready" }, 0, true).key).toBe(
      "queue.status.asIsCutout",
    );
    expect(previewStatus({ ...base, mode: "as-is", status: "ready" }, 0, false).key).toBe(
      "queue.status.asIsPhoto",
    );
  });

  it("error: mensaje del motivo y Cambiar foto", () => {
    expect(previewStatus({ ...base, status: "error", error: "cut_failed" }, 0)).toMatchObject({
      key: "queue.errors.cut_failed",
      failed: true,
    });
    expect(previewStatus({ ...base, status: "error" }, 0).key).toBe("queue.status.error");
  });
});
