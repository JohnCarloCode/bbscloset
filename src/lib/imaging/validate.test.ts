import { describe, expect, it } from "vitest";
import { checkFile, isHeic, MAX_IMAGE_BYTES } from "./validate";

describe("checkFile", () => {
  const ok = { name: "foto.jpg", type: "image/jpeg", size: 2_000_000 };

  it("acepta imágenes de hasta 10 MB", () => {
    expect(checkFile(ok)).toBeNull();
    expect(checkFile({ ...ok, size: MAX_IMAGE_BYTES })).toBeNull();
    expect(checkFile({ name: "a.png", type: "image/png", size: 1 })).toBeNull();
  });

  it("rechaza lo que no es imagen", () => {
    expect(checkFile({ name: "doc.pdf", type: "application/pdf", size: 10 })).toBe("not_image");
    expect(checkFile({ name: "video.mp4", type: "video/mp4", size: 10 })).toBe("not_image");
    expect(checkFile({ name: "sin-tipo", type: "", size: 10 })).toBe("not_image");
  });

  it("acepta HEIC aunque el navegador no dé tipo", () => {
    expect(checkFile({ name: "IMG_0001.HEIC", type: "", size: 10 })).toBeNull();
    expect(checkFile({ name: "x.heic", type: "image/heic", size: 10 })).toBeNull();
  });

  it("rechaza más de 10 MB y archivos vacíos", () => {
    expect(checkFile({ ...ok, size: MAX_IMAGE_BYTES + 1 })).toBe("too_large");
    expect(checkFile({ ...ok, size: 0 })).toBe("decode_failed");
  });
});

describe("isHeic", () => {
  it("por tipo o por extensión", () => {
    expect(isHeic({ name: "a.jpg", type: "image/heic" })).toBe(true);
    expect(isHeic({ name: "a.heif", type: "" })).toBe(true);
    expect(isHeic({ name: "a.jpg", type: "image/jpeg" })).toBe(false);
  });
});
