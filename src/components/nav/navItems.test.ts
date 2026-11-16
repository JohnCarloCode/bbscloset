import { describe, expect, it } from "vitest";
import { activeNavKey, SIDEBAR_ITEMS, TAB_ITEMS } from "./navItems";

describe("activeNavKey", () => {
  it("marca la pestaña de la ruta y de sus subrutas", () => {
    expect(activeNavKey("/catalog", TAB_ITEMS)).toBe("catalog");
    expect(activeNavKey("/dresser", TAB_ITEMS)).toBe("dresser");
    expect(activeNavKey("/favorites/abc", TAB_ITEMS)).toBe("favorites");
    expect(activeNavKey("/settings", SIDEBAR_ITEMS)).toBe("settings");
  });

  it("en Recortar fotos marca Ajustes en la barra inferior y su entrada en la lateral", () => {
    expect(activeNavKey("/cutout", TAB_ITEMS)).toBe("settings");
    expect(activeNavKey("/cutout", SIDEBAR_ITEMS)).toBe("cutout");
  });

  it("no confunde prefijos ni marca rutas ajenas", () => {
    expect(activeNavKey("/catalogue", TAB_ITEMS)).toBeNull();
    expect(activeNavKey("/login", TAB_ITEMS)).toBeNull();
  });
});
