"use client";



interface SectionEditHeaderProps {
  name: string;
  depth: number;
  wineCount: number;
  totalCapacity: number;
  onNameChange: (name: string) => void;
  onDepthChange: (depth: number) => void;
}

export function SectionEditHeader({
  name,
  depth,
  wineCount,
  totalCapacity,
  onNameChange,
  onDepthChange,
}: SectionEditHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 min-w-0 overflow-hidden">
      {/* Editable name */}
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="font-semibold text-sm bg-transparent border-b border-dashed border-[rgba(245,230,202,0.4)] outline-none min-w-0 flex-1"
        style={{
          color: "var(--rack-name-color)",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Depth stepper */}
      <div
        className="flex items-center gap-2 shrink-0 rounded-md px-2 py-0.5"
        style={{ background: "rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="text-[11px] font-medium"
          style={{ color: "rgba(245,230,202,0.6)" }}
        >
          Depth
        </span>
        <button
          type="button"
          className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
          style={{
            color: "rgba(245,230,202,0.9)",
            background: "rgba(255,255,255,0.12)",
          }}
          onClick={() => onDepthChange(Math.max(1, depth - 1))}
          disabled={depth <= 1}
        >
          −
        </button>
        <span
          className="text-sm font-bold min-w-[18px] text-center"
          style={{ color: "rgba(245,230,202,0.95)" }}
        >
          {depth}
        </span>
        <button
          type="button"
          className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors disabled:opacity-30"
          style={{
            color: "rgba(245,230,202,0.9)",
            background: "rgba(255,255,255,0.12)",
          }}
          onClick={() => onDepthChange(Math.min(6, depth + 1))}
          disabled={depth >= 6}
        >
          +
        </button>
      </div>

      {/* Wine count */}
      <span
        className="text-xs shrink-0"
        style={{ color: "rgba(245,230,202,0.7)" }}
      >
        {wineCount} / {totalCapacity}
      </span>
    </div>
  );
}
