import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { RedisClient } from "src/redis/redis.client";

function buildGateway() {
  const redis = {
    set: jest.fn(),
    incr: jest.fn(),
    srem: jest.fn(),
    defineCommand: jest.fn(),
  } as unknown as jest.Mocked<RedisClient>;

  const gateway = new PurchaseGateway(redis);
  return { gateway, redis };
}

describe("PurchaseGateway", () => {
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
    it("gives the stock slot back and removes the identifier from the buyers set", async () => {
      const { gateway, redis } = buildGateway();

      await gateway.compensate("sale-1", "user@example.com");

      expect(redis.incr).toHaveBeenCalledWith("sale:sale-1:stock");
      expect(redis.srem).toHaveBeenCalledWith("sale:sale-1:buyers", "user@example.com");
    });
  });
});
