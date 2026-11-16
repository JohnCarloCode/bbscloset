import { describe, expect, it } from "vitest";
import { applyCursor, decodeCursor, encodeCursor, keysetFilter } from "./cursor";
import { ApiError } from "./errors";

const row = {
  created_at: "2026-11-16T10:20:30.123456+00:00",
  id: "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f",
};

function expectInvalid(value: string) {
  try {
    decodeCursor(value);
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
    expect((err as ApiError).code).toBe("invalid_query");
    return;
  }
  throw new Error(`"${value}" debería ser un cursor inválido`);
}

describe("encodeCursor / decodeCursor", () => {
  it("ida y vuelta", () => {
    const cursor = encodeCursor(row);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, sin relleno
    expect(decodeCursor(cursor)).toEqual(row);
  });

  it("ignora campos de más de la fila", () => {
    const cursor = encodeCursor({ ...row, name: "x" } as typeof row);
    expect(decodeCursor(cursor)).toEqual(row);
  });

  it("acepta fechas con Z", () => {
    const r = { ...row, created_at: "2026-11-16T10:20:30Z" };
    expect(decodeCursor(encodeCursor(r))).toEqual(r);
  });

  it("rechaza cursores inválidos con 400", () => {
    const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    expectInvalid("");
    expectInvalid("no-es-base64-json");
    expectInvalid(Buffer.from("{rota").toString("base64url"));
    expectInvalid(b64({ id: row.id }));
    expectInvalid(b64({ created_at: row.created_at, id: "no-uuid" }));
    expectInvalid(b64({ created_at: "ayer", id: row.id }));
    expectInvalid(b64({ created_at: row.created_at, id: `${row.id}),or(id.gt.0` }));
  });
});

describe("keysetFilter / applyCursor", () => {
  it("construye el filtro con valores entre comillas", () => {
    expect(keysetFilter(row)).toBe(
      `created_at.lt."${row.created_at}",and(created_at.eq."${row.created_at}",id.lt."${row.id}")`,
    );
  });

  it("aplica filtro y orden created_at desc, id desc", () => {
    const calls: unknown[][] = [];
    const query = {
      or(filters: string) {
        calls.push(["or", filters]);
        return query;
      },
      order(column: string, options?: { ascending?: boolean }) {
        calls.push(["order", column, options]);
        return query;
      },
    };
    applyCursor(query, row);
    expect(calls).toEqual([
      ["or", keysetFilter(row)],
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ]);

    calls.length = 0;
    applyCursor(query, null);
    expect(calls.map((c) => c[0])).toEqual(["order", "order"]);
  });
});
