/**
 * Tiny external store so components outside CellarChat can react to the chat
 * panel opening/closing. Used to hide the bottom-right "Add wine" camera FAB
 * while the chat panel is open — otherwise, on phones with a 3-button nav bar
 * the safe-area-shifted FAB overlaps the chat's send button.
 *
 * Deliberately dependency-free (no React imports) so the FAB can subscribe via
 * useSyncExternalStore without pulling in the chat component graph.
 */
let chatOpen = false;
const listeners = new Set<() => void>();

export function setChatPanelOpen(open: boolean): void {
  if (chatOpen === open) return;
  chatOpen = open;
  listeners.forEach((l) => l());
}

export function subscribeChatPanelOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChatPanelOpen(): boolean {
  return chatOpen;
}
