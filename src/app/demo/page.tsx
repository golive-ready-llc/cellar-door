"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Demo entry point.
 * Sets a demo_mode cookie and redirects to the cellar.
 * The auth provider and data layer detect this cookie
 * and serve mock data without requiring sign-in.
 */
export default function DemoPage() {
  const router = useRouter();

  useEffect(() => {
    // Set demo cookie (expires in 1 hour)
    document.cookie = "demo_mode=true; path=/; max-age=3600; SameSite=Lax";
    router.replace("/cellar");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Loading demo...</p>
      </div>
    </div>
  );
}
