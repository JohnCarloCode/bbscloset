"use client";

// Paso 3 de "Añadir prenda" (screens.md 5.3): la foto ya está en la cola de
// recorte y el formulario se rellena mientras tanto. Arriba, la vista previa
// enlazada al item de la cola; debajo, GarmentForm en modo `add`. Los botones
// ("Añadir a {hueco}" y "Guardar y añadir otra") van en el pie de la hoja
// (AddGarmentSheet); el borrador vive en el store de la hoja.
import { CutoutPreview } from "../form/CutoutPreview";
import { GarmentForm } from "../form/GarmentForm";
import { useAddGarment } from "./store";

export function GarmentDataStep({ formId, onSubmit }: { formId: string; onSubmit: () => void }) {
  const localId = useAddGarment((s) => s.localId);
  const hasAlpha = useAddGarment((s) => s.hasAlpha);
  const draft = useAddGarment((s) => s.draft);
  const setDraft = useAddGarment((s) => s.setDraft);

  if (!localId) return null;

  return (
    <GarmentForm
      id={formId}
      mode="add"
      value={draft}
      onChange={setDraft}
      onSubmit={onSubmit}
      className="pt-xs pb-md"
      header={<CutoutPreview localId={localId} hasAlpha={hasAlpha} />}
    />
  );
}
