import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  PERSIST_PURCHASE_JOB,
  PersistPurchaseJobData,
  PURCHASE_PERSISTENCE_QUEUE,
} from "src/flash-sale/infrastructure/queue/purchase-persistence.job";

@Injectable()
export class PurchasePersistenceQueue {
  constructor(@InjectQueue(PURCHASE_PERSISTENCE_QUEUE) private readonly queue: Queue<PersistPurchaseJobData>) {}

  // Persists a decision Redis already made atomically — never re-validates window/stock/dedup.
  async enqueue(data: PersistPurchaseJobData) {
    await this.queue.add(PERSIST_PURCHASE_JOB, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false, // dead-letter surface, inspected via logs
    });
  }
}
