// Placeholder: solo el título y el botón temporal de cerrar sesión (paso 2.2).
// La pantalla se construye en el paso 7.2, que coloca el botón en Cuenta.
import { useTranslations } from "next-intl";
import { SignOutButton } from "@/features/auth/SignOutButton";

export default function SettingsPage() {
  const t = useTranslations("nav");
  return (
    <main className="flex flex-col items-start gap-lg px-5 pt-lg pb-xl">
      <h1 className="text-lead font-semibold">{t("settings")}</h1>
      <SignOutButton />
    </main>
  );
}
