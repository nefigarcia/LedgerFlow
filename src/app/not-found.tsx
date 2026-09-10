import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-6 text-center">
      <div className="max-w-md">
        <BrandMark className="mx-auto" />
        <h1 className="mt-6 text-3xl font-semibold">We couldn&apos;t find that page.</h1>
        <p className="mt-2 text-sm text-muted-foreground">The link may be broken or the page may have moved.</p>
        <Button asChild className="mt-6"><Link href="/app">Back to the app</Link></Button>
      </div>
    </div>
  );
}
