// Tests del nombre del PNG y de la elección compartir / descargar / abrir (plan 6.2).
import { describe, expect, it } from "vitest";
import { exportFileName, isoDay, pickSaveMethod, slugify, type SaveEnv } from "./download";

const DAY = new Date(2026, 10, 7, 23, 30); // 7 nov 2026, hora local

describe("exportFileName", () => {
  it("usa el nombre del favorito saneado y la proporción", () => {
    expect(exportFileName("Cena del viernes", DAY, "4:5")).toBe(
      "bbs-closet-cena-del-viernes-4x5.png",
    );
    expect(exportFileName("Cena del viernes", DAY, "1:1")).toBe(
      "bbs-closet-cena-del-viernes-1x1.png",
    );
    expect(exportFileName("Cena del viernes", DAY, "9:16")).toBe(
      "bbs-closet-cena-del-viernes-9x16.png",
    );
  });

  it("quita acentos, símbolos, barras y espacios sobrantes", () => {
    expect(exportFileName("  Año nuevo: ¡Fiesta!  ", DAY, "4:5")).toBe(
      "bbs-closet-ano-nuevo-fiesta-4x5.png",
    );
    expect(exportFileName("../etc/passwd", DAY, "1:1")).toBe("bbs-closet-etc-passwd-1x1.png");
    expect(exportFileName("Été · Straße 👗", DAY, "1:1")).toBe("bbs-closet-ete-strasse-1x1.png");
  });

  it("sin nombre, o si no queda nada al sanearlo, usa la fecha", () => {
    expect(exportFileName(null, DAY, "4:5")).toBe("bbs-closet-2026-11-07-4x5.png");
    expect(exportFileName("", DAY, "4:5")).toBe("bbs-closet-2026-11-07-4x5.png");
    expect(exportFileName("👗✨", DAY, "9:16")).toBe("bbs-closet-2026-11-07-9x16.png");
  });

  it("recorta nombres muy largos sin dejar guion al final", () => {
    const slug = slugify("a".repeat(39) + " bbbbbb");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("la fecha es local y con ceros", () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("pickSaveMethod", () => {
  const base: SaveEnv = { canShareFiles: false, coarse: false, ios: false, anchorDownload: true };

  it("escritorio: descarga, aunque sepa compartir", () => {
    expect(pickSaveMethod(base)).toBe("download");
    expect(pickSaveMethod({ ...base, canShareFiles: true })).toBe("download");
  });

  it("móvil o iOS con compartir archivos: hoja de compartir", () => {
    expect(pickSaveMethod({ ...base, coarse: true, canShareFiles: true })).toBe("share");
    expect(pickSaveMethod({ ...base, ios: true, coarse: true, canShareFiles: true })).toBe("share");
    // iPad con teclado y ratón.
    expect(pickSaveMethod({ ...base, ios: true, canShareFiles: true })).toBe("share");
  });

  it("Android sin compartir archivos: descarga", () => {
    expect(pickSaveMethod({ ...base, coarse: true })).toBe("download");
  });

  it("iOS viejo sin compartir archivos, o sin <a download>: pestaña nueva", () => {
    expect(pickSaveMethod({ ...base, ios: true, coarse: true })).toBe("open");
    expect(pickSaveMethod({ ...base, anchorDownload: false })).toBe("open");
  });
});
