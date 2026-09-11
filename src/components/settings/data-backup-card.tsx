"use client";

import { useRef, useState } from "react";
import { Download, Upload, DatabaseBackup, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  fetchAllDataForBackup,
  restoreFromBackup,
  fetchWines,
  fetchCabinets,
  bulkCreateWines,
} from "@/lib/data";
import { winesToCSV, validateBackup, type CellarBackup } from "@/lib/backup-utils";
import { CSVImportDialog } from "@/components/wine/csv-import-dialog";
import { toast } from "@/components/ui/custom-toast";
import { useAuth } from "@/components/auth-provider";
import { saveAndShareFile } from "@/lib/capacitor";
import type { Wine } from "@/types/wine";

export function DataBackupCard() {
  const { userId } = useAuth();
  const restoreRef = useRef<HTMLInputElement>(null);
  const [, setImporting] = useState(false);

  // ── CSV Export ───────────────────────────────────────────
  const handleCSVExport = async () => {
    try {
      const [wines, cabinets] = await Promise.all([
        fetchWines(userId),
        fetchCabinets(userId),
      ]);
      const cabinetMap = new Map(cabinets.map((c) => [c.id, c.name]));
      const csv = winesToCSV(wines, cabinetMap);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `cellar-door-inventory-${new Date().toISOString().split("T")[0]}.csv`;
      const reShare = await saveAndShareFile(blob, filename, "Cellar Door Inventory");
      toast.success(`CSV exported — ${filename}`, {
        duration: 10000,
        action: { label: "Share", onClick: reShare },
      });
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  // ── CSV Import ───────────────────────────────────────────
  const handleCSVImport = async (
    wineData: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">[]
  ) => {
    setImporting(true);
    try {
      const created = await bulkCreateWines(wineData, userId);
      const failed = wineData.length - created.length;
      if (failed > 0) {
        toast.warning(
          `Imported ${created.length} of ${wineData.length} wines. ${failed} could not be saved.`
        );
      } else {
        toast.success(`Imported ${created.length} wines`);
      }
    } catch {
      toast.error("Failed to import wines");
    } finally {
      setImporting(false);
    }
  };

  // ── Full Backup (JSON) ──────────────────────────────────
  const handleCreateBackup = async () => {
    try {
      const data = await fetchAllDataForBackup(userId);
      const backup: CellarBackup = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        data,
      };
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const filename = `cellar-door-backup-${new Date().toISOString().split("T")[0]}.json`;
      const reShare = await saveAndShareFile(blob, filename, "Cellar Door Backup");
      toast.success(`Backup created — ${filename}`, {
        duration: 10000,
        action: { label: "Share", onClick: reShare },
      });
    } catch {
      toast.error("Failed to create backup");
    }
  };

  // ── Restore Backup ──────────────────────────────────────
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!validateBackup(parsed)) {
          toast.error("Invalid backup file format");
          return;
        }

        // Confirm with user
        const { data } = parsed;
        const counts = [
          data.wines.length && `${data.wines.length} wines`,
          data.walls.length && `${data.walls.length} walls`,
          data.cabinets.length && `${data.cabinets.length} sections`,
          data.history.length && `${data.history.length} history items`,
          data.buyList.length && `${data.buyList.length} buy list items`,
        ]
          .filter(Boolean)
          .join(", ");

        if (
          !window.confirm(
            `This will replace ALL your data with the backup contents:\n\n${counts}\n\nAre you sure?`
          )
        ) {
          return;
        }

        await restoreFromBackup(data, userId);
        toast.success("Backup restored! Refresh to see changes.");
      } catch {
        toast.error("Failed to restore backup");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data & Backup</CardTitle>
        <CardDescription>
          Export, import, and back up your cellar data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CSV Section */}
        <div>
          <p className="text-sm font-medium mb-2">CSV</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCSVExport}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <CSVImportDialog
              onImport={handleCSVImport}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV
                </Button>
              }
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Export your wines as a spreadsheet, or import wines from CSV.
          </p>
        </div>

        <Separator />

        {/* Cloud / Full Backup Section */}
        <div>
          <p className="text-sm font-medium mb-2">Full Backup</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCreateBackup}
            >
              <DatabaseBackup className="h-3.5 w-3.5" />
              Create Backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => restoreRef.current?.click()}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Backup
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Create a full backup (JSON) of all wines, cabinets, walls, history,
            and buy list. Restore replaces all data.
          </p>
        </div>

        {/* Hidden file input for restore */}
        <input
          ref={restoreRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleRestoreFile}
        />

      </CardContent>
    </Card>
  );
}
