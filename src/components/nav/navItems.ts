// Entradas de la navegación principal (screens.md 1) y cálculo de la activa.
import type { ComponentType, SVGProps } from "react";
import { CatalogIcon, CutoutIcon, DresserIcon, FavoritesIcon, SettingsIcon } from "./NavIcons";

export type NavKey = "catalog" | "dresser" | "favorites" | "settings" | "cutout";

export type NavItem = {
  key: NavKey;
  href: `/${NavKey}`;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
};

/** Las 4 pestañas de la barra inferior (móvil y tablet). */
export const TAB_ITEMS: readonly NavItem[] = [
  { key: "catalog", href: "/catalog", Icon: CatalogIcon },
  { key: "dresser", href: "/dresser", Icon: DresserIcon },
  { key: "favorites", href: "/favorites", Icon: FavoritesIcon },
  { key: "settings", href: "/settings", Icon: SettingsIcon },
];

/** Barra lateral de escritorio: las mismas 4 + Recortar fotos. */
export const SIDEBAR_ITEMS: readonly NavItem[] = [
  ...TAB_ITEMS,
  { key: "cutout", href: "/cutout", Icon: CutoutIcon },
];

/**
 * Entrada activa según la ruta. Recortar fotos no tiene pestaña propia en la
 * barra inferior: allí se marca Ajustes (screens.md 1); en la lateral sí existe.
 */
export function activeNavKey(pathname: string, items: readonly NavItem[]): NavKey | null {
  const match = items.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  if (match) return match.key;
  const inCutout = pathname === "/cutout" || pathname.startsWith("/cutout/");
  return inCutout ? "settings" : null;
}
