import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DrizzleClient = PostgresJsDatabase<typeof schema>;

export function createDrizzleClient(config: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): DrizzleClient {
  const queryClient = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
  });
  return drizzle(queryClient, { schema });
}
