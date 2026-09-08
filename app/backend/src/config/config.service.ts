import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export default class ConfigService {
  constructor(private readonly config: NestConfigService) {}

  app() {
    return {
      port: this.config.get<number>("PORT", 3000),
    };
  }
  // add more config getters as needed
}
