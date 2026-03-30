import { z } from "zod";
import {
  createUser,
  existsWithEmail,
  existsWithPhone,
  findById,
  findByPhoneOrEmail,
  type AuthUser,
} from "../repositories/users.repository";
import { hashPassword, verifyPassword } from "../util/password";
import { signAccessToken } from "../util/tokens";
import { AppError } from "../util/errors";

const registerSchema = z.object({
  phone: z.string().min(6).max(32),
  email: z.string().email().max(255).optional().nullable(),
  password: z.string().min(8).max(128),
  fullName: z.string().max(255).optional().nullable(),
});

const loginSchema = z
  .object({
    phone: z.string().min(6).max(32).optional(),
    email: z.string().email().max(255).optional(),
    password: z.string().min(8).max(128),
  })
  .refine((data) => data.phone || data.email, {
    message: "Phone or email is required",
    path: ["phone"],
  });

type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;

export type PublicUser = Omit<AuthUser, "passwordHash">;

const sanitize = (user: AuthUser): PublicUser => {
  const { passwordHash, ...safe } = user;
  return safe;
};

export const AuthService = {
  register: async (input: RegisterInput) => {
    const data = registerSchema.parse(input);

    if (await existsWithPhone(data.phone)) {
      throw new AppError("Phone already registered", 409, "PHONE_EXISTS");
    }
    if (data.email && (await existsWithEmail(data.email))) {
      throw new AppError("Email already registered", 409, "EMAIL_EXISTS");
    }

    const passwordHash = await hashPassword(data.password);
    const user = await createUser({
      phone: data.phone,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
    });

    const accessToken = signAccessToken(user.id);
    return { user: sanitize(user), accessToken };
  },

  login: async (input: LoginInput) => {
    const data = loginSchema.parse(input);
    const user =
      (data.email && (await findByPhoneOrEmail({ email: data.email }))) ||
      (data.phone && (await findByPhoneOrEmail({ phone: data.phone })));

    if (!user) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const isValidPassword = await verifyPassword(
      data.password,
      user.passwordHash
    );
    if (!isValidPassword) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    const accessToken = signAccessToken(user.id);
    return { user: sanitize(user), accessToken };
  },

  profile: async (userId: string) => {
    const user = await findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    return sanitize(user);
  },
};
