// Campos de texto ligeros con etiqueta, ayuda y error en línea.
// Input en píldora de 44 px (como search-input y el login del prototipo);
// Textarea con rounded-lg. Error: borde negro de 2 px + mensaje con icono,
// enlazado con aria-describedby y aria-invalid (sin rojos: la paleta es rosa + negro).
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";
import { WarningIcon } from "./icons";

type FieldExtras = {
  label: ReactNode;
  /** Texto de ayuda bajo el campo. */
  hint?: ReactNode;
  /** Mensaje de error; si existe, el campo queda marcado como inválido. */
  error?: ReactNode;
  /** Clases del contenedor. */
  className?: string;
};

const controlBase =
  "w-full bg-canvas text-body text-ink placeholder:text-ink-muted-48 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-focus " +
  "disabled:cursor-not-allowed disabled:bg-canvas-parchment disabled:opacity-40";

function borderFor(error: unknown) {
  // Al pasar a 2 px se compensa 1 px de relleno para que el texto no salte.
  return error ? "border-2 border-ink" : "border border-surface-black/12";
}

function FieldShell({
  id,
  label,
  hint,
  error,
  hintId,
  errorId,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  hintId: string;
  errorId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-xs", className)}>
      <label htmlFor={id} className="px-xxs text-caption-strong text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="px-xxs text-fine-print leading-normal text-ink-muted-48">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-[6px] px-xxs text-caption text-ink">
          <WarningIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function useFieldIds(idProp: string | undefined) {
  const auto = useId();
  const id = idProp ?? auto;
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function describedBy(
  own: string | undefined,
  {
    hint,
    error,
    hintId,
    errorId,
  }: { hint?: ReactNode; error?: ReactNode; hintId: string; errorId: string },
) {
  return cx(own, error ? errorId : hint ? hintId : undefined) || undefined;
}

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> &
  FieldExtras & { inputClassName?: string };

export function TextField({
  label,
  hint,
  error,
  className,
  inputClassName,
  id: idProp,
  type = "text",
  "aria-describedby": ownDescribedBy,
  ...props
}: TextFieldProps) {
  const { id, hintId, errorId } = useFieldIds(idProp);
  return (
    <FieldShell {...{ id, label, hint, error, hintId, errorId, className }}>
      <input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ownDescribedBy, { hint, error, hintId, errorId })}
        className={cx(
          controlBase,
          "h-11 rounded-pill",
          borderFor(error),
          error ? "px-[19px]" : "px-[20px]",
          inputClassName,
        )}
        {...props}
      />
    </FieldShell>
  );
}

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> &
  FieldExtras & { textareaClassName?: string };

export function Textarea({
  label,
  hint,
  error,
  className,
  textareaClassName,
  id: idProp,
  rows = 3,
  "aria-describedby": ownDescribedBy,
  ...props
}: TextareaProps) {
  const { id, hintId, errorId } = useFieldIds(idProp);
  return (
    <FieldShell {...{ id, label, hint, error, hintId, errorId, className }}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ownDescribedBy, { hint, error, hintId, errorId })}
        className={cx(
          controlBase,
          "min-h-11 resize-y rounded-lg",
          borderFor(error),
          error ? "px-[16px] py-[11px]" : "px-md py-sm",
          textareaClassName,
        )}
        {...props}
      />
    </FieldShell>
  );
}
