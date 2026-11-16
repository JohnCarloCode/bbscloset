import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody } from "./body";
import { ApiError } from "./errors";

const schema = z.strictObject({ n: z.int().min(1) });
const req = (body: string) => new Request("http://x/", { method: "POST", body });

describe("parseBody", () => {
  it("devuelve los datos válidos", async () => {
    await expect(parseBody(req('{"n":2}'), schema)).resolves.toEqual({ n: 2 });
  });

  it("JSON roto → 400 invalid_body", async () => {
    await expect(parseBody(req("{"), schema)).rejects.toMatchObject({
      status: 400,
      code: "invalid_body",
    });
  });

  it("esquema no cumplido → 400 invalid_body con details", async () => {
    const err = await parseBody(req('{"n":0}'), schema).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "invalid_body" });
    expect((err as ApiError).details).toEqual([{ path: "n", message: expect.any(String) }]);
  });

  it("cuerpo mayor que maxBytes → 413 payload_too_large", async () => {
    const big = JSON.stringify({ n: 1, pad: "x".repeat(2000) });
    await expect(parseBody(req(big), schema, { maxBytes: 1024 })).rejects.toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
    await expect(parseBody(req('{"n":2}'), schema, { maxBytes: 1024 })).resolves.toEqual({ n: 2 });
  });
});
