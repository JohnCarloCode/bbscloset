"use client";

// Etiquetas libres (spec 2.4): chips con las elegidas y las sugerencias
// (las del usuario, las de la cola y las sugeridas iniciales, decisión 1),
// filtradas por lo que se escribe; Intro añade lo escrito.
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/Chip";
import { TextField } from "@/components/TextField";
import { GARMENT_TAG_MAX } from "@/lib/api/types";
import { addTag, tagChoices, toggleTag } from "./logic";

export type TagsFieldProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Vocabulario para sugerir (useFormOptions). */
  vocabulary: readonly string[];
};

export function TagsField({ value, onChange, vocabulary }: TagsFieldProps) {
  const t = useTranslations("garment.form");
  const labelId = useId();
  const [input, setInput] = useState("");
  const chips = tagChoices(value, vocabulary, input);

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-xs">
      <span id={labelId} className="px-xxs text-caption-strong">
        {t("tags")}
      </span>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {chips.map((tag) => (
            <Chip
              key={tag}
              selected={value.includes(tag)}
              onClick={() => onChange(toggleTag(value, tag))}
            >
              {tag}
            </Chip>
          ))}
        </div>
      )}
      <TextField
        label={t("tagsInput")}
        className="[&>label]:sr-only"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          // Intro añade la etiqueta (y no envía el formulario).
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          onChange(addTag(value, input, vocabulary));
          setInput("");
        }}
        placeholder={t("tagsPlaceholder")}
        maxLength={GARMENT_TAG_MAX}
        enterKeyHint="done"
        autoComplete="off"
        autoCapitalize="none"
      />
    </div>
  );
}
