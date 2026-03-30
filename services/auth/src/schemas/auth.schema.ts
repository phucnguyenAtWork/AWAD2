import { mysqlTable, varchar, timestamp } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// Tables live in the dedicated database/schema `auth`
export const authUsers = mysqlTable("auth_users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`(uuid())`),

  phone: varchar("phone", { length: 32 })
    .notNull()
    .unique(),

  email: varchar("email", { length: 255 }).unique(),

  passwordHash: varchar("password_hash", { length: 60 }).notNull(),

  fullName: varchar("full_name", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow(),
});

export type AuthUsersTable = typeof authUsers;
