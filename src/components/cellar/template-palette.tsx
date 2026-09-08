"use client";

import { TEMPLATES } from "./storage-type-picker";
import { useTouchDrag } from "@/hooks/use-touch-drag";

/* ── Extracted chip components so hooks are called at the top level ── */

function TemplateChip({
  template,
  onClickAdd,
}: {
  template: (typeof TEMPLATES)[number];
  onClickAdd?: (templateJson: string) => void;
}) {
  const { isDragging, dragHandleProps } = useTouchDrag({
    type: "template",
    data: JSON.stringify(template.template),
    ghostLabel: template.label,
  });

  return (
    <div
      {...dragHandleProps}
      onClick={() => onClickAdd?.(JSON.stringify(template.template))}
      className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors select-none"
      style={{ ...dragHandleProps.style, opacity: isDragging ? 0.5 : 1 }}
    >
      <template.icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium">{template.label}</span>
    </div>
  );
}

/* ── Main palette ── */

interface TemplatePaletteProps {
  onClickAdd?: (templateJson: string) => void;
}

export function TemplatePalette({
  onClickAdd,
}: TemplatePaletteProps) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-dashed border-border bg-muted/50">
      {/* Section templates */}
      <div className="flex gap-3 items-center">
        <span className="text-xs text-muted-foreground self-center font-medium shrink-0">
          Add section:
        </span>
        {TEMPLATES.map((t) => (
          <TemplateChip key={t.label} template={t} onClickAdd={onClickAdd} />
        ))}
      </div>
    </div>
  );
}
