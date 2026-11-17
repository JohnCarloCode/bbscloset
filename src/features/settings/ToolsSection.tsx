// Ajustes › Herramientas (screens.md 12): fila "Recortar fotos ›" que lleva a
// /cutout (screens.md 13), con su nota debajo.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRightIcon } from "@/components/icons";
import { cx } from "@/components/cx";
import { SettingsGroup, settingsRow } from "./SettingsGroup";

export function ToolsSection() {
  const t = useTranslations("settings.tools");
  return (
    <SettingsGroup title={t("title")} note={t("note")}>
      <Link href="/cutout" className={cx(settingsRow, "justify-between text-body text-ink")}>
        <span>{t("cutout")}</span>
        <ChevronRightIcon className="text-ink-muted-48" />
      </Link>
    </SettingsGroup>
  );
}
