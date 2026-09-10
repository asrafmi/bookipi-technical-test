import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import ConfigModule from "./config/config.module";
import ConfigService from "./config/config.service";

async function bootstrap() {
  const configContext = await NestFactory.createApplicationContext(ConfigModule);
  const { keepAliveTimeout, connectionTimeout } = configContext.get(ConfigService).app();
  await configContext.close();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ keepAliveTimeout, connectionTimeout }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Flash Sale API")
    .setDescription("High-throughput flash sale system")
    .setVersion("1.0")
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);

  const configService = app.get(ConfigService);

  app.enableCors({
    origin: true,
  });

  const { port } = configService.app();
  await app.listen(port, "0.0.0.0", (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Server listening at ${address}`);
  });
}

bootstrap();
