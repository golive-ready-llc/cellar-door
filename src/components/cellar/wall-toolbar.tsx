"use client";

import { Check, X, Grid2x2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WallSettingsDialog, type WallChanges } from "@/components/cellar/wall-settings-dialog";
import { HaSensorChip } from "@/components/cellar/ha-sensor-chip";
import type { Wall } from "@/types/wine";

interface WallToolbarProps {
  walls: Wall[];
  locationWalls: Wall[];
  locations: string[];
  selectedWallId: string | null;
  selectedLocation: string;
  editMode: boolean;
  moveMode: boolean;
  saving: boolean;
  showDiscardConfirm: boolean;
  onWallSelect: (id: string) => void;
  onLocationSelect: (loc: string) => void;
  onWallChanges: (changes: WallChanges) => Promise<void>;
  onWallsChanged: () => Promise<void>;
  onEnterEditMode: () => void;
  onSaveEditMode: () => void;
  onCancelEditMode: () => void;
  onExitMoveMode: () => void;
  onShowDiscardConfirm: (show: boolean) => void;
}

export function WallToolbar({
  walls,
  locationWalls,
  locations,
  selectedWallId,
  selectedLocation,
  editMode,
  moveMode,
  saving,
  showDiscardConfirm,
  onWallSelect,
  onLocationSelect,
  onWallChanges,
  onWallsChanged,
  onEnterEditMode,
  onSaveEditMode,
  onCancelEditMode,
  onExitMoveMode,
  onShowDiscardConfirm,
}: WallToolbarProps) {
  if (walls.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <WallSettingsDialog
          walls={walls}
          onSave={onWallChanges}
          onWallsChanged={onWallsChanged}
        />
        {selectedWallId && !editMode && !moveMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEnterEditMode}
            title="Edit layout"
          >
            <Grid2x2 className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-xs sm:text-sm">Edit Layout</span>
          </Button>
        )}
        {moveMode && (
          <Button size="sm" onClick={onExitMoveMode}>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Done
          </Button>
        )}
        {editMode && (
          <>
            <Button
              size="sm"
              onClick={onSaveEditMode}
              disabled={saving}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Saving..." : "Done"}
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShowDiscardConfirm(true)}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
              {showDiscardConfirm && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
                  <p className="text-sm font-medium mb-2">
                    Discard changes?
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    All layout changes will be lost.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onShowDiscardConfirm(false)}
                    >
                      No
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        onShowDiscardConfirm(false);
                        onCancelEditMode();
                      }}
                    >
                      Yes, discard
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Location filter */}
      {locations.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-1">
          <Badge
            variant={selectedLocation === "all" ? "default" : "outline"}
            className="cursor-pointer select-none text-xs"
            onClick={() => onLocationSelect("all")}
          >
            All Locations
          </Badge>
          {locations.map((loc) => (
            <Badge
              key={loc}
              variant={selectedLocation === loc ? "default" : "outline"}
              className="cursor-pointer select-none text-xs"
              onClick={() => onLocationSelect(loc)}
            >
              {loc}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs
          value={selectedWallId ?? locationWalls[0]?.id}
          onValueChange={(val: string | number | null) =>
            onWallSelect(val as string)
          }
        >
          <TabsList variant="line">
            {locationWalls.map((wall) => (
              <TabsTrigger key={wall.id} value={wall.id}>
                {wall.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {(() => {
          const activeWall = locationWalls.find(
            (w) => w.id === (selectedWallId ?? locationWalls[0]?.id)
          );
          return activeWall?.haConfig ? (
            <HaSensorChip wall={activeWall} />
          ) : null;
        })()}
      </div>
    </div>
  );
}
