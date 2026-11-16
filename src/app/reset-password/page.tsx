// Nueva contraseña (screens.md 2), desde el enlace del email de Supabase.
// Pública en src/proxy.ts: se llega sin sesión y la sesión de recuperación la
// establece ResetPasswordForm en el navegador.
import { useTranslations } from "next-intl";
import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const tc = useTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-lg py-xl">
      <div className="flex w-full max-w-[360px] flex-col gap-[28px]">
        <p className="text-tagline">{tc("appName")}</p>
        <div className="flex flex-col gap-xs">
          <h1 className="text-display-md leading-[1.1]">{t("title")}</h1>
          <p className="text-body text-ink-muted-80">{t("intro")}</p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
