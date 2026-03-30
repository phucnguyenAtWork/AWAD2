export class AppError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const isAppError = (err: Error | AppError): err is AppError =>
  err instanceof AppError;
