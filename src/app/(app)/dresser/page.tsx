// Vestidor (screens.md 7). La pantalla es de cliente: el estado vive en
// features/dresser/store.ts y los datos llegan por la API (apiFetch). Konva
// solo se carga aquí, en un chunk aparte (OutfitCanvasLazy).
import { Dresser } from "@/features/dresser/Dresser";

export default function DresserPage() {
  return <Dresser />;
}
