import { ReconciliationService } from "src/flash-sale/domain/reconciliation/reconciliation.service";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import ConfigService from "src/config/config.service";
import { SaleRow } from "src/flash-sale/infrastructure/repository/sale/sale.entity";

function buildSale(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: "sale-1",
    productName: "Test Product",
    productDescription: "Test Description",
    totalStock: 100,
    startsAt: new Date("2026-09-09T10:00:00Z"),
    endsAt: new Date("2026-09-09T12:00:00Z"),
    soldCount: 10,
    soldCountUpdatedAt: new Date("2026-09-14T00:00:00Z"),
    ...overrides,
  };
}

function buildService() {
  const saleRepository = {
    findById: jest.fn(),
    findAllIds: jest.fn(),
    overwriteSoldCount: jest.fn(),
  } as unknown as jest.Mocked<SaleRepository>;

  const purchaseGateway = {
    getStockSnapshot: jest.fn(),
    overwriteStock: jest.fn(),
  } as unknown as jest.Mocked<PurchaseGateway>;

  const configService = {
    reconciliation: jest.fn().mockReturnValue({ intervalMs: 300_000 }),
  } as unknown as jest.Mocked<ConfigService>;

  const service = new ReconciliationService(saleRepository, purchaseGateway, configService);
  return { service, saleRepository, purchaseGateway, configService };
}

describe("ReconciliationService", () => {
  describe("reconcile", () => {
    it("does nothing when the sale doesn't exist", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(undefined);

      await service.reconcile("missing");

      expect(purchaseGateway.getStockSnapshot).not.toHaveBeenCalled();
    });

    it("rebuilds Redis from Postgres when Redis has no data (cold start)", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      const sale = buildSale({ totalStock: 100, soldCount: 20, soldCountUpdatedAt: new Date("2026-09-14T00:00:00Z") });
      saleRepository.findById.mockResolvedValue(sale);
      purchaseGateway.getStockSnapshot.mockResolvedValue({ stockRemaining: null, updatedAt: null });

      await service.reconcile("sale-1");

      expect(purchaseGateway.overwriteStock).toHaveBeenCalledWith("sale-1", 100, 20, sale.soldCountUpdatedAt);
      expect(saleRepository.overwriteSoldCount).not.toHaveBeenCalled();
    });

    it("rebuilds Redis from Postgres when Postgres is newer", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      const sale = buildSale({ soldCountUpdatedAt: new Date("2026-09-14T00:10:00Z") });
      saleRepository.findById.mockResolvedValue(sale);
      purchaseGateway.getStockSnapshot.mockResolvedValue({
        stockRemaining: 80,
        updatedAt: new Date("2026-09-14T00:05:00Z"),
      });

      await service.reconcile("sale-1");

      expect(purchaseGateway.overwriteStock).toHaveBeenCalledWith("sale-1", 100, 10, sale.soldCountUpdatedAt);
      expect(saleRepository.overwriteSoldCount).not.toHaveBeenCalled();
    });

    it("defaults to Postgres when both timestamps are exactly equal", async () => {
      const tie = new Date("2026-09-14T00:10:00Z");
      const { service, saleRepository, purchaseGateway } = buildService();
      const sale = buildSale({ soldCountUpdatedAt: tie });
      saleRepository.findById.mockResolvedValue(sale);
      purchaseGateway.getStockSnapshot.mockResolvedValue({ stockRemaining: 80, updatedAt: tie });

      await service.reconcile("sale-1");

      expect(purchaseGateway.overwriteStock).toHaveBeenCalled();
      expect(saleRepository.overwriteSoldCount).not.toHaveBeenCalled();
    });

    it("overwrites Postgres's sold_count from Redis when Redis is newer", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      const sale = buildSale({ totalStock: 100, soldCount: 10, soldCountUpdatedAt: new Date("2026-09-14T00:00:00Z") });
      saleRepository.findById.mockResolvedValue(sale);
      const redisUpdatedAt = new Date("2026-09-14T00:05:00Z");
      purchaseGateway.getStockSnapshot.mockResolvedValue({ stockRemaining: 70, updatedAt: redisUpdatedAt });

      await service.reconcile("sale-1");

      expect(saleRepository.overwriteSoldCount).toHaveBeenCalledWith("sale-1", 30, redisUpdatedAt);
      expect(purchaseGateway.overwriteStock).not.toHaveBeenCalled();
    });

    it("floors the derived soldCount at zero when Redis stock exceeds totalStock", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      const sale = buildSale({ totalStock: 100, soldCountUpdatedAt: new Date("2026-09-14T00:00:00Z") });
      saleRepository.findById.mockResolvedValue(sale);
      const redisUpdatedAt = new Date("2026-09-14T00:05:00Z");
      purchaseGateway.getStockSnapshot.mockResolvedValue({ stockRemaining: 150, updatedAt: redisUpdatedAt });

      await service.reconcile("sale-1");

      expect(saleRepository.overwriteSoldCount).toHaveBeenCalledWith("sale-1", 0, redisUpdatedAt);
    });

    it("resolves without throwing when loading the sale rejects unexpectedly", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockRejectedValue(new Error("connection reset"));

      await expect(service.reconcile("sale-1")).resolves.toBeUndefined();
      expect(purchaseGateway.getStockSnapshot).not.toHaveBeenCalled();
    });

    it("resolves without throwing when reading the Redis snapshot rejects unexpectedly", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.getStockSnapshot.mockRejectedValue(new Error("redis down"));

      await expect(service.reconcile("sale-1")).resolves.toBeUndefined();
      expect(purchaseGateway.overwriteStock).not.toHaveBeenCalled();
      expect(saleRepository.overwriteSoldCount).not.toHaveBeenCalled();
    });

    it("resolves without throwing when overwriting Redis rejects unexpectedly", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.getStockSnapshot.mockResolvedValue({ stockRemaining: null, updatedAt: null });
      purchaseGateway.overwriteStock.mockRejectedValue(new Error("redis down"));

      await expect(service.reconcile("sale-1")).resolves.toBeUndefined();
    });

    it("resolves without throwing when overwriting Postgres rejects unexpectedly", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      const sale = buildSale({ soldCountUpdatedAt: new Date("2026-09-14T00:00:00Z") });
      saleRepository.findById.mockResolvedValue(sale);
      purchaseGateway.getStockSnapshot.mockResolvedValue({
        stockRemaining: 70,
        updatedAt: new Date("2026-09-14T00:05:00Z"),
      });
      saleRepository.overwriteSoldCount.mockRejectedValue(new Error("connection reset"));

      await expect(service.reconcile("sale-1")).resolves.toBeUndefined();
    });
  });

  describe("reconcileAll", () => {
    it("reconciles every known sale", async () => {
      const { service, saleRepository, purchaseGateway } = buildService();
      saleRepository.findAllIds.mockResolvedValue([{ id: "sale-1" }, { id: "sale-2" }]);
      saleRepository.findById.mockResolvedValue(buildSale());
      purchaseGateway.getStockSnapshot.mockResolvedValue({ stockRemaining: null, updatedAt: null });

      await service.reconcileAll();

      expect(saleRepository.findById).toHaveBeenCalledWith("sale-1");
      expect(saleRepository.findById).toHaveBeenCalledWith("sale-2");
    });

    it("resolves without throwing when listing sales rejects unexpectedly", async () => {
      const { service, saleRepository } = buildService();
      saleRepository.findAllIds.mockRejectedValue(new Error("connection reset"));

      await expect(service.reconcileAll()).resolves.toBeUndefined();
      expect(saleRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("onModuleInit / onModuleDestroy", () => {
    it("reconciles once immediately and schedules a periodic run using the configured interval", async () => {
      jest.useFakeTimers();
      const setIntervalSpy = jest.spyOn(global, "setInterval");
      const { service, saleRepository, configService } = buildService();
      saleRepository.findAllIds.mockResolvedValue([]);

      await service.onModuleInit();

      expect(saleRepository.findAllIds).toHaveBeenCalledTimes(1);
      expect(configService.reconciliation).toHaveBeenCalled();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 300_000);

      service.onModuleDestroy();
      setIntervalSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
