// Backend types defined locally (replicated from backend services)

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type PublicUser = {
  id: string;
  phone: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
};

export type UserRole = 'Student' | 'Worker' | 'Freelancer' | 'Parent' | 'Retiree';

export type BackendAccount = {
  id: string;
  userId: string;
  name: string;
  type: 'CASH' | 'BANK' | 'WALLET' | 'CREDIT';
  currency: string;
  role: UserRole;
  frictionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
};

export type BackendCategory = {
  id: string;
  accountId: string | null;
  name: string;
  icon: string | null;
  type: 'EXPENSE' | 'INCOME';
  createdAt: string;
};

export type BackendTransaction = {
  id: string;
  userId: string;
  type: 'EXPENSE' | 'INCOME';
  amount: string;
  currency: string;
  description: string | null;
  categoryId: string | null;
  essential: boolean;
  tags: string[] | null;
  occurredAt: string;
};

export type BackendBudget = {
  id: string;
  accountId: string;
  categoryId: string | null;
  amountLimit: string;
  period: 'MONTHLY' | 'WEEKLY';
  alertThreshold: string;
  startDate: string;
  endDate: string;
  createdAt: string | null;
};

export type AccountInput = {
  userId: string;
  name: string;
  type?: 'CASH' | 'BANK' | 'WALLET' | 'CREDIT';
  currency?: string;
  role?: UserRole;
  frictionLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
};

export type AccountPayload = Omit<AccountInput, 'userId'>;

export type BudgetInput = {
  accountId: string;
  categoryId?: string | null;
  amountLimit: string | number;
  period?: 'MONTHLY' | 'WEEKLY';
  alertThreshold?: string | number;
  startDate: string;
  endDate: string;
};

export type NewCategory = {
  accountId?: string | null;
  name: string;
  icon?: string | null;
  type?: 'EXPENSE' | 'INCOME';
};

export type TransactionInput = {
  userId: string;
  type?: 'EXPENSE' | 'INCOME';
  amount: string | number;
  currency?: string;
  description?: string | null;
  categoryId?: string | null;
  essential?: boolean;
  tags?: string[] | null;
  occurredAt?: string;
};

// Frontend-mapped types

export type AuthUser = PublicUser;

export interface Account extends Omit<BackendAccount, 'createdAt'> {
  createdAt: string;
  role: UserRole;
}

export interface Category extends Omit<BackendCategory, 'createdAt'> {
  createdAt: string;
}

export interface Transaction extends Omit<BackendTransaction, 'amount' | 'occurredAt' | 'tags'> {
  amount: number;
  occurredAt: string;
  occurred_at: string;
  tags: string[];
  categoryName?: string;
  category_name?: string;
}

export interface Budget extends Omit<BackendBudget, 'amountLimit' | 'alertThreshold' | 'startDate' | 'endDate' | 'createdAt'> {
  amountLimit: number;
  amount_limit: number;
  alertThreshold: number;
  alert_threshold: number;
  startDate: string;
  start_date: string;
  endDate: string;
  end_date: string;
  createdAt: string;
  spent?: number;
  accountName?: string;
  account_name?: string;
  categoryName?: string;
  category_name?: string;
}

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};
