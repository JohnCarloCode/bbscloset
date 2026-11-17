"use client";

// Página temporal para probar la cola de recorte (paso 3.6): encola fotos
// como prenda con datos fijos (se suben solas), como prenda sin datos (se
// quedan en la cola) o como recorte en lote (solo memoria, no cuenta en la
// píldora). Se borra en el paso 7.5; puede llevar literales.
// El store queda en window.__queue para pruebas automáticas.
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { pillState } from "@/features/queue/logic";
import { GARMENT_SAVED_EVENT, useQueueStore } from "@/features/queue/store";
import type { GarmentData, QueueKind, QueueMode } from "@/features/queue/types";

declare global {
  interface Window {
    __queue?: typeof useQueueStore;
    __queueSaved?: string[];
  }
}

const FIXED_DATA: GarmentData = {
  type_id: "tshirt",
  name: "Prueba cola",
  seasons: ["summer"],
  tags: [],
};

export default function DevQueuePage() {
  const items = useQueueStore((s) => s.items);
  const userId = useQueueStore((s) => s.userId);
  const enqueue = useQueueStore((s) => s.enqueue);
  const remove = useQueueStore((s) => s.remove);
  const setGarmentData = useQueueStore((s) => s.setGarmentData);
  const [mode, setMode] = useState<QueueMode>("cut");
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    window.__queue = useQueueStore;
    const onSaved = (e: Event) => {
      const id = (e as CustomEvent<{ garmentId: string }>).detail.garmentId;
      window.__queueSaved = [...(window.__queueSaved ?? []), id];
      setSaved((s) => [...s, id]);
    };
    window.addEventListener(GARMENT_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(GARMENT_SAVED_EVENT, onSaved);
  }, []);

  async function add(files: FileList | null, kind: QueueKind, withData: boolean) {
    for (const file of Array.from(files ?? [])) {
      await enqueue(kind, file, mode, {
        sourceName: file.name,
        garmentData: withData ? FIXED_DATA : undefined,
      });
    }
  }

  const pill = pillState(items);

  return (
    <main className="flex flex-col gap-md p-lg">
      <h1 className="text-tagline">Cola de recorte · dev</h1>
      <p className="text-caption">
        Usuario: {userId ?? "…"} · píldora:{" "}
        {pill.visible ? `${pill.current} de ${pill.total}` : "oculta"} · subidas: {saved.length}
      </p>
      <label className="flex items-center gap-xs text-caption">
        Modo
        <select value={mode} onChange={(e) => setMode(e.target.value as QueueMode)}>
          <option value="cut">cut (quitar fondo)</option>
          <option value="as-is">as-is (tal cual)</option>
        </select>
      </label>
      <FilePicker
        id="garment-data"
        label="Prenda con datos (tshirt, se sube)"
        onPick={(f) => add(f, "garment", true)}
      />
      <FilePicker
        id="garment-nodata"
        label="Prenda sin datos (se queda)"
        onPick={(f) => add(f, "garment", false)}
      />
      <FilePicker
        id="batch"
        label="Recorte en lote (batch)"
        onPick={(f) => add(f, "batch", false)}
      />

      <table className="text-caption">
        <thead>
          <tr className="text-left">
            <th>localId</th>
            <th>kind</th>
            <th>status</th>
            <th>progreso</th>
            <th>datos</th>
            <th>garmentId</th>
            <th>error</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.localId} data-item={i.localId}>
              <td>{i.localId.slice(0, 8)}</td>
              <td>{i.kind}</td>
              <td>{i.uploaded ? "subida" : i.status}</td>
              <td>{Math.round(i.progress * 100)} %</td>
              <td>{i.garmentData?.type_id ?? "—"}</td>
              <td>{i.garmentId?.slice(0, 8) ?? "—"}</td>
              <td>{i.error ?? i.uploadError ?? ""}</td>
              <td className="flex gap-xs">
                {i.kind === "garment" && !i.garmentData && (
                  <Button variant="text-link" onClick={() => setGarmentData(i.localId, FIXED_DATA)}>
                    Poner datos
                  </Button>
                )}
                <Button variant="text-link" onClick={() => remove(i.localId)}>
                  Quitar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function FilePicker({
  id,
  label,
  onPick,
}: {
  id: string;
  label: string;
  onPick: (files: FileList | null) => Promise<void>;
}) {
  return (
    <label className="flex flex-col gap-xxs text-caption" htmlFor={id}>
      {label}
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          const input = e.currentTarget;
          void onPick(input.files).finally(() => (input.value = ""));
        }}
      />
    </label>
  );
}
