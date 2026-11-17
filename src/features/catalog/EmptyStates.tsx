"use client";

// Estados vacíos del catálogo (screens.md 4) sobre EmptyState:
// - armario vacío: ilustración + "Añadir tu primera prenda" (abre 3.7);
// - sin resultados: "Ninguna prenda coincide";
// - Archivadas sin filtros y sin nada: "Nada archivado".
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";

/** Percha sobre un recuadro rayado, como el hueco del prototipo. */
function ClosetIllustration() {
  return (
    <div
      aria-hidden="true"
      className="flex size-[180px] items-center justify-center rounded-lg bg-canvas-parchment bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.035)_0_6px,transparent_6px_12px)] text-ink-muted-48"
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 16a4 4 0 1 1 4-4c0 1.6-1 2.6-2.2 3.3-1 .6-1.8 1.4-1.8 2.7v.5" />
        <path d="M24 18.5 6 31a2 2 0 0 0 1.2 3.6h33.6A2 2 0 0 0 42 31L24 18.5z" />
      </svg>
    </div>
  );
}

export function EmptyCloset({ onAdd }: { onAdd: () => void }) {
  const t = useTranslations("catalog.empty");
  return (
    <EmptyState
      illustration={<ClosetIllustration />}
      title={t("title")}
      description={t("body")}
      action={
        <Button variant="primary" onClick={onAdd} aria-haspopup="dialog">
          {t("action")}
        </Button>
      }
    />
  );
}

export function NoResults({ kind }: { kind: "noResults" | "noArchived" }) {
  const t = useTranslations(`catalog.${kind}`);
  // Sin ilustración: el recuadro neutro de EmptyState sobraría bajo los chips.
  return <EmptyState illustration={false} title={t("title")} description={t("body")} />;
}
