"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client half of the demo entry: sets the demo_mode cookie (1 hour, no
 * signup) and moves the visitor into the app. Lives in its own file so the
 * route itself stays a server component and crawlers receive the descriptive
 * page below instead of an empty redirect stub.
 */
export function DemoRedirect() {
  const router = useRouter();

  useEffect(() => {
    document.cookie = "demo_mode=true; path=/; max-age=3600; SameSite=Lax";
    router.replace("/cellar");
  }, [router]);

  return null;
}
