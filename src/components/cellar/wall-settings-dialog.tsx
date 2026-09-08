"use client";

import { useState, useCallback } from "react";
import { Columns3, Plus, Trash2, GripVertical, Thermometer, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTier } from "@/hooks/use-tier";

import {
  updateWallHaConfig,
  removeWallHaConfig,
  testHaConnection,
} from "@/server/actions/walls";
import type { Wall } from "@/types/wine";
import { toast } from "@/components/ui/sonner";

interface WallSettingsDialogProps {
  walls: Wall[];
  onSave: (changes: WallChanges) => Promise<void>;
  onWallsChanged?: () => void;
  trigger?: React.ReactElement;
}

export interface WallChanges {
  created: Array<{ name: string; sortOrder: number }>;
  updated: Array<{ id: string; name?: string; sortOrder?: number }>;
  deleted: string[];
}

interface EditableWall {
  id: string;
  name: string;
  sortOrder: number;
  isNew: boolean;
  markedForDelete: boolean;
  originalName: string;
  haConfigured: boolean;
}

let tempIdCounter = 0;

export function WallSettingsDialog({
  walls,
  onSave,
  onWallsChanged,
  trigger,
}: WallSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editableWalls, setEditableWalls] = useState<EditableWall[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedSensorId, setExpandedSensorId] = useState<string | null>(null);

  // Initialize working copy when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setEditableWalls(
          walls.map((w) => ({
            id: w.id,
            name: w.name,
            sortOrder: w.sortOrder,
            isNew: false,
            markedForDelete: false,
            originalName: w.name,
            haConfigured: !!w.haConfig?.hasToken,
          }))
        );
        setConfirmDeleteId(null);
        setExpandedSensorId(null);
      }
      setOpen(nextOpen);
    },
    [walls]
  );

  const handleAddWall = () => {
    tempIdCounter++;
    setEditableWalls((prev) => [
      ...prev,
      {
        id: `new-wall-${tempIdCounter}`,
        name: `Wall ${prev.filter((w) => !w.markedForDelete).length + 1}`,
        sortOrder: prev.length,
        isNew: true,
        markedForDelete: false,
        originalName: "",
        haConfigured: false,
      },
    ]);
  };

  const handleUpdateName = (id: string, name: string) => {
    setEditableWalls((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name } : w))
    );
  };

  const handleDelete = (id: string) => {
    const wall = editableWalls.find((w) => w.id === id);
    if (!wall) return;

    if (wall.isNew) {
      setEditableWalls((prev) => prev.filter((w) => w.id !== id));
    } else {
      setEditableWalls((prev) =>
        prev.map((w) => (w.id === id ? { ...w, markedForDelete: true } : w))
      );
    }
    setConfirmDeleteId(null);
  };

  const handleUndoDelete = (id: string) => {
    setEditableWalls((prev) =>
      prev.map((w) => (w.id === id ? { ...w, markedForDelete: false } : w))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const changes: WallChanges = {
      created: editableWalls
        .filter((w) => w.isNew && !w.markedForDelete)
        .map((w) => ({ name: w.name, sortOrder: w.sortOrder })),
      updated: editableWalls
        .filter(
          (w) =>
            !w.isNew &&
            !w.markedForDelete &&
            w.name !== w.originalName
        )
        .map((w) => ({
          id: w.id,
          ...(w.name !== w.originalName && { name: w.name }),
        })),
      deleted: editableWalls
        .filter((w) => !w.isNew && w.markedForDelete)
        .map((w) => w.id),
    };

    try {
      await onSave(changes);
      setOpen(false);
      const actionCount = changes.created.length + changes.updated.length + changes.deleted.length;
      if (actionCount > 0) {
        toast.success(
          `Saved ${actionCount} change${actionCount !== 1 ? "s" : ""}`
        );
      }
    } catch (err) {
      // Surface the actual error so silent failures stop happening.
      const msg =
        err instanceof Error ? err.message : "Failed to save changes";
      console.error("[wall-settings-dialog] save failed:", err, "changes:", changes);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    editableWalls.some((w) => w.isNew && !w.markedForDelete) ||
    editableWalls.some(
      (w) => !w.isNew && !w.markedForDelete && w.name !== w.originalName
    ) ||
    editableWalls.some((w) => !w.isNew && w.markedForDelete);

  const visibleWalls = editableWalls.filter((w) => !w.markedForDelete);
  const deletedWalls = editableWalls.filter(
    (w) => !w.isNew && w.markedForDelete
  );

  // Allow deleting any wall (including the last one)
  const canDelete = visibleWalls.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger || (
            <Button variant="outline" size="sm">
              <Columns3 className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs sm:text-sm">Manage Walls</span>
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Walls</DialogTitle>
          <DialogDescription>
            Add, rename, or remove walls. Deleting a wall removes all its
            sections and unassigns their wines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {visibleWalls.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No walls yet. Add one to start organizing your cellar.
            </p>
          )}

          {visibleWalls.map((wall, index) => (
            <div key={wall.id}>
              {index > 0 && <Separator className="mb-3" />}
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Input
                    value={wall.name}
                    onChange={(e) =>
                      handleUpdateName(wall.id, e.target.value)
                    }
                    className="h-8 text-sm font-medium"
                    placeholder="Wall name"
                  />
                </div>
                {!wall.isNew && (
                  <SensorToggleButton
                    wallId={wall.id}
                    isExpanded={expandedSensorId === wall.id}
                    haConfigured={wall.haConfigured}
                    onToggle={() =>
                      setExpandedSensorId(
                        expandedSensorId === wall.id ? null : wall.id
                      )
                    }
                  />
                )}
                {confirmDeleteId === wall.id ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleDelete(wall.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDeleteId(wall.id)}
                    disabled={!canDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Sensor config section */}
              {expandedSensorId === wall.id && !wall.isNew && (
                <SensorConfigSection
                  wallId={wall.id}
                  existingWall={walls.find((w) => w.id === wall.id)}
                  onConfigChanged={() => {
                    setEditableWalls((prev) =>
                      prev.map((w) =>
                        w.id === wall.id ? { ...w, haConfigured: true } : w
                      )
                    );
                    onWallsChanged?.();
                  }}
                  onConfigRemoved={() => {
                    setEditableWalls((prev) =>
                      prev.map((w) =>
                        w.id === wall.id ? { ...w, haConfigured: false } : w
                      )
                    );
                    onWallsChanged?.();
                  }}
                />
              )}
            </div>
          ))}

          {/* Deleted walls (undo) */}
          {deletedWalls.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                {deletedWalls.map((wall) => (
                  <div
                    key={wall.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md bg-destructive/10 text-sm"
                  >
                    <span className="text-muted-foreground line-through">
                      {wall.originalName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleUndoDelete(wall.id)}
                    >
                      Undo
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Add wall button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleAddWall}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Wall
        </Button>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sensor Config Sub-components ────────────────────────────

function SensorToggleButton({
  haConfigured,
  onToggle,
}: {
  wallId: string;
  isExpanded: boolean;
  haConfigured: boolean;
  onToggle: () => void;
}) {
  const { can } = useTier();
  if (!can("haSensors")) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 ${haConfigured ? "text-orange-500" : "text-muted-foreground"}`}
      onClick={onToggle}
      title="Sensor settings"
    >
      <Thermometer className="h-4 w-4" />
    </Button>
  );
}

function SensorConfigSection({
  wallId,
  existingWall,
  onConfigChanged,
  onConfigRemoved,
}: {
  wallId: string;
  existingWall?: Wall;
  onConfigChanged: () => void;
  onConfigRemoved: () => void;
}) {
  const { userId } = useTier();
  const existing = existingWall?.haConfig;

  const [haUrl, setHaUrl] = useState(existing?.haUrl || "");
  const [token, setToken] = useState("");
  const [tempEntityId, setTempEntityId] = useState(existing?.tempEntityId || "");
  const [humidityEntityId, setHumidityEntityId] = useState(
    existing?.humidityEntityId || ""
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
  const [savingSensor, setSavingSensor] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleTest = async () => {
    if (!haUrl || !token) {
      setTestResult({ success: false, error: "URL and token are required" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testHaConnection(haUrl, token);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSensor = async () => {
    if (!userId || !haUrl || !tempEntityId) {
      toast.error("Missing required fields");
      return;
    }
    const tokenToSave = token || (existing?.hasToken ? "__keep__" : "");
    if (!tokenToSave) {
      toast.error("Access token is required");
      return;
    }

    setSavingSensor(true);
    try {
      const result = await updateWallHaConfig(
        userId,
        wallId,
        haUrl,
        tokenToSave === "__keep__" ? "" : tokenToSave,
        tempEntityId,
        humidityEntityId
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Sensor config saved");
      setToken(""); // Clear token from state
      // Direct server-action mutation — drop the lib/data read cache so the
      // follow-up wall refetch doesn't serve the pre-save snapshot.
      const { invalidateReadCache } = await import("@/lib/data");
      invalidateReadCache();
      onConfigChanged();
    } catch {
      toast.error("Failed to save sensor config");
    } finally {
      setSavingSensor(false);
    }
  };

  const handleRemove = async () => {
    if (!userId) return;
    setRemoving(true);
    try {
      const result = await removeWallHaConfig(userId, wallId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Sensor config removed");
      {
        const { invalidateReadCache } = await import("@/lib/data");
        invalidateReadCache();
      }
      setHaUrl("");
      setToken("");
      setTempEntityId("");
      setHumidityEntityId("");
      setTestResult(null);
      onConfigRemoved();
    } catch {
      toast.error("Failed to remove sensor config");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="mt-2 ml-6 p-3 rounded-lg bg-muted/30 border border-border/50 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Thermometer className="h-3 w-3" />
        Home Assistant Sensor
      </div>

      <div className="space-y-2">
        <Input
          value={haUrl}
          onChange={(e) => setHaUrl(e.target.value)}
          placeholder="https://your-ha.duckdns.org:8123"
          className="h-7 text-xs"
        />
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={existing?.hasToken ? "Token saved — enter new to change" : "Long-lived access token"}
          className="h-7 text-xs"
        />
        <Input
          value={tempEntityId}
          onChange={(e) => setTempEntityId(e.target.value)}
          placeholder="sensor.cellar_temperature"
          className="h-7 text-xs"
        />
        <Input
          value={humidityEntityId}
          onChange={(e) => setHumidityEntityId(e.target.value)}
          placeholder="sensor.cellar_humidity"
          className="h-7 text-xs"
        />
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-center gap-1.5 text-xs ${
            testResult.success ? "text-green-600" : "text-destructive"
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {testResult.success ? "Connected!" : testResult.error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleTest}
          disabled={testing || !haUrl || !token}
        >
          {testing ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : null}
          Test
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSaveSensor}
          disabled={savingSensor || !haUrl || !tempEntityId}
        >
          {savingSensor ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : null}
          Save Sensor
        </Button>
        {existing?.hasToken && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={removing}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
