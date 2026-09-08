"use client";

import type { StorageRow } from "@/types/wine";

interface GridPreviewProps {
  rows: number;
  cols: number;
  storageRows: StorageRow[];
}

export function GridPreview({ rows, cols, storageRows }: GridPreviewProps) {
  const storageRowSet = new Map<number, StorageRow>();
  for (const sr of storageRows) {
    storageRowSet.set(sr.row, sr);
  }

  const maxDisplayCols = 15;

  return (
    <div className="border border-border rounded-lg p-2 overflow-x-auto">
      {Array.from({ length: rows }, (_, rowIdx) => {
        const sr = storageRowSet.get(rowIdx);
        const isStorage = !!sr;
        const typeIcon = sr?.type === "box" ? "\u{1F4E6}" : "\u25C7";

        return (
          <div
            key={rowIdx}
            className="flex gap-[3px] mb-[3px] last:mb-0 items-center"
          >
            <span className="w-7 text-[0.65em] font-semibold text-muted-foreground text-center shrink-0">
              R{rowIdx + 1}
            </span>
            {isStorage ? (
              <>
                <div className="flex-1 h-4 rounded-sm bg-amber-500/15 border border-amber-500/30" />
                <span className="text-[0.6em] text-amber-700 dark:text-amber-400 font-semibold whitespace-nowrap pl-1">
                  {typeIcon} {sr.name || "Storage"}
                </span>
              </>
            ) : (
              <>
                {Array.from(
                  { length: Math.min(cols, maxDisplayCols) },
                  (_, colIdx) => (
                    <div
                      key={colIdx}
                      className="w-5 h-4 rounded-sm bg-primary/15 border border-primary/25 shrink-0"
                    />
                  )
                )}
                {cols > maxDisplayCols && (
                  <span className="text-[0.65em] text-muted-foreground">
                    +{cols - maxDisplayCols}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
