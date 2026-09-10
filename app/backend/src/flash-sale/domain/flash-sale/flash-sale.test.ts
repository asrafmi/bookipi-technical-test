import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { FlashSaleService } from "src/flash-sale/domain/flash-sale/flash-sale.service";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
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
    insertIfNotExists: jest.fn(),
  } as unknown as jest.Mocked<PurchaseRepository>;

  const purchaseGateway = {
    bootstrap: jest.fn(),
    attemptPurchase: jest.fn(),
    compensate: jest.fn(),
  } as unknown as jest.Mocked<PurchaseGateway>;

  const service = new FlashSaleService(saleRepository, purchaseRepository, purchaseGateway);

  return { service, saleRepository, purchaseRepository, purchaseGateway };
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

    it("computes stockRemaining as totalStock minus purchased count", async () => {
      const { service, saleRepository, purchaseRepository } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 10 }));
      purchaseRepository.count.mockResolvedValue(3);

      const status = await service.getSaleStatus("test-sale");

      expect(status.stockRemaining).toBe(7);
      expect(status.totalStock).toBe(10);
    });

    it("never reports negative stockRemaining, even if purchased count exceeds totalStock", async () => {
      const { service, saleRepository, purchaseRepository } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 5 }));
      purchaseRepository.count.mockResolvedValue(9);

      const status = await service.getSaleStatus("test-sale");

      expect(status.stockRemaining).toBe(0);
    });

    it("reports the window status alongside stock", async () => {
      const { service, saleRepository, purchaseRepository } = buildService();
      saleRepository.findById.mockResolvedValue(
        buildSale({ startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 7200_000) }),
      );
      purchaseRepository.count.mockResolvedValue(0);

      const status = await service.getSaleStatus("test-sale");

      expect(status.status).toBe(SaleWindowStatus.UPCOMING);
    });

    it("throws InternalServerErrorException when the sale lookup rejects unexpectedly", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findById.mockRejectedValue(new Error("connection reset"));

      await expect(service.getSaleStatus("test-sale")).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it("throws InternalServerErrorException when the purchase count query rejects unexpectedly", async () => {
      const { service, saleRepository, purchaseRepository } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseRepository.count.mockRejectedValue(new Error("connection reset"));

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

    it("throws InternalServerErrorException when the purchase count query rejects unexpectedly", async () => {
      const { service, saleRepository, purchaseRepository } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseRepository.count.mockRejectedValue(new Error("connection reset"));

      await expect(service.attemptPurchase("test-sale", "alice")).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it("bootstraps the gateway with the correct stock before attempting", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale({ totalStock: 10 }));
      purchaseRepository.count.mockResolvedValue(4);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchaseRepository.insertIfNotExists.mockResolvedValue({
        id: "p1",
        saleId: "test-sale",
        identifier: "alice",
        createdAt: new Date("2026-09-09T11:00:00Z"),
      });

      await service.attemptPurchase("test-sale", "alice");

      expect(purchaseGateway.bootstrap).toHaveBeenCalledWith("test-sale", 10, 4);
    });

    it("returns accepted:true with the persisted purchase on success", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseRepository.count.mockResolvedValue(0);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      const createdAt = new Date("2026-09-09T11:00:00Z");
      purchaseRepository.insertIfNotExists.mockResolvedValue({
        id: "p1",
        saleId: "test-sale",
        identifier: "alice",
        createdAt,
      });

      const result = await service.attemptPurchase("test-sale", "alice");

      expect(result).toEqual({ accepted: true, identifier: "alice", purchasedAt: createdAt.toISOString() });
    });

    it.each([
      PurchaseErrorCode.SALE_NOT_STARTED,
      PurchaseErrorCode.SALE_ENDED,
      PurchaseErrorCode.SOLD_OUT,
      PurchaseErrorCode.ALREADY_PURCHASED,
    ])("propagates a %s rejection from the gateway without touching the repository", async (code) => {
      const { service, saleRepository, purchaseRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseRepository.count.mockResolvedValue(0);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: false, code });

      const result = await service.attemptPurchase("test-sale", "alice");

      expect(result).toEqual({ accepted: false, code, message: expect.any(String) });
      expect(purchaseRepository.insertIfNotExists).not.toHaveBeenCalled();
    });

    it("returns ALREADY_PURCHASED when the gateway accepts but the DB unique constraint already held a row", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseRepository.count.mockResolvedValue(0);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchaseRepository.insertIfNotExists.mockResolvedValue(null);

      const result = await service.attemptPurchase("test-sale", "alice");

      expect(result).toEqual({
        accepted: false,
        code: PurchaseErrorCode.ALREADY_PURCHASED,
        message: expect.any(String),
      });
    });

    it("compensates the gateway and returns TEMPORARY_FAILURE when the DB write throws unexpectedly", async () => {
      const { service, saleRepository, purchaseRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseRepository.count.mockResolvedValue(0);
      purchaseGateway.attemptPurchase.mockResolvedValue({ accepted: true });
      purchaseRepository.insertIfNotExists.mockRejectedValue(new Error("connection reset"));

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
    it("returns NOT_PURCHASED when no purchase record exists for the identifier", async () => {
      const { service, purchaseRepository } = buildService();
      purchaseRepository.findByIdentifier.mockResolvedValue(undefined);

      const result = await service.checkPurchaseStatus("test-sale", "bob");

      expect(result).toEqual({
        accepted: false,
        code: PurchaseErrorCode.NOT_PURCHASED,
        message: expect.any(String),
      });
    });

    it("returns the purchase record when one exists", async () => {
      const { service, purchaseRepository } = buildService();
      const createdAt = new Date("2026-09-09T11:00:00Z");
      purchaseRepository.findByIdentifier.mockResolvedValue({
        id: "p1",
        saleId: "test-sale",
        identifier: "bob",
        createdAt,
      });

      const result = await service.checkPurchaseStatus("test-sale", "bob");

      expect(result).toEqual({ accepted: true, identifier: "bob", purchasedAt: createdAt.toISOString() });
    });

    it("throws InternalServerErrorException when the lookup rejects unexpectedly", async () => {
      const { service, purchaseRepository } = buildService();
      purchaseRepository.findByIdentifier.mockRejectedValue(new Error("connection reset"));

      await expect(service.checkPurchaseStatus("test-sale", "bob")).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
