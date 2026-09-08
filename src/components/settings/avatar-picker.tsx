"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  { name: "Wine Red", value: "#722F37" },
  { name: "Burgundy", value: "#800020" },
  { name: "Gold", value: "#C5A028" },
  { name: "Sage", value: "#6B8E5A" },
  { name: "Navy", value: "#1B365D" },
  { name: "Plum", value: "#673147" },
  { name: "Terracotta", value: "#CC6633" },
  { name: "Slate", value: "#607080" },
];

interface AvatarPickerProps {
  initials: string;
  currentColor: string;
  currentPhoto: string | null;
  onColorSelect: (color: string) => void;
  onPhotoSelect: (dataUrl: string) => void;
}

export function AvatarPicker({
  initials,
  currentColor,
  currentPhoto,
  onColorSelect,
  onPhotoSelect,
}: AvatarPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = 128;
      canvas.height = 128;
      // Center crop
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
      onPhotoSelect(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = URL.createObjectURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium">Avatar Color</p>
      <div className="flex gap-2 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all",
              currentColor === c.value && !currentPhoto
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                : "hover:scale-105"
            )}
            style={{ backgroundColor: c.value }}
            onClick={() => onColorSelect(c.value)}
            title={c.name}
          >
            {initials}
          </button>
        ))}
        {/* Upload photo button */}
        <button
          type="button"
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors",
            currentPhoto && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
          onClick={() => fileRef.current?.click()}
          title="Upload photo"
        >
          {currentPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- user avatar, base64 or Firebase URL
            <img
              src={currentPhoto}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <Camera className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
