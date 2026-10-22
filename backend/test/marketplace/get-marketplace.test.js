import crypto from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  setupMarketplaceTest,
  unauthorizedCases,
} from "./helper.js";

describe("get /marketplaces/:id", () => {
  const ctx = setupMarketplaceTest();
  const { send, createMarketplace } = ctx;

  test("should can get marketplace by id", async () => {
    const other = await createMarketplace("mp_other");

    const result = await send("get", `/marketplaces/${ctx.target.id}`);

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(ctx.target);
    expect(result.body.data.id).not.toBe(other.id);
  });

  test("should return marketplace not found", async () => {
    const result = await send("get", `/marketplaces/${crypto.randomUUID()}`);

    expect(result.status).toBe(404);
    expect(result.body.errors).toBe("MARKETPLACE_NOT_FOUND");
  });

  test("should return 400 when id is not a uuid", async () => {
    const result = await send("get", "/marketplaces/bukan-uuid");

    expect(result.status).toBe(400);
  });

  test.each(unauthorizedCases)(
    "should return unauthorized when %s",
    async (_label, buildAuthorization) => {
      const result = await send("get", `/marketplaces/${ctx.target.id}`, {
        authorization: buildAuthorization(ctx.accessToken),
      });

      expect(result.status).toBe(401);
      expect(result.body.errors).toBe("UNAUTHORIZED");
    },
  );
});
