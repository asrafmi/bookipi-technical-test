import { Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PurchaseRepository } from "src/flash-sale/infrastructure/repository/purchase/purchase.repository";
import { PurchaseGateway } from "src/flash-sale/infrastructure/redis/purchase-gateway";
import {
  PersistPurchaseJobData,
  PURCHASE_PERSISTENCE_QUEUE,
} from "src/flash-sale/infrastructure/queue/purchase-persistence.job";
import awaitToError from "src/common/error/await-to-error";

@Processor(PURCHASE_PERSISTENCE_QUEUE)
export class PurchasePersistenceProcessor extends WorkerHost {
  private readonly logger = new Logger(PurchasePersistenceProcessor.name);

  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly purchaseGateway: PurchaseGateway,
  ) {
    super();
  }

  // Makes Redis's already-atomic decision durable; a conflict here is a defensive no-op.
  async process(job: Job<PersistPurchaseJobData>): Promise<void> {
    const { saleId, identifier } = job.data;

    const [error, purchase] = await awaitToError(this.purchaseRepository.insertIfNotExists({ saleId, identifier }));
    if (error) {
      this.logger.error(
        `Failed to persist purchase for sale=${saleId} identifier=${identifier}: ${error.message}`,
      );
      throw error; // retry via BullMQ
    }
    if (!purchase) {
      this.logger.warn(`Purchase already persisted for sale=${saleId} identifier=${identifier}, skipping`);
    }
  }

  // 'failed' fires on every attempt, so only compensate once retries are exhausted.
  @OnWorkerEvent("failed")
  async onFailed(job: Job<PersistPurchaseJobData> | undefined, error: Error) {
    if (!job) return;
    const attemptsMax = job.opts.attempts ?? 1;
    if (job.attemptsMade < attemptsMax) return;

    const { saleId, identifier } = job.data;
    this.logger.error(
      `Persisting purchase failed after all retries for sale=${saleId} identifier=${identifier}: ${error.message}`,
    );
    await this.purchaseGateway.compensate(saleId, identifier);
  }
}
