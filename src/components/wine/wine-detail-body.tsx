"use client";

import { UtensilsCrossed, BookOpen, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TagPill } from "@/components/wine/tag-selector";
import { WineLabelThumbnail } from "@/components/wine/wine-label-thumbnail";
import { CdScoreInline } from "@/components/community/community-score";
import { ExpertScoreInline } from "@/components/wine/expert-score";
import {
  WINE_TYPE_COLORS,
  WINE_TYPE_LABELS,
  DISPOSITION_COLORS,
  DISPOSITION_LABELS,
  AI_RATING_LABELS,
} from "@/types/constants";
import { isLightWineType, isSparklingType, BOTTLE_SIZE_LABELS } from "@/types/wine";
import type { AiRatings } from "@/types/wine";

/**
 * The ONE read-only detail body, shared by every detail dialog (wine / history /
 * buy-list / discover). It owns the entire visual layout — photo-forward hero,
 * title, rating + CD score, the full spec grid, and the description / pairings /
 * notes sections — so the views are identical everywhere. Everything that varies
 * by context is passed in: the action buttons (`actions`), the "your rating"
 * control (`ratingSlot`), header extras like location/date/status
 * (`headerExtra`), and any extra sections such as community reviews or vintage
 * story (`children`).
 */
export interface WineDetailBodyData {
  name: string;
  winery?: string;
  vintage?: number | null;
  type: string;
  imageUrl?: string;
  region?: string;
  country?: string;
  grapeVariety?: string;
  alcohol?: string;
  drinkWindow?: string;
  drinkBy?: string;
  /** Purchase price */
  price?: number | null;
  /** Market value / estimated price */
  retailPrice?: number | null;
  purchaseDate?: string;
  barcode?: string;
  description?: string;
  foodPairings?: string;
  tastingNotes?: string | null;
  notes?: string;
  disposition?: string;
  sparkling?: boolean;
  /** Non-standard bottle format ("half" | "magnum" | "large"); hidden when standard. */
  bottleSize?: string;
  tags?: string[];
  aiRatings?: AiRatings | null;
  cdScore?: number | null;
  cdRatingCount?: number;
}

interface WineDetailBodyProps {
  data: WineDetailBodyData;
  /** Format a money value; defaults to a plain $x.xx. */
  formatPrice?: (amount: number) => string;
  /** "Your Rating" control — context-specific (interactive stars, dial, etc.). */
  ratingSlot?: React.ReactNode;
  /** Context action buttons (Edit / Consume / Purchase / Move / Delete …). */
  actions?: React.ReactNode;
  /** Extra meta under the title (cellar location, removed date, wishlist status). */
  headerExtra?: React.ReactNode;
  /** Extra sections appended after the grid (community reviews, vintage story…). */
  children?: React.ReactNode;
  /** Hero image edit/AI callbacks (owned wines only). */
  onImageChange?: (url: string) => void;
  onAiFetchImage?: () => Promise<string>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function WineDetailBody({
  data,
  formatPrice,
  ratingSlot,
  actions,
  headerExtra,
  children,
  onImageChange,
  onAiFetchImage,
}: WineDetailBodyProps) {
  const normType = (data.type || "red").toLowerCase();
  const typeColor = WINE_TYPE_COLORS[normType as keyof typeof WINE_TYPE_COLORS] || "#666";
  const typeLabel = WINE_TYPE_LABELS[normType as keyof typeof WINE_TYPE_LABELS] || data.type;
  const money = (n: number) => (formatPrice ? formatPrice(n) : `$${n.toFixed(2)}`);

  return (
    <div className="space-y-4">
      {/* Photo-forward hero */}
      <WineLabelThumbnail
        variant="hero"
        imageUrl={data.imageUrl ?? ""}
        wineName={data.name}
        typeColor={typeColor}
        onImageChange={onImageChange}
        onAiFetch={onAiFetchImage}
      />

      {/* Title block */}
      <div className="pr-8 space-y-1.5">
        <h2 className="text-display leading-tight">{data.name}</h2>
        {(data.winery || data.vintage) && (
          <p className="text-body text-muted-foreground">
            {data.winery}
            {data.vintage ? ` · ${data.vintage}` : ""}
          </p>
        )}
        {headerExtra}
      </div>

      {/* Your rating + Expert Score + CD score */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {ratingSlot}
        </div>
        {/* Expert Score — 1-5 from AI-estimated public critic ratings.
            Self-hides when the wine has none; callers gate aiRatings on tier. */}
        <ExpertScoreInline aiRatings={data.aiRatings} />
        <CdScoreInline score={data.cdScore} ratingCount={data.cdRatingCount} />
      </div>

      {/* Context actions */}
      {actions}

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge style={{ backgroundColor: typeColor, color: isLightWineType(normType) ? "#333" : "#fff" }}>
          {typeLabel}
        </Badge>
        {data.sparkling && !isSparklingType(normType) && (
          <Badge style={{ backgroundColor: WINE_TYPE_COLORS.sparkling, color: "#333" }}>Sparkling</Badge>
        )}
        {data.disposition && (
          <Badge style={{ backgroundColor: DISPOSITION_COLORS[data.disposition] || "#666", color: "#fff" }}>
            {DISPOSITION_LABELS[data.disposition] || data.disposition}
          </Badge>
        )}
        {data.tags?.map((tag) => (
          <TagPill key={tag} tag={tag} compact />
        ))}
      </div>

      <Separator />

      {/* Spec grid — every populated field */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {data.region && <DetailItem label="Region" value={data.region} />}
        {data.country && <DetailItem label="Country" value={data.country} />}
        {data.grapeVariety && <DetailItem label="Grape" value={data.grapeVariety} />}
        {data.bottleSize && data.bottleSize !== "standard" && (
          <DetailItem label="Bottle" value={BOTTLE_SIZE_LABELS[data.bottleSize as keyof typeof BOTTLE_SIZE_LABELS] ?? data.bottleSize} />
        )}
        {data.alcohol && <DetailItem label="ABV" value={data.alcohol} />}
        {data.drinkWindow && <DetailItem label="Drink Window" value={data.drinkWindow} />}
        {data.drinkBy && <DetailItem label="Drink By" value={data.drinkBy} />}
        {data.price !== null && data.price !== undefined && (
          <DetailItem label="Purchase Price" value={money(data.price)} />
        )}
        {data.retailPrice !== null && data.retailPrice !== undefined && (
          <DetailItem label="Market Value" value={money(data.retailPrice)} />
        )}
        {data.purchaseDate && <DetailItem label="Purchased" value={data.purchaseDate} />}
        {data.barcode && <DetailItem label="Barcode" value={data.barcode} />}
      </div>

      {/* Description */}
      {data.description && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
            <p className="text-sm">{data.description}</p>
          </div>
        </>
      )}

      {/* AI-estimated critic scores — shown when present (caller decides
          whether to pass them, e.g. gated on the AI tier). */}
      {data.aiRatings &&
        Object.values(data.aiRatings).some((v) => v !== null && v !== undefined) && (
          <>
            <Separator />
            <div>
              <div className="flex items-center gap-1 mb-2">
                <Award className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">AI-Estimated Critic Scores</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.aiRatings)
                  .filter(([, val]) => val !== null && val !== undefined)
                  .map(([key, val]) => (
                    <Badge key={key} variant="secondary">
                      {AI_RATING_LABELS[key] || key}:
                      <span className="font-bold ml-1">{(val as number).toString()}</span>
                    </Badge>
                  ))}
              </div>
            </div>
          </>
        )}

      {/* Extra sections (community reviews, vintage story…) */}
      {children}

      {/* Food pairings */}
      {data.foodPairings && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-1 mb-1">
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Food Pairings</p>
            </div>
            <p className="text-sm">{data.foodPairings}</p>
          </div>
        </>
      )}

      {/* Tasting notes */}
      {data.tastingNotes && (
        <>
          <Separator />
          <div>
            <div className="flex items-center gap-1 mb-2">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">Tasting Notes</p>
            </div>
            <p className="text-sm whitespace-pre-line">{data.tastingNotes}</p>
          </div>
        </>
      )}

      {/* Personal notes */}
      {data.notes && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Personal Notes</p>
            <p className="text-sm italic">{data.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}
