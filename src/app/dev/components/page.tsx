"use client";

// Página temporal de desarrollo con cada componente base en cada estado.
// Se borra en el paso 7.5; como /dev/tokens, puede llevar literales.
// Los estados "activo" y "foco" se fuerzan con clases para verlos sin
// interactuar (en uso real los dan :active y :focus-visible).
import { useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, type ButtonVariant } from "@/components/Button";
import { Chip, ChipGroup } from "@/components/Chip";
import { Dialog } from "@/components/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { CloseIcon } from "@/components/icons";
import { NoticeInline } from "@/components/NoticeInline";
import { ProgressBar } from "@/components/ProgressBar";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea, TextField } from "@/components/TextField";
import { useToast } from "@/components/toast";
import { TransparencyChecker } from "@/components/TransparencyChecker";
import { setLocaleCookie } from "@/i18n/actions";
import type { Locale } from "@/i18n/config";

const FORCE_FOCUS = "outline-2 outline-offset-2 outline-primary-focus";
const FORCE_ACTIVE = "scale-95";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-hairline py-xl">
      <h2 className="mb-md text-tagline">{title}</h2>
      <div className="flex flex-col gap-lg">{children}</div>
    </section>
  );
}

function Row({ label, children, dark }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-fine-print text-ink-muted-48">{label}</span>
      <div
        className={
          dark
            ? "flex flex-wrap items-center gap-sm rounded-lg bg-surface-tile-1 p-md"
            : "flex flex-wrap items-center gap-sm"
        }
      >
        {children}
      </div>
    </div>
  );
}

const buttonVariants: Array<{ variant: ButtonVariant; label: string }> = [
  { variant: "primary", label: "Añadir prenda" },
  { variant: "secondary", label: "Cancelar" },
  { variant: "dark-utility", label: "Entrar" },
  { variant: "destructive", label: "Borrar" },
  { variant: "text-link", label: "Añadir una" },
];

const seasons = [
  { value: "spring", label: "Primavera" },
  { value: "summer", label: "Verano" },
  { value: "autumn", label: "Otoño" },
  { value: "winter", label: "Invierno" },
  { value: "all", label: "Todo el año", disabled: true },
] as const;

type Season = (typeof seasons)[number]["value"];

export default function ComponentsPage() {
  const toast = useToast();
  const [chips, setChips] = useState<Season[]>(["summer"]);
  const [mode, setMode] = useState<"cut" | "ready">("cut");
  const [view, setView] = useState<"active" | "archived">("active");
  // Idioma: la cookie `locale` manda; cambiarla vuelve a renderizar la página.
  const t = useTranslations();
  const locale = useLocale();
  const [switching, startSwitch] = useTransition();
  const changeLocale = (next: Locale) => startSwitch(() => setLocaleCookie(next));
  const [sheet, setSheet] = useState<null | "normal" | "full">(null);
  const [dialog, setDialog] = useState<null | "destructive" | "normal">(null);
  const [progress, setProgress] = useState(40);
  const [email, setEmail] = useState("");
  const [raised, setRaised] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-md py-xl tablet:px-xl">
      <h1 className="text-display-md">Componentes base</h1>
      <p className="mt-xs text-caption text-ink-muted-48">
        Página temporal (paso 1.2). Se borra en el paso 7.5.
      </p>

      <Section title="Idioma (paso 1.3)">
        <Row label={`Cookie locale = ${locale}`}>
          <SegmentedControl
            className="w-full"
            aria-label={t("settings.language")}
            options={[
              { value: "es", label: t("common.languages.es") },
              { value: "en", label: t("common.languages.en") },
            ]}
            value={locale}
            onChange={changeLocale}
            disabled={switching}
          />
        </Row>
        <Row label="slots.* con t()">
          <Chip>{t("slots.jewelry")}</Chip>
          <Chip>{t("slots.footwear")}</Chip>
          <Chip>{t("types.trench")}</Chip>
          <Chip>{t("seasons.autumn")}</Chip>
          <Chip>{t("colors.multicolor")}</Chip>
        </Row>
        <Row label="nav.* y common.* con t()">
          <Button>{t("nav.addGarment")}</Button>
          <Button variant="secondary">{t("common.cancel")}</Button>
          <span className="text-caption">{t("favorites.savedCount", { count: 3 })}</span>
        </Row>
      </Section>

      <Section title="Button">
        {buttonVariants.map(({ variant, label }) => (
          <Row key={variant} label={variant}>
            <Button variant={variant}>{label}</Button>
            <Button variant={variant} className={FORCE_ACTIVE}>
              {label} · activo
            </Button>
            <Button variant={variant} className={FORCE_FOCUS}>
              {label} · foco
            </Button>
            <Button variant={variant} disabled>
              {label} · deshabilitado
            </Button>
          </Row>
        ))}
        <Row label="icon-circular (sobre foto / liso): normal, activo, foco, deshabilitado">
          <TransparencyChecker variant="photo" className="flex gap-sm rounded-lg p-sm">
            <Button variant="icon-circular" aria-label="Cerrar">
              <CloseIcon />
            </Button>
            <Button variant="icon-circular" aria-label="Cerrar" className={FORCE_ACTIVE}>
              <CloseIcon />
            </Button>
            <Button variant="icon-circular" aria-label="Cerrar" className={FORCE_FOCUS}>
              <CloseIcon />
            </Button>
            <Button variant="icon-circular" aria-label="Cerrar" disabled>
              <CloseIcon />
            </Button>
          </TransparencyChecker>
          <Button variant="icon-circular" iconSurface="plain" aria-label="Cerrar">
            <CloseIcon />
          </Button>
        </Row>
        <Row label="primary a todo el ancho">
          <Button fullWidth>Guardar</Button>
        </Row>
      </Section>

      <Section title="Chip y ChipGroup">
        <Row label="Chip: normal, seleccionado, foco, deshabilitado">
          <Chip>Verano</Chip>
          <Chip selected>Verano</Chip>
          <Chip className={FORCE_FOCUS}>Verano</Chip>
          <Chip disabled>Verano</Chip>
          <Chip selected disabled>
            Verano
          </Chip>
        </Row>
        <Row label={`ChipGroup multiselección: ${chips.join(", ") || "—"}`}>
          <ChipGroup aria-label="Temporada" options={seasons} value={chips} onChange={setChips} />
        </Row>
      </Section>

      <Section title="SegmentedControl">
        <Row label="emphasis (activo rosa, 600): modo de recorte">
          <SegmentedControl
            className="w-full"
            variant="emphasis"
            aria-label="Fondo"
            options={[
              { value: "cut", label: "Quitar fondo" },
              { value: "ready", label: "Ya recortada" },
            ]}
            value={mode}
            onChange={setMode}
          />
        </Row>
        <Row label="neutral (activo blanco): cambio de vista">
          <SegmentedControl
            className="w-full"
            aria-label="Vista"
            options={[
              { value: "active", label: "En rotación" },
              { value: "archived", label: "Archivadas" },
            ]}
            value={view}
            onChange={setView}
          />
        </Row>
        <Row label="neutral con una opción deshabilitada">
          <SegmentedControl
            className="w-full"
            aria-label="Vista (deshabilitada)"
            options={[
              { value: "active", label: "En rotación" },
              { value: "archived", label: "Archivadas", disabled: true },
            ]}
            value={view}
            onChange={setView}
          />
        </Row>
        <Row label="todo deshabilitado">
          <SegmentedControl
            className="w-full"
            variant="emphasis"
            disabled
            aria-label="Fondo (deshabilitado)"
            options={[
              { value: "cut", label: "Quitar fondo" },
              { value: "ready", label: "Ya recortada" },
            ]}
            value="cut"
            onChange={() => {}}
          />
        </Row>
      </Section>

      <Section title="Sheet y Dialog">
        <Row label="Abrir">
          <Button variant="secondary" onClick={() => setSheet("normal")}>
            Hoja
          </Button>
          <Button variant="secondary" onClick={() => setSheet("full")}>
            Hoja a pantalla completa
          </Button>
          <Button variant="secondary" onClick={() => setDialog("destructive")}>
            Diálogo destructivo
          </Button>
          <Button variant="secondary" onClick={() => setDialog("normal")}>
            Diálogo normal
          </Button>
        </Row>
      </Section>

      <Section title="Toast">
        <Row label="Cola: pulsa varias veces; cada uno dura 3,5 s">
          <Button onClick={() => toast.show({ message: "Prenda guardada" })}>Toast simple</Button>
          <Button
            onClick={() =>
              toast.show({
                message: "Prenda archivada",
                actionLabel: "Deshacer",
                onAction: () => toast.show({ message: "Archivado deshecho" }),
              })
            }
          >
            Toast con acción
          </Button>
          <Button variant="secondary" onClick={() => toast.clear()}>
            Vaciar cola
          </Button>
        </Row>
        <Row label="Simular queue-pill (variable --toast-raise = 52px)">
          <Button
            variant="secondary"
            onClick={() => {
              const next = !raised;
              setRaised(next);
              document.documentElement.style.setProperty("--toast-raise", next ? "52px" : "0px");
            }}
          >
            {raised ? "Quitar queue-pill" : "Poner queue-pill"}
          </Button>
        </Row>
      </Section>

      <Section title="ProgressBar">
        <Row label={`Sobre blanco (${progress} %)`}>
          <ProgressBar value={progress} aria-label="Recortando" />
          <Button
            variant="dark-utility"
            onClick={() => setProgress((p) => (p >= 100 ? 0 : p + 20))}
          >
            Avanzar
          </Button>
        </Row>
        <Row label="Sobre foto">
          <TransparencyChecker variant="photo" className="w-full rounded-lg p-sm">
            <ProgressBar value={progress} tone="photo" aria-label="Recortando" />
          </TransparencyChecker>
        </Row>
      </Section>

      <Section title="StatusBadge">
        <Row label="neutral / error">
          <StatusBadge>En cola</StatusBadge>
          <StatusBadge>Recortando</StatusBadge>
          <StatusBadge tone="error">No se pudo recortar</StatusBadge>
        </Row>
      </Section>

      <Section title="NoticeInline">
        <NoticeInline>
          Esta foto tiene fondo. En el collage se verá como un recuadro. Puedes usarla igualmente.
        </NoticeInline>
      </Section>

      <Section title="TransparencyChecker">
        <Row label="checker (recorte con transparencia) / photo (foto con fondo)">
          <TransparencyChecker className="size-[120px] rounded-lg" />
          <TransparencyChecker variant="photo" className="size-[120px] rounded-lg" />
        </Row>
      </Section>

      <Section title="EmptyState">
        <EmptyState
          title="Tu armario está vacío"
          description="Haz una foto a una prenda y elige su tipo. La recortaremos para el Vestidor."
          action={<Button>Añadir tu primera prenda</Button>}
        />
      </Section>

      <Section title="TextField y Textarea">
        <TextField
          label="Email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Te avisaremos cuando haya plaza."
        />
        <TextField
          label="Email (error)"
          type="email"
          defaultValue="hola@"
          error="Revisa el email."
        />
        <TextField label="Nombre (deshabilitado)" disabled defaultValue="Camiseta" />
        <Textarea label="Notas" placeholder="Talla, dónde la compraste…" />
        <Textarea label="Notas (error)" defaultValue="…" error="Máximo 500 caracteres." />
      </Section>

      <Sheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === "full" ? "Añadir prenda" : "Filtros"}
        closeLabel="Cerrar"
        fullScreen={sheet === "full"}
        footer={
          <Button fullWidth onClick={() => setSheet(null)}>
            Aplicar
          </Button>
        }
      >
        <div className="flex flex-col gap-lg">
          <ChipGroup aria-label="Temporada" options={seasons} value={chips} onChange={setChips} />
          <TextField label="Marca" placeholder="Opcional" />
          <Button variant="destructive" onClick={() => setDialog("destructive")}>
            Borrar (abre un diálogo encima)
          </Button>
          {sheet === "full" && <div className="h-[800px] rounded-lg bg-canvas-parchment" />}
        </div>
      </Sheet>

      <Dialog
        open={dialog !== null}
        title={dialog === "destructive" ? "¿Borrar esta prenda?" : "¿Guardar los cambios?"}
        description={
          dialog === "destructive"
            ? "Se quitará también de los favoritos que la usan. No se puede deshacer."
            : undefined
        }
        confirmLabel={dialog === "destructive" ? "Borrar" : "Guardar"}
        cancelLabel="Cancelar"
        destructive={dialog === "destructive"}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          toast.show({ message: dialog === "destructive" ? "Prenda borrada" : "Guardado" });
        }}
      />
    </main>
  );
}
