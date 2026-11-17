import { describe, expect, it } from "vitest";
import { alphaBoundingBox, garmentBoundingBox } from "./encode";

function image(width: number, height: number, alpha: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = alpha(x, y);
  return { data, width, height };
}

describe("alphaBoundingBox", () => {
  it("encuentra la caja de la prenda", () => {
    const img = image(50, 40, (x, y) => (x >= 10 && x <= 29 && y >= 5 && y <= 34 ? 255 : 0));
    expect(alphaBoundingBox(img)).toEqual({ x: 10, y: 5, width: 20, height: 30 });
  });

  it("una imagen opaca ocupa todo", () => {
    expect(alphaBoundingBox(image(7, 3, () => 255))).toEqual({ x: 0, y: 0, width: 7, height: 3 });
  });

  it("ignora el halo casi invisible por debajo del umbral", () => {
    const img = image(20, 20, (x, y) => (x === 10 && y === 10 ? 200 : x < 2 ? 5 : 0));
    expect(alphaBoundingBox(img)).toEqual({ x: 10, y: 10, width: 1, height: 1 });
    expect(alphaBoundingBox(img, 0)).toEqual({ x: 0, y: 0, width: 11, height: 20 });
  });

  it("null si todo es transparente", () => {
    expect(alphaBoundingBox(image(10, 10, () => 0))).toBeNull();
  });
});

describe("garmentBoundingBox", () => {
  // 256×256: prenda opaca en x 80–175, y 60–199; motas de ruido sueltas por el
  // fondo (alfa 200 y halo de alfa 40), como deja el recorte de @imgly.
  const garment = (x: number, y: number) => x >= 80 && x <= 175 && y >= 60 && y <= 199;
  const speck = (x: number, y: number) => (x * 7 + y * 13) % 97 === 0;
  const noisy = image(256, 256, (x, y) =>
    garment(x, y) ? 255 : speck(x, y) ? 200 : x % 5 ? 40 : 0,
  );

  it("la caja exacta del alfa se va a la imagen entera por el ruido", () => {
    expect(alphaBoundingBox(noisy)).toEqual({ x: 0, y: 0, width: 256, height: 256 });
  });

  it("encuentra la prenda ignorando el ruido (con como mucho una celda de margen)", () => {
    const box = garmentBoundingBox(noisy)!;
    expect(box.x).toBeLessThanOrEqual(80);
    expect(box.y).toBeLessThanOrEqual(60);
    expect(box.x + box.width - 1).toBeGreaterThanOrEqual(175);
    expect(box.y + box.height - 1).toBeGreaterThanOrEqual(199);
    expect(box.x).toBeGreaterThanOrEqual(80 - 8);
    expect(box.y).toBeGreaterThanOrEqual(60 - 8);
    expect(box.x + box.width - 1).toBeLessThanOrEqual(175 + 8);
    expect(box.y + box.height - 1).toBeLessThanOrEqual(199 + 8);
  });

  it("sin ruido coincide con la caja exacta", () => {
    const clean = image(256, 256, (x, y) => (garment(x, y) ? 255 : 0));
    expect(garmentBoundingBox(clean)).toEqual({ x: 80, y: 60, width: 96, height: 140 });
  });

  it("conserva varias piezas grandes (un par de zapatos)", () => {
    const shoes = image(256, 256, (x, y) =>
      y >= 100 && y <= 150 && ((x >= 20 && x <= 100) || (x >= 150 && x <= 230)) ? 255 : 0,
    );
    expect(garmentBoundingBox(shoes)).toEqual({ x: 20, y: 100, width: 211, height: 51 });
  });

  it("prenda fina o semitransparente: cae a la caja exacta", () => {
    const chain = image(100, 100, (x, y) =>
      y === 50 && x >= 10 && x <= 90 ? 255 : y > 70 && x === 50 ? 90 : 0,
    );
    expect(garmentBoundingBox(chain)).toEqual({ x: 10, y: 50, width: 81, height: 50 });
  });

  it("null si todo es transparente", () => {
    expect(garmentBoundingBox(image(64, 64, () => 0))).toBeNull();
  });
});
