// Recortar fotos (screens.md 13): recorte en lote con descarga en PNG. Toda
// la pantalla es de cliente (features/cutout/BatchCutout.tsx).
import { BatchCutout } from "@/features/cutout/BatchCutout";

export default function CutoutPage() {
  return <BatchCutout />;
}
