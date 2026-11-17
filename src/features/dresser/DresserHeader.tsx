"use client";

// Cabecera del vestidor (screens.md 7.1; paso 4.6): título "Vestidor" y, a la
// derecha, Deshacer · Rehacer | Guardar en favoritos · Guardar como imagen,
// atenuados cuando no aplican. "Guardar en favoritos" (5.2) abre
// SaveFavoriteSheet; atenuado con el lienzo vacío. "Guardar como imagen"
// (6.2) abre ExportSheet con el lienzo tal cual (ya recolocado en el store);
// también atenuado con el lienzo vacío.
// Atajos en escritorio: Cmd/Ctrl+Z deshace y Shift+Cmd/Ctrl+Z rehace, salvo
// con el foco en un campo de texto o con una hoja/diálogo abierto encima.
import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DownloadIcon, HeartIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { ExportSheet } from "@/features/export/ExportSheet";
import { SaveFavoriteSheet } from "@/features/favorites/SaveFavoriteSheet";
import { useDresserStore } from "./store";
import { useCanvasGarments } from "./useCanvasGarments";

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function useUndoShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || !(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "z" || isTextField(e.target)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault();
      const s = useDresserStore.getState();
      if (e.shiftKey) s.redo();
      else s.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function HeaderButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink transition-opacity active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}

export function DresserHeader({ title }: { title: string }) {
  const t = useTranslations("dresser.header");
  const canUndo = useDresserStore((s) => s.past.length > 0);
  const canRedo = useDresserStore((s) => s.future.length > 0);
  const undo = useDresserStore((s) => s.undo);
  const redo = useDresserStore((s) => s.redo);

  const canvas = useDresserStore((s) => s.canvas);
  const canvasSize = useDresserStore((s) => s.canvasSize);
  const canvasGarments = useCanvasGarments(canvas.items);
  const empty = canvas.items.length === 0;
  // Cada apertura monta la hoja de nuevo (key), así empieza limpia.
  const [favSheet, setFavSheet] = useState({ open: false, key: 0 });
  const openFavSheet = () => setFavSheet((s) => ({ open: true, key: s.key + 1 }));
  const [imgSheet, setImgSheet] = useState({ open: false, key: 0, date: new Date(0) });
  const openImgSheet = () => setImgSheet((s) => ({ open: true, key: s.key + 1, date: new Date() }));

  useUndoShortcuts();

  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between pr-[10px] pl-5">
      <h1 className="text-tagline">{title}</h1>
      <div role="toolbar" aria-label={t("actions")} className="flex items-center gap-[2px]">
        <HeaderButton label={t("undo")} disabled={!canUndo} onClick={undo}>
          <UndoIcon />
        </HeaderButton>
        <HeaderButton label={t("redo")} disabled={!canRedo} onClick={redo}>
          <RedoIcon />
        </HeaderButton>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-hairline" />
        <HeaderButton label={t("saveFavorite")} disabled={empty} onClick={openFavSheet}>
          <HeartIcon />
        </HeaderButton>
        <HeaderButton label={t("saveImage")} disabled={empty} onClick={openImgSheet}>
          <DownloadIcon />
        </HeaderButton>
      </div>
      <SaveFavoriteSheet
        key={favSheet.key}
        open={favSheet.open && !empty}
        onClose={() => setFavSheet((s) => ({ ...s, open: false }))}
        canvas={canvas}
        garments={canvasGarments}
        canvasSize={canvasSize}
      />
      <ExportSheet
        key={`img-${imgSheet.key}`}
        open={imgSheet.open && !empty}
        onClose={() => setImgSheet((s) => ({ ...s, open: false }))}
        items={canvas.items}
        garments={canvasGarments}
        canvasSize={canvasSize}
        name={null}
        date={imgSheet.date}
      />
    </header>
  );
}
