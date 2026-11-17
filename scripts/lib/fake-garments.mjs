// Datos de prueba para scripts/seed-garments.mjs: qué es cada foto de
// pruebas-fotos/streetwear (en orden alfabético de archivo) y valores
// variados, deterministas, para el resto de campos. Son datos de prueba, no
// listas del dominio (las de verdad están en src/lib/domain/).

// Foto i (orden alfabético) → tipo de prenda y color aproximado.
export const PHOTO_FIXTURES = [
  { type_id: "jumpsuit", color_family: "multicolor" }, // chándal amarillo y rojo
  { type_id: "tshirt", color_hex: "#c62828" }, // camiseta roja
  { type_id: "jacket", color_hex: "#283593" }, // chaqueta azul
  { type_id: "sweatshirt", color_hex: "#1a237e" }, // sudadera azul
  { type_id: "jumpsuit", color_family: "multicolor" }, // chándal negro y verde
  { type_id: "sweatshirt", color_hex: "#1b5e20" }, // sudadera verde
  { type_id: "jacket", color_hex: "#2e7d32" }, // chaqueta verde
  { type_id: "tshirt", color_hex: "#43a047" }, // camiseta verde
  { type_id: "jumpsuit", color_family: "multicolor" }, // chándal naranja y rosa
  { type_id: "sweatshirt", color_hex: "#6a1b9a" }, // sudadera morada
  { type_id: "tshirt", color_hex: "#f57c00" }, // camiseta naranja
  { type_id: "jacket", color_hex: "#5e35b1" }, // chaqueta morada
];

export const GARMENT_TYPES = [...new Set(PHOTO_FIXTURES.map((p) => p.type_id))];

const SEASON_SETS = [
  ["spring", "summer"],
  ["autumn", "winter"],
  ["spring", "autumn"],
  ["summer"],
  [],
  ["spring", "summer", "autumn", "winter"],
];
const BRANDS = ["Repma", "Zara", "Bershka", "vintage", null, "Nike"];
const TAG_SETS = [
  ["cómodo"],
  ["cómodo", "findes"],
  ["elegante"],
  ["fiesta", "elegante"],
  [],
  ["curro", "cómodo"],
  ["findes"],
];
const NAMES = [null, "la favorita", null, "la de los domingos", null, null, "regalo de mamá"];

/** Campos de la prenda i (la foto i % 12 de la carpeta). */
export function randomFields(i) {
  const photo = PHOTO_FIXTURES[i % PHOTO_FIXTURES.length];
  return {
    ...photo,
    name: NAMES[i % NAMES.length],
    seasons: SEASON_SETS[i % SEASON_SETS.length],
    brand: BRANDS[i % BRANDS.length],
    tags: TAG_SETS[i % TAG_SETS.length],
  };
}
