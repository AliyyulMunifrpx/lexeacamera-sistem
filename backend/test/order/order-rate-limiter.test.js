import express from "express";
import supertest from "supertest";
import { describe, expect, test } from "vitest";
import { createOrderLimiter } from "../../src/middleware/order-limiter.js";

describe("order rate limiter", () => {
  const buildApp = (options) => {
    const app = express();
    app.post("/orders", createOrderLimiter(options), (req, res) => {
      res.status(201).json({ data: "ok" });
    });
    return app;
  };

  test("should return 429 after the limit is reached", async () => {
    const app = buildApp({ limit: 2, skip: () => false });

    const first = await supertest(app).post("/orders");
    const second = await supertest(app).post("/orders");
    const third = await supertest(app).post("/orders");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(third.body.errors).toBe("TOO_MANY_REQUESTS");
  });

  test("should not limit when skip is true (as in the test environment)", async () => {
    const app = buildApp({ limit: 1, skip: () => true });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => supertest(app).post("/orders")),
    );

    expect(results.map((result) => result.status)).toEqual([
      201, 201, 201, 201, 201,
    ]);
  });

  test("should skip the limiter by default when NODE_ENV is test", async () => {
    const app = buildApp({ limit: 1 });

    const first = await supertest(app).post("/orders");
    const second = await supertest(app).post("/orders");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });
});
