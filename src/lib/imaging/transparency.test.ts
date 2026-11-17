import { describe, expect, it } from "vitest";
import { looksTransparent, sampleAlpha, type RgbaImage } from "./transparency";

/** Imagen simulada: alfa por píxel según `alpha(x, y)`. */
function image(width: number, height: number, alpha: (x: number, y: number) => number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = alpha(x, y);
  return { data, width, height };
}

const detect = (img: RgbaImage) => looksTransparent(sampleAlpha(img));

describe("sampleAlpha / looksTransparent", () => {
  it("una foto opaca no es transparente", () => {
    const img = image(100, 80, () => 255);
    expect(sampleAlpha(img)).toEqual({ borderRatio: 0, gridRatio: 0 });
    expect(detect(img)).toBe(false);
  });

  it("una prenda recortada en el centro sí lo es", () => {
    const img = image(100, 100, (x, y) => (x > 20 && x < 80 && y > 10 && y < 90 ? 255 : 0));
    expect(sampleAlpha(img).borderRatio).toBe(1);
    expect(detect(img)).toBe(true);
  });

  it("una prenda que toca los bordes pero con huecos transparentes también", () => {
    // Pantalón: llena el ancho arriba, con hueco entre las perneras abajo.
    const img = image(100, 100, (x, y) => (y > 40 && x > 35 && x < 65 ? 0 : 255));
    const stats = sampleAlpha(img);
    expect(stats.borderRatio).toBeLessThan(0.5);
    expect(stats.gridRatio).toBeGreaterThanOrEqual(0.1);
    expect(detect(img)).toBe(true);
  });

  it("un poco de alfa suelto en una esquina no basta", () => {
    const img = image(100, 100, (x, y) => (x < 3 && y < 3 ? 0 : 255));
    expect(detect(img)).toBe(false);
  });

  it("funciona con imágenes de 1 px", () => {
    expect(detect(image(1, 1, () => 0))).toBe(true);
    expect(detect(image(1, 1, () => 255))).toBe(false);
  });
});
