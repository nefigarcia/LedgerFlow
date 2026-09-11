import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

export function BrandMark({
  className,
  showName = true,
  size = "md",
}: {
  className?: string;
  showName?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "h-6 w-6 text-[11px]" : size === "lg" ? "h-9 w-9 text-base" : "h-7 w-7 text-xs";
  const nameCls = size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "relative grid place-items-center rounded-md font-semibold shadow-sm",
          "bg-gradient-to-br from-primary to-primary-hover text-primary-foreground",
          dims,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 12L6 8.5L9 11L13.5 4" />
          <circle cx="13.5" cy="4" r="1" fill="currentColor" />
        </svg>
      </span>
      {showName ? (
        <span className={cn("font-semibold tracking-tight", nameCls)}>{BRAND.name}</span>
      ) : null}
    </div>
  );
}
