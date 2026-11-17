// Temporadas: lista cerrada (spec 2.3), multivalor por prenda. Igual que la
// restricción de garments.seasons (supabase/migrations/0002). Nombres visibles
// en src/messages (clave `seasons.<id>`).

export const SEASON_IDS = ["spring", "summer", "autumn", "winter"] as const;

export type SeasonId = (typeof SEASON_IDS)[number];

export function isSeasonId(value: unknown): value is SeasonId {
  return typeof value === "string" && (SEASON_IDS as readonly string[]).includes(value);
}
