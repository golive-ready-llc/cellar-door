"use client";

import { useState } from "react";
import { ShoppingCart, Plus } from "lucide-react";
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
import { WINE_TYPES, WINE_TYPE_LABELS } from "@/types/constants";
import type { BuyListItem, WineType } from "@/types/wine";

interface AddBuyListDialogProps {
  onAdd: (item: Omit<BuyListItem, "id" | "addedAt" | "userId">) => void;
  trigger?: React.ReactElement;
}

export function AddBuyListDialog({ onAdd, trigger }: AddBuyListDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [winery, setWinery] = useState("");
  const [vintage, setVintage] = useState("");
  const [type, setType] = useState<string>("red");
  const [grapeVariety, setGrapeVariety] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [alcohol, setAlcohol] = useState("");
  const [drinkWindow, setDrinkWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [foodPairings, setFoodPairings] = useState("");

  const resetForm = () => {
    setName("");
    setWinery("");
    setVintage("");
    setType("red");
    setGrapeVariety("");
    setRegion("");
    setCountry("");
    setRetailPrice("");
    setAlcohol("");
    setDrinkWindow("");
    setNotes("");
    setDescription("");
    setFoodPairings("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      onAdd({
        barcode: "",
        name: name.trim(),
        winery: winery.trim(),
        region: region.trim(),
        country: country.trim(),
        vintage: vintage ? parseInt(vintage, 10) : null,
        type: type as WineType,
        grapeVariety: grapeVariety.trim(),
        imageUrl: "",
        retailPrice: retailPrice ? parseFloat(retailPrice) : null,
        notes: notes.trim(),
        description: description.trim(),
        foodPairings: foodPairings.trim(),
        alcohol: alcohol.trim(),
        disposition: "",
        drinkWindow: drinkWindow.trim(),
        aiRatings: null,
        status: "wanted",
        orderDate: null,
        expectedDelivery: null,
        store: "",
      });
      resetForm();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add to List
            </Button>
          )
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Add to Buy List
            </DialogTitle>
            <DialogDescription>
              Add a wine you want to purchase to your wish list.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name — required */}
            <div className="grid gap-2">
              <Label htmlFor="buy-name">
                Wine Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="buy-name"
                placeholder="e.g. Screaming Eagle Cabernet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Winery + Vintage */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="buy-winery">Winery</Label>
                <Input
                  id="buy-winery"
                  placeholder="e.g. Screaming Eagle"
                  value={winery}
                  onChange={(e) => setWinery(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-vintage">Vintage</Label>
                <Input
                  id="buy-vintage"
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
                <Select value={type} onValueChange={(v) => v && setType(v)}>
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
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-grape">Grape Variety</Label>
                <Input
                  id="buy-grape"
                  placeholder="e.g. Cabernet Sauvignon"
                  value={grapeVariety}
                  onChange={(e) => setGrapeVariety(e.target.value)}
                />
              </div>
            </div>

            {/* Region + Country */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="buy-region">Region</Label>
                <Input
                  id="buy-region"
                  placeholder="e.g. Napa Valley"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-country">Country</Label>
                <Input
                  id="buy-country"
                  placeholder="e.g. USA"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>

            {/* Price + Alcohol + Drink Window */}
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="buy-price">Est. Price ($)</Label>
                <Input
                  id="buy-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-alcohol">Alcohol</Label>
                <Input
                  id="buy-alcohol"
                  placeholder="14.5%"
                  value={alcohol}
                  onChange={(e) => setAlcohol(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buy-window">Drink Window</Label>
                <Input
                  id="buy-window"
                  placeholder="2025-2035"
                  value={drinkWindow}
                  onChange={(e) => setDrinkWindow(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="buy-description">Description</Label>
              <Textarea
                id="buy-description"
                placeholder="Wine description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Food Pairings */}
            <div className="grid gap-2">
              <Label htmlFor="buy-pairings">Food Pairings</Label>
              <Input
                id="buy-pairings"
                placeholder="e.g. Steak, lamb, aged cheese"
                value={foodPairings}
                onChange={(e) => setFoodPairings(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="buy-notes">Notes</Label>
              <Textarea
                id="buy-notes"
                placeholder="Why you want this wine, where to buy it..."
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Adding..." : "Add to Buy List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
