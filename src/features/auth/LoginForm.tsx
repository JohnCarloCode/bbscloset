"use client";

// Formulario de login (screens.md 2): email + contraseña con Supabase Auth.
// La sesión queda en cookies (@supabase/ssr). Al entrar fija la cookie
// `locale` con profiles.language y hace una navegación completa a /dresser
// para que el servidor vea las cookies nuevas.
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { NoticeInline } from "@/components/NoticeInline";
import { TextField } from "@/components/TextField";
import { createClient } from "@/lib/supabase/browser";
import { syncLocaleFromProfile } from "./syncLocaleFromProfile";

type LoginError = "invalidCredentials" | "offline" | "generic";

/** Traduce el error de Supabase a un mensaje que no revela si el email existe. */
function classifyError(error: { code?: string; status?: number; name?: string }): LoginError {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  // AuthRetryableFetchError: el fetch ni siquiera llegó al servidor.
  if (error.name === "AuthRetryableFetchError" || error.status === 0) return "offline";
  // Email sin confirmar también cuenta como credenciales incorrectas: no se
  // distingue entre cuentas que existen y que no.
  if (
    error.code === "invalid_credentials" ||
    error.code === "email_not_confirmed" ||
    error.status === 400
  ) {
    return "invalidCredentials";
  }
  return "generic";
}

export function LoginForm() {
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    let failure: LoginError | null = null;
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) failure = classifyError(authError);
    } catch {
      failure = typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "generic";
    }

    if (failure) {
      setError(failure);
      setSubmitting(false);
      return;
    }

    await syncLocaleFromProfile();
    // Navegación completa a propósito: el layout raíz (proveedor de idioma) no se
    // vuelve a pedir en una navegación de cliente y debe leer la cookie `locale`
    // nueva. El botón sigue en "Entrando…" hasta que carga /dresser.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dresser");
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
      <TextField
        label={t("password")}
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
      />
      {error && <NoticeInline role="status">{t(`errors.${error}`)}</NoticeInline>}
      <Button
        type="submit"
        fullWidth
        className="mt-xxs"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? t("submitting") : t("submit")}
      </Button>
      {/* Mismo /login con ?forgot=1: el formulario de recuperar contraseña. */}
      <Link
        href="/login?forgot=1"
        className="inline-flex min-h-11 items-center self-start text-caption text-ink underline underline-offset-2"
      >
        {t("forgotPassword")}
      </Link>
    </form>
  );
}
