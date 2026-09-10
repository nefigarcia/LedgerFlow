"use server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, signIn } from "@/lib/auth/auth";
import { ok, fail, fromZodError, type ActionResult } from "@/lib/validation/result";
import { createId } from "@paralleldrive/cuid2";
import { addHours } from "date-fns";

const registerSchema = z.object({
  name: z.string().min(1, "Enter your name").max(120),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function registerUserAction(formData: FormData): Promise<ActionResult<{ userId: string }>> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail("EMAIL_TAKEN", "An account with that email already exists.");
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      passwordHash,
    },
  });
  return ok({ userId: user.id });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await signIn("credentials", {
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password,
      redirect: false,
    });
    return ok({ ok: true });
  } catch {
    return fail("INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
}

const forgotSchema = z.object({ email: z.string().email() });

export async function requestPasswordResetAction(
  formData: FormData,
): Promise<ActionResult<{ token?: string }>> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fromZodError(parsed.error);
  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Do not leak account existence — respond with ok anyway.
    return ok({});
  }
  const token = createId();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: addHours(new Date(), 1),
    },
  });
  // Email delivery not wired in MVP. In development we return the token
  // so the reset link can be constructed manually.
  return ok(process.env.NODE_ENV === "development" ? { token } : {});
}

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetPasswordAction(formData: FormData): Promise<ActionResult<{ ok: true }>> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZodError(parsed.error);
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return fail("INVALID_TOKEN", "This reset link is invalid or has expired.");
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  return ok({ ok: true });
}
