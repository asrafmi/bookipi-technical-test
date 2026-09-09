import Redis from "ioredis";

export type RedisClient = Redis;

export function createRedisClient(config: {
  host: string;
  port: number;
  password?: string;
}): RedisClient {
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
  });
}