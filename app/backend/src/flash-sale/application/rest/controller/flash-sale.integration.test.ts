import "reflect-metadata";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import request, { Response } from "supertest";
import { eq } from "drizzle-orm";
import { AppModule } from "src/app.module";
import { DRIZZLE_CLIENT } from "src/db/database.module";
import { DrizzleClient } from "src/db/client";
import { REDIS_CLIENT } from "src/redis/redis.module";
import { RedisClient } from "src/redis/redis.client";
import { purchases, sales } from "src/db/schema";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";
import { SaleWindowStatus } from "src/flash-sale/types/sale-status";

// Hits a real, running NestJS app backed by real Postgres and Redis (started via
// `npm run docker:up` from app/backend). Per section 4.3: mocking Redis here would
// defeat the point of this layer — the atomic decision only means something when
// exercised through the real Lua script + real DB unique constraint.
describe("FlashSaleController (integration)", () => {
  let app: INestApplication;
  let db: DrizzleClient;
  let redis: RedisClient;

  const HOUR = 60 * 60 * 1000;

  async function seedSale(overrides: Partial<typeof sales.$inferInsert> = {}) {
    const id = overrides.id ?? `test-sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    const [sale] = await db
      .insert(sales)
      .values({
        productName: "Integration Test Product",
        productDescription: "Seeded for integration tests",
        totalStock: 5,
        startsAt: new Date(now - HOUR),
        endsAt: new Date(now + HOUR),
        ...overrides,
        id,
      })
      .returning();
    return sale;
  }

  async function cleanupSale(saleId: string) {
    await db.delete(purchases).where(eq(purchases.saleId, saleId));
    await db.delete(sales).where(eq(sales.id, saleId));
    await redis.del(`sale:${saleId}:stock`, `sale:${saleId}:buyers`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    // Mirrors main.ts's bootstrap() — the testing module doesn't run bootstrap(),
    // so the global ValidationPipe must be wired up here too, or DTO validation
    // (and its 400 responses) silently never runs against this test instance.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await (app as NestFastifyApplication).getHttpAdapter().getInstance().ready();

    db = moduleRef.get<DrizzleClient>(DRIZZLE_CLIENT);
    redis = moduleRef.get<RedisClient>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /v1/flash-sale/:saleId/status", () => {
    it("returns 404 for an unknown sale", async () => {
      const res = await request(app.getHttpServer()).get("/v1/flash-sale/does-not-exist/status");
      expect(res.status).toBe(404);
    });

    it("reports ACTIVE with remaining stock for a sale within its window", async () => {
      const sale = await seedSale({ totalStock: 3 });
      try {
        const res = await request(app.getHttpServer()).get(`/v1/flash-sale/${sale.id}/status`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          status: SaleWindowStatus.ACTIVE,
          totalStock: 3,
          stockRemaining: 3,
        });
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("reports UPCOMING before startsAt and ENDED after endsAt", async () => {
      const upcoming = await seedSale({
        startsAt: new Date(Date.now() + HOUR),
        endsAt: new Date(Date.now() + 2 * HOUR),
      });
      const ended = await seedSale({
        startsAt: new Date(Date.now() - 2 * HOUR),
        endsAt: new Date(Date.now() - HOUR),
      });
      try {
        const upcomingRes = await request(app.getHttpServer()).get(`/v1/flash-sale/${upcoming.id}/status`);
        expect(upcomingRes.body.status).toBe(SaleWindowStatus.UPCOMING);

        const endedRes = await request(app.getHttpServer()).get(`/v1/flash-sale/${ended.id}/status`);
        expect(endedRes.body.status).toBe(SaleWindowStatus.ENDED);
      } finally {
        await cleanupSale(upcoming.id);
        await cleanupSale(ended.id);
      }
    });
  });

  describe("POST /v1/flash-sale/:saleId/purchase", () => {
    it("accepts a purchase within the window and persists it durably", async () => {
      const sale = await seedSale({ totalStock: 5 });
      try {
        const res = await request(app.getHttpServer())
          .post(`/v1/flash-sale/${sale.id}/purchase`)
          .send({ identifier: "alice@example.com" });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ accepted: true, identifier: "alice@example.com" });
        expect(res.body.purchasedAt).toBeDefined();

        const row = await db.query.purchases.findFirst({
          where: eq(purchases.saleId, sale.id),
        });
        expect(row?.identifier).toBe("alice@example.com");
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("rejects with SALE_NOT_STARTED (403) before the window opens", async () => {
      const sale = await seedSale({
        startsAt: new Date(Date.now() + HOUR),
        endsAt: new Date(Date.now() + 2 * HOUR),
      });
      try {
        const res = await request(app.getHttpServer())
          .post(`/v1/flash-sale/${sale.id}/purchase`)
          .send({ identifier: "bob@example.com" });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe(PurchaseErrorCode.SALE_NOT_STARTED);
        expect(res.body.accepted).toBe(false);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("rejects with SALE_ENDED (410) after the window closes", async () => {
      const sale = await seedSale({
        startsAt: new Date(Date.now() - 2 * HOUR),
        endsAt: new Date(Date.now() - HOUR),
      });
      try {
        const res = await request(app.getHttpServer())
          .post(`/v1/flash-sale/${sale.id}/purchase`)
          .send({ identifier: "carol@example.com" });

        expect(res.status).toBe(410);
        expect(res.body.code).toBe(PurchaseErrorCode.SALE_ENDED);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("rejects a second purchase by the same identifier with ALREADY_PURCHASED (409) — idempotent retry", async () => {
      const sale = await seedSale({ totalStock: 5 });
      try {
        const first = await request(app.getHttpServer())
          .post(`/v1/flash-sale/${sale.id}/purchase`)
          .send({ identifier: "dave@example.com" });
        expect(first.status).toBe(200);
        expect(first.body.accepted).toBe(true);

        const second = await request(app.getHttpServer())
          .post(`/v1/flash-sale/${sale.id}/purchase`)
          .send({ identifier: "dave@example.com" });
        expect(second.status).toBe(409);
        expect(second.body.code).toBe(PurchaseErrorCode.ALREADY_PURCHASED);

        const rows = await db.query.purchases.findMany({ where: eq(purchases.saleId, sale.id) });
        expect(rows).toHaveLength(1);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("rejects with SOLD_OUT (409) once stock is exhausted, and never lets stock go negative", async () => {
      const sale = await seedSale({ totalStock: 2 });
      try {
        const buyers = ["u1@example.com", "u2@example.com", "u3@example.com"];
        const results = await Promise.all(
          buyers.map((identifier) =>
            request(app.getHttpServer()).post(`/v1/flash-sale/${sale.id}/purchase`).send({ identifier }),
          ),
        );

        const accepted = results.filter((r: Response) => r.body.accepted === true);
        const soldOut = results.filter((r: Response) => r.body.code === PurchaseErrorCode.SOLD_OUT);

        expect(accepted).toHaveLength(2);
        expect(soldOut).toHaveLength(1);
        expect(soldOut[0].status).toBe(409);

        const stockKey = `sale:${sale.id}:stock`;
        const remaining = await redis.get(stockKey);
        expect(Number(remaining)).toBe(0);

        const rows = await db.query.purchases.findMany({ where: eq(purchases.saleId, sale.id) });
        expect(rows).toHaveLength(2);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("oversell test: N concurrent distinct users against stock S yields exactly S successes", async () => {
      const stock = 5;
      const concurrentUsers = 30;
      const sale = await seedSale({ totalStock: stock });
      try {
        const identifiers = Array.from({ length: concurrentUsers }, (_, i) => `race-user-${i}@example.com`);
        const results = await Promise.all(
          identifiers.map((identifier) =>
            request(app.getHttpServer()).post(`/v1/flash-sale/${sale.id}/purchase`).send({ identifier }),
          ),
        );

        const accepted = results.filter((r: Response) => r.body.accepted === true);
        const soldOut = results.filter((r: Response) => r.body.code === PurchaseErrorCode.SOLD_OUT);

        expect(accepted).toHaveLength(stock);
        expect(soldOut).toHaveLength(concurrentUsers - stock);

        const remaining = await redis.get(`sale:${sale.id}:stock`);
        expect(Number(remaining)).toBe(0);

        const rows = await db.query.purchases.findMany({ where: eq(purchases.saleId, sale.id) });
        expect(rows).toHaveLength(stock);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("duplicate-user test: one identifier firing many concurrent requests yields exactly one success", async () => {
      const sale = await seedSale({ totalStock: 5 });
      try {
        const identifier = "concurrent-dave@example.com";
        const results = await Promise.all(
          Array.from({ length: 10 }, () =>
            request(app.getHttpServer()).post(`/v1/flash-sale/${sale.id}/purchase`).send({ identifier }),
          ),
        );

        const accepted = results.filter((r: Response) => r.body.accepted === true);
        const alreadyPurchased = results.filter((r: Response) => r.body.code === PurchaseErrorCode.ALREADY_PURCHASED);

        expect(accepted).toHaveLength(1);
        expect(alreadyPurchased).toHaveLength(9);

        const rows = await db.query.purchases.findMany({ where: eq(purchases.saleId, sale.id) });
        expect(rows).toHaveLength(1);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("rejects malformed request bodies with a 400", async () => {
      const sale = await seedSale();
      try {
        const res = await request(app.getHttpServer()).post(`/v1/flash-sale/${sale.id}/purchase`).send({});
        expect(res.status).toBe(400);
      } finally {
        await cleanupSale(sale.id);
      }
    });
  });

  describe("GET /v1/flash-sale/:saleId/purchase/:identifier", () => {
    it("returns NOT_PURCHASED for an identifier with no purchase", async () => {
      const sale = await seedSale();
      try {
        const res = await request(app.getHttpServer()).get(`/v1/flash-sale/${sale.id}/purchase/nobody@example.com`);
        expect(res.status).toBe(200);
        expect(res.body.accepted).toBe(false);
        expect(res.body.code).toBe(PurchaseErrorCode.NOT_PURCHASED);
      } finally {
        await cleanupSale(sale.id);
      }
    });

    it("returns the purchase record for an identifier that did purchase", async () => {
      const sale = await seedSale({ totalStock: 5 });
      try {
        await request(app.getHttpServer())
          .post(`/v1/flash-sale/${sale.id}/purchase`)
          .send({ identifier: "erin@example.com" });

        const res = await request(app.getHttpServer()).get(`/v1/flash-sale/${sale.id}/purchase/erin@example.com`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ accepted: true, identifier: "erin@example.com" });
        expect(res.body.purchasedAt).toBeDefined();
      } finally {
        await cleanupSale(sale.id);
      }
    });
  });
});
