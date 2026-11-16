"use client";

// "¿Has olvidado la contraseña?" (screens.md 2): estado del login con
// ?forgot=1. Pide el email y Supabase envía el enlace a /reset-password.
// La respuesta es siempre la misma, exista o no el email (y también si
// Supabase limita los envíos): solo se avisa si no hay conexión.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { NoticeInline } from "@/components/NoticeInline";
import { TextField } from "@/components/TextField";
import { createClient } from "@/lib/supabase/browser";

function isOffline(error?: { name?: string; status?: number }): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  // AuthRetryableFetchError: el fetch ni siquiera llegó al servidor.
  return error?.name === "AuthRetryableFetchError" || error?.status === 0;
}

export function ForgotPasswordForm() {
  const t = useTranslations("login.forgot");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [offline, setOffline] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setOffline(false);

    let noConnection = false;
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      noConnection = Boolean(error) && isOffline(error ?? undefined);
    } catch {
      noConnection = isOffline();
    }

    setSubmitting(false);
    if (noConnection) setOffline(true);
    else setSent(true);
  }

  const backLink = (
    <Link
      href="/login"
      className="inline-flex min-h-11 items-center self-start text-caption text-ink underline underline-offset-2"
    >
      {t("backToLogin")}
    </Link>
  );

  if (sent) {
    return (
      <div className="flex flex-col gap-sm">
        <p role="status" className="text-body text-ink">
          {t("sent")}
        </p>
        {backLink}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-sm">
      <TextField
        label={t("email")}
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={submitting}
      />
      {offline && <NoticeInline role="status">{t("offline")}</NoticeInline>}
      <Button
        type="submit"
        fullWidth
        className="mt-xxs"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? t("submitting") : t("submit")}
      </Button>
      {backLink}
    </form>
  );
}
