import { describe, expect, it } from "vitest";
import { pngFileName, uniqueNames, zipBlob } from "./zip";

/** Nombres del directorio central de un ZIP (firma PK\x01\x02). */
function centralNames(buf: Uint8Array): string[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const names: string[] = [];
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const len = view.getUint16(i + 28, true);
    names.push(new TextDecoder().decode(buf.subarray(i + 46, i + 46 + len)));
    i += 45 + len;
  }
  return names;
}

describe("pngFileName", () => {
  it("cambia la extensión por .png", () => {
    expect(pngFileName("IMG_4801.HEIC", "recorte-1")).toBe("IMG_4801.png");
    expect(pngFileName("camiseta.negra.jpg", "recorte-1")).toBe("camiseta.negra.png");
    expect(pngFileName("sin-extension", "recorte-1")).toBe("sin-extension.png");
  });

  it("sin nombre usa el de reserva", () => {
    expect(pngFileName(undefined, "recorte-3")).toBe("recorte-3.png");
    expect(pngFileName(".jpg", "recorte-3")).toBe("recorte-3.png");
  });

  it("quita las carpetas", () => {
    expect(pngFileName("fotos/abrigo.webp", "x")).toBe("abrigo.png");
  });
});

describe("uniqueNames", () => {
  it("numera los repetidos sin distinguir mayúsculas", () => {
    expect(uniqueNames(["a.png", "b.png", "A.png", "a.png", "a (2).png"])).toEqual([
      "a.png",
      "b.png",
      "A (2).png",
      "a (3).png",
      "a (2) (2).png",
    ]);
  });
});

describe("zipBlob", () => {
  it("mete cada PNG con su nombre y los pide de uno en uno", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const entries = Array.from({ length: 10 }, (_, i) => ({
      name: `foto-${i + 1}.png`,
      png: async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, i])], { type: "image/png" });
      },
    }));
    const blob = await zipBlob(entries);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect([...buf.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(centralNames(buf)).toEqual(entries.map((e) => e.name));
    expect(maxInFlight).toBe(1);
  });
});
