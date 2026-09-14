import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { FlashSaleService } from "src/flash-sale/domain/flash-sale/flash-sale.service";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import { PurchasePersistenceQueue } from "src/flash-sale/infrastructure/queue/purchase-persistence.queue";
import { PurchaseErrorCode } from "src/flash-sale/types/purchase";
import { SaleWindowStatus } from "src/flash-sale/types/sale-status";
import { SaleRow } from "src/flash-sale/infrastructure/repository/sale/sale.entity";

function buildSale(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: "test-sale",
    productName: "Test Product",
    productDescription: "Test Description",
    totalStock: 10,
    startsAt: new Date("2026-09-09T10:00:00Z"),
    endsAt: new Date("2026-09-09T12:00:00Z"),
    soldCount: 0,
    soldCountUpdatedAt: new Date("2026-09-09T09:00:00Z"),
    ...overrides,
  };
}

function buildService() {
  const saleRepository = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<SaleRepository>;

  const purchaseRepository = {
    findByIdentifier: jest.fn(),
    count: jest.fn(),
    findIdentifiers: jest.fn().mockResolvedValue([]),
    insertIfNotExists: jest.fn(),
  } as unknown as jest.Mocked<PurchaseRepository>;

  const purchaseGateway = {
    isBootstrapped: jest.fn().mockResolvedValue(false),
    bootstrap: jest.fn(),
    attemptPurchase: jest.fn(),
    compensate: jest.fn(),
    isBuyer: jest.fn().mockResolvedValue(false),
  } as unknown as jest.Mocked<PurchaseGateway>;

  const purchasePersistenceQueue = {
    enqueue: jest.fn(),
  } as unknown as jest.Mocked<PurchasePersistenceQueue>;

  const service = new FlashSaleService(saleRepository, purchaseRepository, purchaseGateway, purchasePersistenceQueue);

  return { service, saleRepository, purchaseRepository, purchaseGateway, purchasePersistenceQueue };
}

interface FlashSaleServiceWithWindowResolver {
  resolveWindowStatus(now: Date, startsAt: Date, endsAt: Date): SaleWindowStatus;
}

describe("FlashSaleService", () => {
  describe("resolveWindowStatus (window logic)", () => {
    const { service } = buildService();
    const resolve = (service as unknown as FlashSaleServiceWithWindowResolver).resolveWindowStatus.bind(service);

    it("returns UPCOMING before startsAt", () => {
      const startsAt = new Date("2026-09-09T10:00:00Z");
      const endsAt = new Date("2026-09-09T12:00:00Z");
      const now = new Date("2026-09-09T09:59:59.999Z");
      expect(resolve(now, startsAt, endsAt)).toBe(SaleWindowStatus.UPCOMING);
    });

    it("returns ACTIVE exactly at startsAt", () => {
      const startsAt = new Date("2026-09-09T10:00:00Z");
      const endsAt = new Date("2026-09-09T12:00:00Z");
      expect(resolve(startsAt, startsAt, endsAt)).toBe(SaleWindowStatus.ACTIVE);
    });

    it("returns ACTIVE exactly at endsAt", () => {
      const startsAt = new Date("2026-09-09T10:00:00Z");
      const endsAt = new Date("2026-09-09T12:00:00Z");
      expect(resolve(endsAt, startsAt, endsAt)).toBe(SaleWindowStatus.ACTIVE);
    });

    it("returns ENDED just after endsAt", () => {
      const startsAt = new Date("2026-09-09T10:00:00Z");
      const endsAt = new Date("2026-09-09T12:00:00Z");
      const now = new Date("2026-09-09T12:00:00.001Z");
      expect(resolve(now, startsAt, endsAt)).toBe(SaleWindowStatus.ENDED);
    });
  });

  describe("getSaleStatus", () => {
    it("throws NotFoundException when the sale doesn't exist", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockResolvedValue(undefined);

      await expect(service.getSaleStatus("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("computes stockRemaining as totalStock minus the stored soldCount", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 10, soldCount: 3 }));

      const status = await service.getSaleStatus("test-sale");

      expect(status.stockRemaining).toBe(7);
      expect(status.totalStock).toBe(10);
    });

    it("never reports negative stockRemaining, even if soldCount exceeds totalStock", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 5, soldCount: 9 }));

      const status = await service.getSaleStatus("test-sale");

      expect(status.stockRemaining).toBe(0);
    });

    it("reports the window status alongside stock", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockResolvedValue(
        buildSale({ startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 7200_000) }),
      );

      const status = await service.getSaleStatus("test-sale");

      expect(status.status).toBe(SaleWindowStatus.UPCOMING);
    });

    it("throws InternalServerErrorException when the sale lookup rejects unexpectedly", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockRejectedValue(new Error("connection reset"));

      await expect(service.getSaleStatus("test-sale")).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe("attemptPurchase", () => {
    it("throws NotFoundException when the sale doesn't exist", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockResolvedValue(undefined);

      await expect(service.attemptPurchase("missing", "alice")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws InternalServerErrorException when the sale lookup rejects unexpectedly", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockRejectedValue(new Error("connection reset"));

      await expect(service.attemptPurchase("test-sale", "alice")).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it("bootstraps the gateway from sale.soldCount and prior identifiers when not yet bootstrapped", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway, purchasePersistenceQueue } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 10, soldCount: 4 }));
      purchaseGateway.isBootstrapped.mockResolvedValue(false);
      purchaseRepository.findIdentifiers.mockResolvedValue(["alice", "bob"]);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchasePersistenceQueue.enqueue.mockResolvedValue(undefined);

      await service.attemptPurchase("test-sale", "alice");

      expect(purchaseGateway.bootstrap).toHaveBeenCalledWith("test-sale", 10, 4, ["alice", "bob"]);
    });

    it("throws InternalServerErrorException when fetching prior identifiers for bootstrap fails", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.isBootstrapped.mockResolvedValue(false);
      purchaseRepository.findIdentifiers.mockRejectedValue(new Error("connection reset"));

      await expect(service.attemptPurchase("test-sale", "alice")).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it("skips bootstrap entirely (no DB touched) once the sale is already bootstrapped", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway, purchasePersistenceQueue } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 10 }));
      purchaseGateway.isBootstrapped.mockResolvedValue(true);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchasePersistenceQueue.enqueue.mockResolvedValue(undefined);

      await service.attemptPurchase("test-sale", "alice");

      expect(purchaseRepository.count).not.toHaveBeenCalled();
      expect(purchaseRepository.findIdentifiers).not.toHaveBeenCalled();
      expect(purchaseGateway.bootstrap).not.toHaveBeenCalled();
    });

    it("returns accepted:true and enqueues the durable write on success", async () => {
      const { service, saleRepository, purchaseGateway, purchasePersistenceQueue } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchasePersistenceQueue.enqueue.mockResolvedValue(undefined);

      const result = await service.attemptPurchase("test-sale", "alice");

      expect(result).toEqual({ accepted: true, identifier: "alice", purchasedAt: expect.any(String) });
      expect(purchasePersistenceQueue.enqueue).toHaveBeenCalledWith({ saleId: "test-sale", identifier: "alice" });
    });

    it.each([
      PurchaseErrorCode.SALE_NOT_STARTED,
      PurchaseErrorCode.SALE_ENDED,
      PurchaseErrorCode.SOLD_OUT,
      PurchaseErrorCode.ALREADY_PURCHASED,
    ])("propagates a %s rejection from the gateway without enqueueing a persistence job", async (code) => {
      const { service, saleRepository, purchaseGateway, purchasePersistenceQueue } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: false, code });

      const result = await service.attemptPurchase("test-sale", "alice");

      expect(result).toEqual({ accepted: false, code, message: expect.any(String) });
      expect(purchasePersistenceQueue.enqueue).not.toHaveBeenCalled();
    });

    it("compensates the gateway and returns TEMPORARY_FAILURE when enqueueing the persistence job fails", async () => {
      const { service, saleRepository, purchaseGateway, purchasePersistenceQueue } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchasePersistenceQueue.enqueue.mockRejectedValue(new Error("redis connection reset"));

      const result = await service.attemptPurchase("test-sale", "alice");

      expect(purchaseGateway.compensate).toHaveBeenCalledWith("test-sale", "alice");
      expect(result).toEqual({
        accepted: false,
        code: PurchaseErrorCode.TEMPORARY_FAILURE,
        message: expect.any(String),
      });
    });
  });

  describe("checkPurchaseStatus", () => {
    it("returns NOT_PURCHASED when no purchase record exists and the identifier isn't a Redis buyer", async () => {
      const { service, purchaseRepository, purchaseGateway } = buildService();
      purchaseRepository.findByIdentifier.mockResolvedValue(undefined);
      purchaseGateway.isBuyer.mockResolvedValue(false);

      const result = await service.checkPurchaseStatus("test-sale", "bob");

      expect(result).toEqual({
        accepted: false,
        code: PurchaseErrorCode.NOT_PURCHASED,
        message: expect.any(String),
      });
    });

    it("returns PURCHASE_PENDING when no row exists yet but Redis already holds the slot", async () => {
      const { service, purchaseRepository, purchaseGateway } = buildService();
      purchaseRepository.findByIdentifier.mockResolvedValue(undefined);
      purchaseGateway.isBuyer.mockResolvedValue(true);

      const result = await service.checkPurchaseStatus("test-sale", "bob");

      expect(result).toEqual({
        accepted: false,
        code: PurchaseErrorCode.PURCHASE_PENDING,
        message: expect.any(String),
      });
    });

    it("throws InternalServerErrorException when checking Redis buyer status rejects unexpectedly", async () => {
      const { service, purchaseRepository, purchaseGateway } = buildService();
      purchaseRepository.findByIdentifier.mockResolvedValue(undefined);
      purchaseGateway.isBuyer.mockRejectedValue(new Error("redis down"));

      await expect(service.checkPurchaseStatus("test-sale", "bob")).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it("returns the purchase record when one exists, without checking Redis", async () => {
      const { service, purchaseRepository, purchaseGateway } = buildService();
      const createdAt = new Date("2026-09-09T11:00:00Z");
      purchaseRepository.findByIdentifier.mockResolvedValue({
        id: "p1",
        saleId: "test-sale",
        identifier: "bob",
        createdAt,
      });

      const result = await service.checkPurchaseStatus("test-sale", "bob");

      expect(result).toEqual({ accepted: true, identifier: "bob", purchasedAt: createdAt.toISOString() });
      expect(purchaseGateway.isBuyer).not.toHaveBeenCalled();
    });

    it("throws InternalServerErrorException when the lookup rejects unexpectedly", async () => {
      const { service, purchaseRepository } = buildService();
      purchaseRepository.findByIdentifier.mockRejectedValue(new Error("connection reset"));

      await expect(service.checkPurchaseStatus("test-sale", "bob")).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
