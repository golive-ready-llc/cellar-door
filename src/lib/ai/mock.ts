// Mock AI provider for dev mode (no API key required)
// Returns realistic-looking data for all AI operations

import type { AIProvider } from "./provider";
import type {
  WineIdentification,
  AiTastingNotesResult,
  AiFoodPairingsResult,
  AiPriceEstimation,
  AiDrinkWindowResult,
  AiCriticScoresResult,
  AiWineEnrichmentResult,
  AiWineImageResult,
  WineListExtractionResult,
  AiRecommendationResult,
  AiDecantRecommendationResult,
  BatchDispositionResult,
  WineDataInput,
  AiMealPairingResult,
  MealPairingWineInput,
  AiTerroirTwinResult,
  AiPourCostResult,
  PourCostWineInput,
  WineSuggestionsResult,
  WineSuggestion,
  VintageStoryResult,
} from "./types";

// Simulate network delay
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hardcoded suggestion fixtures — a spread of wines users commonly type
const MOCK_SUGGESTIONS: WineSuggestion[] = [
  { name: "Opus One", winery: "Opus One Winery", vintage: 2019, type: "red", region: "Napa Valley", country: "USA", grapeVariety: "Cabernet Sauvignon Blend" },
  { name: "Caymus Cabernet Sauvignon", winery: "Caymus Vineyards", vintage: 2021, type: "red", region: "Napa Valley", country: "USA", grapeVariety: "Cabernet Sauvignon" },
  { name: "Cloudy Bay Sauvignon Blanc", winery: "Cloudy Bay", vintage: 2023, type: "white", region: "Marlborough", country: "New Zealand", grapeVariety: "Sauvignon Blanc" },
  { name: "Whispering Angel", winery: "Château d'Esclans", vintage: 2023, type: "rosé", region: "Provence", country: "France", grapeVariety: "Grenache Blend" },
  { name: "Veuve Clicquot Yellow Label", winery: "Veuve Clicquot", vintage: null, type: "sparkling", region: "Champagne", country: "France", grapeVariety: "Pinot Noir, Chardonnay, Pinot Meunier" },
  { name: "Château Margaux", winery: "Château Margaux", vintage: 2015, type: "red", region: "Margaux", country: "France", grapeVariety: "Cabernet Sauvignon Blend" },
  { name: "Screaming Eagle Cabernet Sauvignon", winery: "Screaming Eagle", vintage: 2020, type: "red", region: "Napa Valley", country: "USA", grapeVariety: "Cabernet Sauvignon" },
  { name: "Penfolds Grange", winery: "Penfolds", vintage: 2018, type: "red", region: "South Australia", country: "Australia", grapeVariety: "Shiraz" },
  { name: "Sassicaia", winery: "Tenuta San Guido", vintage: 2019, type: "red", region: "Tuscany", country: "Italy", grapeVariety: "Cabernet Sauvignon, Cabernet Franc" },
  { name: "Château d'Yquem", winery: "Château d'Yquem", vintage: 2015, type: "dessert", region: "Sauternes", country: "France", grapeVariety: "Sémillon, Sauvignon Blanc" },
];

export class MockAIProvider implements AIProvider {
  async searchWineSuggestions(query: string, limit?: number): Promise<WineSuggestionsResult> {
    await delay(120);
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { suggestions: [] };
    const max = Math.max(1, Math.min(20, limit ?? 8));
    const hits = MOCK_SUGGESTIONS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.winery.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.grapeVariety.toLowerCase().includes(q),
    ).slice(0, max);
    return { suggestions: hits };
  }

  async searchWine(query: string): Promise<WineIdentification> {
    await delay(800 + Math.random() * 700);

    // Parse query for hints
    const lower = query.toLowerCase();
    const hasVintage = lower.match(/\b(19|20)\d{2}\b/);
    const vintage = hasVintage ? parseInt(hasVintage[0], 10) : 2020;

    // Return mock data that roughly matches the query
    if (lower.includes("opus one")) {
      return {
        name: "Opus One",
        winery: "Opus One Winery",
        vintage,
        type: "red",
        region: "Napa Valley",
        country: "USA",
        grapeVariety: "Cabernet Sauvignon, Merlot, Cabernet Franc",
        description:
          "A Bordeaux-style blend from the legendary Napa Valley partnership. Rich cassis and blackberry notes with cedar, tobacco, and violet undertones. Silky tannins and remarkable length.",
        estimatedPrice: 450,
        alcohol: "14.5%",
        disposition: "H",
        drinkBy: `${vintage + 20}`,
        drinkWindow: `${vintage + 5}-${vintage + 20}`,
        ratings: {
          rating_ws: 96,
          rating_rp: 97,
          rating_jd: 96,
          rating_ag: 95,
        },
        notes: "Iconic Napa Valley first-growth quality",
      };
    }

    if (lower.includes("whispering angel") || lower.includes("rosé") || lower.includes("rose")) {
      return {
        name: "Whispering Angel",
        winery: "Château d'Esclans",
        vintage,
        type: "rosé",
        region: "Côtes de Provence",
        country: "France",
        grapeVariety: "Grenache, Cinsault, Rolle",
        description:
          "Pale salmon-pink with delicate aromas of fresh strawberry and white peach. Crisp and refreshing with vibrant acidity and a mineral finish.",
        estimatedPrice: 22,
        alcohol: "13%",
        disposition: "D",
        drinkBy: `${vintage + 2}`,
        drinkWindow: `${vintage}-${vintage + 2}`,
        ratings: {
          rating_ws: 90,
          rating_rp: undefined,
          rating_jd: undefined,
          rating_ag: 89,
        },
        notes: "Best-selling premium Provence rosé",
      };
    }

    // Generic wine based on query keywords
    const _isRed = lower.includes("red") || lower.includes("cab") || lower.includes("merlot") || lower.includes("pinot noir");
    const isWhite = lower.includes("white") || lower.includes("chard") || lower.includes("sauv blanc") || lower.includes("riesling");
    const isSparkling = lower.includes("champ") || lower.includes("spark") || lower.includes("prosecco");

    const type = isSparkling
      ? "sparkling" as const
      : isWhite
        ? "white" as const
        : "red" as const;

    return {
      name: query.split(/\d{4}/)[0].trim() || query,
      winery: "AI-Identified Winery",
      vintage,
      type,
      region: type === "red" ? "Napa Valley" : type === "white" ? "Burgundy" : "Champagne",
      country: type === "red" ? "USA" : "France",
      grapeVariety:
        type === "red"
          ? "Cabernet Sauvignon"
          : type === "white"
            ? "Chardonnay"
            : "Pinot Noir, Chardonnay",
      description: `A ${type === "sparkling" ? "elegant sparkling" : type === "white" ? "crisp and elegant white" : "rich and structured red"} wine with well-balanced flavors and a lingering finish.`,
      estimatedPrice: type === "sparkling" ? 55 : type === "red" ? 35 : 25,
      alcohol: type === "sparkling" ? "12%" : type === "red" ? "14%" : "13%",
      disposition: "D",
      drinkBy: `${vintage + (type === "red" ? 8 : 3)}`,
      drinkWindow: `${vintage}-${vintage + (type === "red" ? 8 : 3)}`,
      ratings: {
        rating_ws: 89 + Math.floor(Math.random() * 5),
        rating_rp: 88 + Math.floor(Math.random() * 6),
        rating_jd: undefined,
        rating_ag: undefined,
      },
      notes: "AI-identified wine (mock data)",
    };
  }

  async scanLabel(
    _imageBase64: string,
    _mimeType: string
  ): Promise<WineIdentification> {
    await delay(1200 + Math.random() * 800);
    return {
      name: "Reserve Cabernet Sauvignon",
      winery: "Silver Oak Cellars",
      vintage: 2019,
      type: "red",
      region: "Alexander Valley",
      country: "USA",
      grapeVariety: "Cabernet Sauvignon",
      description:
        "Deep garnet with aromas of blackberry, cassis, and toasted oak. Full-bodied with velvety tannins and a long, spicy finish. American oak aging gives it a distinctive vanilla character.",
      estimatedPrice: 85,
      alcohol: "13.9%",
      disposition: "H",
      drinkBy: "2035",
      drinkWindow: "2024-2035",
      ratings: {
        rating_ws: 92,
        rating_rp: 93,
        rating_jd: 94,
        rating_ag: 92,
      },
      notes: "Scanned from label — flagship Alexander Valley bottling",
    };
  }

  async generateTastingNotes(
    wine: WineDataInput
  ): Promise<AiTastingNotesResult> {
    await delay(600 + Math.random() * 400);

    const isRed = wine.type === "red";
    const isWhite = wine.type === "white";

    return {
      tastingNotes: {
        aroma: isRed
          ? `Intense aromas of ripe blackberry and dark cherry, with subtle notes of cedar, vanilla, and a hint of tobacco from oak aging. The bouquet develops complexity with swirling.`
          : isWhite
            ? `Bright citrus and green apple on the nose, with undertones of white flowers and a subtle minerality. Hints of toasted almond emerge with aeration.`
            : `Effervescent and lively with fresh brioche and toasted hazelnut aromas. Delicate citrus blossom and ripe pear notes add complexity.`,
        taste: isRed
          ? `Full-bodied and layered on the palate with concentrated dark fruit flavors. Firm but well-integrated tannins provide structure, while notes of espresso and dark chocolate add depth.`
          : isWhite
            ? `Crisp and refreshing with vibrant acidity. Flavors of lemon curd, ripe peach, and a touch of honey balanced by a clean mineral backbone.`
            : `Fine, persistent bubbles carry flavors of green apple, brioche, and candied lemon. Creamy texture with excellent balance between richness and acidity.`,
        finish: isRed
          ? `Long and lingering finish with persistent tannins and a final flourish of spice and dark fruit. Excellent aging potential.`
          : isWhite
            ? `Clean, refreshing finish with lingering citrus notes and a pleasant mineral aftertaste.`
            : `Elegant and extended finish with notes of toasted almond and a refreshing citrus lift.`,
        overall: isRed
          ? `An impressive ${wine.type} that balances power and elegance. A wine of considerable depth that will reward cellaring.`
          : isWhite
            ? `A vibrant and well-crafted ${wine.type} that showcases the terroir beautifully. Excellent as an aperitif or with seafood.`
            : `A refined and celebratory wine with excellent pedigree. Perfect for special occasions.`,
      },
      description: `${wine.name} from ${wine.winery} is a ${wine.type === "red" ? "rich, full-bodied" : wine.type === "white" ? "crisp, elegant" : "refined, effervescent"} ${wine.type} wine${wine.vintage ? ` from the ${wine.vintage} vintage` : ""}. ${wine.region ? `Sourced from ${wine.region}, it` : "It"} showcases ${wine.type === "red" ? "dark fruit, oak spice, and velvety tannins" : wine.type === "white" ? "bright citrus, stone fruit, and mineral character" : "fine bubbles, toasty brioche, and crisp acidity"}.`,
    };
  }

  async generateFoodPairings(
    wine: WineDataInput
  ): Promise<AiFoodPairingsResult> {
    await delay(500 + Math.random() * 400);

    const pairings: Record<string, { foods: string; notes: string }> = {
      red: {
        foods:
          "Grilled ribeye steak with herb butter, Braised lamb shanks with rosemary, Wild mushroom risotto, Aged Comté cheese, Beef bourguignon, Dark chocolate truffles, Roasted duck breast with cherry reduction, Hard aged Manchego",
        notes:
          "The firm tannins and dark fruit profile of this red pair beautifully with rich, umami-laden dishes. The wine's structure can stand up to bold flavors while its acidity cuts through fat. Aged cheeses mirror the wine's complexity.",
      },
      white: {
        foods:
          "Pan-seared halibut with lemon beurre blanc, Lobster tail with drawn butter, Caesar salad with grilled chicken, Fresh goat cheese and herb crostini, Roasted chicken with tarragon, Grilled shrimp with garlic and herbs, Oysters on the half shell, Triple-cream Brie",
        notes:
          "The bright acidity and citrus character make this white an ideal match for seafood and lighter proteins. The wine's mineral backbone complements the brininess of shellfish, while its subtle richness pairs with creamy cheeses.",
      },
      rosé: {
        foods:
          "Grilled Mediterranean vegetables, Niçoise salad, Seared tuna with sesame crust, Charcuterie board with prosciutto, Summer tomato and burrata salad, Grilled salmon with dill, Feta and watermelon salad, Herbed focaccia with olive tapenade",
        notes:
          "This rosé's versatility shines with Mediterranean-inspired dishes. Its fresh acidity and red fruit notes bridge the gap between red and white wine pairings, making it perfect for lighter fare with bold flavors.",
      },
      sparkling: {
        foods:
          "Caviar with blinis and crème fraîche, Fried chicken, Smoked salmon on toasted brioche, Raw oysters with mignonette, Parmesan crisps, Strawberries with cream, Eggs Benedict, Soft-ripened Camembert",
        notes:
          "The effervescence and acidity of this sparkling wine make it an exceptional food partner. The bubbles act as a palate cleanser, cutting through rich and fried dishes, while the toasty notes complement savory preparations.",
      },
      dessert: {
        foods:
          "Crème brûlée, Blue cheese and honeycomb, Poached pears with cinnamon, Almond biscotti, Foie gras with fig jam, Dark chocolate tart, Apple tarte tatin, Roquefort with walnut bread",
        notes:
          "The sweetness and rich flavors of this dessert wine create beautiful contrasts with salty blue cheeses and complement caramelized desserts. Its acidity prevents the pairing from becoming cloying.",
      },
    };

    const p = pairings[wine.type] || pairings.red;
    return {
      foodPairings: p.foods,
      pairingNotes: p.notes,
    };
  }

  async estimatePrice(wine: WineDataInput): Promise<AiPriceEstimation> {
    await delay(400 + Math.random() * 300);
    const base = wine.price || 30;
    return {
      estimatedPrice: Math.round(base * (0.9 + Math.random() * 0.3)),
      priceRange: {
        low: Math.round(base * 0.7),
        high: Math.round(base * 1.4),
      },
      confidence: "medium",
      notes: `Based on ${wine.vintage ?? "NV"} ${wine.winery} ${wine.name} from ${wine.region || "unknown region"}. Market price reflects current US retail availability.`,
    };
  }

  async suggestDrinkWindow(wine: WineDataInput): Promise<AiDrinkWindowResult> {
    await delay(400 + Math.random() * 300);
    const currentYear = new Date().getFullYear();
    const vintage = wine.vintage || currentYear;
    const age = currentYear - vintage;

    let disposition: string;
    let window: number;

    if (wine.type === "red") {
      if (age > 15) {
        disposition = "P";
        window = 0;
      } else if (age >= 3) {
        // Most reds 3+ years old are ready to drink
        disposition = "D";
        window = Math.max(3, 10 - age);
      } else {
        // Very young reds (0-2 years) — only hold premium wines
        const isPremium = (wine.price ?? 0) >= 40;
        disposition = isPremium ? "H" : "D";
        window = isPremium ? 10 - age : 5;
      }
    } else if (wine.type === "sparkling") {
      disposition = "D";
      window = 3;
    } else {
      // Whites, rosé, etc. — drink now unless very old
      disposition = age > 5 ? "P" : "D";
      window = Math.max(0, 5 - age);
    }

    return {
      disposition,
      drinkBy: `${currentYear + window}`,
      drinkWindow: `${currentYear}-${currentYear + window}`,
      notes: `Based on ${wine.type} wine from ${wine.region || "unknown region"}, vintage ${wine.vintage ?? "NV"}. ${disposition === "D" ? "Drinking well now." : disposition === "H" ? "Has aging potential; best to hold." : "Past peak; drink soon if at all."}`,
    };
  }

  async estimateCriticScores(
    _wine: WineDataInput
  ): Promise<AiCriticScoresResult> {
    await delay(400 + Math.random() * 300);
    const base = 88 + Math.floor(Math.random() * 7);
    return {
      ratings: {
        rating_ws: base + Math.floor(Math.random() * 3),
        rating_rp: base + Math.floor(Math.random() * 3),
        rating_jd: Math.random() > 0.5 ? base + Math.floor(Math.random() * 4) : undefined,
        rating_ag: Math.random() > 0.5 ? base + Math.floor(Math.random() * 4) : undefined,
      },
      confidence: "medium",
      notes: "Estimated scores based on regional averages and producer reputation (mock data).",
    };
  }

  async enrichWine(wine: WineDataInput): Promise<AiWineEnrichmentResult> {
    await delay(800 + Math.random() * 600);

    const currentYear = new Date().getFullYear();
    const vintage = wine.vintage || currentYear;
    const age = currentYear - vintage;
    const isRed = wine.type === "red";
    const isWhite = wine.type === "white";

    // Combine logic from individual methods into one response
    const base = wine.price || 30;

    // Disposition logic — most wines should be "D" (Drink Now)
    let disposition: string;
    let window: number;
    if (isRed) {
      if (age > 15) { disposition = "P"; window = 0; }
      else if (age >= 3) { disposition = "D"; window = Math.max(3, 10 - age); }
      else { const isPremium = (wine.price ?? 0) >= 40; disposition = isPremium ? "H" : "D"; window = isPremium ? 10 - age : 5; }
    } else if (wine.type === "sparkling") {
      disposition = "D"; window = 3;
    } else {
      disposition = age > 5 ? "P" : "D";
      window = Math.max(0, 5 - age);
    }

    // Food pairings by type
    const pairingsMap: Record<string, { foods: string; notes: string }> = {
      red: {
        foods: "Grilled ribeye steak with herb butter, Braised lamb shanks with rosemary, Wild mushroom risotto, Aged Comté cheese, Beef bourguignon, Dark chocolate truffles, Roasted duck breast with cherry reduction, Hard aged Manchego",
        notes: "The firm tannins and dark fruit profile pair beautifully with rich, umami-laden dishes. The wine's structure stands up to bold flavors while its acidity cuts through fat.",
      },
      white: {
        foods: "Pan-seared halibut with lemon beurre blanc, Lobster tail with drawn butter, Caesar salad with grilled chicken, Fresh goat cheese and herb crostini, Roasted chicken with tarragon, Grilled shrimp with garlic, Oysters on the half shell, Triple-cream Brie",
        notes: "Bright acidity and citrus character make this an ideal match for seafood and lighter proteins. The mineral backbone complements shellfish beautifully.",
      },
      rosé: {
        foods: "Grilled Mediterranean vegetables, Niçoise salad, Seared tuna with sesame crust, Charcuterie board with prosciutto, Summer tomato and burrata salad, Grilled salmon with dill, Feta and watermelon salad, Herbed focaccia",
        notes: "This rosé's versatility shines with Mediterranean-inspired dishes. Fresh acidity and red fruit notes bridge the gap between red and white wine pairings.",
      },
      sparkling: {
        foods: "Caviar with blinis, Fried chicken, Smoked salmon on toasted brioche, Raw oysters with mignonette, Parmesan crisps, Strawberries with cream, Eggs Benedict, Soft-ripened Camembert",
        notes: "The effervescence and acidity make this an exceptional food partner. Bubbles act as a palate cleanser, cutting through rich and fried dishes.",
      },
    };
    const p = pairingsMap[wine.type] || pairingsMap.red;

    const scoreBase = 88 + Math.floor(Math.random() * 7);

    return {
      description: `${wine.name} from ${wine.winery} is a ${isRed ? "rich, full-bodied" : isWhite ? "crisp, elegant" : "refined"} ${wine.type} wine${wine.vintage ? ` from the ${wine.vintage} vintage` : ""}. ${wine.region ? `Sourced from ${wine.region}, it` : "It"} showcases ${isRed ? "dark fruit, oak spice, and velvety tannins" : isWhite ? "bright citrus, stone fruit, and mineral character" : "fine complexity and balanced character"}.`,
      foodPairings: p.foods,
      pairingNotes: p.notes,
      estimatedPrice: Math.round(base * (0.9 + Math.random() * 0.3)),
      priceRange: { low: Math.round(base * 0.7), high: Math.round(base * 1.4) },
      disposition,
      drinkBy: `${currentYear + window}`,
      drinkWindow: `${currentYear}-${currentYear + window}`,
      ratings: {
        rating_ws: scoreBase + Math.floor(Math.random() * 3),
        rating_rp: scoreBase + Math.floor(Math.random() * 3),
        rating_jd: Math.random() > 0.5 ? scoreBase + Math.floor(Math.random() * 4) : undefined,
        rating_ag: Math.random() > 0.5 ? scoreBase + Math.floor(Math.random() * 4) : undefined,
      },
      confidence: "medium",
    };
  }

  async extractWineList(
    _imageBase64: string,
    _mimeType: string
  ): Promise<WineListExtractionResult> {
    await delay(1500 + Math.random() * 1000);
    return {
      wines: [
        {
          name: "Châteauneuf-du-Pape",
          winery: "Château de Beaucastel",
          vintage: 2019,
          type: "red",
          region: "Rhône Valley",
          country: "France",
          grapeVariety: "Grenache, Mourvèdre, Syrah",
          description:
            "Complex and earthy with notes of dark fruit, herbs, and spice. Full-bodied with a long, savory finish.",
          estimatedPrice: 75,
          alcohol: "14.5%",
          disposition: "H",
          drinkBy: "2035",
          drinkWindow: "2024-2035",
          ratings: { rating_ws: 95, rating_rp: 96, rating_jd: 97, rating_ag: 95 },
          notes: "",
        },
        {
          name: "Sancerre",
          winery: "Domaine Vacheron",
          vintage: 2022,
          type: "white",
          region: "Loire Valley",
          country: "France",
          grapeVariety: "Sauvignon Blanc",
          description:
            "Crisp and mineral-driven with notes of citrus, flint, and fresh herbs. Vibrant acidity and a clean finish.",
          estimatedPrice: 30,
          alcohol: "13%",
          disposition: "D",
          drinkBy: "2026",
          drinkWindow: "2023-2026",
          ratings: { rating_ws: 92, rating_rp: undefined, rating_jd: undefined, rating_ag: 91 },
          notes: "",
        },
      ],
      sourceName: "Mock Restaurant",
      currency: "USD",
    };
  }

  async recommend(
    occasion: string,
    wines: Array<{
      id: string;
      name: string;
      winery: string;
      vintage: number | null;
      type: string;
      disposition: string;
      drinkWindow: string;
    }>
  ): Promise<AiRecommendationResult> {
    await delay(600 + Math.random() * 400);
    // Pick a wine with "D" disposition, or the first one
    const drinkNow = wines.find((w) => w.disposition === "D") || wines[0];
    return {
      wineId: drinkNow?.id || "",
      reasoning: `For ${occasion}, I recommend ${drinkNow?.name || "this wine"} from ${drinkNow?.winery || "the cellar"}. It's drinking beautifully right now and will complement the occasion perfectly.`,
      occasion,
      pairingsSuggestion:
        "Consider pairing with a cheese board and charcuterie for a relaxed evening, or grilled proteins for a dinner setting.",
    };
  }

  async fetchWineImage(wine: WineDataInput): Promise<AiWineImageResult> {
    await delay(500 + Math.random() * 500);
    // Generate a wine-label–shaped SVG placeholder with the wine name
    const bgColors: Record<string, string> = {
      red: "#2C1215", white: "#F5EFE0", rosé: "#F0D4DC", sparkling: "#F5F0D0",
      dessert: "#3D2C10", orange: "#4A2E12", green: "#1C3322", fortified: "#2A1530",
    };
    const textColors: Record<string, string> = {
      red: "#D4A574", white: "#4A3728", rosé: "#6B3040", sparkling: "#5C5020",
      dessert: "#D4A574", orange: "#D4A574", green: "#90C4A0", fortified: "#C4A0C4",
    };
    const bg = bgColors[wine.type] ?? "#2C1215";
    const fg = textColors[wine.type] ?? "#D4A574";
    const name = wine.name.length > 20 ? wine.name.slice(0, 18) + "…" : wine.name;
    const winery = wine.winery.length > 22 ? wine.winery.slice(0, 20) + "…" : wine.winery;
    const vintage = wine.vintage || "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
      <rect width="300" height="400" rx="8" fill="${bg}"/>
      <rect x="20" y="30" width="260" height="340" rx="4" fill="none" stroke="${fg}" stroke-width="1.5" opacity="0.4"/>
      <rect x="30" y="40" width="240" height="320" rx="2" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.25"/>
      <line x1="60" y1="160" x2="240" y2="160" stroke="${fg}" stroke-width="0.5" opacity="0.3"/>
      <line x1="60" y1="250" x2="240" y2="250" stroke="${fg}" stroke-width="0.5" opacity="0.3"/>
      <text x="150" y="135" text-anchor="middle" font-family="Georgia,serif" font-size="22" font-weight="bold" fill="${fg}">${name}</text>
      <text x="150" y="195" text-anchor="middle" font-family="Georgia,serif" font-size="14" fill="${fg}" opacity="0.8">${winery}</text>
      <text x="150" y="280" text-anchor="middle" font-family="Georgia,serif" font-size="28" fill="${fg}" opacity="0.6">${vintage}</text>
      <text x="150" y="340" text-anchor="middle" font-family="Georgia,serif" font-size="10" fill="${fg}" opacity="0.4">750ml</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    return {
      imageUrl: dataUrl,
      source: "mock",
    };
  }

  async decantRecommendation(wine: WineDataInput): Promise<AiDecantRecommendationResult> {
    await delay(600 + Math.random() * 400);
    const type = wine.type?.toLowerCase() || "red";
    const age = wine.vintage ? new Date().getFullYear() - wine.vintage : 3;

    // Light wines shouldn't be decanted
    if (type === "sparkling" || type === "rosé" || (type === "white" && age < 3)) {
      return {
        decantMinutes: 0,
        recommended: false,
        explanation: `This ${type} wine is best enjoyed fresh without decanting. Pouring it directly preserves its delicate aromatics and lively character.`,
      };
    }

    // Young tannic reds need more time
    const minutes = type === "red"
      ? age < 5 ? 45 : age < 15 ? 30 : 10
      : type === "white" ? 20 : 0;

    return {
      decantMinutes: minutes,
      recommended: minutes > 0,
      explanation: minutes > 0
        ? `At ${age} years old, this ${wine.grapeVariety || type} will benefit from ${minutes} minutes of decanting. The exposure to air will soften tannins and allow the fruit and secondary aromas to fully develop.`
        : `This wine doesn't need decanting. Serve it directly from the bottle.`,
    };
  }

  async batchDisposition(
    wines: Array<{
      id: string;
      name: string;
      winery: string;
      vintage: number | null;
      type: string;
      region: string;
      drinkBy: string;
    }>
  ): Promise<BatchDispositionResult> {
    await delay(300 + wines.length * 50);
    const currentYear = new Date().getFullYear();
    const dispositions: Record<string, string> = {};
    for (const wine of wines) {
      const age = wine.vintage ? currentYear - wine.vintage : 0;
      if (age > 15) dispositions[wine.id] = "P";
      else if (wine.type === "red" && age < 2) dispositions[wine.id] = "H";
      else dispositions[wine.id] = "D";
    }
    return { dispositions };
  }

  async mealPairing(
    meal: string,
    wines: MealPairingWineInput[]
  ): Promise<AiMealPairingResult> {
    await delay(800 + Math.random() * 400);
    const drinkable = wines.filter((w) => w.disposition === "D" || !w.disposition);
    const picked = drinkable.length > 0 ? drinkable.slice(0, 3) : wines.slice(0, 3);
    const confidences: Array<"perfect" | "great" | "worth_trying"> = ["perfect", "great", "worth_trying"];
    return {
      matches: picked.map((w, i) => ({
        wineId: w.id,
        wineName: w.name,
        winery: w.winery,
        vintage: w.vintage,
        pairingExplanation: `The ${w.grapeVariety || w.type} character of this wine complements the flavors in "${meal}" beautifully. Its acidity and body create a harmonious balance on the palate.`,
        confidence: confidences[i] || "worth_trying",
      })),
      buySuggestions: [],
    };
  }

  async terroirTwins(
    wine: WineDataInput,
    _userWines: Array<{
      id: string;
      name: string;
      winery: string;
      region: string;
      country: string;
      grapeVariety: string;
    }>
  ): Promise<AiTerroirTwinResult> {
    await delay(800 + Math.random() * 400);
    return {
      twins: [
        {
          name: "Etna Rosso DOC",
          winery: "Tenuta delle Terre Nere",
          region: "Mount Etna, Sicily",
          country: "Italy",
          grapeVariety: "Nerello Mascalese",
          sharedTerroir: `Both grown on volcanic soils at high elevation with significant diurnal temperature variation`,
          explanation: `Like ${wine.name}, this wine thrives on mineral-rich volcanic soils. The high altitude creates similar cool-climate characteristics despite Sicily's southern latitude. A lover of ${wine.region || "this style"} would appreciate the mineral tension and elegance.`,
          inCellar: false,
        },
        {
          name: "Assyrtiko",
          winery: "Domaine Sigalas",
          region: "Santorini",
          country: "Greece",
          grapeVariety: "Assyrtiko",
          sharedTerroir: `Both shaped by volcanic soils, strong winds, and maritime influence at elevation`,
          explanation: `Santorini's ancient volcanic caldera creates similarly mineral-driven wines. The extreme windswept conditions and porous volcanic pumice concentrate flavors just as the terroir shapes wines from ${wine.region || "your chosen region"}.`,
          inCellar: false,
        },
        {
          name: "Priorat",
          winery: "Alvaro Palacios",
          region: "Priorat",
          country: "Spain",
          grapeVariety: "Garnacha, Cariñena",
          sharedTerroir: `Both feature steep hillside vineyards on slate/schist soils with extreme sun exposure`,
          explanation: `Priorat's licorella (slate) soils and steep terraces mirror the terroir intensity of ${wine.region || "this wine's origin"}. The resulting wines share a similar concentration and mineral backbone.`,
          inCellar: false,
        },
      ],
    };
  }

  async pourCostCalculation(
    params: {
      guestCount: number;
      duration: number;
      budget?: number;
      courseCount: number;
      style: "casual" | "formal" | "mixed";
    },
    wines: PourCostWineInput[]
  ): Promise<AiPourCostResult> {
    await delay(1000 + Math.random() * 500);

    const poursPerGuest = params.style === "formal" ? params.courseCount : Math.ceil(params.duration * 1.5);
    const totalPours = params.guestCount * poursPerGuest;
    const _bottlesNeeded = Math.ceil(totalPours / 5);

    const courseNames = ["Aperitif", "Starter", "Main Course", "Cheese", "Dessert"];
    const drinkable = wines.filter((w) => w.disposition === "D" || !w.disposition);
    const winePool = drinkable.length > 0 ? drinkable : wines;

    const courses = [];
    let totalCost = 0;
    let totalBottles = 0;

    for (let i = 0; i < params.courseCount; i++) {
      const wine = winePool[i % winePool.length];
      const coursePours = Math.ceil(params.guestCount / (params.courseCount));
      const courseBottles = Math.max(1, Math.ceil(coursePours / 5));
      totalBottles += courseBottles;
      totalCost += courseBottles * (wine.price ?? 25);
      courses.push({
        courseName: courseNames[i] || `Course ${i + 1}`,
        wines: [{
          wineId: wine.id,
          wineName: wine.name,
          winery: wine.winery,
          vintage: wine.vintage,
          bottlesNeeded: courseBottles,
          poursPerBottle: 5,
          reason: `A ${wine.type} ${wine.grapeVariety || "blend"} from ${wine.region || "the cellar"} — ideal for the ${(courseNames[i] || "course").toLowerCase()} course.`,
        }],
      });
    }

    return {
      courses,
      totalBottles,
      estimatedCost: Math.round(totalCost),
      perGuestCost: Math.round(totalCost / Math.max(1, params.guestCount)),
      shoppingList: totalBottles > winePool.length ? [{
        name: "Supplemental Wine",
        type: "red",
        grapeVariety: "Cabernet Sauvignon",
        quantity: totalBottles - winePool.length,
        estimatedPrice: 20,
        reason: "Additional bottles needed to cover the full event. Consider a crowd-pleasing option.",
      }] : [],
    };
  }

  async vintageStory(region: string, country: string, _vintage: number): Promise<VintageStoryResult> {
    await delay(400 + Math.random() * 300);
    return {
      rating: "Very Good",
      narrative: `The vintage in ${region}, ${country} was marked by a warm growing season with timely rainfall. Wines show excellent concentration and balance.`,
      weather: "Warm spring, dry summer with brief August rains provided ideal ripening conditions.",
    };
  }

  async chat(_systemPrompt: string, messages: Array<{ role: string; content: string }>): Promise<string> {
    await delay(300 + Math.random() * 200);
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
    if (lastMessage.includes("hello") || lastMessage.includes("hi")) {
      return "Hello! I'm your AI sommelier. What would you like to know about your cellar?";
    }
    return "That's an interesting question! Based on your cellar, I'd recommend checking your Drink Now wines for something that matches your mood tonight.";
  }

  async *chatStream(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string> {
    const reply = await this.chat(systemPrompt, messages);
    for (const piece of reply.split(/(\s+)/)) {
      if (piece) yield piece;
    }
  }
}
