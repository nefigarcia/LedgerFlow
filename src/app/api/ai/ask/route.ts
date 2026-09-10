import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/permissions";
import { rateLimit } from "@/lib/ratelimit/ratelimit";
import { isAIConfigured } from "@/lib/openai/client";
import { askAssistant } from "@/features/ai/assistant";

export const runtime = "nodejs";

const bodySchema = z.object({
  organizationSlug: z.string().min(1),
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: session.user.id, organization: { slug: parsed.data.organizationSlug } },
    include: { organization: { select: { id: true, aiEnabled: true } } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!membership.organization.aiEnabled) {
    return NextResponse.json({ error: "AI is disabled for this workspace" }, { status: 403 });
  }
  if (!hasPermission(membership.role, "ai:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = rateLimit(`ai:${membership.organization.id}:${session.user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!isAIConfigured()) {
    return NextResponse.json({ error: "AI is not configured on the server." }, { status: 503 });
  }

  try {
    const result = await askAssistant({
      organizationId: membership.organization.id,
      userId: session.user.id,
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI ask failed", err);
    return NextResponse.json({ error: "Assistant failed to respond." }, { status: 500 });
  }
}
