export class AppError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function toSafeError(err: unknown): { code: string; message: string; status: number } {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, status: err.status };
  }
  return { code: "INTERNAL_ERROR", message: "Something went wrong.", status: 500 };
}

/**
 * Message that is safe to show a user.
 *
 * Service-layer errors (AppError or plain Error thrown with a human message)
 * pass through. Database/driver errors are logged and replaced with a
 * generic message so table names, constraints, and SQL never leak.
 */
export function toUserMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) {
    const isInfraError =
      err.name.startsWith("PrismaClient") ||
      err.name === "TypeError" ||
      err.name === "ReferenceError" ||
      /prisma|constraint|ECONN|ETIMEDOUT|ENOENT/i.test(err.message);
    if (!isInfraError) return err.message;
  }
  console.error(err);
  return fallback;
}
