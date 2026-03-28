import "dotenv/config";
import type { Config } from "drizzle-kit";
import { env } from "./env";

const connectionString = env.db.url;

export default {
  schema: "./schemas/index.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: { url: connectionString },
} satisfies Config;
