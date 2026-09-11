"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, X, Maximize2, Pencil, Sparkles, Loader2, Wine as WineIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WineLabelThumbnailProps {
  /** Image URL — can be empty string, http URL, or data URL */
  imageUrl: string;
  /** Wine name for alt text */
  wineName: string;
  /** Wine type color for hero background gradient */
  typeColor?: string;
  /** Display variant */
  variant?: "portrait" | "hero";
  /** When provided, shows edit controls and calls back with URL/data-URL on change */
  onImageChange?: (imageUrl: string) => void;
  /** When provided, shows "AI Find" button to search for an image */
  onAiFetch?: () => Promise<string>;
  /** Children to render overlaid on the hero area (e.g. rating badges) */
  children?: React.ReactNode;
}

/**
 * Wine-label image component with two modes:
 *
 * `portrait` — 96px wide column thumbnail, sits left of dialog headers.
 * `hero`    — Full-width banner at top of a dialog with gradient background.
 *
 * Both support lightbox zoom, edit/upload dialog, and AI image search.
 */
export function WineLabelThumbnail({
  imageUrl,
  wineName,
  typeColor = "#666",
  variant = "portrait",
  onImageChange,
  onAiFetch,
  children,
}: WineLabelThumbnailProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [aiFetching, setAiFetching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const hasImage = imageUrl && imageUrl.length > 0;
  const editable = !!onImageChange;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onImageChange?.(dataUrl);
        setEditOpen(false);
      };
      reader.readAsDataURL(file);
      if (fileRef.current) fileRef.current.value = "";
    },
    [onImageChange]
  );

  const handleAiFetch = useCallback(async () => {
    if (!onAiFetch || !onImageChange) return;
    setAiFetching(true);
    try {
      const url = await onAiFetch();
      if (url) {
        onImageChange(url);
      }
    } finally {
      setAiFetching(false);
    }
  }, [onAiFetch, onImageChange]);

  // Hidden file input (shared)
  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      className="hidden"
    />
  );

  // Lightbox dialog
  const lightbox = hasImage ? (
    <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl p-2">
        <DialogHeader className="sr-only">
          <DialogTitle>{wineName} — Wine Label</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${wineName} wine label`}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  ) : null;

  // Edit dialog
  const editDialog = editable ? (
    <Dialog open={editOpen} onOpenChange={setEditOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Label Photo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {hasImage && (
            <div className="rounded-lg overflow-hidden border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Current label"
                className="w-full max-h-40 object-contain"
              />
            </div>
          )}

          <div className="flex gap-2">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors w-full">
                <Camera className="h-4 w-4" />
                Camera
              </div>
            </label>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>

          {onAiFetch && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              disabled={aiFetching}
              onClick={async () => {
                await handleAiFetch();
                setEditOpen(false);
              }}
            >
              {aiFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiFetching ? "Searching..." : "Find with AI"}
            </Button>
          )}

          {hasImage && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => {
                onImageChange?.("");
                setEditOpen(false);
              }}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Remove photo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  // ═══════════════════════════════════════════════════
  // HERO VARIANT
  // ═══════════════════════════════════════════════════
  if (variant === "hero") {
    return (
      <>
        {fileInput}
        {lightbox}
        {editDialog}

        {/* shrink-0 is load-bearing: DialogContent is a max-height flex
            column, and this container's overflow-hidden (for the rounded
            corners) gives it an implicit min-height of 0 — so on any wine
            with enough content to overflow, flexbox crushed the ENTIRE
            hero to 0px and the label photo vanished. Verified live. */}
        <div
          className="relative shrink-0 -mx-6 -mt-6 rounded-t-lg overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${typeColor}18 0%, ${typeColor}30 50%, ${typeColor}10 100%)`,
          }}
        >
          {/* Subtle pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, ${typeColor} 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
            }}
          />

          <div className="relative flex flex-col items-center py-6 px-4 min-h-[200px]">
            {hasImage ? (
              <button
                type="button"
                className="relative group cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={`${wineName} wine label`}
                  className="max-h-[220px] w-auto rounded-lg shadow-lg border border-white/20 object-contain"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                  <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </button>
            ) : (
              <div
                className={cn(
                  "w-32 h-44 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2",
                  editable
                    ? "border-foreground/20 cursor-pointer hover:border-foreground/40 hover:bg-white/10 transition-colors"
                    : "border-foreground/10"
                )}
                role={editable ? "button" : undefined}
                tabIndex={editable ? 0 : undefined}
                onClick={editable ? () => fileRef.current?.click() : undefined}
                onKeyDown={
                  editable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ")
                          fileRef.current?.click();
                      }
                    : undefined
                }
              >
                <WineIcon className="h-8 w-8 text-foreground/20" />
                {editable && (
                  <span className="text-[10px] text-foreground/40 text-center leading-tight px-2">
                    Add wine label photo
                  </span>
                )}
              </div>
            )}

            {/* Edit button (floating) */}
            {editable && hasImage && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-2 right-4 h-7 w-7 shadow-md opacity-70 hover:opacity-100"
                title="Change photo"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}

            {/* AI fetch button (when no image) */}
            {editable && !hasImage && onAiFetch && (
              <Button
              variant="ai"
              size="sm"
              className="mt-2 h-7 px-3 text-xs gap-1.5"
                disabled={aiFetching}
                onClick={handleAiFetch}
              >
                {aiFetching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {aiFetching ? "Searching..." : "Find with AI"}
              </Button>
            )}

            {/* Overlay children (rating badges etc) */}
            {children}
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════
  // PORTRAIT VARIANT (default)
  // ═══════════════════════════════════════════════════
  if (!hasImage) {
    return (
      <>
        {fileInput}
        {editDialog}
        {/* Camera input — separate hidden input with capture attribute for mobile */}
        {editable && (
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        )}
        <div className="shrink-0 w-24 flex flex-col items-center">
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center gap-1.5 min-h-[120px] transition-colors",
              editable && "cursor-pointer hover:border-foreground/30 hover:bg-muted/50"
            )}
            onClick={editable ? () => setEditOpen(true) : undefined}
            disabled={!editable}
          >
            {aiFetching ? (
              <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-muted-foreground/40" />
            )}
            {editable && !aiFetching && (
              <span className="text-[9px] text-muted-foreground">
                Add photo
              </span>
            )}
            {aiFetching && (
              <span className="text-[9px] text-amber-500">
                Searching...
              </span>
            )}
          </button>
        </div>
      </>
    );
  }

  // ── Has image (portrait) ──
  return (
    <>
      {fileInput}
      {lightbox}
      {editDialog}

      {/* Portrait thumbnail — fixed height prevents stretching with dialog content */}
      <div className="shrink-0 w-24 relative group" style={{ height: 128 }}>
        <button
          type="button"
          className="w-full h-full rounded-lg overflow-hidden border border-border bg-muted cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${wineName} wine label`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide broken images — muted bg acts as placeholder
              e.currentTarget.style.display = "none";
            }}
          />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg pointer-events-none" />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 shadow-md"
            title="View full size"
            onClick={() => setLightboxOpen(true)}
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
          {editable && (
            <Button
              variant="secondary"
              size="icon"
              className="h-6 w-6 shadow-md"
              title="Change photo"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
