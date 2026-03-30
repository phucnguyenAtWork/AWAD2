import bcrypt from "bcrypt";
import { env } from "../env";

export const hashPassword = (password: string) =>
  bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);
