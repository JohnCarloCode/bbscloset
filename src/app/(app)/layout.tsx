// Esqueleto de la app con sesión (screens.md 1): barra de pestañas inferior en
// móvil y tablet, barra lateral de 232 px en escritorio. El corte está en
// `desktop:` (≥ 1024 px): screens.md agrupa móvil (402) y tablet (834) con la
// barra inferior, y el prototipo solo pinta la lateral a 1280.
// TabBar y Sidebar leen la ruta con usePathname (cliente); al ir dentro del
// <Suspense> del layout raíz se renderizan en servidor con la ruta ya resuelta,
// así que aria-current sale también en el HTML.
import { Sidebar } from "@/components/nav/Sidebar";
import { TabBar } from "@/components/nav/TabBar";
import { QueuePillSlot } from "@/components/nav/QueuePillSlot";
import { QueueProvider } from "@/features/queue/QueueProvider";
import { AddGarmentSheet } from "@/features/catalog/add/AddGarmentSheet";
import { ReviewSheet } from "@/features/catalog/review/ReviewSheet";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      {/* Hueco inferior del alto de la barra para que no tape el contenido. */}
      <div className="min-w-0 flex-1 pb-(--tab-bar-h)">{children}</div>
      <TabBar />
      {/* Cola de recorte global (paso 3.6): bucles, píldora y hoja. */}
      <QueuePillSlot>
        <QueueProvider />
      </QueuePillSlot>
      {/* Hoja "Añadir prenda" (paso 3.7): se abre desde cualquier pantalla con useAddGarment. */}
      <AddGarmentSheet />
      {/* Hoja "Por revisar" (paso 3.12): la abren la franja del catálogo y el aviso de la subida masiva. */}
      <ReviewSheet />
    </div>
  );
}
