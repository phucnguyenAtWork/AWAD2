import { verifyAccessToken } from "../util/tokens";
import { findById, type AuthUser } from "../repositories/users.repository";
import { AppError } from "../util/errors";

export const requireAuth = async (
  request: Request,
  set: { status?: number | string }
): Promise<AuthUser> => {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    set.status = 401;
    throw new AppError("Missing bearer token", 401, "UNAUTHORIZED");
  }

  const token = header.slice("bearer ".length);
  const payload = verifyAccessToken(token);
  const user = await findById(payload.sub);

  if (!user) {
    set.status = 401;
    throw new AppError("User not found", 401, "UNAUTHORIZED");
  }

  return user;
};
