import { join } from "node:path";
import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from "@nestjs/config";
import ConfigService from "./config.service";
import validateEnv from "./validate-env";

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Resolved relative to this file (not process.cwd()) so the module finds
      // app/backend/.env regardless of the working directory it's launched from.
      envFilePath: join(__dirname, "..", "..", ".env"),
      validate: validateEnv,
    }),
  ],
  providers: [ConfigService, NestConfigService],
  exports: [ConfigService, NestConfigService],
})
export default class ConfigModule {}
