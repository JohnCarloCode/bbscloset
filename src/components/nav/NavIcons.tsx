// Iconos de la navegación, copiados del prototipo (trazo 1.8, currentColor).
// Son decorativos: el nombre accesible es el texto de la entrada.
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function NavSvg({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CatalogIcon(props: IconProps) {
  return (
    <NavSvg {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </NavSvg>
  );
}

export function DresserIcon(props: IconProps) {
  return (
    <NavSvg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <rect x="8" y="7" width="7" height="8" rx="1.5" transform="rotate(-10 11.5 11)" />
    </NavSvg>
  );
}

export function FavoritesIcon(props: IconProps) {
  return (
    <NavSvg strokeLinejoin="round" {...props}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </NavSvg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <NavSvg {...props}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
    </NavSvg>
  );
}

export function CutoutIcon(props: IconProps) {
  return (
    <NavSvg strokeLinecap="round" {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
    </NavSvg>
  );
}
