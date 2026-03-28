import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load root-level .env (two levels up from finance/)
const rootEnvPath = resolve(__dirname, "../../.env");
config({ path: rootEnvPath });

const numberString = (def: string) =>
  z
    .string()
    .regex(/^\d+$/)
    .default(def)
    .transform((v) => Number(v));

const EnvSchema = z.object({
  PORT: numberString("4001"),

  MYSQL_HOST: z.string().default("localhost"),
  MYSQL_PORT: numberString("3306"),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default("finance"),
  DB_POOL_SIZE: numberString("10"),

  DATABASE_URL: z.string().url().optional(),
});

export type PartialEnv = z.infer<typeof EnvSchema>;
export const partialEnv: PartialEnv = EnvSchema.parse(process.env);

export const env = {
  ...partialEnv,
  db: {
    host: partialEnv.MYSQL_HOST,
    port: partialEnv.MYSQL_PORT,
    user: partialEnv.MYSQL_USER,
    password: partialEnv.MYSQL_PASSWORD,
    database: partialEnv.MYSQL_DATABASE,
    poolSize: partialEnv.DB_POOL_SIZE,
    url:
      partialEnv.DATABASE_URL ??
      `mysql://${encodeURIComponent(partialEnv.MYSQL_USER)}:${encodeURIComponent(
        partialEnv.MYSQL_PASSWORD
      )}@${partialEnv.MYSQL_HOST}:${partialEnv.MYSQL_PORT}/${partialEnv.MYSQL_DATABASE}`,
  },
};

export default env;
