"use client";

// Formulario de prenda (screens.md 5.3, 4.3 y 4.4), controlado: el padre
// guarda los valores (`value`), recibe cada cambio (`onChange`) y decide qué
// hacer al enviar (`onSubmit`, solo con el formulario válido). Los botones
// van fuera (en el pie de la hoja): usan `form={id}` o llaman a lo mismo.
// - add / edit: Tipo arriba y debajo los opcionales.
// - review: Tipo arriba y el resto plegado en "Más datos".
import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TextField } from "@/components/TextField";
import { cx } from "@/components/cx";
import { ChevronDownIcon } from "@/components/icons";
import { GARMENT_BRAND_MAX, GARMENT_NAME_MAX } from "@/lib/api/types";
import { BrandField } from "./BrandField";
import { ColorField } from "./ColorField";
import {
  isGarmentFormValid,
  validateGarmentForm,
  type GarmentFormMode,
  type GarmentFormValues,
} from "./logic";
import { SeasonChips } from "./SeasonChips";
import { TagsField } from "./TagsField";
import { TypeChips } from "./TypeChips";
import { useFormOptions } from "./useFormOptions";

export type GarmentFormProps = {
  mode: GarmentFormMode;
  value: GarmentFormValues;
  onChange: (value: GarmentFormValues) => void;
  /** Envío con Intro o con un botón `type="submit" form={id}`; solo si es válido. */
  onSubmit?: (value: GarmentFormValues) => void;
  /** id del <form> (para botones de envío fuera de él). */
  id?: string;
  /** Algo encima del formulario (la vista previa del recorte). */
  header?: ReactNode;
  className?: string;
};

export function GarmentForm({
  mode,
  value,
  onChange,
  onSubmit,
  id,
  header,
  className,
}: GarmentFormProps) {
  const t = useTranslations();
  const options = useFormOptions();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreId = useId();
  const errors = validateGarmentForm(value);
  const set = <K extends keyof GarmentFormValues>(key: K, v: GarmentFormValues[K]) =>
    onChange({ ...value, [key]: v });
  const tooLong = (max: number) => t("garment.form.tooLong", { max });

  const optional = (
    <>
      <TextField
        label={t("garment.form.name")}
        value={value.name}
        onChange={(e) => set("name", e.target.value)}
        placeholder={
          value.typeId
            ? t("garment.form.namePlaceholderType", { type: t(`types.${value.typeId}`) })
            : t("garment.form.namePlaceholder")
        }
        maxLength={GARMENT_NAME_MAX}
        autoComplete="off"
        error={errors.name ? tooLong(GARMENT_NAME_MAX) : undefined}
      />
      <SeasonChips value={value.seasons} onChange={(v) => set("seasons", v)} />
      <ColorField value={value.color} onChange={(v) => set("color", v)} />
      <BrandField
        value={value.brand}
        onChange={(v) => set("brand", v)}
        brands={options.brands}
        error={errors.brand ? tooLong(GARMENT_BRAND_MAX) : undefined}
      />
      <TagsField value={value.tags} onChange={(v) => set("tags", v)} vocabulary={options.tags} />
    </>
  );

  return (
    <form
      id={id}
      noValidate
      className={cx("flex flex-col gap-lg", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (isGarmentFormValid(value)) onSubmit?.(value);
      }}
    >
      {header}
      <TypeChips value={value.typeId} onChange={(v) => set("typeId", v)} />

      {mode === "review" ? (
        <div className="flex flex-col gap-md border-t border-divider-soft pt-md">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls={moreId}
            onClick={() => setMoreOpen((o) => !o)}
            className="flex min-h-11 cursor-pointer items-center justify-between text-body-strong"
          >
            {t("garment.form.moreData")}
            <ChevronDownIcon
              size={18}
              className={cx("motion-safe:transition-transform", moreOpen && "rotate-180")}
            />
          </button>
          <div id={moreId} hidden={!moreOpen} className="flex flex-col gap-lg">
            {optional}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-lg border-t border-divider-soft pt-lg">
          <span className="text-fine-print text-ink-muted-48">
            {t("garment.form.optionalNote")}
          </span>
          {optional}
        </div>
      )}
    </form>
  );
}
