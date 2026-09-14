import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import ConfigService from "src/config/config.service";
import { SaleRepository } from "src/flash-sale/infrastructure/repository/sale/sale.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import awaitToError from "src/common/error/await-to-error";

// Two-way last-write-wins on sold_count only — never touches purchases rows or the buyers set.
@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationService.name);
  private intervalHandle?: NodeJS.Timeout;

  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly purchaseGateway: PurchaseGateway,
    private readonly configService: ConfigService,
  ) { }

  async onModuleInit() {
    await this.reconcileAll();
    const { intervalMs } = this.configService.reconciliation();
    this.intervalHandle = setInterval(() => this.reconcileAll(), intervalMs);
    this.intervalHandle.unref?.();
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  async reconcileAll() {
    const [errSales, sales] = await awaitToError(this.saleRepository.findAllIds());
    if (errSales) {
      this.logger.error(`Reconciliation failed to list sales: ${errSales.message}`);
      return;
    }
    await Promise.all(sales.map((sale) => this.reconcile(sale.id)));
  }

  async reconcile(saleId: string) {
    // One reconciler wins per sale per interval, however many instances are running.
    const { intervalMs } = this.configService.reconciliation();
    const [errLock, acquired] = await awaitToError(this.purchaseGateway.acquireReconcileLock(saleId, intervalMs));
    if (errLock) {
      this.logger.error(`Reconciliation failed to acquire lock for sale=${saleId}: ${errLock.message}`);
      return;
    }
    if (!acquired) return;

    const [errSale, sale] = await awaitToError(this.saleRepository.findById(saleId));
    if (errSale) {
      this.logger.error(`Reconciliation failed to load sale=${saleId}: ${errSale.message}`);
      return;
    }
    if (!sale) return;

    const [errSnapshot, redisSnapshot] = await awaitToError(this.purchaseGateway.getStockSnapshot(saleId));
    if (errSnapshot) {
      this.logger.error(`Reconciliation failed to read Redis snapshot for sale=${saleId}: ${errSnapshot.message}`);
      return;
    }

    const postgresUpdatedAt = sale.soldCountUpdatedAt;
    const redisUpdatedAt = redisSnapshot.updatedAt;

    if (redisUpdatedAt === null || redisUpdatedAt <= postgresUpdatedAt) {
      const postgresTarget = Math.max(sale.totalStock - sale.soldCount, 0);
      // Only ever lower Redis's stock — raising it here would reopen an oversell
      // window while a queued job hasn't landed in Postgres yet (soldCount looks
      // stale-low even though the timestamp says Postgres is "newer").
      if (redisSnapshot.stockRemaining !== null && postgresTarget >= redisSnapshot.stockRemaining) {
        return;
      }
      const [err] = await awaitToError(
        this.purchaseGateway.overwriteStock(saleId, sale.totalStock, sale.soldCount, postgresUpdatedAt),
      );
      if (err) this.logger.error(`Reconciliation failed to overwrite Redis for sale=${saleId}: ${err.message}`);
      return;
    }

    const redisSoldCount = Math.max(sale.totalStock - (redisSnapshot.stockRemaining ?? sale.totalStock), 0);
    const [err] = await awaitToError(this.saleRepository.overwriteSoldCount(saleId, redisSoldCount, redisUpdatedAt));
    if (err) this.logger.error(`Reconciliation failed to overwrite Postgres for sale=${saleId}: ${err.message}`);
  }
}
