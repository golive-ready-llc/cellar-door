import type { StorageRow, Wine } from "@/types/wine";

export interface StorageBoxLayout {
  hasBoxes: boolean;
  totalBoxCapacity: number;
  looseCapacity: number;
  sortedWines: Wine[];
  boxRanges: { start: number; end: number }[];
  boxColOffsets: number[];
  boxWineGroups: Wine[][];
  looseWines: Wine[];
}

/**
 * Shared layout model for a storage row (bulk/box zone): wines sorted by
 * column, grouped into case boxes by col range, with the remainder loose.
 * Both the in-grid zone and the side drill-down view render from it.
 */
export function computeStorageBoxLayout(
  storageRow: StorageRow,
  wines: Wine[]
): StorageBoxLayout {
  const boxes = storageRow.boxes;
  const hasBoxes = boxes != null && boxes.length > 0;
  const totalBoxCapacity = hasBoxes ? boxes.reduce((sum, b) => sum + b, 0) : 0;
  const looseCapacity = storageRow.capacity - totalBoxCapacity;

  const sortedWines = [...wines].sort((a, b) => (a.col ?? 0) - (b.col ?? 0));

  const boxRanges: { start: number; end: number }[] = hasBoxes
    ? boxes.reduce<{ start: number; end: number }[]>((acc, boxSize) => {
        const prevEnd = acc.length > 0 ? acc[acc.length - 1].end : 0;
        acc.push({ start: prevEnd, end: prevEnd + boxSize });
        return acc;
      }, [])
    : [];
  const boxColOffsets: number[] = boxRanges.map((r) => r.start);
  const boxWineGroups: Wine[][] = boxRanges.map(({ start, end }) =>
    sortedWines.filter((w) => {
      const col = w.col ?? 0;
      return col >= start && col < end;
    })
  );
  const looseWines: Wine[] = hasBoxes
    ? sortedWines.filter((w) => (w.col ?? 0) >= totalBoxCapacity)
    : sortedWines;

  return {
    hasBoxes,
    totalBoxCapacity,
    looseCapacity,
    sortedWines,
    boxRanges,
    boxColOffsets,
    boxWineGroups,
    looseWines,
  };
}
