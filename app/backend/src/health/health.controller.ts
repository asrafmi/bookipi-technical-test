import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "src/health/database.health-indicator";
import { RedisHealthIndicator } from "src/health/redis.health-indicator";

@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  // Root route: mainly so a plain GET / (load balancer probes, a reviewer's first
  // curl) gets a 200 with something useful instead of Nest's default 404 for an
  // unmapped route — it's a liveness signal, not a dependency check. Depth is at
  // GET /health below.
  @Get()
  @ApiOperation({ summary: "Service liveness — always 200 once the process is up" })
  root() {
    return {
      status: "ok",
      service: "flash-sale-backend",
      docs: "/docs",
      health: "/health",
    };
  }

  // Readiness: verifies the two dependencies the purchase path actually needs
  // (Decision 1/2 in the root README — Redis for the atomic decision, Postgres as
  // the source of truth). A 503 here is the signal an orchestrator should use to
  // stop routing traffic to this instance, not just that the process is running.
  @Get("health")
  @HealthCheck()
  @ApiOperation({ summary: "Readiness — checks Postgres and Redis connectivity" })
  @ApiOkResponse({ description: "Postgres and Redis are both reachable" })
  check() {
    return this.health.check([
      () => this.db.check("database"),
      () => this.redis.check("redis"),
    ]);
  }
}
