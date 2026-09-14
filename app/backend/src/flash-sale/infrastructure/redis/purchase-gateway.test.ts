import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { RedisClient } from "src/redis/redis.client";

function buildGateway() {
  const multiExec = jest.fn().mockResolvedValue([]);
  const multi = {
    set: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    exec: multiExec,
  };
  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    incr: jest.fn(),
    srem: jest.fn(),
    sadd: jest.fn(),
    sismember: jest.fn(),
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
    it("seeds the stock counter with SET ... NX and rebuilds the buyers set, atomically via MULTI", async () => {
      const { gateway, multi } = buildGateway();

      await gateway.bootstrap("sale-1", 100, 3, ["alice", "bob"]);

      // One round trip, not an EXISTS-then-SET pair — that would race.
      expect(multi.set).toHaveBeenCalledTimes(1);
      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock", 97, "NX");
      expect(multi.sadd).toHaveBeenCalledWith("sale:sale-1:buyers", ["alice", "bob"]);
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });

    it("floors the seeded stock at zero when purchased count exceeds total stock", async () => {
      const { gateway, multi } = buildGateway();

      await gateway.bootstrap("sale-1", 10, 15, []);

      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock", 0, "NX");
    });

    it("issues the NX SET unconditionally — no EXISTS check up front", async () => {
      const { gateway, multi } = buildGateway();

      await gateway.bootstrap("sale-1", 50, 0, []);

      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock", 50, "NX");
    });

    it("skips SADD when there are no prior identifiers to rebuild", async () => {
      const { gateway, multi } = buildGateway();

      await gateway.bootstrap("sale-1", 50, 0, []);

      expect(multi.sadd).not.toHaveBeenCalled();
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

  describe("releaseStock", () => {
    it("gives the stock slot back, keeps the identifier in the buyers set, and bumps the marker — atomically via MULTI", async () => {
      const { gateway, redis, multi } = buildGateway();

      await gateway.releaseStock("sale-1", "user@example.com");

      expect(redis.multi).toHaveBeenCalledTimes(1);
      expect(multi.incr).toHaveBeenCalledWith("sale:sale-1:stock");
      expect(multi.sadd).toHaveBeenCalledWith("sale:sale-1:buyers", "user@example.com");
      expect(multi.set).toHaveBeenCalledWith("sale:sale-1:stock:updatedAt", expect.any(Number));
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });

    it("never calls SREM — the identifier genuinely did purchase", async () => {
      const { gateway, redis } = buildGateway();

      await gateway.releaseStock("sale-1", "user@example.com");

      expect(redis.srem).not.toHaveBeenCalled();
    });
  });

  describe("isBuyer", () => {
    it("returns true when the identifier is in the buyers set", async () => {
      const { gateway, redis } = buildGateway();
      redis.sismember.mockResolvedValue(1);

      await expect(gateway.isBuyer("sale-1", "user@example.com")).resolves.toBe(true);
      expect(redis.sismember).toHaveBeenCalledWith("sale:sale-1:buyers", "user@example.com");
    });

    it("returns false when the identifier isn't in the buyers set", async () => {
      const { gateway, redis } = buildGateway();
      redis.sismember.mockResolvedValue(0);

      await expect(gateway.isBuyer("sale-1", "user@example.com")).resolves.toBe(false);
    });
  });

  describe("acquireReconcileLock", () => {
    it("returns true when the lock is acquired", async () => {
      const { gateway, redis } = buildGateway();
      redis.set.mockResolvedValue("OK");

      await expect(gateway.acquireReconcileLock("sale-1", 300_000)).resolves.toBe(true);
      expect(redis.set).toHaveBeenCalledWith("reconcile:lock:sale-1", "1", "PX", 300_000, "NX");
    });

    it("returns false when another instance already holds the lock", async () => {
      const { gateway, redis } = buildGateway();
      redis.set.mockResolvedValue(null as unknown as "OK");

      await expect(gateway.acquireReconcileLock("sale-1", 300_000)).resolves.toBe(false);
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
