import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PurchaseErrorCode, PurchaseGatewayResult } from "src/flash-sale/types/purchase";
import { RedisClient } from "src/redis/redis.client";
import { REDIS_CLIENT } from "src/redis/redis.module";

const LUA_SCRIPT = readFileSync(path.join(__dirname, "purchase.lua"), "utf8");

type RedisWithAttemptPurchase = RedisClient & {
  attemptPurchase(
    stockKey: string,
    buyersKey: string,
    identifier: string,
    now: number,
    startsAt: number,
    endsAt: number,
  ): Promise<string>;
};

@Injectable()
export class PurchaseGateway implements OnModuleInit {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) { }

  onModuleInit() {
    this.redis.defineCommand("attemptPurchase", {
      numberOfKeys: 2,
      lua: LUA_SCRIPT,
    })
  }

  private stockKey(saleId: string) {
    return `sale:${saleId}:stock`;
  }

  private buyersKey(saleId: string) {
    return `sale:${saleId}:buyers`;
  }

  // SET ... NX in one round trip. EXISTS then SET would race and could
  // re-stomp the counter under concurrent first-purchase requests.
  async bootstrap(saleId: string, totalStock: number, purchasedCount: number) {
    const stockKey = this.stockKey(saleId);
    await this.redis.set(stockKey, Math.max(totalStock - purchasedCount, 0), "NX");
  }

  async attemptPurchase(saleId: string, identifier: string, now: Date, startsAt: Date, endsAt: Date): Promise<PurchaseGatewayResult> {
    const outcome = await (this.redis as RedisWithAttemptPurchase).attemptPurchase(
      this.stockKey(saleId),
      this.buyersKey(saleId),
      identifier,
      now.getTime(),
      startsAt.getTime(),
      endsAt.getTime()
    );

    if (outcome === "OK") return { accepted: true };
    return { accepted: false, code: PurchaseErrorCode[outcome as keyof typeof PurchaseErrorCode] };
  }

  async compensate(saleId: string, identifier: string) {
    await this.redis.incr(this.stockKey(saleId));
    await this.redis.srem(this.buyersKey(saleId), identifier);
  }
}