import "dotenv/config";
import { env } from "./src/env";

const connectionString = env.db.url;

export default {
  schema: "./src/schemas/index.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: { url: connectionString },
};
