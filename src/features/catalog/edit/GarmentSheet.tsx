"use client";

// Ficha de prenda "Editar prenda" (screens.md 4.3): se abre al tocar una
// tarjeta del catálogo. Arriba el recorte grande sobre cuadros con "Cambiar
// foto"; debajo el mismo formulario que al añadir (GarmentForm en modo edit)
// y, al final, "Archivar" / "Volver a usar" y "Eliminar prenda". El pie lleva
// "Guardar cambios".
// - Abre al momento con los datos de la tarjeta y pide la prenda (GET) para
//   tener el recorte grande (cutoutUrl) y los datos al día.
// - Guardar → PATCH; la tarjeta cambia en la lista sin recargar (store).
// - Cambiar foto (5.4) → ChangePhoto.tsx: pasos 5.1–5.2 en esta misma hoja;
//   mientras se recorta, la vista previa enseña su estado. Al subirse
//   (GARMENT_SAVED_EVENT `replace`) se vuelve a pedir la prenda: las URLs
//   firmadas nuevas llevan otro token y el navegador no usa la caché vieja.
// - Archivar / Volver a usar → PATCH {archived} y aviso con "Deshacer".
// - Eliminar → GET usage, diálogo destructivo y DELETE.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { useToast } from "@/components/toast";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import type { Garment, GarmentUsageResponse } from "@/lib/api/types";
import {
  GARMENT_SAVED_EVENT,
  useQueueStore,
  type GarmentSavedDetail,
} from "@/features/queue/store";
import { CutoutPreview } from "../form/CutoutPreview";
import { GarmentForm } from "../form/GarmentForm";
import {
  displayName,
  formChanged,
  formValuesFromGarment,
  isGarmentFormValid,
  toGarmentPatch,
  type GarmentFormValues,
} from "../form/logic";
import { useCatalogStore } from "../store";
import { dropPendingReplaces, replaceHasAlpha, useChangePhoto } from "./ChangePhoto";
import { DeleteDialog } from "./DeleteDialog";
import { pendingReplaceOf } from "./logic";

type Busy = "save" | "archive" | "usage" | "delete" | null;

const garmentPath = (id: string) => `/api/garments/${encodeURIComponent(id)}`;

/** PATCH {archived} y la tarjeta cambia (sale de la vista o vuelve). */
async function patchArchived(id: string, archived: boolean): Promise<Garment> {
  const g = await apiFetch<Garment>(garmentPath(id), { method: "PATCH", json: { archived } });
  useCatalogStore.getState().updateGarment(g);
  return g;
}

export type GarmentSheetProps = {
  /** La prenda de la tarjeta tocada (se monta con `key` = id). */
  garment: Garment;
  onClose: () => void;
};

export function GarmentSheet({ garment: initial, onClose }: GarmentSheetProps) {
  const t = useTranslations();
  const { show } = useToast();
  const id = initial.id;
  const formId = useId();

  const [garment, setGarment] = useState(initial);
  const base = useRef(formValuesFromGarment(initial));
  const [values, setValues] = useState<GarmentFormValues>(() => formValuesFromGarment(initial));
  const [view, setView] = useState<"form" | "photo">("form");
  const [busy, setBusy] = useState<Busy>(null);
  const [usage, setUsage] = useState<GarmentUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useQueueStore((s) => pendingReplaceOf(s.items, id));

  const typeLabel = t(`types.${garment.type_id}`);
  const name = displayName(garment.name, typeLabel);

  /** Errores de las acciones: en línea, o fuera si la prenda ya no existe. */
  const fail = useCallback(
    (err: unknown) => {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      if (isApiClientError(err) && err.code === "not_found") {
        dropPendingReplaces(id);
        useCatalogStore.getState().removeGarment(id);
        onClose();
        show({ message: t("catalog.edit.notFound") });
        return;
      }
      console.warn("[garment-sheet] acción fallida", err);
      setError(
        isApiClientError(err) && err.code === "network"
          ? t("catalog.edit.offline")
          : t("catalog.edit.error"),
      );
    },
    [id, onClose, show, t],
  );

  // Prenda al día (recorte grande). Si no se ha tocado el formulario, se
  // rellena con lo que llega; si ya se tocó, se respeta lo escrito.
  const loadDetail = useCallback(async () => {
    try {
      const g = await apiFetch<Garment>(garmentPath(id));
      const next = formValuesFromGarment(g);
      setValues((v) => (formChanged(v, base.current) ? v : next));
      base.current = next;
      setGarment(g);
    } catch (err) {
      // Sin detalle se sigue con la tarjeta (miniatura); si ya no existe, fuera.
      if (isApiClientError(err) && err.code === "not_found") fail(err);
    }
  }, [fail, id]);

  // Se pide al abrir y cuando se sube un cambio de foto de esta prenda. La
  // ref evita volver a pedirla en cada render del padre.
  const loadRef = useRef(loadDetail);
  useEffect(() => {
    loadRef.current = loadDetail;
  });
  useEffect(() => {
    void loadRef.current();
    const onSaved = (e: Event) => {
      const d = (e as CustomEvent<GarmentSavedDetail>).detail;
      if (d.kind === "replace" && d.garmentId === id) void loadRef.current();
    };
    window.addEventListener(GARMENT_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(GARMENT_SAVED_EVENT, onSaved);
  }, [id]);

  const photo = useChangePhoto({ garmentId: id, onDone: () => setView("form") });
  const exitPhoto = () => {
    photo.reset();
    setView("form");
  };

  async function save() {
    if (busy || !isGarmentFormValid(values)) return;
    if (!formChanged(values, base.current)) {
      onClose();
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const g = await apiFetch<Garment>(garmentPath(id), {
        method: "PATCH",
        json: toGarmentPatch(values),
      });
      useCatalogStore.getState().updateGarment(g);
      onClose();
      show({ message: t("catalog.edit.saved") });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchived() {
    if (busy) return;
    const archived = !garment.archived;
    setError(null);
    setBusy("archive");
    try {
      await patchArchived(id, archived);
      onClose();
      show({
        message: archived ? t("catalog.edit.archived") : t("catalog.edit.unarchived"),
        actionLabel: t("common.undo"),
        onAction: () => {
          patchArchived(id, !archived).catch((err: unknown) => {
            if (isApiClientError(err) && err.code === "unauthorized") return;
            show({ message: t("catalog.edit.error") });
          });
        },
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function askDelete() {
    if (busy) return;
    setError(null);
    setBusy("usage");
    try {
      setUsage(await apiFetch<GarmentUsageResponse>(`${garmentPath(id)}/usage`));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (busy === "delete") return;
    setBusy("delete");
    try {
      await apiFetch(garmentPath(id), { method: "DELETE" });
      // Un cambio de foto pendiente ya no tiene a qué prenda ir.
      dropPendingReplaces(id);
      useCatalogStore.getState().removeGarment(id);
      setUsage(null);
      onClose();
      show({ message: t("catalog.edit.deleted") });
    } catch (err) {
      setUsage(null);
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  const changePhotoLink = (
    <Button
      variant="text-link"
      className="text-caption whitespace-nowrap"
      disabled={busy !== null}
      onClick={() => setView("photo")}
    >
      {t("catalog.edit.changePhoto")}
    </Button>
  );

  // Recorte actual (o el estado del cambio de foto pendiente).
  const src = garment.cutoutUrl ?? garment.thumbUrl;
  const preview = pending ? (
    <div className="flex flex-col">
      <CutoutPreview localId={pending.localId} hasAlpha={replaceHasAlpha(pending.localId)} />
      {/* Con error, la propia vista previa ya ofrece "Cambiar foto". */}
      {pending.status !== "error" && <div className="flex justify-end">{changePhotoLink}</div>}
    </div>
  ) : (
    <div className="flex flex-col gap-xs">
      <TransparencyChecker
        variant="checker"
        className="flex h-[220px] w-full items-center justify-center overflow-hidden rounded-lg tablet:h-[260px]"
      >
        {src && (
          // Recorte con URL firmada de Supabase: no pasa por next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={t("catalog.edit.cutoutAlt", { garment: name })}
            decoding="async"
            draggable={false}
            className="size-full object-contain p-sm"
          />
        )}
      </TransparencyChecker>
      <div className="flex min-h-11 items-center justify-between gap-sm">
        <p className="text-fine-print leading-normal text-ink-muted-48">
          {t("catalog.edit.onlyCutout")}
        </p>
        {changePhotoLink}
      </div>
    </div>
  );

  const inPhoto = view === "photo";

  return (
    <>
      <Sheet
        open
        // En "Cambiar foto", cerrar vuelve a la ficha (como el prototipo).
        onClose={inPhoto ? exitPhoto : onClose}
        title={inPhoto ? t("catalog.edit.photoTitle") : t("catalog.edit.title")}
        closeLabel={t("common.close")}
        fullScreen
        className="tablet:min-h-[min(560px,92dvh)]"
        footer={
          inPhoto ? (
            photo.footer
          ) : (
            <div className="flex flex-col gap-xs">
              {error && (
                <p role="alert" className="text-center text-caption">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                form={formId}
                fullWidth
                disabled={!values.typeId || busy !== null}
              >
                {t("catalog.edit.save")}
              </Button>
            </div>
          )
        }
      >
        {inPhoto ? (
          photo.body
        ) : (
          <div className="flex flex-col gap-lg pt-xs pb-md">
            <GarmentForm
              id={formId}
              mode="edit"
              value={values}
              onChange={setValues}
              onSubmit={() => void save()}
              header={preview}
            />
            <div className="flex flex-wrap gap-x-md border-t border-divider-soft pt-sm">
              <Button
                variant="text-link"
                className="text-[15px]"
                disabled={busy !== null}
                onClick={() => void toggleArchived()}
              >
                {garment.archived ? t("catalog.edit.unarchive") : t("catalog.edit.archive")}
              </Button>
              <Button
                variant="text-link"
                className="text-[15px]"
                disabled={busy !== null}
                aria-haspopup="dialog"
                onClick={() => void askDelete()}
              >
                {t("catalog.edit.delete")}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <DeleteDialog
        usage={usage}
        garmentName={name}
        deleting={busy === "delete"}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setUsage(null)}
      />
    </>
  );
}
