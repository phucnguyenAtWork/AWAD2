import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load root-level .env (three levels up from finance/src)
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

const defaults = {
  database: process.env.FINANCE_DATABASE ?? process.env.MYSQL_DATABASE ?? "finance",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
};

const EnvSchema = z.object({
  PORT: numberFromEnv(4001),

  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: numberFromEnv(3306),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default(defaults.database),
  DB_POOL_SIZE: numberFromEnv(10),

  FINANCE_DATABASE_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(24, "JWT_SECRET must be at least 24 chars"),

  FRONTEND_ORIGIN: z.string().optional().default(defaults.frontendOrigin),

  // FINA Brain (Windows GPU machine)
  FINA_API_URL: z.string().default("http://100.126.232.108:8105"),
});

export type PartialEnv = z.infer<typeof EnvSchema>;
export const partialEnv: PartialEnv = EnvSchema.parse(process.env);

export const env = {
  ...partialEnv,
  frontendOrigin: partialEnv.FRONTEND_ORIGIN ?? defaults.frontendOrigin,
  FINA_API_URL: partialEnv.FINA_API_URL,
  db: {
    host: partialEnv.MYSQL_HOST,
    port: partialEnv.MYSQL_PORT,
    user: partialEnv.MYSQL_USER,
    password: partialEnv.MYSQL_PASSWORD,
    database: partialEnv.MYSQL_DATABASE,
    poolSize: partialEnv.DB_POOL_SIZE,
    url:
      partialEnv.FINANCE_DATABASE_URL ??
      `mysql://${encodeURIComponent(partialEnv.MYSQL_USER)}:${encodeURIComponent(
        partialEnv.MYSQL_PASSWORD
      )}@${partialEnv.MYSQL_HOST}:${partialEnv.MYSQL_PORT}/${partialEnv.MYSQL_DATABASE}`,
  },
};

export default env;
