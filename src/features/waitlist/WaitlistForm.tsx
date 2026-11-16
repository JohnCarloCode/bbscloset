"use client";

// Formulario de la waitlist (screens.md 3): solo el email. "Apuntarme" se
// habilita en cuanto hay una "@"; al enviar, POST /api/waitlist y mensaje de
// confirmación en pantalla (no se envía ningún correo).
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { NoticeInline } from "@/components/NoticeInline";
import { TextField } from "@/components/TextField";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import { canSubmitEmail, EMAIL_MAX_LENGTH, waitlistBodySchema } from "./email";

type WaitlistError = "invalidEmail" | "offline" | "rateLimited" | "generic";

function classifyError(err: unknown): WaitlistError {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (!isApiClientError(err)) return "generic";
  switch (err.code) {
    case "network":
      return "offline";
    case "invalid_body":
      return "invalidEmail";
    case "rate_limited":
      return "rateLimited";
    default:
      return "generic";
  }
}

export function WaitlistForm() {
  const t = useTranslations("waitlist");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<WaitlistError | null>(null);
  const [joinedEmail, setJoinedEmail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !canSubmitEmail(email)) return;

    // Misma validación que la API: si no pasa, ni se envía.
    const parsed = waitlistBodySchema.safeParse({ email });
    if (!parsed.success) {
      setError("invalidEmail");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/waitlist", { method: "POST", json: parsed.data });
      setJoinedEmail(parsed.data.email);
    } catch (err) {
      setError(classifyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (joinedEmail) {
    return (
      <div
        role="status"
        className="flex w-full flex-col gap-[6px] rounded-lg bg-canvas-parchment p-lg text-center"
      >
        <p className="text-body font-semibold">{t("done.title")}</p>
        <p className="text-caption break-words text-ink-muted-80">
          {t("done.body", { email: joinedEmail })}
        </p>
      </div>
    );
  }

  return (
    // noValidate: los errores se enseñan en línea, no con la burbuja del navegador.
    <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-sm text-left">
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
        maxLength={EMAIL_MAX_LENGTH}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error === "invalidEmail") setError(null);
        }}
        disabled={submitting}
        error={error === "invalidEmail" ? t("errors.invalidEmail") : undefined}
      />
      {error && error !== "invalidEmail" && (
        <NoticeInline role="status">{t(`errors.${error}`)}</NoticeInline>
      )}
      <Button
        type="submit"
        fullWidth
        className="mt-xxs"
        disabled={submitting || !canSubmitEmail(email)}
        aria-busy={submitting}
      >
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
