import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export default class ConfigService {
  constructor(private readonly config: NestConfigService) { }

  app() {
    return {
      port: this.config.get<number>("PORT", 3000),
    };
  }

  database() {
    return {
      host: this.config.get<string>("DB_HOST", "localhost"),
      port: this.config.get<number>("DB_PORT", 5432),
      database: this.config.get<string>("DB_NAME", "flash_sale"),
      username: this.config.get<string>("DB_USERNAME", "postgres"),
      password: this.config.get<string>("DB_PASSWORD", "postgres"),
    };
  }

  redis() {
    return {
      host: this.config.get<string>("REDIS_HOST", "localhost"),
      port: this.config.get<number>("REDIS_PORT", 6379),
    };
  }
  // add more config getters as needed
}
