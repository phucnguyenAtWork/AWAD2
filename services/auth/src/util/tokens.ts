import * as jwt from "jsonwebtoken";
import { type JwtPayload } from "jsonwebtoken";
import { env } from "../env";

export type AccessTokenPayload = JwtPayload & { sub: string };

export const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET as jwt.Secret, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_SECRET as jwt.Secret) as AccessTokenPayload;
