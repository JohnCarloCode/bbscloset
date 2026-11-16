// Waitlist (screens.md 3): página pública, fuera del grupo (app), sin la
// navegación de la app. El proxy la deja abierta sin sesión.
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { WaitlistForm } from "@/features/waitlist/WaitlistForm";

export default function WaitlistPage() {
  const t = useTranslations("waitlist");
  const tc = useTranslations("common");
  return (
    <main className="flex min-h-dvh flex-col items-center px-lg pt-lg pb-[40px]">
      <div className="my-auto flex w-full max-w-[400px] flex-col items-center gap-[28px] text-center">
        <p className="text-tagline">{tc("appName")}</p>
        {/* Collage provisional (SVG plano, sin fotos reales): ver public/waitlist-collage.svg. */}
        <Image
          src="/waitlist-collage.svg"
          alt={t("collageAlt")}
          width={240}
          height={300}
          loading="eager"
          className="h-auto w-[240px] rounded-lg"
        />
        <div className="flex flex-col gap-sm">
          <h1 className="text-display-md leading-[1.1] text-balance">{t("headline")}</h1>
          <p className="text-body text-pretty text-ink-muted-80">{t("intro")}</p>
        </div>
        <WaitlistForm />
        <p className="flex flex-wrap items-center justify-center gap-x-xxs text-caption text-ink-muted-80">
          <span>{t("alreadyInvited")}</span>
          <Link href="/login" className="text-ink underline underline-offset-2">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
