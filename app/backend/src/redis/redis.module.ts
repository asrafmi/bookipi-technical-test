import { Global, Inject, Module, OnModuleDestroy } from "@nestjs/common";
import ConfigModule from "src/config/config.module";
import ConfigService from "src/config/config.service";
import { createRedisClient, RedisClient } from "./redis.client";

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
  exports: [REDIS_CLIENT],
})

export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}