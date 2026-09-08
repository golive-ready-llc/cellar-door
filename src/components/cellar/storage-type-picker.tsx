"use client";

import { Grid3X3, Archive } from "lucide-react";
import type { StorageRow } from "@/types/wine";
import { useTouchDrag } from "@/hooks/use-touch-drag";

export interface SectionTemplate {
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
}

export const TEMPLATES: Array<{
  icon: typeof Grid3X3;
  label: string;
  description: string;
  template: SectionTemplate;
}> = [
  {
    icon: Grid3X3,
    label: "Wine Rack",
    description: "Standard slot grid",
    template: {
      name: "Wine Rack",
      rows: 8,
      cols: 8,
      depth: 1,
      storageRows: [],
    },
  },
  {
    icon: Archive,
    label: "Bulk Bin",
    description: "Open storage bin",
    template: {
      name: "Bulk Storage",
      rows: 1,
      cols: 1,
      depth: 1,
      storageRows: [
        { row: 0, name: "Bulk Storage", type: "bulk", capacity: 20 },
      ],
    },
  },
];

/* ── Extracted template button so hook is called at top level ── */

function SectionTemplateButton({
  template,
  onSelect,
  onClickAdd,
}: {
  template: (typeof TEMPLATES)[number];
  onSelect: (t: SectionTemplate) => void;
  onClickAdd?: (templateJson: string) => void;
}) {
  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "template",
    data: JSON.stringify(template.template),
    ghostLabel: template.label,
  });

  return (
    <button
      type="button"
      {...dragHandleProps}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 cursor-pointer transition-all text-sm"
      style={{ ...dragHandleProps.style, opacity: isDragging ? 0.5 : 1 }}
      onClick={() => {
        if (onClickAdd) {
          onClickAdd(JSON.stringify(template.template));
        } else {
          onSelect(template.template);
        }
      }}
    >
      <template.icon className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{template.label}</span>
    </button>
  );
}

interface StorageTypePickerProps {
  onSelect: (template: SectionTemplate) => void;
  /** Click handler for non-draggable add buttons */
  onClickAdd?: (templateJson: string) => void;
}

export function StorageTypePicker({
  onSelect,
  onClickAdd,
}: StorageTypePickerProps) {
  return (
    <div className="space-y-3">
      {/* Section templates — add a whole new section */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium shrink-0">
          Add section:
        </span>
        {TEMPLATES.map((t) => (
          <SectionTemplateButton
            key={t.label}
            template={t}
            onSelect={onSelect}
            onClickAdd={onClickAdd}
          />
        ))}
      </div>
    </div>
  );
}
