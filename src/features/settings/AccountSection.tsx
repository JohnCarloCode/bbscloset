"use client";

// Ajustes › Cuenta (screens.md 12; paso 2.2): email de la sesión en solo
// lectura y "Cerrar sesión" (signOut termina con una navegación a /login).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import { signOut } from "@/features/auth/signOut";
import { SettingsGroup, settingsRow } from "./SettingsGroup";

export function AccountSection({ email }: { email: string | null }) {
  const t = useTranslations("settings");
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    // Navegación completa a /login: no se vuelve a habilitar.
    await signOut();
  }

  return (
    <SettingsGroup title={t("account.title")}>
      <div className={cx(settingsRow, "justify-between")}>
        <span className="shrink-0 text-body">{t("account.email")}</span>
        <span className="min-w-0 truncate text-caption text-ink-muted-80">{email ?? ""}</span>
      </div>
      <button
        type="button"
        onClick={() => void onSignOut()}
        disabled={signingOut}
        aria-busy={signingOut}
        className={cx(
          settingsRow,
          "w-full cursor-pointer text-left text-body text-ink underline underline-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {signingOut ? t("signingOut") : t("signOut")}
      </button>
    </SettingsGroup>
  );
}
