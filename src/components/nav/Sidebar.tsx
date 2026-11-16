"use client";

// Barra lateral de escritorio (≥ 1024 px; screens.md 1). Medidas del
// prototipo: 232 px, fondo parchment con borde derecho, nombre de la app,
// entradas de 44 px con icono de 20 px y texto de 15 px; la activa con fondo
// rosa y negrita. Abajo, el botón principal "Añadir prenda".
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cx } from "../cx";
import { activeNavKey, SIDEBAR_ITEMS } from "./navItems";

export function Sidebar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const active = activeNavKey(usePathname(), SIDEBAR_ITEMS);

  return (
    <aside
      className={cx(
        "sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col desktop:flex",
        "border-r border-hairline bg-canvas-parchment px-sm pt-lg pb-5",
      )}
    >
      <p className="px-sm pb-5 text-tagline tracking-[-0.2px]">{tc("appName")}</p>
      <nav aria-label={t("label")} className="flex flex-col gap-xxs">
        {SIDEBAR_ITEMS.map(({ key, href, Icon }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "flex h-11 items-center gap-sm rounded-sm px-sm text-[15px] text-ink",
                isActive ? "bg-primary font-semibold" : "font-normal",
              )}
            >
              <Icon size={20} />
              {t(key)}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      {/* El paso 3.7 cambia el enlace por el botón que abre la hoja "Añadir prenda". */}
      <Link
        href="/catalog"
        className={cx(
          "mx-1 flex min-h-11 items-center justify-center rounded-pill bg-primary px-[22px]",
          "text-[15px] text-on-primary",
        )}
      >
        {t("addGarment")}
      </Link>
    </aside>
  );
}
