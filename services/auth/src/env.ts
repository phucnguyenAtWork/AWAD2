import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";
import { randomBytes } from "crypto";
import type { Secret } from "jsonwebtoken";

// Load root-level .env (three levels up from services/auth/src)
const rootEnvPath = resolve(__dirname, "../../../.env");
config({ path: rootEnvPath });

const numberFromEnv = (def: number) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return def;
      return val;
    },
    z.coerce.number().nonnegative()
  );

const stringWithDefault = (min: number, def: () => string) =>
  z.preprocess(
    (val) => {
      if (val === "" || val === undefined || val === null) return undefined;
      return val;
    },
    z.string().min(min).default(def())
  );

const defaultJwtSecret = randomBytes(32).toString("hex"); // 64 chars for dev fallback

const defaults = {
  database: process.env.AUTH_DATABASE ?? process.env.MYSQL_DATABASE ?? "auth",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
};

const EnvSchema = z.object({
  PORT: numberFromEnv(4002),

  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: numberFromEnv(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default(defaults.database),
  DB_POOL_SIZE: numberFromEnv(10),

  AUTH_DATABASE_URL: z.string().url().optional(),

  JWT_SECRET: stringWithDefault(24, () => defaultJwtSecret),
  JWT_EXPIRES_IN: z.union([z.string(), z.number()]).default("1h"),
  BCRYPT_SALT_ROUNDS: numberFromEnv(12),

  RATE_LIMIT_WINDOW_MS: numberFromEnv(60000),
  RATE_LIMIT_MAX_REQUESTS: numberFromEnv(100),

  FRONTEND_ORIGIN: z.string().optional().default(defaults.frontendOrigin),
});

export type PartialEnv = z.infer<typeof EnvSchema>;
export const partialEnv: PartialEnv = EnvSchema.parse(process.env);

type Env = PartialEnv & {
  JWT_SECRET: Secret;
  JWT_EXPIRES_IN: string | number;
  frontendOrigin: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    poolSize: number;
    url: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
};

export const env: Env = {
  ...partialEnv,
  JWT_SECRET: partialEnv.JWT_SECRET,
  JWT_EXPIRES_IN: partialEnv.JWT_EXPIRES_IN,
  db: {
    host: partialEnv.MYSQL_HOST,
    port: partialEnv.MYSQL_PORT,
    user: partialEnv.MYSQL_USER,
    password: partialEnv.MYSQL_PASSWORD,
    database: partialEnv.MYSQL_DATABASE,
    poolSize: partialEnv.DB_POOL_SIZE,
    url:
      partialEnv.AUTH_DATABASE_URL ??
      `mysql://${encodeURIComponent(partialEnv.MYSQL_USER)}:${encodeURIComponent(
        partialEnv.MYSQL_PASSWORD
      )}@${partialEnv.MYSQL_HOST}:${partialEnv.MYSQL_PORT}/${partialEnv.MYSQL_DATABASE}`,
  },
  rateLimit: {
    windowMs: partialEnv.RATE_LIMIT_WINDOW_MS,
    maxRequests: partialEnv.RATE_LIMIT_MAX_REQUESTS,
  },
  frontendOrigin: partialEnv.FRONTEND_ORIGIN ?? defaults.frontendOrigin,
};

export default env;
