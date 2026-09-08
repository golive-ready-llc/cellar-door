"use client";

import { Grid3X3, Archive } from "lucide-react";
import type { EditableRowProps } from "./cabinet-grid-types";

const TYPE_ICONS = {
  slots: Grid3X3,
  bulk: Archive,
} as const;

const TYPE_LABELS = {
  slots: "Slots",
  bulk: "Bulk",
} as const;

export function EditableRow({
  rowIndex,
  currentType,
  onClick,
  children,
}: EditableRowProps) {
  const Icon = TYPE_ICONS[currentType];

  return (
    <div className="relative group/row transition-all rounded">
      <button
        type="button"
        className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium transition-all sm:opacity-0 sm:group-hover/row:opacity-100 cursor-pointer"
        style={{
          background: "rgba(0,0,0,0.7)",
          color: "rgba(245,230,202,0.8)",
          backdropFilter: "blur(4px)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) {
            const rect = e.currentTarget.getBoundingClientRect();
            onClick(rowIndex, rect);
          }
        }}
      >
        <Icon className="h-2.5 w-2.5" />
        {TYPE_LABELS[currentType]}
      </button>

      {children}
    </div>
  );
}
