// Login (screens.md 2). Fuera del grupo (app): sin navegación de la app.
// Con sesión, src/proxy.ts redirige /login a /dresser antes de llegar aquí.
// Con ?expired=1 (401 de la API, src/lib/api/client.ts) enseña un toast.
// Con ?forgot=1 es el estado "¿Has olvidado la contraseña?" del mismo login.
import { Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";
import { LoginForm } from "@/features/auth/LoginForm";
import { SessionExpiredToast } from "@/features/auth/SessionExpiredToast";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = useTranslations("login");
  const tc = useTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-lg py-xl">
      <div className="flex w-full max-w-[360px] flex-col gap-[28px]">
        <p className="text-tagline">{tc("appName")}</p>
        {/* Lo que depende de ?forgot va en su propio Suspense (cacheComponents). */}
        <Suspense>
          <LoginBody searchParams={searchParams} />
        </Suspense>
        <SessionExpiredToast />
        <p className="flex flex-wrap items-center gap-x-xxs border-t border-hairline pt-[20px] text-caption text-ink-muted-80">
          <span>{t("inviteOnly")}</span>
          <Link href="/waitlist" className="text-ink underline underline-offset-2">
            {t("joinWaitlist")}
          </Link>
        </p>
      </div>
    </main>
  );
}

async function LoginBody({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const forgot = (await searchParams).forgot === "1";
  const t = await getTranslations("login");
  return (
    <>
      <div className="flex flex-col gap-xs">
        <h1 className="text-display-md leading-[1.1]">{forgot ? t("forgot.title") : t("title")}</h1>
        <p className="text-body text-ink-muted-80">{forgot ? t("forgot.intro") : t("intro")}</p>
      </div>
      {/* key: al cambiar de estado, cada formulario empieza limpio. */}
      {forgot ? <ForgotPasswordForm key="forgot" /> : <LoginForm key="login" />}
    </>
  );
}
