"use client";

// Página temporal para crear una sesión a mano con el cliente de navegador y
// probar GET /api/me con las cookies de @supabase/ssr. Se borra en el paso 7.5;
// como las demás páginas /dev, puede llevar textos escritos a mano.
import { useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/browser";

export default function DevSessionPage() {
  const [email, setEmail] = useState("test@bbscloset.test");
  const [password, setPassword] = useState("");
  const [output, setOutput] = useState("");

  async function signIn(e: FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setOutput(error ? `Error: ${error.message}` : "Sesión iniciada");
  }

  async function signOut() {
    const { error } = await createClient().auth.signOut();
    setOutput(error ? `Error: ${error.message}` : "Sesión cerrada");
  }

  async function fetchMe() {
    const res = await fetch("/api/me");
    setOutput(`${res.status}\n${JSON.stringify(await res.json(), null, 2)}`);
  }

  // Prueba del paso 2.2: con la cookie de sesión borrada, un 401 manda a /login.
  async function apiFetchMe() {
    try {
      setOutput(JSON.stringify(await apiFetch("/api/me"), null, 2));
    } catch (err) {
      setOutput(`Error: ${String(err)}`);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Sesión (dev)</h1>
      <form onSubmit={signIn} className="flex flex-col gap-2">
        <input
          className="rounded border p-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
        <input
          className="rounded border p-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="Contraseña"
        />
        <button className="rounded border p-2" type="submit">
          Entrar
        </button>
      </form>
      <div className="flex gap-2">
        <button className="rounded border p-2" type="button" onClick={fetchMe}>
          GET /api/me
        </button>
        <button className="rounded border p-2" type="button" onClick={apiFetchMe}>
          apiFetch /api/me
        </button>
        <button className="rounded border p-2" type="button" onClick={signOut}>
          Salir
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-sm">{output}</pre>
    </main>
  );
}
