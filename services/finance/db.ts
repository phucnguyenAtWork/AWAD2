import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import * as schema from "./schemas";
import { env } from "./env";

const pool = createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: env.db.poolSize,
});

export const db = drizzle(pool, { schema, mode: "default" });
export type Db = typeof db;

export const closePool = async () => pool.end();
