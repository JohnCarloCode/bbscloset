"use client";

// Ajustes › Etiquetas (screens.md 12; spec 2.4 y 3.6; decisiones 1 y 15).
// - Lista de etiquetas del usuario (GET /api/tags) con su número de prendas.
//   Las sugeridas no salen: solo existen en `tags` cuando se han usado.
// - "Renombrar" en línea con Guardar/Cancelar (Intro/Escape). Si el nombre ya
//   existe (comprobado aquí y por la API con 409 `conflict`), error en línea
//   y no se guarda.
// - "Eliminar" pide confirmación diciendo a cuántas prendas afecta.
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { TextField } from "@/components/TextField";
import { useToast } from "@/components/toast";
import { apiFetch, isApiClientError } from "@/lib/api/client";
import {
  GARMENT_TAG_MAX,
  type TagDeleteResponse,
  type TagWithCount,
  type TagsResponse,
} from "@/lib/api/types";
import { checkTagRename } from "./logic";
import { SettingsGroup, settingsRow } from "./SettingsGroup";

type RenameError = "duplicate" | "empty" | "tooLong" | "generic" | "offline";

const actionBase =
  "min-h-11 shrink-0 cursor-pointer px-xxs text-caption " +
  "disabled:cursor-not-allowed disabled:opacity-40";
/** Acción de texto subrayada (Renombrar, Eliminar, Guardar), como el prototipo. */
const linkAction = `${actionBase} text-ink underline underline-offset-2`;

export function TagsSection() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const { show } = useToast();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Etiqueta cuyo botón "Renombrar" recupera el foco al cerrar la edición.
  const returnFocusTo = useRef<string | null>(null);
  const endEditing = (id: string) => {
    returnFocusTo.current = id;
    setEditingId(null);
  };
  const [toDelete, setToDelete] = useState<TagWithCount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await apiFetch<TagsResponse>("/api/tags");
      setTags(res.tags);
      setStatus("ready");
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // Carga inicial al montar (la petición fija el estado al volver).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch<TagDeleteResponse>(`/api/tags/${toDelete.id}`, { method: "DELETE" });
      setTags((prev) => prev.filter((x) => x.id !== toDelete.id));
      if (editingId === toDelete.id) setEditingId(null);
      setToDelete(null);
      show({ message: t("tags.deleted") });
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      setToDelete(null);
      if (isApiClientError(err) && err.code === "not_found") {
        // Ya no existía (otro dispositivo): fuera de la lista igualmente.
        setTags((prev) => prev.filter((x) => x.id !== toDelete.id));
        return;
      }
      show({
        message:
          isApiClientError(err) && err.code === "network" ? t("offline") : t("tags.deleteError"),
      });
    } finally {
      setDeleting(false);
    }
  }

  let body;
  if (status === "loading") {
    body = (
      <div className={settingsRow} aria-busy="true">
        <div className="h-[18px] w-1/3 rounded-xs bg-canvas-parchment" />
      </div>
    );
  } else if (status === "error") {
    body = (
      <div role="alert" className={`${settingsRow} justify-between`}>
        <span className="text-caption text-ink-muted-80">{t("loadError")}</span>
        <Button variant="text-link" onClick={() => void load()}>
          {tCommon("retry")}
        </Button>
      </div>
    );
  } else if (tags.length === 0) {
    body = <p className={`${settingsRow} text-caption text-ink-muted-80`}>{t("tags.empty")}</p>;
  } else {
    body = (
      <ul className="divide-y divide-divider-soft">
        {tags.map((tag) => (
          <li key={tag.id}>
            {editingId === tag.id ? (
              <RenameRow
                tag={tag}
                all={tags}
                onCancel={() => endEditing(tag.id)}
                onSaved={(saved) => {
                  setTags((prev) =>
                    prev
                      .map((x) => (x.id === saved.id ? saved : x))
                      .sort((a, b) =>
                        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
                      ),
                  );
                  endEditing(saved.id);
                }}
              />
            ) : (
              <div className={settingsRow}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{tag.name}</span>
                  <span className="text-fine-print leading-normal text-ink-muted-48">
                    {t("tags.count", { count: tag.count })}
                  </span>
                </div>
                <button
                  type="button"
                  className={linkAction}
                  aria-label={t("tags.renameAria", { name: tag.name })}
                  onClick={() => setEditingId(tag.id)}
                  ref={(el) => {
                    // Al salir de "Renombrar" el foco vuelve a este botón (si no, se pierde en <body>).
                    if (el && returnFocusTo.current === tag.id) {
                      returnFocusTo.current = null;
                      el.focus({ preventScroll: true });
                    }
                  }}
                >
                  {t("tags.rename")}
                </button>
                <button
                  type="button"
                  className={linkAction}
                  aria-label={t("tags.deleteAria", { name: tag.name })}
                  onClick={() => setToDelete(tag)}
                >
                  {tCommon("delete")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <SettingsGroup title={t("tags.title")} note={t("tags.note")}>
        {body}
      </SettingsGroup>
      <Dialog
        open={toDelete !== null}
        title={toDelete ? t("tags.deleteTitle", { name: toDelete.name }) : ""}
        description={toDelete ? t("tags.deleteBody", { count: toDelete.count }) : undefined}
        confirmLabel={t("tags.deleteConfirm")}
        cancelLabel={tCommon("cancel")}
        destructive
        confirmDisabled={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) setToDelete(null);
        }}
      />
    </>
  );
}

function RenameRow({
  tag,
  all,
  onCancel,
  onSaved,
}: {
  tag: TagWithCount;
  all: TagWithCount[];
  onCancel: () => void;
  onSaved: (tag: TagWithCount) => void;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [value, setValue] = useState(tag.name);
  const [error, setError] = useState<RenameError | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const check = checkTagRename(tag, value, all);
    if (!check.ok) {
      if (check.reason === "unchanged") onCancel();
      else setError(check.reason);
      return;
    }
    setSaving(true);
    try {
      const saved = await apiFetch<TagWithCount>(`/api/tags/${tag.id}`, {
        method: "PATCH",
        json: { name: check.name },
      });
      onSaved(saved);
    } catch (err) {
      if (isApiClientError(err) && err.code === "unauthorized") return;
      setError(
        isApiClientError(err)
          ? err.code === "conflict"
            ? "duplicate"
            : err.code === "network"
              ? "offline"
              : "generic"
          : "generic",
      );
      setSaving(false);
    }
  }

  const errorText =
    error === null
      ? undefined
      : error === "offline"
        ? t("offline")
        : t(`tags.errors.${error}`, { max: GARMENT_TAG_MAX });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-xs px-md py-xs">
      <div className="flex items-start gap-sm">
        <TextField
          // Se abre a petición del usuario ("Renombrar"): el foco va al campo.
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          label={t("tags.renameLabel", { name: tag.name })}
          // La etiqueta visible sobra en la fila (como el prototipo): solo para lectores.
          className="min-w-0 flex-1 [&>label]:sr-only"
          value={value}
          maxLength={GARMENT_TAG_MAX * 2}
          error={errorText}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="submit" className={linkAction} disabled={saving} aria-busy={saving}>
          {tCommon("save")}
        </button>
        <button type="button" className={`${actionBase} text-ink-muted-80`} onClick={onCancel}>
          {tCommon("cancel")}
        </button>
      </div>
    </form>
  );
}
