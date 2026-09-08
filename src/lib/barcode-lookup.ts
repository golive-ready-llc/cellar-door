import { isSparklingType, type Wine, type WineType } from "@/types/wine";
import { aiBarcodeLookup } from "@/server/actions/ai";

/** The wine form fields managed by the review step. */
export interface WineFormFields {
  name: string;
  winery: string;
  vintage: string;
  type: string;
  grapeVariety: string;
  region: string;
  country: string;
  price: string;
  alcohol: string;
  description: string;
  drinkBy: string;
  drinkWindow: string;
  disposition: string;
  notes: string;
  cabinetId: string;
}

export type LookupResult =
  | { success: true; fields: WineFormFields }
  | { success: false; error: string };

/**
 * Look up a barcode and map the AI result to form field values.
 */
export async function lookupBarcode(
  barcode: string,
  defaultCabinetId: string
): Promise<LookupResult> {
  const result = await aiBarcodeLookup(barcode);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const wine = result.data;

  return {
    success: true,
    fields: {
      name: wine.name || "",
      winery: wine.winery || "",
      vintage: wine.vintage != null ? String(wine.vintage) : "",
      type: wine.type || "red",
      grapeVariety: wine.grapeVariety || "",
      region: wine.region || "",
      country: wine.country || "",
      price: wine.estimatedPrice != null ? String(wine.estimatedPrice) : "",
      alcohol: wine.alcohol || "",
      description: wine.description || "",
      drinkBy: wine.drinkBy || "",
      drinkWindow: wine.drinkWindow || "",
      disposition: wine.disposition || "",
      notes: "",
      cabinetId: defaultCabinetId,
    },
  };
}

/** Build the wine object to pass to onAdd from the current form fields. */
export function buildWineFromFields(
  fields: WineFormFields,
  barcodeValue: string
): Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId"> {
  return {
    cabinetId: fields.cabinetId || null,
    barcode: barcodeValue,
    name: fields.name.trim(),
    winery: fields.winery.trim(),
    region: fields.region.trim(),
    country: fields.country.trim(),
    vintage: fields.vintage ? parseInt(fields.vintage, 10) : null,
    type: fields.type as WineType,
    sparkling: isSparklingType(fields.type),
    grapeVariety: fields.grapeVariety.trim(),
    userRating: null,
    imageUrl: "",
    price: null,
    retailPrice: fields.price ? parseFloat(fields.price) : null,
    purchaseDate: "",
    drinkBy: fields.drinkBy.trim(),
    notes: fields.notes.trim(),
    description: fields.description.trim(),
    foodPairings: "",
    alcohol: fields.alcohol.trim(),
    row: null,
    col: null,
    depth: 0,
    zone: "",
    tastingNotes: null,
    disposition: fields.disposition.trim(),
    drinkWindow: fields.drinkWindow.trim(),
    aiRatings: null,
    tags: [],
  };
}
