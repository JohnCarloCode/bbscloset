"use client";

// Nueva contraseña (screens.md 2, /reset-password). Al llegar desde el email
// primero se establece la sesión de recuperación (ver recovery.ts):
// - `?token_hash=…&type=recovery` (plantilla propia): verifyOtp, en cualquier navegador.
// - `?code=…` (plantilla por defecto, PKCE): lo canjea el cliente de Supabase
//   al iniciarse; solo funciona en el navegador que pidió el enlace.
// Sin sesión válida (caducado, usado u otro navegador) se ofrece pedir otro.
// Al guardar, fija la cookie `locale` como el login y entra con navegación completa.
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { NoticeInline } from "@/components/NoticeInline";
import { TextField } from "@/components/TextField";
import { createClient } from "@/lib/supabase/browser";
import {
  isRecoveryClaims,
  MIN_PASSWORD_LENGTH,
  parseRecoveryLink,
  stripRecoveryParams,
  validateNewPassword,
  type NewPasswordErrors,
} from "./recovery";
import { syncLocaleFromProfile } from "./syncLocaleFromProfile";

type LinkStatus = "checking" | "ready" | "invalid";
type PasswordError = NonNullable<NewPasswordErrors["password"]> | "sameAsOld";
type SubmitError = "offline" | "generic";

/** Establece la sesión de recuperación a partir de la URL actual. */
async function checkRecoveryLink(): Promise<LinkStatus> {
  const link = parseRecoveryLink(window.location.href);
  const supabase = createClient();
  try {
    // initialize() espera a que el cliente termine de leer la URL: con ?code=
    // canjea el código (PKCE) y lo quita de la URL si lo consigue.
    const { error: initError } = await supabase.auth.initialize();
    let ok = false;
    if (link.kind === "tokenHash") {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: link.tokenHash,
        type: "recovery",
      });
      ok = !error;
    } else if (link.kind === "code") {
      // Si el código sigue en la URL, no había code_verifier (otro navegador).
      ok = !initError && !new URL(window.location.href).searchParams.has("code");
    } else if (link.kind === "none") {
      // Recarga tras haber verificado el enlace: vale la sesión de recuperación.
      const { data } = await supabase.auth.getClaims();
      ok = isRecoveryClaims(data?.claims);
    }
    return ok ? "ready" : "invalid";
  } catch {
    return "invalid";
  } finally {
    // El enlace es de un solo uso: fuera de la URL para no reintentarlo al recargar.
    window.history.replaceState(
      window.history.state,
      "",
      stripRecoveryParams(window.location.href),
    );
  }
}

function isOffline(error?: { name?: string; status?: number }): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error?.name === "AuthRetryableFetchError" || error?.status === 0;
}

export function ResetPasswordForm() {
  const t = useTranslations("resetPassword");
  const [status, setStatus] = useState<LinkStatus>("checking");
  const checking = useRef<Promise<LinkStatus> | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [passwordError, setPasswordError] = useState<PasswordError | null>(null);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Una sola comprobación aunque el efecto se repita (StrictMode): el
    // token_hash es de un solo uso y un segundo verifyOtp fallaría.
    let active = true;
    checking.current ??= checkRecoveryLink();
    checking.current.then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);

  // Tras el primer intento, los errores en línea se recalculan al escribir.
  const fieldErrors: NewPasswordErrors = attempted ? validateNewPassword(password, confirm) : {};
  const shownPasswordError = fieldErrors.password ?? passwordError;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setAttempted(true);
    setPasswordError(null);
    setSubmitError(null);
    const errors = validateNewPassword(password, confirm);
    if (errors.password || errors.confirm) return;

    setSubmitting(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setSubmitting(false);
        if (isOffline(error)) setSubmitError("offline");
        else if (error.code === "same_password") setPasswordError("sameAsOld");
        else if (error.code === "weak_password") setPasswordError("tooShort");
        else if (
          error.name === "AuthSessionMissingError" ||
          error.code === "session_not_found" ||
          error.code === "session_expired" ||
          error.status === 401 ||
          error.status === 403
        ) {
          setStatus("invalid");
        } else setSubmitError("generic");
        return;
      }
    } catch {
      setSubmitting(false);
      setSubmitError(isOffline() ? "offline" : "generic");
      return;
    }

    await syncLocaleFromProfile();
    // Navegación completa (como el login): el layout raíz debe leer la cookie
    // `locale` nueva. El botón sigue en "Guardando…" hasta que carga /dresser.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dresser");
  }

  if (status === "checking") {
    return (
      <p role="status" className="text-body text-ink-muted-80">
        {t("checking")}
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col gap-sm">
        <NoticeInline role="status">{t("invalidLink")}</NoticeInline>
        <Link
          href="/login?forgot=1"
          className="inline-flex min-h-11 items-center self-start text-caption text-ink underline underline-offset-2"
        >
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-sm">
      <TextField
        label={t("newPassword")}
        type="password"
        name="new-password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
        hint={t("hint", { min: MIN_PASSWORD_LENGTH })}
        error={
          shownPasswordError
            ? t(`errors.${shownPasswordError}`, { min: MIN_PASSWORD_LENGTH })
            : undefined
        }
      />
      <TextField
        label={t("confirmPassword")}
        type="password"
        name="confirm-password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={submitting}
        error={fieldErrors.confirm ? t("errors.mismatch") : undefined}
      />
      {submitError && <NoticeInline role="status">{t(`errors.${submitError}`)}</NoticeInline>}
      <Button
        type="submit"
        fullWidth
        className="mt-xxs"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
