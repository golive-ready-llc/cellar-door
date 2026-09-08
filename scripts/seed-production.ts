/**
 * Seed production Neon database with mock store data for a specific user.
 * Replicates the deterministic RNG (seed 42) from src/lib/mock-store.ts
 * to generate identical walls, cabinets, and ~900 wines.
 *
 * Usage: npx tsx scripts/seed-production.ts
 */

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set. Load from .env or .env.local");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TARGET_USER_ID = "cmmkrbnmz0000ewvqw9keertr";

// ============================================================
// Seeded PRNG — identical to mock-store.ts
// ============================================================

function createRng(seed: number) {
  let s = seed;
  return {
    next(): number {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0x100000000;
    },
    nextInt(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)];
    },
    pickN<T>(arr: T[], n: number): T[] {
      const shuffled = [...arr].sort(() => this.next() - 0.5);
      return shuffled.slice(0, n);
    },
    chance(p: number): boolean {
      return this.next() < p;
    },
  };
}

const rng = createRng(42);

// ============================================================
// Wine types
// ============================================================

type WineType = "red" | "white" | "rosé" | "sparkling" | "dessert" | "orange" | "green" | "fortified";

interface AiRatings {
  rating_ws?: number;
  rating_rp?: number;
  rating_jd?: number;
  rating_ag?: number;
}

interface WineTemplate {
  name: string;
  winery: string;
  region: string;
  country: string;
  type: WineType;
  grape: string;
  priceRange: [number, number];
  drinkYears: [number, number];
  alcohol: string;
  description: string;
  foodPairings: string;
}

interface StorageRow {
  row: number;
  name: string;
  type: "bulk" | "box";
  capacity: number;
  boxes?: number[];
}

// ============================================================
// Wine Catalog — identical to mock-store.ts
// ============================================================

const wineCatalog: WineTemplate[] = [
  // ---- RED (50 templates) ----
  { name: "Cabernet Sauvignon", winery: "Caymus Vineyards", region: "Napa Valley", country: "USA", type: "red", grape: "Cabernet Sauvignon", priceRange: [75, 95], drinkYears: [5, 15], alcohol: "14.6%", description: "Rich and full-bodied Napa Cab", foodPairings: "Grilled steak, aged cheese" },
  { name: "Opus One", winery: "Opus One Winery", region: "Napa Valley", country: "USA", type: "red", grape: "Cabernet Sauvignon, Merlot", priceRange: [380, 500], drinkYears: [8, 25], alcohol: "14.5%", description: "Iconic Napa blend, rich and complex", foodPairings: "Filet mignon, lamb, truffle dishes" },
  { name: "Château Lafite Rothschild", winery: "Château Lafite Rothschild", region: "Bordeaux", country: "France", type: "red", grape: "Cabernet Sauvignon, Merlot", priceRange: [600, 1200], drinkYears: [10, 40], alcohol: "13%", description: "First Growth Bordeaux, elegant and refined", foodPairings: "Roast lamb, duck confit" },
  { name: "Château Mouton Rothschild", winery: "Château Mouton Rothschild", region: "Bordeaux", country: "France", type: "red", grape: "Cabernet Sauvignon, Merlot", priceRange: [450, 900], drinkYears: [10, 35], alcohol: "13.5%", description: "First Growth Bordeaux, powerful and opulent", foodPairings: "Venison, aged gruyère" },
  { name: "Château Margaux", winery: "Château Margaux", region: "Bordeaux", country: "France", type: "red", grape: "Cabernet Sauvignon, Merlot", priceRange: [500, 950], drinkYears: [10, 40], alcohol: "13%", description: "Supremely elegant Margaux", foodPairings: "Lamb, mature cheese" },
  { name: "Château Haut-Brion", winery: "Château Haut-Brion", region: "Bordeaux", country: "France", type: "red", grape: "Merlot, Cabernet Sauvignon", priceRange: [400, 800], drinkYears: [8, 30], alcohol: "13.5%", description: "Smoky, mineral-driven Pessac", foodPairings: "Beef bourguignon" },
  { name: "Pétrus", winery: "Pétrus", region: "Pomerol", country: "France", type: "red", grape: "Merlot", priceRange: [2000, 4500], drinkYears: [10, 40], alcohol: "14%", description: "Legendary Pomerol Merlot", foodPairings: "Truffle risotto, foie gras" },
  { name: "Barolo Monfortino", winery: "Giacomo Conterno", region: "Piedmont", country: "Italy", type: "red", grape: "Nebbiolo", priceRange: [500, 800], drinkYears: [10, 40], alcohol: "14%", description: "King of Barolo, extraordinary depth", foodPairings: "Truffle risotto, braised meats" },
  { name: "Brunello di Montalcino", winery: "Biondi-Santi", region: "Tuscany", country: "Italy", type: "red", grape: "Sangiovese Grosso", priceRange: [100, 300], drinkYears: [8, 30], alcohol: "14%", description: "Benchmark Brunello, austere elegance", foodPairings: "Wild boar, porcini pasta" },
  { name: "Tignanello", winery: "Antinori", region: "Tuscany", country: "Italy", type: "red", grape: "Sangiovese, Cabernet Sauvignon", priceRange: [90, 140], drinkYears: [5, 20], alcohol: "13.5%", description: "The original Super Tuscan", foodPairings: "Grilled lamb, hard cheeses" },
  { name: "Sassicaia", winery: "Tenuta San Guido", region: "Bolgheri", country: "Italy", type: "red", grape: "Cabernet Sauvignon, Cabernet Franc", priceRange: [200, 350], drinkYears: [8, 25], alcohol: "14%", description: "Italy's greatest Cabernet blend", foodPairings: "Beef tenderloin, aged pecorino" },
  { name: "Amarone della Valpolicella", winery: "Bertani", region: "Veneto", country: "Italy", type: "red", grape: "Corvina, Rondinella", priceRange: [60, 120], drinkYears: [5, 20], alcohol: "15.5%", description: "Dried grape richness, powerful and complex", foodPairings: "Braised short ribs, aged parmesan" },
  { name: "Rioja Gran Reserva", winery: "López de Heredia", region: "Rioja", country: "Spain", type: "red", grape: "Tempranillo", priceRange: [40, 70], drinkYears: [8, 25], alcohol: "13.5%", description: "Traditional Rioja, leather and tobacco", foodPairings: "Lamb chops, manchego" },
  { name: "Ribera del Duero Reserva", winery: "Vega Sicilia", region: "Ribera del Duero", country: "Spain", type: "red", grape: "Tempranillo", priceRange: [200, 400], drinkYears: [8, 30], alcohol: "14%", description: "Spain's most iconic red", foodPairings: "Roast suckling pig" },
  { name: "Priorat", winery: "Alvaro Palacios", region: "Priorat", country: "Spain", type: "red", grape: "Garnacha, Cariñena", priceRange: [50, 180], drinkYears: [5, 15], alcohol: "14.5%", description: "Intense, mineral-driven Priorat", foodPairings: "Grilled lamb, chorizo" },
  { name: "Penfolds Grange", winery: "Penfolds", region: "South Australia", country: "Australia", type: "red", grape: "Shiraz", priceRange: [600, 900], drinkYears: [10, 40], alcohol: "14.5%", description: "Australia's most iconic wine", foodPairings: "Wagyu beef, dark chocolate" },
  { name: "Shiraz", winery: "Henschke Hill of Grace", region: "Eden Valley", country: "Australia", type: "red", grape: "Shiraz", priceRange: [400, 700], drinkYears: [8, 30], alcohol: "14.5%", description: "Historic single-vineyard Shiraz", foodPairings: "Smoked meats, hard cheeses" },
  { name: "Pinot Noir", winery: "Felton Road", region: "Central Otago", country: "New Zealand", type: "red", grape: "Pinot Noir", priceRange: [45, 70], drinkYears: [3, 12], alcohol: "14%", description: "Silky Central Otago Pinot", foodPairings: "Duck, mushroom risotto" },
  { name: "Châteauneuf-du-Pape", winery: "Château Rayas", region: "Rhône Valley", country: "France", type: "red", grape: "Grenache", priceRange: [300, 500], drinkYears: [8, 25], alcohol: "14.5%", description: "Pure Grenache brilliance", foodPairings: "Lamb navarin, wild game" },
  { name: "Hermitage", winery: "Jean-Louis Chave", region: "Rhône Valley", country: "France", type: "red", grape: "Syrah", priceRange: [200, 400], drinkYears: [8, 30], alcohol: "13.5%", description: "Noble Northern Rhône Syrah", foodPairings: "Braised beef, black olive tapenade" },
  { name: "Côte-Rôtie La Mouline", winery: "E. Guigal", region: "Rhône Valley", country: "France", type: "red", grape: "Syrah, Viognier", priceRange: [250, 500], drinkYears: [8, 25], alcohol: "13%", description: "One of the great Côte-Rôties", foodPairings: "Roast duck, truffle" },
  { name: "Côtes du Rhône", winery: "E. Guigal", region: "Rhône Valley", country: "France", type: "red", grape: "Grenache, Syrah, Mourvèdre", priceRange: [12, 20], drinkYears: [2, 6], alcohol: "14%", description: "Juicy red fruit, herbes de Provence", foodPairings: "Ratatouille, grilled chicken" },
  { name: "Pinot Noir", winery: "Domaine de la Romanée-Conti", region: "Burgundy", country: "France", type: "red", grape: "Pinot Noir", priceRange: [1500, 5000], drinkYears: [10, 40], alcohol: "13%", description: "The pinnacle of Pinot Noir", foodPairings: "Roast guinea fowl, truffle" },
  { name: "Gevrey-Chambertin", winery: "Domaine Armand Rousseau", region: "Burgundy", country: "France", type: "red", grape: "Pinot Noir", priceRange: [100, 400], drinkYears: [8, 25], alcohol: "13%", description: "Powerful, structured Burgundy", foodPairings: "Coq au vin, Epoisses" },
  { name: "Volnay Premier Cru", winery: "Domaine Marquis d'Angerville", region: "Burgundy", country: "France", type: "red", grape: "Pinot Noir", priceRange: [60, 120], drinkYears: [5, 18], alcohol: "13%", description: "Elegant, floral Burgundy", foodPairings: "Roast chicken, Brie" },
  { name: "Cabernet Sauvignon", winery: "Silver Oak", region: "Alexander Valley", country: "USA", type: "red", grape: "Cabernet Sauvignon", priceRange: [65, 90], drinkYears: [5, 15], alcohol: "13.9%", description: "Velvety, American oak aged", foodPairings: "Prime rib, grilled portobello" },
  { name: "Pinot Noir", winery: "Williams Selyem", region: "Sonoma Coast", country: "USA", type: "red", grape: "Pinot Noir", priceRange: [50, 80], drinkYears: [3, 12], alcohol: "14.1%", description: "Lush, concentrated Sonoma Pinot", foodPairings: "Salmon, mushroom dishes" },
  { name: "Zinfandel", winery: "Ridge Vineyards", region: "Sonoma County", country: "USA", type: "red", grape: "Zinfandel", priceRange: [30, 50], drinkYears: [3, 10], alcohol: "14.5%", description: "Brambly, spicy Zinfandel", foodPairings: "BBQ ribs, pizza" },
  { name: "Malbec", winery: "Catena Zapata", region: "Mendoza", country: "Argentina", type: "red", grape: "Malbec", priceRange: [20, 50], drinkYears: [3, 10], alcohol: "14%", description: "Intense, velvety Argentine Malbec", foodPairings: "Grilled steak, empanadas" },
  { name: "Malbec Reserva", winery: "Terrazas de los Andes", region: "Mendoza", country: "Argentina", type: "red", grape: "Malbec", priceRange: [15, 30], drinkYears: [2, 7], alcohol: "14%", description: "Approachable, fruity Malbec", foodPairings: "Grilled meats, pasta" },
  { name: "Carmenère Reserva", winery: "Concha y Toro", region: "Colchagua Valley", country: "Chile", type: "red", grape: "Carmenère", priceRange: [12, 25], drinkYears: [2, 7], alcohol: "13.5%", description: "Smooth, spicy Chilean Carmenère", foodPairings: "Empanadas, grilled vegetables" },
  { name: "Cabernet Sauvignon", winery: "Kanonkop", region: "Stellenbosch", country: "South Africa", type: "red", grape: "Cabernet Sauvignon", priceRange: [25, 50], drinkYears: [5, 15], alcohol: "14%", description: "Structured, Cape Cabernet", foodPairings: "Bobotie, grilled lamb" },
  { name: "Pinotage", winery: "Kanonkop", region: "Stellenbosch", country: "South Africa", type: "red", grape: "Pinotage", priceRange: [20, 40], drinkYears: [3, 10], alcohol: "14.5%", description: "South Africa's signature grape", foodPairings: "BBQ, grilled sausages" },
  { name: "Cabernet Sauvignon", winery: "19 Crimes", region: "South Eastern Australia", country: "Australia", type: "red", grape: "Cabernet Sauvignon", priceRange: [10, 16], drinkYears: [1, 4], alcohol: "13.5%", description: "Friendly, approachable Cab", foodPairings: "Burgers, pasta" },
  { name: "Red Blend", winery: "The Prisoner", region: "Napa Valley", country: "USA", type: "red", grape: "Zinfandel, Cabernet Sauvignon, Petite Sirah", priceRange: [40, 55], drinkYears: [2, 8], alcohol: "15.2%", description: "Bold, dark fruit blend", foodPairings: "BBQ, spicy dishes" },
  { name: "Pinot Noir", winery: "Meiomi", region: "California", country: "USA", type: "red", grape: "Pinot Noir", priceRange: [16, 24], drinkYears: [1, 4], alcohol: "13.7%", description: "Soft, fruity, crowd-pleaser", foodPairings: "Salmon, mushroom dishes" },
  { name: "Montepulciano d'Abruzzo", winery: "Masciarelli", region: "Abruzzo", country: "Italy", type: "red", grape: "Montepulciano", priceRange: [10, 18], drinkYears: [2, 6], alcohol: "13.5%", description: "Juicy, easy-drinking Italian red", foodPairings: "Pizza, pasta bolognese" },
  { name: "Chianti Classico Riserva", winery: "Castello di Ama", region: "Tuscany", country: "Italy", type: "red", grape: "Sangiovese", priceRange: [25, 45], drinkYears: [4, 12], alcohol: "13.5%", description: "Elegant, food-friendly Chianti", foodPairings: "Bistecca fiorentina, pecorino" },
  { name: "Douro Red", winery: "Quinta do Noval", region: "Douro Valley", country: "Portugal", type: "red", grape: "Touriga Nacional, Tinta Roriz", priceRange: [20, 45], drinkYears: [3, 12], alcohol: "14%", description: "Complex, structured Douro red", foodPairings: "Grilled sardines, stew" },
  { name: "Zweigelt", winery: "Umathum", region: "Burgenland", country: "Austria", type: "red", grape: "Zweigelt", priceRange: [15, 28], drinkYears: [2, 6], alcohol: "13%", description: "Bright cherry, spicy Austrian red", foodPairings: "Wiener Schnitzel, pork" },
  { name: "Merlot", winery: "Duckhorn Vineyards", region: "Napa Valley", country: "USA", type: "red", grape: "Merlot", priceRange: [45, 65], drinkYears: [3, 12], alcohol: "14.5%", description: "Plush, silky Napa Merlot", foodPairings: "Roast pork, mushroom risotto" },
  { name: "Cabernet Franc", winery: "Château Cheval Blanc", region: "Saint-Émilion", country: "France", type: "red", grape: "Cabernet Franc, Merlot", priceRange: [400, 800], drinkYears: [8, 30], alcohol: "13.5%", description: "Premier Grand Cru Classé A", foodPairings: "Roast lamb, truffle" },
  { name: "Saint-Julien", winery: "Château Léoville-Las Cases", region: "Bordeaux", country: "France", type: "red", grape: "Cabernet Sauvignon, Merlot", priceRange: [120, 250], drinkYears: [8, 30], alcohol: "13%", description: "Super Second, classically structured", foodPairings: "Roast beef, Comté" },
  { name: "Pauillac", winery: "Château Lynch-Bages", region: "Bordeaux", country: "France", type: "red", grape: "Cabernet Sauvignon", priceRange: [80, 150], drinkYears: [6, 20], alcohol: "13%", description: "Crowd-pleasing Pauillac", foodPairings: "Rack of lamb" },
  { name: "Petite Sirah", winery: "Stags' Leap Winery", region: "Napa Valley", country: "USA", type: "red", grape: "Petite Sirah", priceRange: [35, 55], drinkYears: [3, 12], alcohol: "14.8%", description: "Inky, powerful, tannic", foodPairings: "Smoked brisket, aged cheddar" },
  { name: "Syrah", winery: "Sine Qua Non", region: "Central Coast", country: "USA", type: "red", grape: "Syrah", priceRange: [200, 400], drinkYears: [5, 18], alcohol: "15%", description: "Cult California Syrah", foodPairings: "Grilled lamb, olive tapenade" },
  { name: "Barbaresco", winery: "Gaja", region: "Piedmont", country: "Italy", type: "red", grape: "Nebbiolo", priceRange: [150, 300], drinkYears: [8, 25], alcohol: "14%", description: "Elegant, structured Barbaresco", foodPairings: "White truffle pasta, veal" },
  { name: "Nero d'Avola", winery: "Planeta", region: "Sicily", country: "Italy", type: "red", grape: "Nero d'Avola", priceRange: [12, 25], drinkYears: [2, 6], alcohol: "13.5%", description: "Rich, fruity Sicilian red", foodPairings: "Pasta alla norma, arancini" },
  { name: "Garnacha", winery: "Bodegas Alto Moncayo", region: "Campo de Borja", country: "Spain", type: "red", grape: "Garnacha", priceRange: [15, 35], drinkYears: [2, 8], alcohol: "15%", description: "Concentrated old-vine Garnacha", foodPairings: "Roast lamb, tapas" },
  { name: "Cabernet Sauvignon Reserve", winery: "Robert Mondavi", region: "Napa Valley", country: "USA", type: "red", grape: "Cabernet Sauvignon", priceRange: [35, 55], drinkYears: [4, 12], alcohol: "14.5%", description: "Classic Napa style, blackcurrant and oak", foodPairings: "Steak, burgers" },

  // ---- WHITE (25 templates) ----
  { name: "Sauvignon Blanc", winery: "Cloudy Bay", region: "Marlborough", country: "New Zealand", type: "white", grape: "Sauvignon Blanc", priceRange: [22, 32], drinkYears: [1, 4], alcohol: "13.5%", description: "Citrus and passion fruit aromas", foodPairings: "Oysters, goat cheese, sushi" },
  { name: "Sauvignon Blanc", winery: "Kim Crawford", region: "Marlborough", country: "New Zealand", type: "white", grape: "Sauvignon Blanc", priceRange: [12, 18], drinkYears: [1, 3], alcohol: "13%", description: "Passion fruit, citrus, herbaceous", foodPairings: "Salad, goat cheese" },
  { name: "Chablis Grand Cru", winery: "Domaine Raveneau", region: "Burgundy", country: "France", type: "white", grape: "Chardonnay", priceRange: [150, 350], drinkYears: [5, 20], alcohol: "13%", description: "Minerally, flinty Chablis perfection", foodPairings: "Oysters, Dover sole" },
  { name: "Puligny-Montrachet", winery: "Domaine Leflaive", region: "Burgundy", country: "France", type: "white", grape: "Chardonnay", priceRange: [80, 200], drinkYears: [5, 15], alcohol: "13%", description: "Ethereal white Burgundy", foodPairings: "Lobster, roast chicken" },
  { name: "Chardonnay", winery: "Kistler Vineyards", region: "Sonoma Mountain", country: "USA", type: "white", grape: "Chardonnay", priceRange: [55, 85], drinkYears: [3, 10], alcohol: "14.1%", description: "Rich, buttery California Chardonnay", foodPairings: "Lobster, cream sauces" },
  { name: "Riesling Kabinett", winery: "Joh. Jos. Prüm", region: "Mosel", country: "Germany", type: "white", grape: "Riesling", priceRange: [25, 45], drinkYears: [3, 15], alcohol: "8%", description: "Delicate, racy Mosel Riesling", foodPairings: "Thai food, sushi, light salads" },
  { name: "Riesling Spätlese", winery: "Dr. Loosen", region: "Mosel", country: "Germany", type: "white", grape: "Riesling", priceRange: [20, 35], drinkYears: [3, 12], alcohol: "8.5%", description: "Off-dry, peach and slate", foodPairings: "Asian cuisine, pork" },
  { name: "Riesling Clos Sainte Hune", winery: "Trimbach", region: "Alsace", country: "France", type: "white", grape: "Riesling", priceRange: [150, 200], drinkYears: [8, 25], alcohol: "13%", description: "One of the world's greatest whites", foodPairings: "Lobster, aged Comté, sushi" },
  { name: "Gewürztraminer", winery: "Zind-Humbrecht", region: "Alsace", country: "France", type: "white", grape: "Gewürztraminer", priceRange: [25, 50], drinkYears: [2, 10], alcohol: "14%", description: "Intensely aromatic, lychee and rose", foodPairings: "Asian fusion, Munster cheese" },
  { name: "Grüner Veltliner", winery: "Bründlmayer", region: "Kamptal", country: "Austria", type: "white", grape: "Grüner Veltliner", priceRange: [18, 35], drinkYears: [2, 8], alcohol: "12.5%", description: "Peppery, fresh Austrian white", foodPairings: "Wiener Schnitzel, asparagus" },
  { name: "Sancerre", winery: "Domaine Vacheron", region: "Loire Valley", country: "France", type: "white", grape: "Sauvignon Blanc", priceRange: [25, 45], drinkYears: [2, 6], alcohol: "13%", description: "Mineral, flinty Loire Sauvignon", foodPairings: "Goat cheese, shellfish" },
  { name: "Condrieu", winery: "Georges Vernay", region: "Rhône Valley", country: "France", type: "white", grape: "Viognier", priceRange: [50, 100], drinkYears: [2, 8], alcohol: "13.5%", description: "Intensely floral, stone fruit", foodPairings: "Foie gras, lobster thermidor" },
  { name: "Pinot Grigio", winery: "Santa Margherita", region: "Trentino-Alto Adige", country: "Italy", type: "white", grape: "Pinot Grigio", priceRange: [18, 28], drinkYears: [1, 3], alcohol: "12.5%", description: "Crisp, clean Italian Pinot Grigio", foodPairings: "Light pasta, seafood" },
  { name: "Vermentino di Sardegna", winery: "Argiolas", region: "Sardinia", country: "Italy", type: "white", grape: "Vermentino", priceRange: [12, 20], drinkYears: [1, 3], alcohol: "13%", description: "Fresh, Mediterranean white", foodPairings: "Grilled fish, calamari" },
  { name: "Albariño", winery: "Pazo de Señoráns", region: "Rías Baixas", country: "Spain", type: "white", grape: "Albariño", priceRange: [18, 30], drinkYears: [1, 4], alcohol: "12.5%", description: "Aromatic, peach and apricot", foodPairings: "Seafood, ceviche, paella" },
  { name: "Viognier", winery: "Yalumba", region: "Eden Valley", country: "Australia", type: "white", grape: "Viognier", priceRange: [15, 25], drinkYears: [1, 4], alcohol: "13.5%", description: "Perfumed, stone fruit richness", foodPairings: "Thai curry, grilled chicken" },
  { name: "Chenin Blanc", winery: "Ken Forrester", region: "Stellenbosch", country: "South Africa", type: "white", grape: "Chenin Blanc", priceRange: [12, 22], drinkYears: [1, 5], alcohol: "13%", description: "Versatile, honeyed South African Chenin", foodPairings: "Sushi, curry, roast pork" },
  { name: "Chardonnay", winery: "Leeuwin Estate Art Series", region: "Margaret River", country: "Australia", type: "white", grape: "Chardonnay", priceRange: [60, 100], drinkYears: [4, 12], alcohol: "14%", description: "Australia's finest Chardonnay", foodPairings: "Lobster, roast chicken" },
  { name: "Torrontés", winery: "Colomé", region: "Salta", country: "Argentina", type: "white", grape: "Torrontés", priceRange: [12, 20], drinkYears: [1, 3], alcohol: "13.5%", description: "Aromatic, floral Argentine white", foodPairings: "Ceviche, spicy cuisine" },
  { name: "Muscadet Sèvre et Maine", winery: "Domaine de l'Écu", region: "Loire Valley", country: "France", type: "white", grape: "Melon de Bourgogne", priceRange: [12, 20], drinkYears: [1, 5], alcohol: "12%", description: "Crisp, oceanic, sur lie aged", foodPairings: "Oysters, mussels, clams" },

  // ---- ROSÉ (10 templates) ----
  { name: "Whispering Angel", winery: "Château d'Esclans", region: "Provence", country: "France", type: "rosé", grape: "Grenache, Rolle", priceRange: [20, 28], drinkYears: [1, 2], alcohol: "13%", description: "Pale pink, fresh and fruity", foodPairings: "Salads, seafood, light pasta" },
  { name: "Rosé", winery: "Domaines Ott", region: "Provence", country: "France", type: "rosé", grape: "Grenache, Cinsault", priceRange: [30, 45], drinkYears: [1, 2], alcohol: "13%", description: "The benchmark Provence rosé", foodPairings: "Bouillabaisse, Niçoise salad" },
  { name: "Tavel Rosé", winery: "Domaine de la Mordorée", region: "Rhône Valley", country: "France", type: "rosé", grape: "Grenache, Cinsault", priceRange: [18, 28], drinkYears: [1, 3], alcohol: "14%", description: "Full-bodied, serious rosé", foodPairings: "Grilled meats, charcuterie" },
  { name: "Rosé d'Anjou", winery: "Domaine des Baumard", region: "Loire Valley", country: "France", type: "rosé", grape: "Grolleau", priceRange: [10, 16], drinkYears: [1, 2], alcohol: "11%", description: "Off-dry, strawberry sweetness", foodPairings: "Spicy Asian food, light desserts" },
  { name: "Rosato", winery: "Tenuta delle Terre Nere", region: "Sicily", country: "Italy", type: "rosé", grape: "Nerello Mascalese", priceRange: [15, 25], drinkYears: [1, 2], alcohol: "12.5%", description: "Volcanic rosé with mineral character", foodPairings: "Grilled fish, bruschetta" },
  { name: "Rosé", winery: "Miraval", region: "Provence", country: "France", type: "rosé", grape: "Cinsault, Grenache, Rolle", priceRange: [22, 30], drinkYears: [1, 2], alcohol: "13%", description: "Celebrity-backed, elegant Provence rosé", foodPairings: "Charcuterie, grilled shrimp" },
  { name: "Garnacha Rosado", winery: "Chivite", region: "Navarra", country: "Spain", type: "rosé", grape: "Garnacha", priceRange: [10, 18], drinkYears: [1, 2], alcohol: "13%", description: "Fresh, fruity Spanish rosado", foodPairings: "Tapas, paella, grilled fish" },
  { name: "White Zinfandel", winery: "Sutter Home", region: "California", country: "USA", type: "rosé", grape: "Zinfandel", priceRange: [6, 10], drinkYears: [1, 2], alcohol: "10.5%", description: "Sweet, approachable blush wine", foodPairings: "Light appetizers, fruit" },

  // ---- SPARKLING (12 templates) ----
  { name: "Yellow Label Brut", winery: "Veuve Clicquot", region: "Champagne", country: "France", type: "sparkling", grape: "Pinot Noir, Chardonnay, Pinot Meunier", priceRange: [50, 65], drinkYears: [0, 5], alcohol: "12%", description: "Classic Champagne, golden with fine bubbles", foodPairings: "Appetizers, oysters" },
  { name: "Dom Pérignon", winery: "Moët & Chandon", region: "Champagne", country: "France", type: "sparkling", grape: "Chardonnay, Pinot Noir", priceRange: [180, 280], drinkYears: [5, 20], alcohol: "12.5%", description: "Prestige cuvée, extraordinary complexity", foodPairings: "Caviar, lobster, celebration" },
  { name: "La Grande Dame", winery: "Veuve Clicquot", region: "Champagne", country: "France", type: "sparkling", grape: "Pinot Noir, Chardonnay", priceRange: [150, 200], drinkYears: [5, 15], alcohol: "12.5%", description: "Prestige cuvée, power and finesse", foodPairings: "Truffle dishes, foie gras" },
  { name: "Bollinger La Grande Année", winery: "Bollinger", region: "Champagne", country: "France", type: "sparkling", grape: "Pinot Noir, Chardonnay", priceRange: [100, 140], drinkYears: [3, 15], alcohol: "12%", description: "Rich, toasty vintage Champagne", foodPairings: "Caviar, oysters" },
  { name: "Brut Réserve", winery: "Billecart-Salmon", region: "Champagne", country: "France", type: "sparkling", grape: "Pinot Noir, Chardonnay, Pinot Meunier", priceRange: [45, 60], drinkYears: [0, 5], alcohol: "12%", description: "Elegant, refined house style", foodPairings: "Shellfish, canapés" },
  { name: "Rosé Brut", winery: "Ruinart", region: "Champagne", country: "France", type: "sparkling", grape: "Chardonnay, Pinot Noir", priceRange: [65, 90], drinkYears: [0, 5], alcohol: "12.5%", description: "Pale salmon, wild strawberry delicacy", foodPairings: "Salmon, red fruit desserts" },
  { name: "Prosecco Superiore", winery: "Bisol", region: "Valdobbiadene", country: "Italy", type: "sparkling", grape: "Glera", priceRange: [15, 25], drinkYears: [0, 2], alcohol: "11.5%", description: "Fresh, floral Italian sparkling", foodPairings: "Aperitivo, light appetizers" },
  { name: "Cava Gran Reserva", winery: "Gramona", region: "Penedès", country: "Spain", type: "sparkling", grape: "Xarel·lo, Macabeo", priceRange: [25, 40], drinkYears: [2, 8], alcohol: "12%", description: "Complex, age-worthy Cava", foodPairings: "Jamón ibérico, seafood" },
  { name: "Crémant d'Alsace", winery: "Lucien Albrecht", region: "Alsace", country: "France", type: "sparkling", grape: "Pinot Blanc, Auxerrois", priceRange: [15, 22], drinkYears: [0, 3], alcohol: "12%", description: "Crisp, affordable French sparkler", foodPairings: "Brunch, quiche" },
  { name: "Franciacorta Satèn", winery: "Ca' del Bosco", region: "Lombardy", country: "Italy", type: "sparkling", grape: "Chardonnay", priceRange: [35, 55], drinkYears: [1, 6], alcohol: "12.5%", description: "Creamy, elegant Italian méthode", foodPairings: "Risotto, light seafood" },

  // ---- DESSERT (6 templates) ----
  { name: "Château d'Yquem", winery: "Château d'Yquem", region: "Sauternes", country: "France", type: "dessert", grape: "Sémillon, Sauvignon Blanc", priceRange: [300, 500], drinkYears: [10, 50], alcohol: "14%", description: "The greatest dessert wine in the world", foodPairings: "Foie gras, Roquefort, crème brûlée" },
  { name: "Tokaji Aszú 5 Puttonyos", winery: "Royal Tokaji", region: "Tokaj", country: "Hungary", type: "dessert", grape: "Furmint, Hárslevelű", priceRange: [35, 60], drinkYears: [5, 25], alcohol: "11%", description: "Honey, apricot, noble sweetness", foodPairings: "Blue cheese, fruit tart" },
  { name: "Recioto della Valpolicella", winery: "Giuseppe Quintarelli", region: "Veneto", country: "Italy", type: "dessert", grape: "Corvina", priceRange: [80, 150], drinkYears: [5, 20], alcohol: "14%", description: "Rich, dried-fruit sweetness", foodPairings: "Chocolate cake, aged parmesan" },
  { name: "Ice Wine Riesling", winery: "Inniskillin", region: "Niagara Peninsula", country: "Canada", type: "dessert", grape: "Riesling", priceRange: [45, 80], drinkYears: [3, 15], alcohol: "10%", description: "Frozen grape concentrate, luscious", foodPairings: "Foie gras, peach cobbler" },
  { name: "Muscat de Beaumes-de-Venise", winery: "Domaine de Durban", region: "Rhône Valley", country: "France", type: "dessert", grape: "Muscat", priceRange: [18, 30], drinkYears: [1, 6], alcohol: "15%", description: "Sweet, grapey, golden", foodPairings: "Melon, fruit desserts" },
  { name: "Pedro Ximénez", winery: "Toro Albalá", region: "Montilla-Moriles", country: "Spain", type: "dessert", grape: "Pedro Ximénez", priceRange: [20, 40], drinkYears: [0, 20], alcohol: "15%", description: "Treacle-thick, raisin-sweet PX sherry", foodPairings: "Vanilla ice cream, chocolate" },

  // ---- ORANGE (4 templates) ----
  { name: "Ribolla Gialla", winery: "Gravner", region: "Friuli", country: "Italy", type: "orange", grape: "Ribolla Gialla", priceRange: [40, 70], drinkYears: [3, 15], alcohol: "13.5%", description: "Pioneer of amphora orange wine", foodPairings: "Japanese cuisine, Indian curries" },
  { name: "Amber Wine", winery: "Pheasant's Tears", region: "Kakheti", country: "Georgia", type: "orange", grape: "Rkatsiteli", priceRange: [18, 30], drinkYears: [2, 8], alcohol: "12.5%", description: "Traditional qvevri amber wine", foodPairings: "Georgian cuisine, grilled meats" },
  { name: "Skin-Contact Pinot Gris", winery: "Radikon", region: "Friuli", country: "Italy", type: "orange", grape: "Pinot Grigio", priceRange: [35, 55], drinkYears: [3, 12], alcohol: "13%", description: "Extended maceration, copper-hued", foodPairings: "Charcuterie, aged cheeses" },
  { name: "Ramato Pinot Grigio", winery: "Cos", region: "Sicily", country: "Italy", type: "orange", grape: "Pinot Grigio", priceRange: [20, 35], drinkYears: [1, 5], alcohol: "12.5%", description: "Sicilian skin-contact Pinot Grigio", foodPairings: "Grilled octopus, bruschetta" },

  // ---- FORTIFIED (5 templates) ----
  { name: "Vintage Port", winery: "Taylor's", region: "Douro Valley", country: "Portugal", type: "fortified", grape: "Touriga Nacional, Tinta Roriz", priceRange: [60, 120], drinkYears: [10, 40], alcohol: "20%", description: "Classic vintage Port, rich and structured", foodPairings: "Stilton, dark chocolate" },
  { name: "Tawny Port 20 Year", winery: "Graham's", region: "Douro Valley", country: "Portugal", type: "fortified", grape: "Touriga Nacional, Tinta Barroca", priceRange: [40, 70], drinkYears: [0, 10], alcohol: "20%", description: "Nutty, caramel, dried fruit", foodPairings: "Crème brûlée, pecan pie" },
  { name: "Fino Sherry", winery: "Tio Pepe", region: "Jerez", country: "Spain", type: "fortified", grape: "Palomino Fino", priceRange: [10, 18], drinkYears: [0, 2], alcohol: "15%", description: "Bone-dry, saline, yeasty", foodPairings: "Almonds, olives, jamón" },
  { name: "Amontillado Sherry", winery: "Lustau", region: "Jerez", country: "Spain", type: "fortified", grape: "Palomino Fino", priceRange: [15, 30], drinkYears: [0, 10], alcohol: "18%", description: "Nutty, complex, oxidative", foodPairings: "Aged cheeses, consommé" },
  { name: "Madeira Malmsey 10 Year", winery: "Blandy's", region: "Madeira", country: "Portugal", type: "fortified", grape: "Malmsey", priceRange: [25, 45], drinkYears: [0, 30], alcohol: "19%", description: "Rich, caramel, near-indestructible", foodPairings: "Chocolate desserts, dried fruits" },

  // ---- GREEN / VINHO VERDE (3 templates) ----
  { name: "Vinho Verde", winery: "Quinta da Aveleda", region: "Minho", country: "Portugal", type: "green", grape: "Loureiro, Alvarinho", priceRange: [8, 14], drinkYears: [0, 2], alcohol: "11%", description: "Light, fizzy, citrus-fresh", foodPairings: "Grilled sardines, salads, sushi" },
  { name: "Vinho Verde Alvarinho", winery: "Soalheiro", region: "Monção e Melgaço", country: "Portugal", type: "green", grape: "Alvarinho", priceRange: [12, 22], drinkYears: [1, 3], alcohol: "12.5%", description: "Premium Vinho Verde, structured", foodPairings: "Seafood, ceviche, tapas" },
  { name: "Vinho Verde Reserva", winery: "Anselmo Mendes", region: "Minho", country: "Portugal", type: "green", grape: "Alvarinho, Loureiro", priceRange: [15, 28], drinkYears: [1, 4], alcohol: "13%", description: "Complex, mineral-driven green wine", foodPairings: "Grilled fish, white meats" },
];

// ============================================================
// Tasting notes, tags, helpers — identical to mock-store.ts
// ============================================================

const tagPool = [
  "favorite", "everyday", "special occasion", "gift", "investment",
  "summer", "winter", "patio", "cellar pick", "staff pick",
  "organic", "biodynamic", "natural", "value", "splurge",
  "party", "date night", "holiday", "rare", "new arrival",
];

const ratingServices = ["rating_ws", "rating_rp", "rating_jd", "rating_ag"] as const;

function randomDate(rng: ReturnType<typeof createRng>, startYear: number, endYear: number): string {
  const year = rng.nextInt(startYear, endYear);
  const month = rng.nextInt(1, 12);
  const day = rng.nextInt(1, 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const tastingParts: Record<string, { nose: string[]; palate: string[]; finish: string[] }> = {
  red: {
    nose: ["Dark cherry", "Blackberry", "Plum", "Cassis", "Tobacco", "Leather", "Cedar", "Vanilla", "Cocoa", "Black pepper", "Violet", "Earthy mushroom", "Dried herbs", "Graphite", "Smoky oak"],
    palate: ["Full-bodied with firm tannins", "Medium-bodied and silky", "Rich and velvety on the palate", "Elegant structure with fine-grained tannins", "Bold and concentrated", "Layered and complex mid-palate", "Supple texture with good grip"],
    finish: ["Long, lingering finish with spice", "Persistent finish of dark fruit and oak", "Smooth finish with mocha notes", "Elegant finish with mineral undertones", "Warm finish with hints of vanilla"],
  },
  white: {
    nose: ["Citrus zest", "Green apple", "White peach", "Pear", "Honeysuckle", "Jasmine", "Flint", "Tropical fruit", "Lemon curd", "Almond blossom", "Hay", "Wet stone"],
    palate: ["Crisp acidity with good weight", "Creamy and full-bodied", "Bright and mineral-driven", "Refreshing with balanced acidity", "Lush and textured", "Lean and focused mid-palate"],
    finish: ["Clean, refreshing finish", "Long finish with a saline edge", "Lingering citrus and mineral notes", "Crisp finish with green apple", "Smooth finish with toasty oak"],
  },
  sparkling: {
    nose: ["Toasted brioche", "Fresh apple", "Lemon zest", "White flowers", "Almond", "Biscuit", "Chalk"],
    palate: ["Fine, persistent bubbles", "Creamy mousse with bright acidity", "Elegant and precise", "Rich and toasty with vibrant acidity"],
    finish: ["Long, yeasty finish", "Crisp, clean finish", "Complex finish with hazelnut and citrus"],
  },
  dessert: {
    nose: ["Honeycomb", "Dried apricot", "Orange marmalade", "Saffron", "Caramel", "Beeswax", "Candied ginger"],
    palate: ["Luscious sweetness balanced by acidity", "Rich and unctuous", "Concentrated and layered"],
    finish: ["Endless finish of honey and spice", "Long, sweet finish with fresh acidity", "Lingering dried fruit notes"],
  },
  "rosé": {
    nose: ["Strawberry", "Watermelon", "Rose petal", "Citrus zest", "White cherry", "Peach"],
    palate: ["Crisp and refreshing with juicy fruit", "Delicate body with bright acidity", "Dry and elegant"],
    finish: ["Clean, refreshing finish", "Short, crisp finish with mineral notes", "Lingering summer fruit"],
  },
  fortified: {
    nose: ["Caramel", "Dried fig", "Walnut", "Toffee", "Orange peel", "Raisin", "Roasted nuts"],
    palate: ["Rich and warming", "Complex layers of dried fruit and nuts", "Velvety sweetness with balancing acidity"],
    finish: ["Incredibly long, warming finish", "Lingering notes of spice and dried fruit", "Persistent nuttiness"],
  },
  green: {
    nose: ["Lime", "Green apple", "Lemon verbena", "White flowers", "Sea spray"],
    palate: ["Light-bodied with a gentle spritz", "Bright and zesty", "Refreshing with crisp acidity"],
    finish: ["Clean, zippy finish", "Short and refreshing", "Citrus and mineral notes linger"],
  },
};

function generateTastingNotes(rng: ReturnType<typeof createRng>, type: string): string {
  const parts = tastingParts[type] || tastingParts.red;
  const noseNotes = rng.pickN(parts.nose, rng.nextInt(2, 4)).join(", ");
  const palateNote = rng.pick(parts.palate);
  const finishNote = rng.pick(parts.finish);
  return `Nose: ${noseNotes}. ${palateNote}. ${finishNote}.`;
}

const typeColors: Record<string, string> = {
  red: "722F37",
  white: "C4A35A",
  sparkling: "D4AF37",
  "rosé": "E8A0BF",
  dessert: "8B6914",
  fortified: "5C3317",
  green: "6B8E23",
  orange: "CC7722",
};

function makeLabelUrl(winery: string, name: string, type: string): string {
  const bg = typeColors[type] || typeColors.red;
  const text = encodeURIComponent(`${winery}\n${name}`);
  return `https://placehold.co/375x500/${bg}/ffffff?text=${text}&font=playfair-display`;
}

const demoWineries = new Set([
  "Caymus Vineyards", "Opus One Winery", "Silver Oak", "Catena Zapata",
  "Duckhorn Vineyards", "The Prisoner", "Meiomi", "Château Margaux",
  "Antinori", "Penfolds", "Ridge Vineyards", "Veuve Clicquot",
  "Dom Pérignon", "Cloudy Bay", "Williams Selyem", "Château Lafite Rothschild",
  "Château Mouton Rothschild", "Giacomo Conterno", "Biondi-Santi",
  "Tenuta San Guido", "López de Heredia", "Vega Sicilia", "E. Guigal",
  "Domaine de la Romanée-Conti", "Bollinger", "Krug", "Whispering Angel",
  "Joh. Jos. Prüm", "Domaine Weinbach", "Kanonkop", "Felton Road",
  "Kistler Vineyards", "Château Rayas", "Jean-Louis Chave",
  "Alvaro Palacios", "Bertani", "Henschke Hill of Grace",
]);

function generateAiRatings(rng: ReturnType<typeof createRng>, priceHint: number): AiRatings {
  const ratings: AiRatings = {};
  const baseScore = priceHint > 200 ? 92 : priceHint > 80 ? 88 : priceHint > 30 ? 85 : 82;
  const numRatings = rng.nextInt(0, 4);
  const services = rng.pickN([...ratingServices], numRatings);
  for (const svc of services) {
    ratings[svc] = baseScore + rng.nextInt(0, 7);
  }
  return ratings;
}

// ============================================================
// Walls
// ============================================================

const sampleWalls = [
  { name: "Main Wall", sortOrder: 0 },
  { name: "Cellar Room", sortOrder: 1 },
  { name: "Garage", sortOrder: 2 },
  { name: "Overflow Room", sortOrder: 3 },
  { name: "Wine Fridge", sortOrder: 4 },
];

// ============================================================
// Cabinets (wallIndex refers to sampleWalls index)
// ============================================================

interface CabinetDef {
  wallIndex: number;
  name: string;
  rows: number;
  cols: number;
  depth: number;
  storageRows: StorageRow[];
  sortOrder: number;
}

const sampleCabinets: CabinetDef[] = [
  // Wall 0: Main Wall
  { wallIndex: 0, name: "Premium Reds", rows: 10, cols: 8, depth: 2, storageRows: [], sortOrder: 0 },
  { wallIndex: 0, name: "Whites & Rosé", rows: 8, cols: 6, depth: 1, storageRows: [], sortOrder: 1 },
  { wallIndex: 0, name: "Sparkling Collection", rows: 6, cols: 6, depth: 1, storageRows: [], sortOrder: 2 },

  // Wall 1: Cellar Room
  { wallIndex: 1, name: "Bordeaux Reserve", rows: 8, cols: 10, depth: 2, storageRows: [
    { row: 7, name: "Bordeaux Bulk Bin", type: "bulk", capacity: 30 },
  ], sortOrder: 0 },
  { wallIndex: 1, name: "Napa Cabinets", rows: 6, cols: 8, depth: 1, storageRows: [
    { row: 5, name: "Napa Cases", type: "bulk", capacity: 36, boxes: [12, 12, 12] },
  ], sortOrder: 1 },
  { wallIndex: 1, name: "Italian Cellar", rows: 6, cols: 8, depth: 1, storageRows: [], sortOrder: 2 },
  { wallIndex: 1, name: "Burgundy & Rhône", rows: 4, cols: 6, depth: 2, storageRows: [], sortOrder: 3 },

  // Wall 2: Garage
  { wallIndex: 2, name: "Everyday Drinking", rows: 6, cols: 6, depth: 1, storageRows: [
    { row: 4, name: "Red Bin", type: "bulk", capacity: 20 },
    { row: 5, name: "White Bin", type: "bulk", capacity: 20 },
  ], sortOrder: 0 },
  { wallIndex: 2, name: "Case Cellar", rows: 1, cols: 1, depth: 1, storageRows: [
    { row: 0, name: "Mixed Cases", type: "bulk", capacity: 60, boxes: [6, 12, 12, 24] },
  ], sortOrder: 1 },
  { wallIndex: 2, name: "Party Bin", rows: 1, cols: 1, depth: 1, storageRows: [
    { row: 0, name: "Party Wine Bin", type: "bulk", capacity: 50 },
  ], sortOrder: 2 },

  // Wall 3: Overflow Room
  { wallIndex: 3, name: "Mixed Storage", rows: 4, cols: 6, depth: 1, storageRows: [
    { row: 0, name: "Reserve Cases", type: "bulk", capacity: 30, boxes: [12, 12] },
    { row: 3, name: "Overflow Bin", type: "bulk", capacity: 25 },
  ], sortOrder: 0 },
  { wallIndex: 3, name: "Long-Term Aging", rows: 8, cols: 8, depth: 2, storageRows: [], sortOrder: 1 },
  { wallIndex: 3, name: "Quick Access", rows: 4, cols: 4, depth: 1, storageRows: [], sortOrder: 2 },

  // Wall 4: Wine Fridge
  { wallIndex: 4, name: "Fridge Top", rows: 6, cols: 4, depth: 1, storageRows: [], sortOrder: 0 },
  { wallIndex: 4, name: "Fridge Bottom Cases", rows: 1, cols: 1, depth: 1, storageRows: [
    { row: 0, name: "Chilled Cases", type: "bulk", capacity: 30, boxes: [6, 6, 12] },
  ], sortOrder: 1 },
];

// ============================================================
// Wine generation — identical logic to mock-store.ts
// ============================================================

interface WineData {
  cabinetIndex: number | null; // index into sampleCabinets
  name: string;
  winery: string;
  region: string;
  country: string;
  vintage: number | null;
  type: string;
  grapeVariety: string;
  userRating: number | null;
  imageUrl: string;
  price: number | null;
  retailPrice: number | null;
  purchaseDate: string;
  drinkBy: string;
  notes: string;
  description: string;
  foodPairings: string;
  alcohol: string;
  row: number | null;
  col: number | null;
  depth: number;
  zone: string;
  tastingNotes: string;
  disposition: string;
  drinkWindow: string;
  aiRatings: AiRatings | null;
  tags: string[];
  addedAt: string;
}

function generateWines(): WineData[] {
  const wines: WineData[] = [];

  function createWine(
    template: WineTemplate,
    cabinetIndex: number | null,
    row: number | null,
    col: number | null,
    depth: number,
  ): WineData {
    const vintage = template.type === "fortified" && rng.chance(0.3)
      ? null
      : rng.nextInt(2016, 2024);
    const price = rng.nextInt(template.priceRange[0], template.priceRange[1]);
    const drinkByYear = vintage
      ? vintage + rng.nextInt(template.drinkYears[0], template.drinkYears[1])
      : null;
    const drinkFromYear = vintage
      ? vintage + Math.max(0, rng.nextInt(0, template.drinkYears[0]))
      : null;

    const dRoll = rng.next();
    const disposition = dRoll < 0.50 ? "D" : dRoll < 0.85 ? "H" : "P";

    const numTags = rng.nextInt(0, 3);
    const tags = rng.pickN(tagPool, numTags);

    const addedDate = randomDate(rng, 2024, 2026);

    return {
      cabinetIndex,
      name: template.name,
      winery: template.winery,
      region: template.region,
      country: template.country,
      vintage,
      type: template.type,
      grapeVariety: template.grape,
      userRating: rng.chance(0.7)
        ? Math.round((rng.nextInt(25, 50) / 10) * 10) / 10
        : null,
      imageUrl: demoWineries.has(template.winery) ? makeLabelUrl(template.winery, template.name, template.type) : "",
      price,
      retailPrice: Math.round(price * (1 + rng.next() * 0.3)),
      purchaseDate: addedDate,
      drinkBy: drinkByYear ? String(drinkByYear) : "",
      notes: "",
      description: template.description,
      foodPairings: template.foodPairings,
      alcohol: template.alcohol,
      row,
      col,
      depth,
      zone: "",
      tastingNotes: rng.chance(0.85) ? generateTastingNotes(rng, template.type) : "",
      disposition,
      drinkWindow: drinkFromYear && drinkByYear
        ? `${drinkFromYear}-${drinkByYear}`
        : "",
      aiRatings: generateAiRatings(rng, price),
      tags,
      addedAt: `${addedDate}T${String(rng.nextInt(8, 22)).padStart(2, "0")}:${String(rng.nextInt(0, 59)).padStart(2, "0")}:00Z`,
    };
  }

  // Weighted template picker
  const redTemplates = wineCatalog.filter((t) => t.type === "red");
  const whiteTemplates = wineCatalog.filter((t) => t.type === "white");
  const roseTemplates = wineCatalog.filter((t) => t.type === "rosé");
  const sparklingTemplates = wineCatalog.filter((t) => t.type === "sparkling");
  const dessertTemplates = wineCatalog.filter((t) => t.type === "dessert");
  const orangeTemplates = wineCatalog.filter((t) => t.type === "orange");
  const fortifiedTemplates = wineCatalog.filter((t) => t.type === "fortified");
  const greenTemplates = wineCatalog.filter((t) => t.type === "green");

  function pickTemplate(): WineTemplate {
    const roll = rng.next();
    if (roll < 0.45) return rng.pick(redTemplates);
    if (roll < 0.67) return rng.pick(whiteTemplates);
    if (roll < 0.75) return rng.pick(roseTemplates);
    if (roll < 0.85) return rng.pick(sparklingTemplates);
    if (roll < 0.90) return rng.pick(dessertTemplates);
    if (roll < 0.93) return rng.pick(orangeTemplates);
    if (roll < 0.97) return rng.pick(fortifiedTemplates);
    return rng.pick(greenTemplates);
  }

  const FILL_RATE = 0.85;

  for (let cabIdx = 0; cabIdx < sampleCabinets.length; cabIdx++) {
    const cab = sampleCabinets[cabIdx];
    const storageRowIndices = new Set(cab.storageRows.map((sr) => sr.row));

    // Grid slots
    for (let row = 0; row < cab.rows; row++) {
      if (storageRowIndices.has(row)) continue;
      for (let col = 0; col < cab.cols; col++) {
        for (let d = 0; d < cab.depth; d++) {
          if (!rng.chance(FILL_RATE)) continue;
          const template = pickTemplate();
          wines.push(createWine(template, cabIdx, row, col, d));
        }
      }
    }

    // Storage rows
    for (const sr of cab.storageRows) {
      const targetFill = Math.floor(sr.capacity * FILL_RATE);
      for (let i = 0; i < targetFill; i++) {
        const template = pickTemplate();
        wines.push(createWine(template, cabIdx, sr.row, i, 0));
      }
    }
  }

  // Unfiled wines (~30)
  const unfiledCount = 30;
  for (let i = 0; i < unfiledCount; i++) {
    const template = pickTemplate();
    wines.push(createWine(template, null, null, null, 0));
  }

  return wines;
}

// ============================================================
// Main seed function
// ============================================================

async function main() {
  const userId = TARGET_USER_ID;

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`User ${userId} not found in database!`);
    process.exit(1);
  }
  console.log(`Found user: ${user.email} (${user.displayName})`);

  // Step 1: Delete existing wines, cabinets, walls for this user (clean slate)
  console.log("\n--- Deleting existing data for user ---");

  const delWines = await prisma.wine.deleteMany({ where: { userId } });
  console.log(`  Deleted ${delWines.count} wines`);

  const delCabinets = await prisma.cabinet.deleteMany({ where: { userId } });
  console.log(`  Deleted ${delCabinets.count} cabinets`);

  const delWalls = await prisma.wall.deleteMany({ where: { userId } });
  console.log(`  Deleted ${delWalls.count} walls`);

  // Step 2: Insert walls
  console.log("\n--- Inserting walls ---");
  const wallIds: string[] = [];
  for (const w of sampleWalls) {
    const wall = await prisma.wall.create({
      data: {
        userId,
        name: w.name,
        sortOrder: w.sortOrder,
      },
    });
    wallIds.push(wall.id);
    console.log(`  Created wall: ${wall.name} (${wall.id})`);
  }

  // Step 3: Insert cabinets
  console.log("\n--- Inserting cabinets ---");
  const cabinetIds: string[] = [];
  for (const c of sampleCabinets) {
    const cab = await prisma.cabinet.create({
      data: {
        userId,
        wallId: wallIds[c.wallIndex],
        name: c.name,
        rows: c.rows,
        cols: c.cols,
        depth: c.depth,
        storageRows: c.storageRows as unknown as Prisma.InputJsonValue,
        sortOrder: c.sortOrder,
      },
    });
    cabinetIds.push(cab.id);
    console.log(`  Created cabinet: ${cab.name} (${cab.id}) -> wall ${sampleWalls[c.wallIndex].name}`);
  }

  // Step 4: Generate wines
  console.log("\n--- Generating wines ---");
  const wineData = generateWines();
  console.log(`  Generated ${wineData.length} wines`);

  // Step 5: Batch insert wines
  console.log("\n--- Inserting wines (batch) ---");
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < wineData.length; i += BATCH_SIZE) {
    const batch = wineData.slice(i, i + BATCH_SIZE);
    const createData = batch.map((w) => ({
      userId,
      cabinetId: w.cabinetIndex !== null ? cabinetIds[w.cabinetIndex] : null,
      barcode: "",
      name: w.name,
      winery: w.winery,
      region: w.region,
      country: w.country,
      vintage: w.vintage,
      type: w.type,
      grapeVariety: w.grapeVariety,
      userRating: w.userRating,
      imageUrl: w.imageUrl,
      price: w.price,
      retailPrice: w.retailPrice,
      purchaseDate: w.purchaseDate,
      drinkBy: w.drinkBy,
      notes: w.notes,
      description: w.description,
      foodPairings: w.foodPairings,
      alcohol: w.alcohol,
      row: w.row,
      col: w.col,
      depth: w.depth,
      zone: w.zone,
      tastingNotes: w.tastingNotes,
      disposition: w.disposition,
      drinkWindow: w.drinkWindow,
      aiRatings: w.aiRatings ?? undefined,
      tags: w.tags,
      addedAt: new Date(w.addedAt),
    }));

    // Use createMany for speed
    const result = await prisma.wine.createMany({ data: createData });
    inserted += result.count;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: inserted ${result.count} wines (total: ${inserted})`);
  }

  // Step 6: Verify counts
  console.log("\n--- Verification ---");
  const wallCount = await prisma.wall.count({ where: { userId } });
  const cabinetCount = await prisma.cabinet.count({ where: { userId } });
  const wineCount = await prisma.wine.count({ where: { userId } });
  const filedWineCount = await prisma.wine.count({ where: { userId, cabinetId: { not: null } } });
  const unfiledWineCount = await prisma.wine.count({ where: { userId, cabinetId: null } });

  console.log(`  Walls:          ${wallCount}`);
  console.log(`  Cabinets:       ${cabinetCount}`);
  console.log(`  Total wines:    ${wineCount}`);
  console.log(`  Filed wines:    ${filedWineCount}`);
  console.log(`  Unfiled wines:  ${unfiledWineCount}`);
  console.log("\nSeed complete!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
