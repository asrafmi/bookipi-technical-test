import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "src/health/health.controller";
import { DatabaseHealthIndicator } from "src/health/database.health-indicator";
import { RedisHealthIndicator } from "src/health/redis.health-indicator";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
