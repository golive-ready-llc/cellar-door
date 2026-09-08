"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { toast } from "@/components/ui/custom-toast";
import type { CreditPack } from "@/lib/tier";

/**
 * Starts a Stripe Checkout session for a one-time AI credit top-up.
 * On success, Stripe redirects to /settings?credits=success and the
 * webhook credits the user's account.
 */
export function useBuyCredits() {
  const { getIdToken } = useAuth();
  const [loadingPack, setLoadingPack] = useState<CreditPack["id"] | null>(null);

  const buy = async (pack: CreditPack) => {
    setLoadingPack(pack.id);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Please sign in to purchase credits.");
        return;
      }
      const res = await fetch("/api/stripe/credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packId: pack.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start checkout");
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
      setLoadingPack(null);
    }
  };

  return { buy, loadingPack };
}
