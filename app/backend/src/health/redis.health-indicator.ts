import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import awaitToError from "src/common/error/await-to-error";
import { RedisClient } from "src/redis/redis.client";
import { REDIS_CLIENT } from "src/redis/redis.module";

const PING_TIMEOUT_MS = 2000;

// Terminus ships indicators for TypeORM/Mongoose/HTTP/etc. but not ioredis — this
// wraps the same Redis client the purchase gateway uses (src/redis/redis.client.ts)
// rather than opening a second connection just to prove the first one is alive.
//
// ioredis queues commands (including PING) while it's reconnecting instead of
// rejecting them, so a bare `await this.redis.ping()` would hang for as long as
// Redis stays unreachable — the opposite of what a readiness check needs. Racing
// it against a timeout is what turns "Redis is down" into a prompt 503 instead of
// a request that never resolves.
@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async check(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    const ping = Promise.race([
      this.redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis ping timed out")), PING_TIMEOUT_MS)),
    ]);

    const [error] = await awaitToError(ping);
    if (error) return indicator.down({ message: error.message });
    return indicator.up();
  }
}
