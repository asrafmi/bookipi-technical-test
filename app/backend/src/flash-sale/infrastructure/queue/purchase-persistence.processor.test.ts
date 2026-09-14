import { Job } from "bullmq";
import { PurchasePersistenceProcessor } from "src/flash-sale/infrastructure/queue/purchase-persistence.processor";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { PersistPurchaseJobData } from "src/flash-sale/infrastructure/queue/purchase-persistence.job";

function buildJob(overrides: Partial<Job<PersistPurchaseJobData>> = {}): Job<PersistPurchaseJobData> {
  return {
    data: { saleId: "test-sale", identifier: "alice" },
    attemptsMade: 1,
    opts: { attempts: 3 },
    ...overrides,
  } as Job<PersistPurchaseJobData>;
}

function buildProcessor() {
  const purchaseRepository = {
    insertIfNotExists: jest.fn(),
  } as unknown as jest.Mocked<PurchaseRepository>;

  const purchaseGateway = {
    compensate: jest.fn(),
    releaseStock: jest.fn(),
  } as unknown as jest.Mocked<PurchaseGateway>;

  const processor = new PurchasePersistenceProcessor(purchaseRepository, purchaseGateway);

  return { processor, purchaseRepository, purchaseGateway };
}

describe("PurchasePersistenceProcessor", () => {
  describe("process", () => {
    it("persists the purchase decided by Redis", async () => {
      const { processor, purchaseRepository } = buildProcessor();
      purchaseRepository.insertIfNotExists.mockResolvedValue({
        id: "p1",
        saleId: "test-sale",
        identifier: "alice",
        createdAt: new Date("2026-09-09T11:00:00Z"),
      });

      await processor.process(buildJob());

      expect(purchaseRepository.insertIfNotExists).toHaveBeenCalledWith({
        saleId: "test-sale",
        identifier: "alice",
      });
    });

    it("releases the double-decremented stock slot when the row already exists, without removing the buyer", async () => {
      const { processor, purchaseRepository, purchaseGateway } = buildProcessor();
      purchaseRepository.insertIfNotExists.mockResolvedValue(null);

      await expect(processor.process(buildJob())).resolves.toBeUndefined();
      expect(purchaseGateway.releaseStock).toHaveBeenCalledWith("test-sale", "alice");
    });

    it("lets the error propagate so BullMQ retries the job", async () => {
      const { processor, purchaseRepository } = buildProcessor();
      purchaseRepository.insertIfNotExists.mockRejectedValue(new Error("connection reset"));

      await expect(processor.process(buildJob())).rejects.toThrow("connection reset");
    });
  });

  describe("onFailed", () => {
    it("does nothing while retries remain", async () => {
      const { processor, purchaseGateway } = buildProcessor();

      await processor.onFailed(buildJob({ attemptsMade: 1, opts: { attempts: 3 } }), new Error("boom"));

      expect(purchaseGateway.compensate).not.toHaveBeenCalled();
    });

    it("gives the Redis slot back once retries are exhausted", async () => {
      const { processor, purchaseGateway } = buildProcessor();

      await processor.onFailed(buildJob({ attemptsMade: 3, opts: { attempts: 3 } }), new Error("boom"));

      expect(purchaseGateway.compensate).toHaveBeenCalledWith("test-sale", "alice");
    });

    it("does nothing when the job is undefined (stalled + removeOnFail)", async () => {
      const { processor, purchaseGateway } = buildProcessor();

      await processor.onFailed(undefined, new Error("boom"));

      expect(purchaseGateway.compensate).not.toHaveBeenCalled();
    });
  });
});
