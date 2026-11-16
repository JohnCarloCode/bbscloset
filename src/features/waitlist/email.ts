// Validación del email de la waitlist, compartida por el formulario y por
// POST /api/waitlist. Se recorta y se guarda tal cual lo escribió (sin pasar
// a minúsculas): la unicidad la garantiza el índice por lower(email)
// (database.md 5).
import { z } from "zod";

/** Largo máximo de un email (RFC 5321). */
export const EMAIL_MAX_LENGTH = 254;

export const waitlistBodySchema = z.strictObject({
  email: z.string().trim().max(EMAIL_MAX_LENGTH).pipe(z.email()),
});

export type WaitlistBody = z.output<typeof waitlistBodySchema>;

/** El botón "Apuntarme" se habilita en cuanto hay una "@" (screens.md 3). */
export function canSubmitEmail(value: string): boolean {
  return value.includes("@");
}
