"use client";

// Tarjeta del listado de favoritos (screens.md 10; tarjeta del prototipo):
// mini collage 4:5, nombre (o la fecha si no tiene) y "fecha · N prendas".
// Tocarla abre el detalle (/favorites/[id]). En modo Editar lleva arriba a la
// derecha el botón "Eliminar" (fuera del enlace, para no anidar controles).
import { memo } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { FavoriteSummary } from "@/lib/api/types";
import { MiniCollage } from "./MiniCollage";

export type FavoriteCardProps = {
  favorite: FavoriteSummary;
  editing: boolean;
  onDelete: (favorite: FavoriteSummary) => void;
};

export const FavoriteCard = memo(function FavoriteCard({
  favorite,
  editing,
  onDelete,
}: FavoriteCardProps) {
  const t = useTranslations("favorites.list");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const date = format.dateTime(new Date(favorite.created_at), "short");
  const title = favorite.name || date;

  return (
    <div className="relative flex min-w-0 flex-col">
      <Link
        href={`/favorites/${favorite.id}`}
        className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-hairline bg-canvas active:scale-[0.98]"
      >
        <MiniCollage items={favorite.items} />
        <span className="flex min-w-0 flex-col gap-[2px] px-[14px] pt-[10px] pb-[14px]">
          <span className="truncate text-caption-strong">{title}</span>
          <span className="text-fine-print text-ink-muted-48">
            {t("meta", { date, count: favorite.garmentCount })}
          </span>
        </span>
      </Link>
      {editing && (
        <button
          type="button"
          onClick={() => onDelete(favorite)}
          aria-label={t("deleteLabel", { title })}
          className="absolute top-xs right-xs z-[1] h-8 cursor-pointer rounded-md border-[3px] border-divider-soft bg-surface-pearl px-3 text-[13px] text-ink-muted-80 select-none active:scale-95 after:absolute after:-inset-1.5 after:content-['']"
        >
          {tCommon("delete")}
        </button>
      )}
    </div>
  );
});
