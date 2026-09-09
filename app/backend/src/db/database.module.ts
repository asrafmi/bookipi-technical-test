import { Global, Module } from "@nestjs/common";
import ConfigModule from "src/config/config.module";
import ConfigService from "src/config/config.service";
import { createDrizzleClient, DrizzleClient } from "src/db/client";

export const DRIZZLE_CLIENT = "DRIZZLE_CLIENT";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE_CLIENT,
      useFactory: (configService: ConfigService): DrizzleClient => createDrizzleClient(configService.database()),
      inject: [ConfigService],
    },
  ],
  exports: [DRIZZLE_CLIENT],
})
export class DatabaseModule {}
