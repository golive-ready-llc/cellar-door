// One home for the client-side collection mutation protocol: how a wine
// create/edit/consume/duplicate reaches the data layer AND syncs every piece
// of UI state that holds a copy of the collection. The cellar, inventory, and
// stats surfaces each used to keep their own copies of these handlers, and the
// copies drifted — duplicate-bottle went batched in inventory while the cellar
// still fired up to 99 sequential server actions for the same feature.

import { toast } from "@/components/ui/custom-toast";
import { bulkCreateWines, createWine, deleteWine, editWine } from "@/lib/data";
import type { NewWineInput, Wine } from "@/types/wine";

type SetWines = React.Dispatch<React.SetStateAction<Wine[]>>;
type SetSelectedWine = React.Dispatch<React.SetStateAction<Wine | null>>;

interface SyncTargets {
  userId: string | null | undefined;
  setWines: SetWines;
  setSelectedWine?: SetSelectedWine;
}

/**
 * Edit a wine and mirror the server's returned row into every state copy.
 * Returns the updated row, or null when the server reports no change.
 */
export async function editWineAndSync(
  wineId: string,
  data: Partial<Wine>,
  { userId, setWines, setSelectedWine }: SyncTargets
): Promise<Wine | null> {
  const updated = await editWine(wineId, data, userId);
  if (!updated) return null;
  setWines((prev) =>
    prev.map((w) => (w.id === wineId ? { ...w, ...updated } : w))
  );
  setSelectedWine?.((prev) =>
    prev?.id === wineId ? { ...prev, ...updated } : prev
  );
  return updated;
}

/**
 * Move a wine to history: remove it from the collection, close the detail
 * dialog, and surface the outcome. Errors are caught here because every
 * caller wants the same toast and none want an unhandled rejection.
 */
export async function consumeWineAndSync(
  wineId: string,
  reason: string,
  rating: number | null | undefined,
  notes: string | undefined,
  {
    userId,
    setWines,
    setSelectedWine,
    setDetailOpen,
  }: SyncTargets & { setDetailOpen: (open: boolean) => void }
): Promise<void> {
  try {
    await deleteWine(wineId, reason, rating, notes, userId);
    setWines((prev) => prev.filter((w) => w.id !== wineId));
    setSelectedWine?.(null);
    setDetailOpen(false);
    toast.success("Wine moved to history");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to remove wine");
  }
}

/** Create a wine and put it at the top of the collection. */
export async function addWineAndPrepend(
  data: NewWineInput,
  { userId, setWines }: SyncTargets
): Promise<Wine> {
  const created = await createWine(data, userId);
  setWines((prev) => [created, ...prev]);
  return created;
}

/**
 * The payload for "another bottle of this wine": a copy minus its identity.
 * Duplicating IS creating a duplicate, so the same-name+winery+vintage check
 * is always skipped. `unfile` also clears the slot placement — the Duplicate
 * flow sends its copies to the unfiled pile — while Add Bottle keeps the slot
 * so the new bottle stacks where the opened one sits.
 */
export function buildDuplicateWineInput(
  wine: Wine,
  { unfile }: { unfile: boolean }
): NewWineInput {
  const {
    id: _id,
    addedAt: _addedAt,
    updatedAt: _updatedAt,
    userId: _userId,
    ...wineData
  } = wine;
  const payload = unfile
    ? { ...wineData, cabinetId: null, row: null, col: null, depth: 0, zone: "" }
    : wineData;
  return { ...payload, skipDuplicateCheck: true };
}

/**
 * Duplicate a wine N times with ONE batched server call, and put the created
 * bottles at the top of the collection. The count is clamped to 1–99.
 */
export async function duplicateWinesAndPrepend(
  wine: Wine,
  count: number,
  { userId, setWines }: SyncTargets
): Promise<Wine[]> {
  const safeCount = Math.max(1, Math.min(99, Math.floor(count)));
  const payload = buildDuplicateWineInput(wine, { unfile: true });
  const created = await bulkCreateWines(
    Array.from({ length: safeCount }, () => ({ ...payload })),
    userId
  );
  setWines((prev) => [...created, ...prev]);
  return created;
}

/**
 * Apply one edit per wine across a batch of ids, a few server calls at a
 * time — kept small so a mobile connection doesn't queue dozens of server
 * actions at once. A mapper returning null skips that wine.
 */
export async function editWinesInBatches(
  wineIds: string[],
  toUpdate: (wineId: string) => Partial<Wine> | null,
  userId: string | null | undefined
): Promise<void> {
  const BATCH_SIZE = 5;
  for (let i = 0; i < wineIds.length; i += BATCH_SIZE) {
    await Promise.all(
      wineIds.slice(i, i + BATCH_SIZE).map(async (id) => {
        const data = toUpdate(id);
        if (data) await editWine(id, data, userId);
      })
    );
  }
}
