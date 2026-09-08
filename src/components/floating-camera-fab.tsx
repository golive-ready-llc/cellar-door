"use client";

import { useSyncExternalStore } from "react";
import { Camera } from "lucide-react";
import { useAddWine } from "@/components/add-wine-context";
import { subscribeChatPanelOpen, getChatPanelOpen } from "@/components/chat/chat-open-store";

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
      className="hidden md:flex fixed bottom-6 right-6 z-50 w-16 h-16 rounded-2xl flex-col items-center justify-center gap-0.5 bg-red-600 text-white hover:bg-red-700 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg"
      aria-label="Add wine"
      title="Add wine"
    >
      <Camera className="h-5 w-5 shrink-0" />
      <span className="text-[11px] font-semibold leading-none">Add</span>
    </button>
  );
}
