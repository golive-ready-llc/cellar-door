"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { toast } from "@/components/ui/custom-toast";
import type { Tier } from "@/lib/tier";
import type { BillingInterval } from "@/lib/stripe-helpers";

export function useCheckout() {
  const { getIdToken } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const startCheckout = async (tier: Tier, interval: BillingInterval = "monthly") => {
    setCheckoutLoading(true);
    // Track whether we're navigating away — only THEN should we leave the
    // loading flag set (so the button stays disabled while the browser
    // tears down the page). Every other exit path must reset it, otherwise
    // the button is stuck disabled forever (e.g. token failure, fetch error).
    let navigating = false;
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Please sign in to subscribe.");
        return;
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier, interval }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { url } = await res.json();
      if (url) {
        navigating = true;
        window.location.href = url;
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start checkout"
      );
    } finally {
      if (!navigating) setCheckoutLoading(false);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    let navigating = false;
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Please sign in first.");
        return;
      }

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to open subscription portal");
      }

      const { url } = await res.json();
      if (url) {
        navigating = true;
        window.location.href = url;
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to open portal"
      );
    } finally {
      if (!navigating) setPortalLoading(false);
    }
  };

  return { startCheckout, openPortal, checkoutLoading, portalLoading };
}
