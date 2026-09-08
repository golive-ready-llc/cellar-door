import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  /** Right-aligned action(s) — e.g. a Select / Add button */
  action?: React.ReactNode;
}

/**
 * Canonical page header — one title/subtitle/icon/action rhythm for every
 * top-level screen, so headers don't drift in size, weight, and spacing.
 */
export function PageHeader({ title, subtitle, icon: Icon, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-display flex items-center gap-2">
          {Icon && <Icon className="h-6 w-6 text-primary shrink-0" />}
          {title}
        </h1>
        {subtitle && <div className="text-body text-muted-foreground mt-1">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
