import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PurchaseErrorCode, PurchaseGatewayResult } from "src/flash-sale/types/purchase";
import { RedisClient } from "src/redis/redis.client";
import { REDIS_CLIENT } from "src/redis/redis.module";

const LUA_SCRIPT = readFileSync(path.join(__dirname, "purchase.lua"), "utf8");

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

  async bootstrap(saleId: string, totalStock: number, purchasedCount: number) {
    const stockKey = this.stockKey(saleId);
    const exists = await this.redis.exists(stockKey);

    if (!exists) {
      await this.redis.set(stockKey, Math.max(totalStock - purchasedCount, 0));
    }
  }

  async attemptPurchase(saleId: string, identifier: string, now: Date, startsAt: Date, endsAt: Date): Promise<PurchaseGatewayResult> {
    // TEMPORARY — deliberately broken for a stress-test demo. This reintroduces the
    // exact "classic failure" section 2.1 of the working notes warns about: three
    // separate steps (window check, stock check, dedup) followed by a write, instead
    // of the one atomic EVALSHA below. Under real concurrency, many requests can pass
    // the stock check before any of them decrements — expect oversell.
    if (now.getTime() < startsAt.getTime()) return { accepted: false, code: PurchaseErrorCode.SALE_NOT_STARTED };
    if (now.getTime() > endsAt.getTime()) return { accepted: false, code: PurchaseErrorCode.SALE_ENDED };

    const isBuyer = await this.redis.sismember(this.buyersKey(saleId), identifier);
    if (isBuyer) return { accepted: false, code: PurchaseErrorCode.ALREADY_PURCHASED };

    const stock = Number(await this.redis.get(this.stockKey(saleId)));
    if (!stock || stock <= 0) return { accepted: false, code: PurchaseErrorCode.SOLD_OUT };

    await this.redis.decr(this.stockKey(saleId));
    await this.redis.sadd(this.buyersKey(saleId), identifier);
    return { accepted: true };

    // Original atomic version (restore this, delete the block above):
    // const outcome = await (this.redis as any).attemptPurchase(
    //   this.stockKey(saleId),
    //   this.buyersKey(saleId),
    //   identifier,
    //   now.getTime(),
    //   startsAt.getTime(),
    //   endsAt.getTime()
    // );
    // if (outcome === "OK") return { accepted: true };
    // return { accepted: false, code: PurchaseErrorCode[outcome as keyof typeof PurchaseErrorCode] };
  }

  async compensate(saleId: string, identifier: string) {
    await this.redis.incr(this.stockKey(saleId));
    await this.redis.srem(this.buyersKey(saleId), identifier);
  }
}