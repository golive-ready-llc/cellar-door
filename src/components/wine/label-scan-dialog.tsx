"use client";

import { useState, useCallback } from "react";
import {
  Camera,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  Wine as WineIcon,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ImageCapture } from "./image-capture";
import { WINE_TYPES, WINE_TYPE_LABELS } from "@/types/constants";
import type { Wine, WineType, Cabinet } from "@/types/wine";
import { aiScanLabel } from "@/server/actions/ai";
import { useTier } from "@/hooks/use-tier";

interface LabelScanDialogProps {
  cabinets: Cabinet[];
  onAdd: (
    wine: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">
  ) => void | Promise<void>;
  trigger?: React.ReactElement;
}

type Step = "capture" | "identifying" | "review";

export function LabelScanDialog({
  cabinets,
  onAdd,
  trigger,
}: LabelScanDialogProps) {
  const { userId } = useTier();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("capture");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");

  // Wine fields (populated by AI)
  const [name, setName] = useState("");
  const [winery, setWinery] = useState("");
  const [vintage, setVintage] = useState("");
  const [type, setType] = useState<string>("red");
  const [sparkling, setSparkling] = useState(false);
  const [grapeVariety, setGrapeVariety] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [price, setPrice] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [description, setDescription] = useState("");
  const [drinkBy, setDrinkBy] = useState("");
  const [drinkWindow, setDrinkWindow] = useState("");
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [cabinetId, setCabinetId] = useState(
    cabinets.length > 0 ? cabinets[0].id : ""
  );

  const resetAll = () => {
    setStep("capture");
    setError(null);
    setImageBase64(null);
    setName("");
    setWinery("");
    setVintage("");
    setType("red");
    setSparkling(false);
    setGrapeVariety("");
    setRegion("");
    setCountry("");
    setPrice("");
    setAlcohol("");
    setDescription("");
    setDrinkBy("");
    setDrinkWindow("");
    setDisposition("");
    setNotes("");
    setCabinetId(cabinets.length > 0 ? cabinets[0].id : "");
  };

  const handleCapture = useCallback(
    (base64: string, mimeType: string) => {
      setImageBase64(base64);
      setImageMimeType(mimeType);
    },
    []
  );

  const handleIdentify = useCallback(async () => {
    if (!imageBase64) return;

    // Client-side image validation before sending to server
    const decodedSize = Math.ceil((imageBase64.length * 3) / 4);
    const MAX_BYTES = 20 * 1024 * 1024; // 20MB (matches server limit)
    if (decodedSize > MAX_BYTES) {
      setError(`Image too large (${Math.round(decodedSize / (1024 * 1024))}MB). Maximum is 20MB.`);
      return;
    }
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!ALLOWED_TYPES.includes(imageMimeType)) {
      setError(`Unsupported image type: ${imageMimeType}. Allowed: JPEG, PNG, WebP, AVIF.`);
      return;
    }

    setStep("identifying");
    setError(null);

    try {
      const result = await aiScanLabel(imageBase64, imageMimeType, userId ?? undefined);

      if (!result.success) {
        setError(result.error === "not_a_wine_label"
          ? "This doesn't appear to be a wine label. Please try another image."
          : result.error);
        setStep("capture");
        return;
      }

      const wine = result.data;

      // Populate form fields
      setName(wine.name || "");
      setWinery(wine.winery || "");
      setVintage(wine.vintage != null ? String(wine.vintage) : "");
      // Trust what the AI returned; only fall back to "red" if AI literally returned nothing.
      setType(wine.type && WINE_TYPES.includes(wine.type as WineType) ? wine.type : "red");
      setSparkling(wine.sparkling === true);
      setGrapeVariety(wine.grapeVariety || "");
      setRegion(wine.region || "");
      setCountry(wine.country || "");
      setPrice(wine.estimatedPrice != null ? String(wine.estimatedPrice) : "");
      setAlcohol(wine.alcohol || "");
      setDescription(wine.description || "");
      setDrinkBy(wine.drinkBy || "");
      setDrinkWindow(wine.drinkWindow || "");
      setDisposition(wine.disposition || "");
      setNotes("");

      setStep("review");
    } catch {
      setError("Failed to identify wine. Please try again.");
      setStep("capture");
    }
  }, [imageBase64, imageMimeType, userId]);

  const handleSave = async () => {
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await onAdd({
        cabinetId: cabinetId || null,
        barcode: "",
        name: name.trim(),
        winery: winery.trim(),
        region: region.trim(),
        country: country.trim(),
        vintage: vintage ? parseInt(vintage, 10) : null,
        type: type as WineType,
        sparkling,
        grapeVariety: grapeVariety.trim(),
        userRating: null,
        imageUrl: imageBase64 ? `data:${imageMimeType};base64,${imageBase64}` : "",
        price: null,
        retailPrice: price ? parseFloat(price) : null,
        purchaseDate: new Date().toISOString().split("T")[0],
        drinkBy: drinkBy.trim(),
        notes: notes.trim(),
        description: description.trim(),
        foodPairings: "",
        alcohol: alcohol.trim(),
        row: null,
        col: null,
        depth: 0,
        zone: "",
        tastingNotes: null,
        disposition: disposition.trim(),
        drinkWindow: drinkWindow.trim(),
        aiRatings: null,
        tags: [],
      });
      resetAll();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save wine. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetAll();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Camera className="h-4 w-4" />
              Label
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "capture" && (
              <>
                <Camera className="h-5 w-5 text-primary" />
                Scan Wine Label
              </>
            )}
            {step === "identifying" && (
              <>
                <Sparkles className="h-5 w-5 text-amber-500" />
                Identifying Wine...
              </>
            )}
            {step === "review" && (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Wine Identified
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "capture" &&
              "Take a photo of a wine label or upload an image. AI will identify the wine and fill in all the details."}
            {step === "identifying" &&
              "Our AI sommelier is analyzing the label..."}
            {step === "review" &&
              "Review the identified wine details and edit if needed."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Capture */}
          {step === "capture" && (
            <>
              <ImageCapture
                onCapture={handleCapture}
                label="Capture a wine label for AI identification"
              />

              {imageBase64 && (
                <Button variant="ai"
                  onClick={handleIdentify}
                  className="w-full gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Identify Wine with AI
                </Button>
              )}
            </>
          )}

          {/* Step 2: Identifying */}
          {step === "identifying" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <WineIcon className="h-12 w-12 text-primary" />
                <Loader2 className="h-6 w-6 text-amber-500 animate-spin absolute -bottom-1 -right-1" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Analyzing wine label...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Our AI sommelier is identifying the wine, vintage, and more
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <>
              <Badge
                variant="outline"
                className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI identified — review and save
              </Badge>

              {/* Scanned label photo */}
              {imageBase64 && (
                <div className="rounded-lg overflow-hidden border border-border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${imageMimeType};base64,${imageBase64}`}
                    alt="Scanned wine label"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              )}

              <div className="grid gap-3">
                {/* Name */}
                <div className="grid gap-1.5">
                  <Label htmlFor="scan-name" className="text-xs">
                    Wine Name *
                  </Label>
                  <Input
                    id="scan-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Winery + Vintage */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 grid gap-1.5">
                    <Label className="text-xs">Winery</Label>
                    <Input
                      value={winery}
                      onChange={(e) => setWinery(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Vintage</Label>
                    <Input
                      type="number"
                      value={vintage}
                      onChange={(e) => setVintage(e.target.value)}
                    />
                  </div>
                </div>

                {/* Type + Grape */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={type}
                      onValueChange={(v) => v && setType(v)}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {WINE_TYPE_LABELS[type as keyof typeof WINE_TYPE_LABELS] || type}
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
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none mt-0.5">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-border accent-amber-500"
                        checked={sparkling}
                        onChange={(e) => setSparkling(e.target.checked)}
                      />
                      Sparkling
                    </label>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Grape</Label>
                    <Input
                      value={grapeVariety}
                      onChange={(e) => setGrapeVariety(e.target.value)}
                    />
                  </div>
                </div>

                {/* Region + Country */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Region</Label>
                    <Input
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Country</Label>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>

                {/* Market Value + Alcohol + Section */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Market Value ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Alcohol</Label>
                    <Input
                      value={alcohol}
                      onChange={(e) => setAlcohol(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Section</Label>
                    <Select
                      value={cabinetId}
                      onValueChange={(v) => v && setCabinetId(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select...">
                          {cabinets.find((c) => c.id === cabinetId)?.name || "Select..."}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {cabinets.map((cab) => (
                          <SelectItem key={cab.id} value={cab.id}>
                            {cab.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Drink Window + Disposition */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Drink Window</Label>
                    <Input
                      value={drinkWindow}
                      onChange={(e) => setDrinkWindow(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Drink By</Label>
                    <Input
                      value={drinkBy}
                      onChange={(e) => setDrinkBy(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Readiness</Label>
                    <Select
                      value={disposition}
                      onValueChange={(v) => v && setDisposition(v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—">
                          {disposition === "D"
                            ? "Drink Now"
                            : disposition === "H"
                              ? "Hold"
                              : disposition === "P"
                                ? "Past Peak"
                                : "—"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="D">Drink Now</SelectItem>
                        <SelectItem value="H">Hold</SelectItem>
                        <SelectItem value="P">Past Peak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div className="grid gap-1.5">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Notes */}
                <div className="grid gap-1.5">
                  <Label className="text-xs">Personal Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {step === "capture" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetAll();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          )}

          {step === "review" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Clear stale capture + identification fields so the
                  // capture view reopens fresh instead of overlaying the
                  // "Identify Wine with AI" button on the prior image.
                  setStep("capture");
                  setError(null);
                  setImageBase64(null);
                  setName("");
                  setWinery("");
                  setVintage("");
                }}
              >
                Scan Again
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? "Saving..." : "Save to Cellar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
