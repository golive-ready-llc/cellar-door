import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

/**
 * Designed empty state — a tinted, ringed icon, a clear headline, supporting
 * copy, and a primary action. Used across every surface so "nothing here yet"
 * always reads as intentional and points the user at the next step.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const renderAction = (a: EmptyStateAction, primary: boolean) => {
    if (a.href) {
      return (
        <Button
          render={<Link href={a.href} />}
          variant={primary ? "default" : "outline"}
          size="sm"
        >
          {a.label}
        </Button>
      );
    }
    return (
      <Button onClick={a.onClick} variant={primary ? "default" : "outline"} size="sm">
        {a.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border surface-elevated",
        className
      )}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/15 blur-xl" aria-hidden />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center">
          <Icon className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h3 className="text-title mb-1">{title}</h3>
      {description && (
        <p className="text-body text-muted-foreground max-w-sm mb-5">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {action && renderAction(action, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );
}
