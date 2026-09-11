"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { decodeCsvBytes, parseWineCsv, type ImportedWine } from "@/lib/csv-import";

interface CSVImportDialogProps {
  onImport: (wines: ImportedWine[]) => Promise<void>;
  trigger?: React.ReactElement;
}

export function CSVImportDialog({ onImport, trigger }: CSVImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<
    ImportedWine[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [_headers, setHeaders] = useState<string[]>([]);
  const [mappedFields, setMappedFields] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setPreview(null);
    setError(null);
    setHeaders([]);
    setMappedFields([]);
    setSkipped(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        if (!buffer || typeof buffer === "string") {
          setError("Failed to read the file.");
          return;
        }
        // Decode the bytes ourselves: CellarTracker exports can be
        // Windows-1252, which FileReader's UTF-8 text mode would garble.
        const result = parseWineCsv(decodeCsvBytes(buffer));
        setHeaders(result.headers);
        setMappedFields(result.mappedFields);
        setSkipped(result.skippedConsumed);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPreview(result.wines);
      } catch {
        setError("Failed to parse CSV file. Please check the format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!preview) return;

    setImporting(true);
    try {
      await onImport(preview);
      resetState();
      setOpen(false);
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetState();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm" className="text-xs">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Import CSV
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Wines from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or tab-delimited file to import wines. Supports
            CellarTracker, Vivino, and custom formats.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                Click to select a CSV file
              </span>
              <span className="text-xs text-muted-foreground">
                Supports CellarTracker, Vivino, and custom CSV formats
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Mapped fields */}
          {mappedFields.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Mapped fields:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {mappedFields.map((f) => (
                  <Badge key={f} variant="outline" className="text-xs">
                    <Check className="h-3 w-3 mr-1 text-green-500" />
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Rows skipped on purpose, e.g. CellarTracker bottles already drunk */}
          {skipped > 0 && (
            <p className="text-xs text-muted-foreground">
              Skipped {skipped} {skipped === 1 ? "row" : "rows"} marked as
              consumed or with no bottles left.
            </p>
          )}

          {/* Preview */}
          {preview && (
            <div>
              <p className="text-sm font-medium mb-2">
                Found <strong>{preview.length}</strong> wines to import:
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {preview.slice(0, 20).map((wine, idx) => (
                  <div
                    key={idx}
                    className="text-xs flex items-center gap-2 py-1"
                  >
                    <span className="text-muted-foreground w-5 text-right">
                      {idx + 1}.
                    </span>
                    <span className="font-medium truncate flex-1">
                      {wine.name}
                    </span>
                    {wine.winery && (
                      <span className="text-muted-foreground truncate max-w-24">
                        {wine.winery}
                      </span>
                    )}
                    {wine.vintage && (
                      <span className="text-muted-foreground">
                        {wine.vintage}
                      </span>
                    )}
                  </div>
                ))}
                {preview.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    ... and {preview.length - 20} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetState();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!preview || importing}
          >
            {importing
              ? "Importing..."
              : preview
                ? `Import ${preview.length} Wines`
                : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
