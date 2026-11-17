"use client";

// Color de la prenda (spec 2.3): selector táctil (react-colorful, sin
// teclear) que guarda el hex; debajo, la familia calculada en vivo con su
// muestra. "Multicolor" es una opción explícita sin hex (decisión 2) y
// "Quitar color" deja la prenda sin color.
import { useEffect, useId, useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ColorSwatch } from "@/components/ColorSwatch";
import { cx } from "@/components/cx";
import { COLOR_SWATCHES } from "@/lib/domain/colors";
import { normalizeHex } from "@/lib/imaging/colorFamily";
import { colorFamilyOf, NO_COLOR, type ColorValue } from "./logic";

export type ColorFieldProps = {
  value: ColorValue;
  onChange: (color: ColorValue) => void;
};

export function ColorField({ value, onChange }: ColorFieldProps) {
  const t = useTranslations();
  const labelId = useId();
  const family = colorFamilyOf(value);
  const hex = value.kind === "hex" ? normalizeHex(value.hex) : null;
  const pickerRef = useRef<HTMLDivElement>(null);

  // react-colorful trae sus aria-label en inglés ("Color", "Hue",
  // "Saturation …%, Brightness …%") y no deja cambiarlos: se reescriben
  // en el DOM, también cada vez que la librería actualiza el valor.
  useEffect(() => {
    const root = pickerRef.current;
    if (!root) return;
    const localize = () => {
      const shade = root.querySelector(".react-colorful__saturation [role=slider]");
      const hue = root.querySelector(".react-colorful__hue [role=slider]");
      const label = t("garment.form.colorShade");
      if (shade && shade.getAttribute("aria-label") !== label) {
        shade.setAttribute("aria-label", label);
      }
      const text = shade?.getAttribute("aria-valuetext");
      const m = text?.match(/^Saturation (\d+(?:\.\d+)?)%, Brightness (\d+(?:\.\d+)?)%$/);
      if (shade && m) {
        shade.setAttribute(
          "aria-valuetext",
          t("garment.form.colorShadeValue", { saturation: m[1], brightness: m[2] }),
        );
      }
      const hueLabel = t("garment.form.colorHue");
      if (hue && hue.getAttribute("aria-label") !== hueLabel)
        hue.setAttribute("aria-label", hueLabel);
    };
    localize();
    const observer = new MutationObserver(localize);
    observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "aria-valuetext"],
    });
    return () => observer.disconnect();
  }, [t]);

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-xs">
      <span id={labelId} className="text-caption-strong">
        {t("garment.form.color")}
      </span>

      {/* Familia calculada en vivo (la que usa el filtro del catálogo). */}
      <div aria-live="polite" className="flex items-center gap-xs text-caption">
        {family ? (
          <ColorSwatch family={family} size={18} />
        ) : (
          <span
            aria-hidden
            className="inline-block size-[18px] rounded-full border border-hairline"
          />
        )}
        <span>{family ? t(`colors.${family}`) : t("garment.form.colorNone")}</span>
        {hex && <span className="text-ink-muted-48 uppercase">{hex}</span>}
      </div>

      <div
        ref={pickerRef}
        aria-label={t("garment.form.colorPicker")}
        role="group"
        className={cx(value.kind !== "hex" && "opacity-60 motion-safe:transition-opacity")}
      >
        <HexColorPicker
          // Sin color elegido, el selector parte del gris (no se guarda hasta tocarlo).
          color={hex ?? COLOR_SWATCHES.gray}
          onChange={(next) => onChange({ kind: "hex", hex: next })}
          style={{ width: "100%", height: 168 }}
        />
      </div>
      {value.kind === "none" && (
        <p className="text-fine-print leading-normal text-ink-muted-48">
          {t("garment.form.colorHint")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-md">
        <Chip
          selected={value.kind === "multicolor"}
          onClick={() => onChange(value.kind === "multicolor" ? NO_COLOR : { kind: "multicolor" })}
        >
          <ColorSwatch family="multicolor" />
          {t("colors.multicolor")}
        </Chip>
        {value.kind !== "none" && (
          <Button variant="text-link" className="text-caption" onClick={() => onChange(NO_COLOR)}>
            {t("garment.form.clearColor")}
          </Button>
        )}
      </div>
    </div>
  );
}
