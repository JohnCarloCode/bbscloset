#!/usr/bin/env node
// Crea prendas de prueba para el usuario de prueba LOCAL (test@bbscloset.test)
// por la API, como lo haría la app: reserva ids, sube recorte y miniatura WebP
// generados desde pruebas-fotos/streetwear y crea la prenda con datos variados
// (tipo, temporadas, color, marca, etiquetas; ~1 de cada 10 archivada).
//
// Requisitos: Supabase local arrancado y `npx next dev -p 3100` en marcha.
//
// Uso:
//   node scripts/seed-garments.mjs            → 60 prendas
//   node scripts/seed-garments.mjs 24         → 24 prendas
//   node scripts/seed-garments.mjs --clean    → borra TODAS las prendas del
//                                               usuario de prueba (archivos + filas)
//   node scripts/seed-garments.mjs 30 --user 2  → para test2@
// Otra URL de la app: BBS_BASE_URL=http://localhost:3100
import { GARMENT_TYPES, randomFields } from "./lib/fake-garments.mjs";
import { api, createGarments, deleteAllGarments, sessionCookie, TEST_USERS } from "./lib/local.mjs";

const args = process.argv.slice(2);
const userArg = args.indexOf("--user");
const user = userArg >= 0 ? Number(args[userArg + 1]) : 1;
if (!TEST_USERS[user]) throw new Error("--user debe ser 1 o 2");
const clean = args.includes("--clean");
const count = Number(args.find((a, i) => /^\d+$/.test(a) && args[i - 1] !== "--user") ?? 60);

const cookie = await sessionCookie(user);

if (clean) {
  const n = await deleteAllGarments(cookie);
  console.log(`Borradas ${n} prendas de ${TEST_USERS[user].email}.`);
} else {
  const fields = Array.from({ length: count }, (_, i) => randomFields(i));
  const created = await createGarments(cookie, fields);
  // Una de cada 10, archivada (para probar la vista de archivadas).
  const toArchive = created.filter((_, i) => i % 10 === 9).map((g) => g.id);
  let archived = 0;
  if (toArchive.length > 0) {
    const res = await api(cookie, "/api/garments/archive", {
      method: "POST",
      json: { ids: toArchive, archived: true },
    });
    if (res.status !== 200) throw new Error(`archive → ${res.status} ${JSON.stringify(res.body)}`);
    archived = res.body.updated;
  }
  console.log(
    `Creadas ${created.length} prendas para ${TEST_USERS[user].email} ` +
      `(${archived} archivadas; ${GARMENT_TYPES.length} tipos posibles).`,
  );
}
