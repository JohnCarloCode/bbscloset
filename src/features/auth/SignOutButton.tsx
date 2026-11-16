"use client";

// Botón "Cerrar sesión". Temporal en /settings: el paso 7.2 lo coloca en el
// grupo Cuenta de Ajustes.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { signOut } from "./signOut";

export function SignOutButton() {
  const t = useTranslations("settings");
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    setPending(true);
    // signOut termina con una navegación completa a /login: no se vuelve a habilitar.
    await signOut();
  }

  return (
    <Button variant="secondary" onClick={onClick} disabled={pending} aria-busy={pending}>
      {pending ? t("signingOut") : t("signOut")}
    </Button>
  );
}
