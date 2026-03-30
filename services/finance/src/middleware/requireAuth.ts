import * as jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { env } from "../env";

export const authGuardConfig = {
  async beforeHandle({ request, set }: { request: Request; set: { status?: number | string } }) {
    const header = request.headers.get("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
    const token = header.slice("bearer ".length);
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
        sub?: string;
      };
      if (!payload.sub) {
        set.status = 401;
        return { message: "Unauthorized" };
      }
    } catch {
      set.status = 401;
      return { message: "Unauthorized" };
    }
  },
};

export const resolveUserId = ({ request }: { request: Request }) => {
  const header = request.headers.get("authorization")!;
  const token = header.slice("bearer ".length);
  const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload & {
    sub: string;
  };
  return { userId: payload.sub };
};
