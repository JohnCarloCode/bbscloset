// Variables de entorno públicas de Supabase. Next solo las incrusta si se leen
// con su nombre literal (process.env.NEXT_PUBLIC_…), por eso no se indexan.
// No fallan al importar el módulo (el build puede no tenerlas): fallan al usarse.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Rellénala en .env.local (remoto) o .env.development.local (local); ver .env.example.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
