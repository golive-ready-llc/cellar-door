"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

interface StepperProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  size?: "default" | "sm";
  className?: string;
}

export function Stepper({
  label,
  value,
  min = 1,
  max = 20,
  onChange,
  size = "default",
  className,
}: StepperProps) {
  const isSmall = size === "sm";

  return (
    <div className={cn("flex flex-col", className)}>
      {label && (
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
          {label}
        </span>
      )}
      <div
        className={cn(
          "flex items-center border border-border rounded-lg overflow-hidden",
          isSmall ? "h-7" : "h-9"
        )}
      >
        <button
          type="button"
          className={cn(
            "flex items-center justify-center shrink-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:cursor-default",
            isSmall ? "w-7 h-7" : "w-9 h-9"
          )}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus className={isSmall ? "h-3 w-3" : "h-4 w-4"} />
        </button>
        <span
          className={cn(
            "font-semibold text-center min-w-[36px] select-none",
            isSmall ? "text-xs" : "text-sm"
          )}
        >
          {value}
        </span>
        <button
          type="button"
          className={cn(
            "flex items-center justify-center shrink-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-25 disabled:cursor-default",
            isSmall ? "w-7 h-7" : "w-9 h-9"
          )}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus className={isSmall ? "h-3 w-3" : "h-4 w-4"} />
        </button>
      </div>
    </div>
  );
}
