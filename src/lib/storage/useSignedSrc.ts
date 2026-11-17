"use client";

// <img> con URL firmada que se renueva sola (7.6): si la imagen no carga
// (p. ej. la URL ha caducado tras 1 h), pide otra con refreshSignedUrl y la
// reintenta una vez; si vuelve a fallar, src = null (la tarjeta queda lisa).
// Una URL nueva desde fuera (otra respuesta de la API) vuelve a empezar.
import { useState } from "react";
import { refreshSignedUrl } from "./refresh";

type State = {
  /** URL recibida a la que corresponde este estado. */
  base: string | null;
  src: string | null;
  retried: boolean;
};

export function useSignedSrc(url: string | null | undefined): {
  src: string | null;
  onError: () => void;
} {
  const base = url ?? null;
  const [state, setState] = useState<State>({ base, src: base, retried: false });
  const current: State = state.base === base ? state : { base, src: base, retried: false };

  const onError = () => {
    if (!current.src) return;
    if (current.retried) {
      setState({ ...current, src: null });
      return;
    }
    const failed = current.src;
    setState({ base, src: null, retried: true });
    void refreshSignedUrl(failed).then((next) =>
      setState((s) => (s.base === base && s.retried ? { ...s, src: next } : s)),
    );
  };

  return { src: current.src, onError };
}
