// Grupo de Ajustes (screens.md 12; prototipo): título pequeño, tarjeta blanca
// con borde fino sobre el fondo gris claro de la página y nota opcional debajo.
import { useId, type ReactNode } from "react";
import { cx } from "@/components/cx";

export function SettingsGroup({
  title,
  note,
  children,
  cardClassName,
}: {
  title: ReactNode;
  note?: ReactNode;
  children: ReactNode;
  cardClassName?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-xs">
      <h2 id={titleId} className="px-xxs text-caption-strong">
        {title}
      </h2>
      <div
        className={cx(
          // Separador fino entre filas.
          "divide-y divide-divider-soft overflow-hidden rounded-lg border border-hairline bg-canvas",
          cardClassName,
        )}
      >
        {children}
      </div>
      {note && <p className="px-xxs text-fine-print leading-normal text-ink-muted-48">{note}</p>}
    </section>
  );
}

/** Fila de una tarjeta: 52 px de alto como mínimo. */
export const settingsRow = "flex min-h-[52px] items-center gap-sm px-md py-xs";
