import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { env } from "./env";

export const pool = mysql.createPool({
  uri: env.db.url,
  connectionLimit: env.db.poolSize,
});

export const db = drizzle(pool);

export const closePool = async () => {
  await pool.end();
};
