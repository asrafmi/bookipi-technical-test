import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { RedisClient } from "src/redis/redis.client";

function buildGateway() {
  const multiExec = jest.fn().mockResolvedValue([]);
  const multi = {
    set: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    exec: multiExec,
  };
  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    incr: jest.fn(),
    srem: jest.fn(),
    exists: jest.fn(),
    defineCommand: jest.fn(),
    multi: jest.fn().mockReturnValue(multi),
  } as unknown as jest.Mocked<RedisClient>;

  const gateway = new PurchaseGateway(redis);
  return { gateway, redis, multi };
}

describe("PurchaseGateway", () => {
  describe("isBootstrapped", () => {
    it("returns true when the stock key exists", async () => {
      const { gateway, redis } = buildGateway();
      redis.exists.mockResolvedValue(1);

      await expect(gateway.isBootstrapped("sale-1")).resolves.toBe(true);
      expect(redis.exists).toHaveBeenCalledWith("sale:sale-1:stock");
    });

    it("returns false when the stock key doesn't exist", async () => {
      const { gateway, redis } = buildGateway();
      redis.exists.mockResolvedValue(0);

      await expect(gateway.isBootstrapped("sale-1")).resolves.toBe(false);
    });
  });

  describe("bootstrap", () => {
    it("seeds the stock counter with a single atomic SET ... NX call", async () => {
      const { gateway, redis } = buildGateway();

      await gateway.bootstrap("sale-1", 100, 3);

      // One round trip, not an EXISTS-then-SET pair — that would race.
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith("sale:sale-1:stock", 97, "NX");
    });

    it("floors the seeded stock at zero when purchased count exceeds total stock", async () => {
      const { gateway, redis } = buildGateway();

      await gateway.bootstrap("sale-1", 10, 15);

      expect(redis.set).toHaveBeenCalledWith("sale:sale-1:stock", 0, "NX");
    });

    it("issues the NX SET unconditionally — no EXISTS check up front", async () => {
      const { gateway, redis } = buildGateway();

      await gateway.bootstrap("sale-1", 50, 0);

      expect(redis.set).toHaveBeenCalledWith("sale:sale-1:stock", 50, "NX");
    });
  });

  describe("compensate", () => {
    it("gives the stock slot back, removes the identifier, and bumps the updatedAt marker — atomically via MULTI", async () => {
      const { gateway, redis, multi } = buildGateway();

      await gateway.compensate("sale-1", "user@example.com");

      expect(redis.multi).toHaveBeenCalledTimes(1);
      expect(multi.incr).toHaveBeenCalledWith("sale:sale-1:stock");
      expect(multi.srem).toHaveBeenCalledWith("sale:sale-1:buyers", "user@example.com");
      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock:updatedAt", expect.any(Number));
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStockSnapshot", () => {
    it("returns the stock and updatedAt marker when both exist", async () => {
      const { gateway, redis } = buildGateway();
      redis.get.mockResolvedValueOnce("42").mockResolvedValueOnce("1700000000000");

      const snapshot = await gateway.getStockSnapshot("sale-1");

      expect(snapshot).toEqual({ stockRemaining: 42, updatedAt: new Date(1700000000000) });
      expect(redis.get).toHaveBeenCalledWith("sale:sale-1:stock");
      expect(redis.get).toHaveBeenCalledWith("sale:sale-1:stock:updatedAt");
    });

    it("returns nulls when neither key exists (cold start)", async () => {
      const { gateway, redis } = buildGateway();
      redis.get.mockResolvedValue(null);

      const snapshot = await gateway.getStockSnapshot("sale-1");

      expect(snapshot).toEqual({ stockRemaining: null, updatedAt: null });
    });
  });

  describe("overwriteStock", () => {
    it("sets the stock counter and updatedAt marker atomically via MULTI", async () => {
      const { gateway, redis, multi } = buildGateway();
      const updatedAt = new Date("2026-09-14T00:00:00Z");

      await gateway.overwriteStock("sale-1", 100, 30, updatedAt);

      expect(redis.multi).toHaveBeenCalledTimes(1);
      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock", 70);
      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock:updatedAt", updatedAt.getTime());
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });

    it("floors the stock at zero when soldCount exceeds totalStock", async () => {
      const { gateway, multi } = buildGateway();

      await gateway.overwriteStock("sale-1", 10, 15, new Date());

      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock", 0);
    });
  });
});
