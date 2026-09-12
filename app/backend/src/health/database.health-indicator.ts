import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import { sql } from "drizzle-orm";
import awaitToError from "src/common/error/await-to-error";
import { DrizzleClient } from "src/db/client";
import { DRIZZLE_CLIENT } from "src/db/database.module";

const QUERY_TIMEOUT_MS = 2000;

// Terminus's own TypeOrmHealthIndicator assumes @nestjs/typeorm; this project uses
// Drizzle (see Decision 3.5 in the root README), so the check runs directly against
// the same client every repository uses rather than a separate connection.
//
// postgres-js's own connect_timeout defaults to 30s — fine for the app's normal
// retry behavior, too slow for a readiness probe. Racing against a shorter timeout
// here (same reasoning as RedisHealthIndicator) keeps /health responsive even
// while Postgres is unreachable.
@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async check(key: string) {
    const indicator = this.healthIndicatorService.check(key);

    const query = Promise.race([
      this.db.execute(sql`SELECT 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Database query timed out")), QUERY_TIMEOUT_MS)),
    ]);

    const [error] = await awaitToError(query);
    if (error) return indicator.down({ message: error.message });
    return indicator.up();
  }
}
