// Reglas puras de recuperar contraseña (paso 2.3): qué trae el enlace del email
// y validación de la contraseña nueva. Sin React ni Supabase para poder probarlas.

/** Igual que `minimum_password_length` de supabase/config.toml (y del proyecto remoto). */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Lo que trae la URL de /reset-password al llegar desde el email:
 * - `token_hash` + `type=recovery`: plantilla propia (supabase/README.md). Se
 *   canjea con verifyOtp y funciona en cualquier navegador.
 * - `code`: plantilla por defecto con PKCE. Lo canjea solo el cliente de
 *   Supabase al iniciarse, y solo en el navegador que pidió el enlace (el
 *   `code_verifier` está en sus cookies).
 * - `error` / `error_code` (en la query o en el hash): enlace caducado o usado.
 */
export type RecoveryLink =
  | { kind: "tokenHash"; tokenHash: string }
  | { kind: "code" }
  | { kind: "error" }
  | { kind: "none" };

export function parseRecoveryLink(href: string): RecoveryLink {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = (key: string) => url.searchParams.get(key) ?? hash.get(key);

  if (get("error") || get("error_code") || get("error_description")) return { kind: "error" };
  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash) {
    // Solo enlaces de recuperación: otro `type` no abre esta pantalla.
    return url.searchParams.get("type") === "recovery"
      ? { kind: "tokenHash", tokenHash }
      : { kind: "error" };
  }
  if (url.searchParams.get("code")) return { kind: "code" };
  return { kind: "none" };
}

/** Quita de la URL los parámetros del enlace para que no se reutilicen al recargar. */
export function stripRecoveryParams(href: string): string {
  const url = new URL(href);
  for (const key of ["token_hash", "type", "code", "error", "error_code", "error_description"]) {
    url.searchParams.delete(key);
  }
  return url.pathname + url.search;
}

export type NewPasswordErrors = { password?: "tooShort"; confirm?: "mismatch" };

export function validateNewPassword(password: string, confirm: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = "tooShort";
  if (confirm !== password) errors.confirm = "mismatch";
  return errors;
}

/**
 * ¿La sesión viene de un enlace de recuperación? Lo dice el claim `amr` del JWT:
 * verifyOtp deja `otp` y el canje PKCE `recovery`. La app no usa magic links,
 * así que una sesión `otp` solo puede salir del reseteo. Sirve para recargar
 * /reset-password sin perder el formulario.
 */
const RECOVERY_METHODS = new Set<unknown>(["otp", "recovery"]);

export function isRecoveryClaims(claims: { amr?: unknown } | null | undefined): boolean {
  if (!claims || !Array.isArray(claims.amr)) return false;
  return claims.amr.some(
    (entry: unknown) =>
      typeof entry === "object" &&
      entry !== null &&
      RECOVERY_METHODS.has((entry as { method?: unknown }).method),
  );
}
