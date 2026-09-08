"use client";

/**
 * Headless mount point for the notifications reconciler. Runs the
 * `useNotifications` hook so its wine-list-watching effect fires
 * regardless of which page the user is on. Renders nothing.
 *
 * Lives inside WineDataProvider in (app)/layout.tsx so the hook
 * sees the populated wines context.
 */
import { useNotifications } from "@/hooks/use-notifications";

export function NotificationsBootstrap() {
  useNotifications();
  return null;
}
