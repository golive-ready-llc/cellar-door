"use client";

import { useState, useEffect } from "react";
import { Wine as WineIcon, Star, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WineNameAutocomplete } from "@/components/wine/wine-name-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  WINE_TYPES,
  WINE_TYPE_LABELS,
  WINE_TYPE_COLORS,
  DISPOSITION_OPTIONS,
} from "@/types/constants";
import { isLightWineType, type Wine, type Cabinet } from "@/types/wine";
import { TagSelector } from "@/components/wine/tag-selector";

interface EditWineDialogProps {
  wine: Wine;
  cabinets: Cabinet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (wineId: string, data: Partial<Wine>) => Promise<void>;
  allTags?: string[];
}

export function EditWineDialog({
  wine,
  cabinets,
  open,
  onOpenChange,
  onSave,
  allTags = [],
}: EditWineDialogProps) {
  const [saving, setSaving] = useState(false);

  // Form state — initialized from wine prop
  const [name, setName] = useState("");
  const [winery, setWinery] = useState("");
  const [vintage, setVintage] = useState("");
  const [type, setType] = useState("red");
  const [sparkling, setSparkling] = useState(false);
  const [grapeVariety, setGrapeVariety] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [price, setPrice] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [cabinetId, setCabinetId] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [disposition, setDisposition] = useState("");
  const [drinkWindow, setDrinkWindow] = useState("");
  const [foodPairings, setFoodPairings] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Populate form when dialog opens or wine changes
  useEffect(() => {
    if (open) {
      setName(wine.name);
      setWinery(wine.winery);
      setVintage(wine.vintage?.toString() ?? "");
      setType(wine.type);
      setSparkling(wine.sparkling ?? false);
      setGrapeVariety(wine.grapeVariety);
      setRegion(wine.region);
      setCountry(wine.country);
      setPrice(wine.price?.toString() ?? "");
      setAlcohol(wine.alcohol);
      setCabinetId(wine.cabinetId ?? "");
      setNotes(wine.notes);
      setDescription(wine.description);
      setUserRating(wine.userRating);
      setDisposition(wine.disposition);
      setDrinkWindow(wine.drinkWindow);
      setFoodPairings(wine.foodPairings);
      setTags(wine.tags ?? []);
    }
  }, [open, wine]);

  const missingType = !type || !WINE_TYPES.includes(type as typeof WINE_TYPES[number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave(wine.id, {
        name: name.trim(),
        winery: winery.trim(),
        vintage: vintage ? parseInt(vintage, 10) : null,
        type: type as Wine["type"],
        sparkling,
        grapeVariety: grapeVariety.trim(),
        region: region.trim(),
        country: country.trim(),
        price: price ? parseFloat(price) : null,
        alcohol: alcohol.trim(),
        cabinetId: cabinetId || null,
        notes: notes.trim(),
        description: description.trim(),
        userRating,
        disposition,
        drinkWindow: drinkWindow.trim(),
        foodPairings: foodPairings.trim(),
        tags,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const typeColor =
    WINE_TYPE_COLORS[wine.type as keyof typeof WINE_TYPE_COLORS] || "#666";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  isLightWineType(wine.type) && "border-2 border-border"
                )}
                style={{ backgroundColor: typeColor }}
              >
                <WineIcon
                  className="h-4 w-4"
                  style={{ color: isLightWineType(wine.type) ? "#333" : "#fff" }}
                />
              </div>
              Edit Wine
            </DialogTitle>
            <DialogDescription>
              Update the details for this wine.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {missingType && (
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>This wine has no type set. Please select one below (red, white, etc.).</span>
              </div>
            )}
            {/* Name — required */}
            <div className="grid gap-2">
              <Label htmlFor="edit-wine-name">
                Wine Name <span className="text-destructive">*</span>
              </Label>
              <WineNameAutocomplete
                id="edit-wine-name"
                placeholder="e.g. Caymus Cabernet Sauvignon"
                value={name}
                autoFocus
                onChange={setName}
                onPickSuggestion={(s) => {
                  if (!winery && s.winery) setWinery(s.winery);
                  if (!vintage && s.vintage) setVintage(String(s.vintage));
                  if (s.type) setType(s.type);
                  if (!region && s.region) setRegion(s.region);
                  if (!country && s.country) setCountry(s.country);
                  if (!grapeVariety && s.grapeVariety) setGrapeVariety(s.grapeVariety);
                }}
              />
            </div>

            {/* Winery + Vintage row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="edit-wine-winery">Winery</Label>
                <Input
                  id="edit-wine-winery"
                  placeholder="e.g. Caymus Vineyards"
                  value={winery}
                  onChange={(e) => setWinery(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-vintage">Vintage</Label>
                <Input
                  id="edit-wine-vintage"
                  type="number"
                  placeholder="2021"
                  min={1900}
                  max={2099}
                  value={vintage}
                  onChange={(e) => setVintage(e.target.value)}
                />
              </div>
            </div>

            {/* Type + Grape */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
                  <SelectTrigger>
                    <SelectValue>
                      {WINE_TYPE_LABELS[type as keyof typeof WINE_TYPE_LABELS] ||
                        type}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {WINE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {WINE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border accent-amber-500"
                    checked={sparkling}
                    onChange={(e) => setSparkling(e.target.checked)}
                  />
                  Sparkling
                </label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-grape">Grape Variety</Label>
                <Input
                  id="edit-wine-grape"
                  placeholder="e.g. Cabernet Sauvignon"
                  value={grapeVariety}
                  onChange={(e) => setGrapeVariety(e.target.value)}
                />
              </div>
            </div>

            {/* Region + Country */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-region">Region</Label>
                <Input
                  id="edit-wine-region"
                  placeholder="e.g. Napa Valley"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-country">Country</Label>
                <Input
                  id="edit-wine-country"
                  placeholder="e.g. USA"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>

            {/* Price + Alcohol + Section */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-price">Price ($)</Label>
                <Input
                  id="edit-wine-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-alcohol">Alcohol</Label>
                <Input
                  id="edit-wine-alcohol"
                  placeholder="14.5%"
                  value={alcohol}
                  onChange={(e) => setAlcohol(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Section</Label>
                <Select value={cabinetId} onValueChange={(v) => setCabinetId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select...">
                      {cabinets.find((c) => c.id === cabinetId)?.name ||
                        "Unassigned"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {cabinets.map((cab) => (
                      <SelectItem key={cab.id} value={cab.id}>
                        {cab.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rating + Disposition + Drink Window */}
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
              <div className="grid gap-2">
                <Label>Your Rating</Label>
                <div className="flex items-center gap-0.5 h-8">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-0.5 transition-transform hover:scale-110"
                      onClick={() =>
                        setUserRating(userRating === star ? null : star)
                      }
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5 transition-colors",
                          (hoverRating ?? userRating ?? 0) >= star
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-muted-foreground/30"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Disposition</Label>
                <Select value={disposition} onValueChange={(v) => setDisposition(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue>
                      {DISPOSITION_OPTIONS.find((d) => d.value === disposition)
                        ?.label ?? "Not set"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {DISPOSITION_OPTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-wine-drink-window">Drink Window</Label>
                <Input
                  id="edit-wine-drink-window"
                  placeholder="2025-2030"
                  value={drinkWindow}
                  onChange={(e) => setDrinkWindow(e.target.value)}
                />
              </div>
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagSelector
                tags={tags}
                onChange={setTags}
                allTags={allTags}
              />
            </div>

            {/* Food Pairings */}
            <div className="grid gap-2">
              <Label htmlFor="edit-wine-pairings">Food Pairings</Label>
              <Input
                id="edit-wine-pairings"
                placeholder="Steak, lamb, aged cheese..."
                value={foodPairings}
                onChange={(e) => setFoodPairings(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="edit-wine-description">Description</Label>
              <Textarea
                id="edit-wine-description"
                placeholder="Tasting notes, appearance, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="edit-wine-notes">Personal Notes</Label>
              <Textarea
                id="edit-wine-notes"
                placeholder="Your personal notes about this wine..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
