"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reversePaymentAction } from "@/features/payments/actions";

/** Reverses a payment recorded by mistake; the invoice balance is recalculated. */
export function ReversePaymentButton({
  organizationSlug,
  paymentId,
  label,
}: {
  organizationSlug: string;
  paymentId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Reverse payment ${label}`}
      title="Reverse payment"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Reverse the payment of ${label}? The invoice balance will be restored. This is recorded in the audit log.`)) return;
        start(async () => {
          const res = await reversePaymentAction(organizationSlug, paymentId);
          if (!res.success) { toast.error(res.error.message); return; }
          toast.success("Payment reversed");
          router.refresh();
        });
      }}
    >
      <Undo2 />
    </Button>
  );
}
