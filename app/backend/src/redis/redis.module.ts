import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import ConfigModule from "src/config/config.module";
import ConfigService from "src/config/config.service";
import { createRedisClient } from "./redis.client";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => createRedisClient(configService.redis()),
      inject: [ConfigService],
    },
  ],
})

export class RedisModule implements OnModuleDestroy {
  constructor(private readonly redisClient: ReturnType<typeof createRedisClient>) {}

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}