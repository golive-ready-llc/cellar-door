"use client";

import { Bell, BellOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

/**
 * Settings → Notifications card. Hidden entirely on web — LocalNotifications
 * is a Capacitor-only feature, so on the web build there's nothing to toggle.
 */
export function NotificationsCard() {
  const { enabled, setEnabled, permission, supported } = useNotifications();

  if (!supported) return null;

  const denied = permission === "denied";
  const effective = enabled && !denied;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {effective ? (
            <Bell className="h-5 w-5 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          Notifications
        </CardTitle>
        <CardDescription>
          Heads-up on the 1st of each month for wines hitting their peak, plus
          a one-time alert when a bottle crosses past its drink-by window.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Drink-window reminders</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {denied
                ? "Blocked at the OS level"
                : effective
                  ? "Notifications are on"
                  : "Notifications are off"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={effective}
            disabled={denied}
            onClick={() => setEnabled(!enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              effective ? "bg-primary" : "bg-muted-foreground/30",
              denied && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                effective ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {denied && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Notifications are blocked in your phone&apos;s settings. Enable
            them for Cellar Door in your OS notification settings to turn this
            on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
