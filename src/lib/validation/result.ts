import type { ZodError } from "zod";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { success: false, error: { code, message, fieldErrors } };
}

/**
 * Convert a ZodError into a user-visible ActionResult.
 * Walks the full issue list (including nested paths like `owners.1.name`)
 * so the caller can see exactly which field failed instead of a generic
 * "please check the form" message.
 */
export function fromZodError(err: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (fieldErrors[path] ??= []).push(issue.message);
  }

  const parts = Object.entries(fieldErrors)
    .slice(0, 4)
    .map(([field, msgs]) => `${field}: ${msgs[0]}`);
  const summary =
    parts.length > 0
      ? `Please fix: ${parts.join("; ")}${Object.keys(fieldErrors).length > 4 ? "…" : ""}`
      : "Please check the form and try again.";

  if (process.env.NODE_ENV !== "production") {
    console.warn("[validation] failed:", fieldErrors);
  }

  return fail("VALIDATION_ERROR", summary, fieldErrors);
}
