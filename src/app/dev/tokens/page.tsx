// Página temporal de desarrollo con todos los tokens de DESIGN.md.
// Se borra en el paso 7.5; es la única excepción a "sin textos en el código".
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tokens · dev",
  robots: { index: false, follow: false },
};

// Clases escritas enteras para que Tailwind las detecte.
const colors = [
  { name: "primary", hex: "#f0d7d7", cls: "bg-primary" },
  { name: "primary-focus", hex: "#1d1d1f", cls: "bg-primary-focus" },
  { name: "primary-on-dark", hex: "#f0d7d7", cls: "bg-primary-on-dark" },
  { name: "ink", hex: "#1d1d1f", cls: "bg-ink" },
  { name: "body-on-dark", hex: "#ffffff", cls: "bg-body-on-dark" },
  { name: "body-muted", hex: "#cccccc", cls: "bg-body-muted" },
  { name: "ink-muted-80", hex: "#333333", cls: "bg-ink-muted-80" },
  { name: "ink-muted-48", hex: "#7a7a7a", cls: "bg-ink-muted-48" },
  { name: "divider-soft", hex: "#f0f0f0", cls: "bg-divider-soft" },
  { name: "hairline", hex: "#e0e0e0", cls: "bg-hairline" },
  { name: "canvas", hex: "#ffffff", cls: "bg-canvas" },
  { name: "canvas-parchment", hex: "#f5f5f7", cls: "bg-canvas-parchment" },
  { name: "surface-pearl", hex: "#fafafc", cls: "bg-surface-pearl" },
  { name: "surface-tile-1", hex: "#272729", cls: "bg-surface-tile-1" },
  { name: "surface-tile-2", hex: "#2a2a2c", cls: "bg-surface-tile-2" },
  { name: "surface-tile-3", hex: "#252527", cls: "bg-surface-tile-3" },
  { name: "surface-black", hex: "#000000", cls: "bg-surface-black" },
  {
    name: "surface-chip-translucent",
    hex: "#d2d2d7",
    cls: "bg-surface-chip-translucent",
  },
  { name: "on-primary", hex: "#1d1d1f", cls: "bg-on-primary" },
  { name: "on-dark", hex: "#ffffff", cls: "bg-on-dark" },
  { name: "segmented-track", hex: "#e8e8ed", cls: "bg-segmented-track" },
  { name: "checker", hex: "#ececec", cls: "bg-checker" },
  { name: "photo-backdrop", hex: "#d9d4cc", cls: "bg-photo-backdrop" },
];

const radii = [
  { name: "none", value: "0px", cls: "rounded-none" },
  { name: "xs", value: "5px", cls: "rounded-xs" },
  { name: "sm", value: "8px", cls: "rounded-sm" },
  { name: "md", value: "11px", cls: "rounded-md" },
  { name: "lg", value: "18px", cls: "rounded-lg" },
  { name: "pill", value: "9999px", cls: "rounded-pill" },
  { name: "full", value: "9999px", cls: "rounded-full" },
];

const spacings = [
  { name: "xxs", value: "4px", cls: "w-xxs" },
  { name: "xs", value: "8px", cls: "w-xs" },
  { name: "sm", value: "12px", cls: "w-sm" },
  { name: "md", value: "17px", cls: "w-md" },
  { name: "lg", value: "24px", cls: "w-lg" },
  { name: "xl", value: "32px", cls: "w-xl" },
  { name: "xxl", value: "48px", cls: "w-xxl" },
  { name: "section", value: "80px", cls: "w-section" },
];

const typeScale = [
  {
    name: "hero-display",
    spec: "56 / 600 / 1.07 / -0.28px",
    cls: "text-hero-display font-display",
  },
  { name: "display-lg", spec: "40 / 600 / 1.10 / 0", cls: "text-display-lg font-display" },
  { name: "display-md", spec: "34 / 600 / 1.47 / -0.374px", cls: "text-display-md" },
  { name: "lead", spec: "28 / 400 / 1.14 / 0.196px", cls: "text-lead font-display" },
  { name: "lead-airy", spec: "24 / 300 / 1.5 / 0", cls: "text-lead-airy" },
  { name: "tagline", spec: "21 / 600 / 1.19 / 0.231px", cls: "text-tagline font-display" },
  { name: "body-strong", spec: "17 / 600 / 1.24 / -0.374px", cls: "text-body-strong" },
  { name: "body", spec: "17 / 400 / 1.47 / -0.374px", cls: "text-body" },
  { name: "dense-link", spec: "17 / 400 / 2.41 / 0", cls: "text-dense-link" },
  { name: "caption", spec: "14 / 400 / 1.43 / -0.224px", cls: "text-caption" },
  { name: "caption-strong", spec: "14 / 600 / 1.29 / -0.224px", cls: "text-caption-strong" },
  { name: "button-large", spec: "18 / 300 / 1.0 / 0", cls: "text-button-large" },
  { name: "button-utility", spec: "14 / 400 / 1.29 / -0.224px", cls: "text-button-utility" },
  { name: "fine-print", spec: "12 / 400 / 1.0 / -0.12px", cls: "text-fine-print" },
  { name: "micro-legal", spec: "10 / 400 / 1.3 / -0.08px", cls: "text-micro-legal" },
  { name: "nav-link", spec: "12 / 400 / 1.0 / -0.12px", cls: "text-nav-link" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline py-xxl">
      <h2 className="mb-lg text-tagline">{title}</h2>
      {children}
    </section>
  );
}

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-5xl px-md py-xl tablet:px-xl desktop:px-section">
      <h1 className="text-display-md tablet:text-display-lg desktop:text-hero-display">
        Tokens de diseño
      </h1>
      <p className="mt-xs text-caption text-ink-muted-48">
        doc-ai/DESIGN.md · página temporal (se borra en 7.5)
      </p>

      <Section title="Colores">
        <ul className="grid grid-cols-2 gap-md tablet:grid-cols-4 desktop:grid-cols-6">
          {colors.map((c) => (
            <li key={c.name} data-token={`color-${c.name}`}>
              <div className={`aspect-square rounded-lg border border-hairline ${c.cls}`} />
              <p className="mt-xs text-caption-strong">{c.name}</p>
              <p className="text-fine-print text-ink-muted-48">{c.hex}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Radios">
        <ul className="grid grid-cols-3 gap-md tablet:grid-cols-7">
          {radii.map((r) => (
            <li key={r.name} data-token={`radius-${r.name}`}>
              <div className={`h-16 w-full bg-primary ${r.cls}`} />
              <p className="mt-xs text-caption-strong">rounded-{r.name}</p>
              <p className="text-fine-print text-ink-muted-48">{r.value}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Espaciados">
        <ul className="flex flex-col gap-sm">
          {spacings.map((s) => (
            <li key={s.name} data-token={`spacing-${s.name}`} className="flex items-center gap-md">
              <span className="w-24 text-caption-strong">{s.name}</span>
              <span className={`h-md bg-ink ${s.cls}`} />
              <span className="text-fine-print text-ink-muted-48">{s.value}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tipografía">
        <ul className="flex flex-col gap-lg">
          {typeScale.map((t) => (
            <li key={t.name} data-token={`text-${t.name}`}>
              <p className="text-fine-print text-ink-muted-48">
                text-{t.name} · {t.spec}
              </p>
              <p className={t.cls}>Todo tu armario, listo para vestirte.</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Sombra y estados">
        <div className="flex flex-wrap items-center gap-xl">
          <div className="size-32 rounded-lg bg-canvas-parchment shadow-product" />
          <div className="size-32 rounded-pill bg-primary drop-shadow-product" />
          <button
            type="button"
            className="rounded-pill bg-primary px-[22px] py-[11px] text-body text-on-primary"
          >
            Botón principal
          </button>
          <button
            type="button"
            className="rounded-pill border border-ink px-[22px] py-[11px] text-body text-ink"
          >
            Secundario
          </button>
          <button
            type="button"
            className="rounded-sm bg-ink px-[15px] py-xs text-button-utility text-on-dark"
          >
            Utilidad
          </button>
          <a href="#" className="text-body text-ink underline underline-offset-2">
            Enlace
          </a>
        </div>
      </Section>

      <section className="bg-surface-tile-1 px-lg py-section text-on-dark">
        <p className="text-display-lg font-display">Bloque oscuro</p>
        <p className="mt-xs text-body text-body-muted">
          Texto secundario y{" "}
          <a href="#" className="text-primary-on-dark underline underline-offset-2">
            enlace sobre oscuro
          </a>
          .
        </p>
      </section>
    </main>
  );
}
