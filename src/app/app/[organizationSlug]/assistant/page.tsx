import { requireOrgAccess } from "@/lib/auth/session";
import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "./assistant-chat";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";
import { isAIConfigured } from "@/lib/openai/client";

export const dynamic = "force-dynamic";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  await requireOrgAccess(organizationSlug, "ai:use");
  const configured = isAIConfigured();
  return (
    <div>
      <PageHeader
        title="Financial assistant"
        description="Ask about your revenue, invoices, expenses, cash, or taxes."
      />
      {!configured ? (
        <Alert variant="warning">
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Set <code>OPENAI_API_KEY</code> (and optionally <code>OPENAI_MODEL</code>) in your environment to enable the assistant.
          </AlertDescription>
        </Alert>
      ) : (
        <AssistantChat organizationSlug={organizationSlug} />
      )}
    </div>
  );
}
