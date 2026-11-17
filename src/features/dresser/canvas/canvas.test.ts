// Tests de la matemática del lienzo (geometría, gesto de dos dedos y tema).
// Los gestos táctiles reales no se han probado en móvil: esto cubre solo la
// matemática.
import { describe, expect, it } from "vitest";
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  garmentPixelSize,
  nodeBox,
  normalizeRotation,
  transformFromNode,
} from "./geometry";
import { angleDelta, twoFingerTransform, type TwoFingers } from "./gestures";
import { parseDropShadow } from "./theme";

const size = { width: 400, height: 800 };

describe("geometry", () => {
  it("el lado mayor mide scale × lado corto del lienzo", () => {
    expect(garmentPixelSize(0.5, 2, size)).toEqual({ width: 200, height: 100 });
    expect(garmentPixelSize(0.5, 0.5, size)).toEqual({ width: 100, height: 200 });
    expect(garmentPixelSize(0.5, NaN, size)).toEqual({ width: 200, height: 200 });
  });

  it("nodeBox pone el origen en el centro", () => {
    const b = nodeBox({ x: 0.25, y: 0.5, scale: 0.5, rotation: 30 }, 1, size);
    expect(b).toEqual({
      x: 100,
      y: 400,
      width: 200,
      height: 200,
      offsetX: 100,
      offsetY: 100,
      rotation: 30,
    });
  });

  it("transformFromNode es la inversa de nodeBox con escala 1", () => {
    const t = { x: 0.3, y: 0.7, scale: 0.4, rotation: -45 };
    const b = nodeBox(t, 0.8, size);
    expect(transformFromNode({ ...b, scaleX: 1 }, t.scale, size)).toEqual(t);
  });

  it("transformFromNode multiplica la escala y la limita", () => {
    const n = { x: 200, y: 400, rotation: 0 };
    expect(transformFromNode({ ...n, scaleX: 1.5 }, 0.4, size).scale).toBeCloseTo(0.6);
    expect(transformFromNode({ ...n, scaleX: 100 }, 0.4, size).scale).toBe(MAX_SCALE);
    expect(transformFromNode({ ...n, scaleX: 0.001 }, 0.4, size).scale).toBe(MIN_SCALE);
  });

  it("normaliza la rotación a (-180, 180]", () => {
    expect(normalizeRotation(370)).toBe(10);
    expect(normalizeRotation(-190)).toBe(170);
    expect(normalizeRotation(180)).toBe(180);
    expect(normalizeRotation(-180)).toBe(180);
    expect(normalizeRotation(-360)).toBe(0);
    expect(clampScale(NaN)).toBe(MIN_SCALE);
  });
});

describe("gesto de dos dedos (no comprobado en móvil)", () => {
  const start: TwoFingers = { a: { x: 100, y: 100 }, b: { x: 200, y: 100 } };
  const node = { x: 150, y: 100, rotation: 0, scale: 0.4 };

  it("sin movimiento no cambia nada", () => {
    const r = twoFingerTransform(start, start, node);
    expect(r.x).toBeCloseTo(150);
    expect(r.y).toBeCloseTo(100);
    expect(r.rotation).toBeCloseTo(0);
    expect(r.scale).toBeCloseTo(0.4);
  });

  it("pellizcar (separar los dedos al doble) duplica la escala", () => {
    const cur: TwoFingers = { a: { x: 50, y: 100 }, b: { x: 250, y: 100 } };
    const r = twoFingerTransform(start, cur, node);
    expect(r.scale).toBeCloseTo(0.8);
    expect(r.rotation).toBeCloseTo(0);
    expect(r.x).toBeCloseTo(150);
  });

  it("girar los dedos 90° en sentido horario rota +90°", () => {
    const cur: TwoFingers = { a: { x: 150, y: 50 }, b: { x: 150, y: 150 } };
    const r = twoFingerTransform(start, cur, node);
    expect(r.rotation).toBeCloseTo(90);
    expect(r.scale).toBeCloseTo(0.4);
  });

  it("la prenda gira alrededor del punto medio de los dedos", () => {
    // Prenda a 50 px a la derecha del punto medio; giro de 90° → queda 50 px abajo.
    const n = { ...node, x: 200 };
    const cur: TwoFingers = { a: { x: 150, y: 50 }, b: { x: 150, y: 150 } };
    const r = twoFingerTransform(start, cur, n);
    expect(r.x).toBeCloseTo(150);
    expect(r.y).toBeCloseTo(150);
  });

  it("mover los dos dedos arrastra la prenda", () => {
    const cur: TwoFingers = { a: { x: 130, y: 140 }, b: { x: 230, y: 140 } };
    const r = twoFingerTransform(start, cur, node);
    expect(r.x).toBeCloseTo(180);
    expect(r.y).toBeCloseTo(140);
  });

  it("con la escala limitada la posición usa la escala limitada", () => {
    const n = { ...node, x: 200 };
    const cur: TwoFingers = { a: { x: 0, y: 100 }, b: { x: 300, y: 100 } }; // ×3
    const r = twoFingerTransform(start, cur, n, (s) => Math.min(s, 0.8)); // ×2 como mucho
    expect(r.scale).toBeCloseTo(0.8);
    expect(r.x).toBeCloseTo(250); // 150 + 2 × 50
  });

  it("dedos juntos al empezar: solo arrastre", () => {
    const s: TwoFingers = { a: { x: 100, y: 100 }, b: { x: 100, y: 100 } };
    const cur: TwoFingers = { a: { x: 110, y: 100 }, b: { x: 190, y: 120 } };
    const r = twoFingerTransform(s, cur, node);
    expect(r.scale).toBe(0.4);
    expect(r.rotation).toBe(0);
  });

  it("angleDelta no salta al cruzar ±180°", () => {
    expect(angleDelta(170, -170)).toBeCloseTo(20);
    expect(angleDelta(-170, 170)).toBeCloseTo(-20);
  });
});

describe("parseDropShadow", () => {
  it("lee el token tal como lo emite Tailwind y en formato CSS", () => {
    expect(parseDropShadow(" 3px 5px 30px #00000038")).toEqual({
      color: "#00000038",
      offsetX: 3,
      offsetY: 5,
      blur: 30,
    });
    expect(parseDropShadow("rgba(0, 0, 0, 0.22) 3px 5px 30px")).toEqual({
      color: "rgba(0, 0, 0, 0.22)",
      offsetX: 3,
      offsetY: 5,
      blur: 30,
    });
    expect(parseDropShadow("drop-shadow(3px 5px 30px rgba(0,0,0,.22))")?.blur).toBe(30);
  });

  it("devuelve null si no se entiende", () => {
    expect(parseDropShadow("")).toBeNull();
    expect(parseDropShadow("none")).toBeNull();
    expect(parseDropShadow("3px red blue")).toBeNull();
  });
});
