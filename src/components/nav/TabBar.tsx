"use client";

// Barra de pestañas inferior (móvil y tablet, < 1024 px; screens.md 1).
// Medidas del prototipo: entradas de 50 px de alto (máx. 120 px de ancho),
// icono de 24 px, texto de 10 px; activa en negro y negrita, resto en gris.
// Fondo perla translúcido con desenfoque y borde superior suave. El relleno
// inferior respeta la zona segura del iPhone (--tab-bar-h en globals.css).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cx } from "../cx";
import { activeNavKey, TAB_ITEMS } from "./navItems";

export function TabBar() {
  const t = useTranslations("nav");
  const active = activeNavKey(usePathname(), TAB_ITEMS);

  return (
    <nav
      aria-label={t("label")}
      data-tab-bar=""
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 flex items-start justify-around desktop:hidden",
        "px-2 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]",
        "border-t border-surface-black/8 bg-surface-pearl/92 backdrop-blur-xl backdrop-saturate-180",
      )}
    >
      {TAB_ITEMS.map(({ key, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "flex h-[50px] max-w-[120px] flex-1 flex-col items-center justify-center gap-[3px]",
              "text-micro-legal",
              isActive ? "font-semibold text-ink" : "text-ink-muted-48",
            )}
          >
            <Icon />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
