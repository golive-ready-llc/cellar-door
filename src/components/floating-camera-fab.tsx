"use client";

import { useSyncExternalStore } from "react";
import { Camera } from "lucide-react";
import { useAddWine } from "@/components/add-wine-context";
import { subscribeChatPanelOpen, getChatPanelOpen } from "@/components/chat/chat-open-store";
import { useConsentBannerVisible } from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";

/**
 * Always-visible floating camera button. Owns the prime bottom-right slot
 * (`fixed bottom-20 right-4 md:bottom-6 md:right-6`) — the position users
 * reach for first. Distinct red color so it's instantly recognizable as
 * "scan a wine" and not confused with the chat FAB (which is now at the
 * top of the screen). The chat button moved out to make room — adding
 * wine is the more frequent action.
 *
 * Hidden when no page has registered an `onAdd` handler — prevents a
 * mystery FAB on /settings, /admin, etc. that wouldn't actually do
 * anything if tapped.
 */
export function FloatingCameraFab() {
  const { ready, _openCameraFirst, _onAdd } = useAddWine();
  // Hidden while the CellarChat panel is open so it doesn't overlap the chat's
  // send button (they share the bottom-right corner on mobile).
  const chatOpen = useSyncExternalStore(
    subscribeChatPanelOpen,
    getChatPanelOpen,
    () => false
  );

  // While the cookie-consent banner is up (first visit with undecided
  // consent, or reopened via the footer "Cookie settings" link) it occupies
  // the bottom strip — its centered card reaches the bottom-right corner on
  // narrower desktop widths and the FAB becomes unreachable under it. Lift
  // the FAB clear until consent is (re)decided.
  const bannerUp = useConsentBannerVisible();

  if (!ready || !_onAdd || chatOpen) return null;

  return (
    <button
      type="button"
      onClick={_openCameraFirst}
      // Mobile positioning: bottom nav is h-14 (56px) and pads itself
      // with env(safe-area-inset-bottom) so its visual top edge sits
      // at 56px + safe-area from the window bottom. We add 72px on top
      // of safe-area so the FAB lands ~16px above the nav top edge —
      // a tight, intentional gap. (Previously 92px which felt floaty.)
      //
      // Layout: vertical stack — Camera icon over "Add" label. Square-
      // ish footprint matching the bottom-nav-tab aesthetic so it reads
      // as "another action button" rather than a giant pill. Web FAB
      // (md+) follows the same pattern, just clear of the absent bottom
      // nav.
      // Mobile no longer shows the floating FAB — it kept covering content
      // (bottles, dialogs). The red Add button now lives in the bottom nav
      // where Settings used to be. Desktop (md+) has no bottom nav, so the
      // floating button stays there.
      // While the consent banner is up, sit above its card (max card height
      // ~190px + wrapper padding + gap ≈ 13.5rem) instead of under it. The
      // existing transition-all animates the settle-back once decided.
      className={cn(
        "hidden md:flex fixed right-6 z-50 w-16 h-16 rounded-2xl flex-col items-center justify-center gap-0.5 bg-red-600 text-white hover:bg-red-700 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg",
        bannerUp ? "bottom-[13.5rem]" : "bottom-6"
      )}
      aria-label="Add wine"
      title="Add wine"
    >
      <Camera className="h-5 w-5 shrink-0" />
      <span className="text-[11px] font-semibold leading-none">Add</span>
    </button>
  );
}
