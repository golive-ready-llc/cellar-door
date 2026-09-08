import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  subtext?: string;
  /** If provided, the card becomes a tappable Link to this href. */
  href?: string;
}

export function StatCard({ label, value, icon: Icon, color, subtext, href }: StatCardProps) {
  const inner = (
    <Card
      className={cn(
        href &&
          "transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.99] cursor-pointer"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtext && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {subtext}
              </p>
            )}
          </div>
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        aria-label={`View details: ${label}`}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
