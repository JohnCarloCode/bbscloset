// Matemática del gesto de dos dedos (pellizcar = escalar, girar = rotar,
// y el punto medio arrastra). Funciones puras; useTouchGestures las aplica.
//
// Idea: el gesto es una semejanza (escala + giro + traslación) que lleva el
// segmento inicial entre los dedos al actual. Se aplica al centro de la
// prenda alrededor del punto medio inicial, así la prenda "se queda pegada"
// a los dedos.

export type Point = { x: number; y: number };
export type TwoFingers = { a: Point; b: Point };
/** Estado del nodo: centro en px, rotación en grados y escala relativa. */
export type GestureNode = { x: number; y: number; rotation: number; scale: number };

const DEG = 180 / Math.PI;

export function distance(f: TwoFingers): number {
  return Math.hypot(f.b.x - f.a.x, f.b.y - f.a.y);
}

/** Ángulo del segmento a→b en grados (sentido horario, eje y hacia abajo). */
export function angle(f: TwoFingers): number {
  return Math.atan2(f.b.y - f.a.y, f.b.x - f.a.x) * DEG;
}

export function midpoint(f: TwoFingers): Point {
  return { x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 };
}

/** Diferencia de ángulos en (-180, 180] (girar cruzando ±180° no da saltos). */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * Nuevo estado del nodo dado el inicio del gesto y la posición actual de los
 * dedos. `clamp` limita la escala resultante; si actúa, la posición se
 * calcula con la escala limitada para que la prenda no "patine".
 */
export function twoFingerTransform(
  start: TwoFingers,
  current: TwoFingers,
  node: GestureNode,
  clamp: (scale: number) => number = (s) => s,
): GestureNode {
  const d0 = distance(start);
  // Dedos juntos al empezar: no hay escala ni giro fiables; solo se arrastra.
  const rawFactor = d0 > 1 ? distance(current) / d0 : 1;
  const rot = d0 > 1 ? angleDelta(angle(start), angle(current)) : 0;
  const scale = clamp(node.scale * rawFactor);
  const factor = node.scale > 0 ? scale / node.scale : 1;

  const m0 = midpoint(start);
  const m1 = midpoint(current);
  const rad = rot / DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const vx = node.x - m0.x;
  const vy = node.y - m0.y;
  return {
    x: m1.x + factor * (vx * cos - vy * sin),
    y: m1.y + factor * (vx * sin + vy * cos),
    rotation: node.rotation + rot,
    scale,
  };
}
