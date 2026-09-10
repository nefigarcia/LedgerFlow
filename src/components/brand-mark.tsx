import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export function BrandMark({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
        {BRAND.name[0]}
      </span>
      {showName ? <span className="text-base font-semibold tracking-tight">{BRAND.name}</span> : null}
    </div>
  );
}
