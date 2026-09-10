import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export default class ConfigService {
  constructor(private readonly config: NestConfigService) { }

  app() {
    return {
      port: Number(this.config.get<number>("PORT", 3000)),
      keepAliveTimeout: Number(this.config.get<number>("HTTP_KEEP_ALIVE_TIMEOUT_MS", 30_000)),
      connectionTimeout: Number(this.config.get<number>("HTTP_CONNECTION_TIMEOUT_MS", 30_000)),
    };
  }

  database() {
    return {
      host: this.config.get<string>("DB_HOST", "localhost"),
      port: Number(this.config.get<number>("DB_PORT", 5432)),
      database: this.config.get<string>("DB_NAME", "flash_sale"),
      username: this.config.get<string>("DB_USERNAME", "postgres"),
      password: this.config.get<string>("DB_PASSWORD", "postgres"),
      poolMax: Number(this.config.get<number>("DB_POOL_MAX", 10)),
    };
  }

  redis() {
    return {
      host: this.config.get<string>("REDIS_HOST", "localhost"),
      port: Number(this.config.get<number>("REDIS_PORT", 6379)),
    };
  }
  // add more config getters as needed
}
