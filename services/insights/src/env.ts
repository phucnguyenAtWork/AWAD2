import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// load root .env
config({ path: resolve(__dirname, "../../../.env") });

const numberFromEnv = (def: number) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return def;
      return val;
    },
    z.coerce.number().nonnegative()
  );

const defaults = {
  database: process.env.INSIGHTS_DATABASE ?? process.env.MYSQL_DATABASE ?? "insights",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  financeApiUrl: process.env.FINANCE_API_URL ?? "http://localhost:4001",
};

const EnvSchema = z.object({
  PORT: numberFromEnv(4003),

  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: numberFromEnv(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default(defaults.database),
  DB_POOL_SIZE: numberFromEnv(10),

  INSIGHTS_DATABASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(24, "JWT_SECRET must be at least 24 chars"),

  FRONTEND_ORIGIN: z.string().optional().default(defaults.frontendOrigin),
  FINANCE_API_URL: z.string().optional().default(defaults.financeApiUrl),

  GEMINI_API_KEY: z.string().min(10, "GEMINI_API_KEY required"),
});

export type PartialEnv = z.infer<typeof EnvSchema>;
export const partialEnv: PartialEnv = EnvSchema.parse(process.env);

export const env = {
  ...partialEnv,
  frontendOrigin: partialEnv.FRONTEND_ORIGIN ?? defaults.frontendOrigin,
  financeApiUrl: partialEnv.FINANCE_API_URL ?? defaults.financeApiUrl,
  db: {
    host: partialEnv.MYSQL_HOST,
    port: partialEnv.MYSQL_PORT,
    user: partialEnv.MYSQL_USER,
    password: partialEnv.MYSQL_PASSWORD,
    database: partialEnv.MYSQL_DATABASE,
    poolSize: partialEnv.DB_POOL_SIZE,
    url:
      partialEnv.INSIGHTS_DATABASE_URL ??
      `mysql://${encodeURIComponent(partialEnv.MYSQL_USER)}:${encodeURIComponent(partialEnv.MYSQL_PASSWORD)}@${partialEnv.MYSQL_HOST}:${partialEnv.MYSQL_PORT}/${partialEnv.MYSQL_DATABASE}`,
  },
};

export default env;
