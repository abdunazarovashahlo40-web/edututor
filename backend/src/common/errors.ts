export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code = 'BAD_REQUEST', msg?: string, details?: unknown) =>
  new AppError(400, code, msg, details);
export const unauthorized = (code = 'UNAUTHORIZED', msg?: string) => new AppError(401, code, msg);
export const forbidden = (code = 'FORBIDDEN', msg?: string) => new AppError(403, code, msg);
export const notFound = (code = 'NOT_FOUND', msg?: string) => new AppError(404, code, msg);
export const conflict = (code = 'CONFLICT', msg?: string) => new AppError(409, code, msg);
export const locked = (code = 'APP_LOCKED', msg?: string) => new AppError(423, code, msg);
export const tooMany = (code = 'TOO_MANY_REQUESTS', msg?: string) => new AppError(429, code, msg);
