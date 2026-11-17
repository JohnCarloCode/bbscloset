"use client";

// Franja "12 prendas por revisar · Revisar" arriba del catálogo (screens.md
// 4.4): cuenta los items locales de la subida masiva aún sin tipo. "Revisar"
// abre la hoja de revisión (ReviewSheet).
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { useQueueStore } from "@/features/queue/store";
import { reviewCount } from "./logic";
import { useReview } from "./store";

export function ReviewBanner() {
  const t = useTranslations("catalog.review");
  const count = useQueueStore((s) => reviewCount(s.items));
  const open = useReview((s) => s.open);

  if (count === 0) return null;

  return (
    <section
      aria-label={t("banner", { count })}
      className="flex items-center gap-sm rounded-lg border border-ink px-md py-[14px]"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-xxs">
        <span className="text-body-strong">{t("banner", { count })}</span>
        <span className="text-caption text-ink-muted-80">{t("bannerHint", { count })}</span>
      </div>
      <Button onClick={open} aria-haspopup="dialog">
        {t("open")}
      </Button>
    </section>
  );
}
