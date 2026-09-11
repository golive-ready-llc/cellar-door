// In-memory mock store for development without a database
// This is used when DATABASE_URL is not configured
import type { Wine, Wall, Cabinet, StorageRow, WineHistoryItem, BuyListItem } from "@/types/wine";
import type { WineType, AiRatings } from "@/types/wine";

const DEV_USER_ID = "dev-user-001";
const DEMO_USER_ID = "demo-user-001";

/**
 * Normalize user IDs so the demo persona (`demo-user-001`, set by the
 * /demo landing page) maps to the same mock dataset as the unauthenticated
 * dev persona (`dev-user-001`). Without this, demo users see an empty cellar
 * because all seeded wines/walls/cabinets are tagged with DEV_USER_ID.
 */
function normalizeUserId(userId: string): string {
  return userId === DEMO_USER_ID ? DEV_USER_ID : userId;
}

// ============================================================
// Seeded PRNG for deterministic wine generation
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
// Wine Catalog — ~120 real wine templates
// ============================================================

interface WineTemplate {
  name: string;
  winery: string;
  region: string;
  country: string;
  type: WineType;
  grape: string;
  priceRange: [number, number];
  drinkYears: [number, number]; // years from vintage to drink-by window
  alcohol: string;
  description: string;
  foodPairings: string;
}

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
// Tag Pool and Helpers
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

// ============================================================
// Tasting Notes Generator
// ============================================================

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

// Wine type → background color for placeholder labels
const typeColors: Record<string, string> = {
  red: "722F37",      // deep wine red
  white: "C4A35A",    // golden
  sparkling: "D4AF37", // champagne gold
  "rosé": "E8A0BF",   // pink
  dessert: "8B6914",   // amber
  fortified: "5C3317", // port brown
  green: "6B8E23",     // olive green
  orange: "CC7722",    // amber orange
};

/** Generate a placeholder label image URL for a wine */
function makeLabelUrl(winery: string, name: string, type: string): string {
  const bg = typeColors[type] || typeColors.red;
  const text = encodeURIComponent(`${winery}\n${name}`);
  return `https://placehold.co/375x500/${bg}/ffffff?text=${text}&font=playfair-display`;
}

// Set of wineries that get label images in the demo (about 40% of templates)
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
  // Higher-priced wines tend to have higher scores
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

const sampleWalls: Wall[] = [
  { id: "wall-001", userId: DEV_USER_ID, name: "Main Wall", location: "", sortOrder: 0 },
  { id: "wall-002", userId: DEV_USER_ID, name: "Cellar Room", location: "", sortOrder: 1 },
  { id: "wall-003", userId: DEV_USER_ID, name: "Garage", location: "", sortOrder: 2 },
  { id: "wall-004", userId: DEV_USER_ID, name: "Overflow Room", location: "", sortOrder: 3 },
  { id: "wall-005", userId: DEV_USER_ID, name: "Wine Fridge", location: "", sortOrder: 4 },
];

// ============================================================
// Cabinets — 15 sections with diverse storage types
// ============================================================

const sampleCabinets: Cabinet[] = [
  // ── Wall 1: Main Wall (~244 capacity) ──
  {
    id: "cab-001", userId: DEV_USER_ID, wallId: "wall-001",
    name: "Premium Reds", rows: 10, cols: 8, depth: 2,
    storageRows: [], sortOrder: 0,
  },
  {
    id: "cab-002", userId: DEV_USER_ID, wallId: "wall-001",
    name: "Whites & Rosé", rows: 8, cols: 6, depth: 1,
    storageRows: [], sortOrder: 1,
  },
  {
    id: "cab-003", userId: DEV_USER_ID, wallId: "wall-001",
    name: "Sparkling Collection", rows: 6, cols: 6, depth: 1,
    storageRows: [], sortOrder: 2,
  },

  // ── Wall 2: Cellar Room (~272 capacity) ──
  {
    id: "cab-004", userId: DEV_USER_ID, wallId: "wall-002",
    name: "Bordeaux Reserve", rows: 8, cols: 10, depth: 2,
    storageRows: [
      { row: 7, name: "Bordeaux Bulk Bin", type: "bulk" as StorageRow["type"], capacity: 30 },
    ],
    sortOrder: 0,
  },
  {
    id: "cab-005", userId: DEV_USER_ID, wallId: "wall-002",
    name: "Napa Cabinets", rows: 6, cols: 8, depth: 1,
    storageRows: [
      { row: 5, name: "Napa Cases", type: "bulk" as StorageRow["type"], capacity: 36, boxes: [12, 12, 12] },
    ],
    sortOrder: 1,
  },
  {
    id: "cab-006", userId: DEV_USER_ID, wallId: "wall-002",
    name: "Italian Cellar", rows: 6, cols: 8, depth: 1,
    storageRows: [], sortOrder: 2,
  },
  {
    id: "cab-007", userId: DEV_USER_ID, wallId: "wall-002",
    name: "Burgundy & Rhône", rows: 4, cols: 6, depth: 2,
    storageRows: [], sortOrder: 3,
  },

  // ── Wall 3: Garage (~174 capacity) ──
  {
    id: "cab-008", userId: DEV_USER_ID, wallId: "wall-003",
    name: "Everyday Drinking", rows: 6, cols: 6, depth: 1,
    storageRows: [
      { row: 4, name: "Red Bin", type: "bulk" as StorageRow["type"], capacity: 20 },
      { row: 5, name: "White Bin", type: "bulk" as StorageRow["type"], capacity: 20 },
    ],
    sortOrder: 0,
  },
  {
    id: "cab-009", userId: DEV_USER_ID, wallId: "wall-003",
    name: "Case Cellar", rows: 1, cols: 1, depth: 1,
    storageRows: [
      { row: 0, name: "Mixed Cases", type: "bulk" as StorageRow["type"], capacity: 60, boxes: [6, 12, 12, 24] },
    ],
    sortOrder: 1,
  },
  {
    id: "cab-010", userId: DEV_USER_ID, wallId: "wall-003",
    name: "Party Bin", rows: 1, cols: 1, depth: 1,
    storageRows: [
      { row: 0, name: "Party Wine Bin", type: "bulk" as StorageRow["type"], capacity: 50 },
    ],
    sortOrder: 2,
  },

  // ── Wall 4: Overflow Room (~211 capacity) ──
  {
    id: "cab-011", userId: DEV_USER_ID, wallId: "wall-004",
    name: "Mixed Storage", rows: 4, cols: 6, depth: 1,
    storageRows: [
      { row: 0, name: "Reserve Cases", type: "bulk" as StorageRow["type"], capacity: 30, boxes: [12, 12] },
      { row: 3, name: "Overflow Bin", type: "bulk" as StorageRow["type"], capacity: 25 },
    ],
    sortOrder: 0,
  },
  {
    id: "cab-012", userId: DEV_USER_ID, wallId: "wall-004",
    name: "Long-Term Aging", rows: 8, cols: 8, depth: 2,
    storageRows: [], sortOrder: 1,
  },
  {
    id: "cab-013", userId: DEV_USER_ID, wallId: "wall-004",
    name: "Quick Access", rows: 4, cols: 4, depth: 1,
    storageRows: [], sortOrder: 2,
  },

  // ── Wall 5: Wine Fridge (~54 capacity) ──
  {
    id: "cab-014", userId: DEV_USER_ID, wallId: "wall-005",
    name: "Fridge Top", rows: 6, cols: 4, depth: 1,
    storageRows: [], sortOrder: 0,
  },
  {
    id: "cab-015", userId: DEV_USER_ID, wallId: "wall-005",
    name: "Fridge Bottom Cases", rows: 1, cols: 1, depth: 1,
    storageRows: [
      { row: 0, name: "Chilled Cases", type: "bulk" as StorageRow["type"], capacity: 30, boxes: [6, 6, 12] },
    ],
    sortOrder: 1,
  },
];

// ============================================================
// Programmatic Wine Generator
// ============================================================

function generateWines(): Wine[] {
  const wines: Wine[] = [];
  let wineNum = 1;

  function makeWineId(): string {
    return `wine-${String(wineNum++).padStart(4, "0")}`;
  }

  function createWine(
    template: WineTemplate,
    cabinetId: string | null,
    row: number | null,
    col: number | null,
    depth: number,
  ): Wine {
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

    // Disposition weighted: D=50%, H=35%, P=15%
    const dRoll = rng.next();
    const disposition = dRoll < 0.50 ? "D" : dRoll < 0.85 ? "H" : "P";

    const numTags = rng.nextInt(0, 3);
    const tags = rng.pickN(tagPool, numTags);

    const addedDate = randomDate(rng, 2024, 2026);

    return {
      id: makeWineId(),
      userId: DEV_USER_ID,
      cabinetId,
      barcode: "",
      name: template.name,
      winery: template.winery,
      region: template.region,
      country: template.country,
      vintage,
      type: template.type,
      sparkling: template.type === "sparkling",
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
      updatedAt: `${addedDate}T${String(rng.nextInt(8, 22)).padStart(2, "0")}:${String(rng.nextInt(0, 59)).padStart(2, "0")}:00Z`,
    };
  }

  // Weighted template picker: more reds, fewer rare types
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

  // For each cabinet, fill slots
  for (const cab of sampleCabinets) {
    const storageRowIndices = new Set(cab.storageRows.map((sr) => sr.row));

    // --- Grid slots ---
    for (let row = 0; row < cab.rows; row++) {
      if (storageRowIndices.has(row)) continue; // skip storage rows

      for (let col = 0; col < cab.cols; col++) {
        for (let d = 0; d < cab.depth; d++) {
          if (!rng.chance(FILL_RATE)) continue; // leave some empty
          const template = pickTemplate();
          wines.push(createWine(template, cab.id, row, col, d));
        }
      }
    }

    // --- Storage rows ---
    for (const sr of cab.storageRows) {
      const targetFill = Math.floor(sr.capacity * FILL_RATE);
      for (let i = 0; i < targetFill; i++) {
        const template = pickTemplate();
        wines.push(createWine(template, cab.id, sr.row, i, 0));
      }
    }
  }

  // --- Unfiled wines (~30) ---
  const unfiledCount = 30;
  for (let i = 0; i < unfiledCount; i++) {
    const template = pickTemplate();
    wines.push(createWine(template, null, null, null, 0));
  }

  return wines;
}

const sampleWines = generateWines();

// ============================================================
// Sample History
// ============================================================

// Mock history items omit fully-specified fields (consumeNotes, retailPrice,
// etc.) for readability — fill defaults via a helper so TS matches.
function makeHistoryItem(partial: Partial<WineHistoryItem> & Pick<WineHistoryItem, "id" | "name" | "winery" | "type" | "rating" | "removedAt" | "reason">): WineHistoryItem {
  return {
    originalId: null,
    vintage: null,
    region: "",
    country: "",
    grapeVariety: "",
    consumeRating: partial.rating ?? null,
    consumeNotes: "",
    price: null,
    retailPrice: null,
    imageUrl: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    addedAt: null,
    ...partial,
  } as WineHistoryItem;
}

const sampleHistory: WineHistoryItem[] = ([
  {
    id: "hist-001", originalId: null,
    name: "Penfolds Grange", winery: "Penfolds", vintage: 2017, type: "red",
    region: "South Australia", country: "Australia", grapeVariety: "Shiraz",
    rating: 5, price: 750, imageUrl: makeLabelUrl("Penfolds", "Grange", "red"),
    addedAt: "2023-06-10T12:00:00Z", removedAt: "2026-03-05T19:30:00Z", reason: "drank",
  },
  {
    id: "hist-002", originalId: null,
    name: "Domaine de la Romanée-Conti", winery: "DRC", vintage: 2012, type: "red",
    region: "Burgundy", country: "France", grapeVariety: "Pinot Noir",
    rating: 5, price: 2500, imageUrl: "",
    addedAt: "2022-11-01T12:00:00Z", removedAt: "2026-02-14T20:00:00Z", reason: "drank",
  },
  {
    id: "hist-003", originalId: null,
    name: "Cabernet Sauvignon", winery: "Silver Oak", vintage: 2018, type: "red",
    region: "Alexander Valley", country: "USA", grapeVariety: "Cabernet Sauvignon",
    rating: 4, price: 85, imageUrl: makeLabelUrl("Silver Oak", "Cabernet Sauvignon", "red"),
    addedAt: "2024-01-05T12:00:00Z", removedAt: "2026-02-28T18:00:00Z", reason: "gifted",
  },
  {
    id: "hist-004", originalId: null,
    name: "Tignanello", winery: "Antinori", vintage: 2019, type: "red",
    region: "Tuscany", country: "Italy", grapeVariety: "Sangiovese, Cabernet Sauvignon",
    rating: null, price: 120, imageUrl: makeLabelUrl("Antinori", "Tignanello", "red"),
    addedAt: "2024-03-20T12:00:00Z", removedAt: "2026-01-15T12:00:00Z", reason: "sold",
  },
  {
    id: "hist-005", originalId: null,
    name: "Sassicaia", winery: "Tenuta San Guido", vintage: 2018, type: "red",
    region: "Bolgheri", country: "Italy", grapeVariety: "Cabernet Sauvignon, Cabernet Franc",
    rating: 5, price: 280, imageUrl: "",
    addedAt: "2023-08-15T12:00:00Z", removedAt: "2025-12-31T21:00:00Z", reason: "drank",
  },
  {
    id: "hist-006", originalId: null,
    name: "Château Margaux", winery: "Château Margaux", vintage: 2010, type: "red",
    region: "Bordeaux", country: "France", grapeVariety: "Cabernet Sauvignon, Merlot",
    rating: null, price: 650, imageUrl: makeLabelUrl("Château Margaux", "Grand Vin", "red"),
    addedAt: "2023-01-20T12:00:00Z", removedAt: "2025-11-20T12:00:00Z", reason: "broken",
  },
  {
    id: "hist-007", originalId: null,
    name: "Riesling Kabinett", winery: "Joh. Jos. Prüm", vintage: 2019, type: "white",
    region: "Mosel", country: "Germany", grapeVariety: "Riesling",
    rating: 4, price: 35, imageUrl: "",
    addedAt: "2024-05-10T12:00:00Z", removedAt: "2026-01-20T19:00:00Z", reason: "drank",
  },
  {
    id: "hist-008", originalId: null,
    name: "Rosé d'Anjou", winery: "Domaine des Baumard", vintage: 2023, type: "rosé",
    region: "Loire Valley", country: "France", grapeVariety: "Grolleau",
    rating: 3, price: 12, imageUrl: "",
    addedAt: "2025-06-01T12:00:00Z", removedAt: "2025-08-15T18:00:00Z", reason: "drank",
  },
  {
    id: "hist-009", originalId: null,
    name: "Rioja Gran Reserva", winery: "López de Heredia", vintage: 2010, type: "red",
    region: "Rioja", country: "Spain", grapeVariety: "Tempranillo",
    rating: 4.5, price: 55, imageUrl: "",
    addedAt: "2023-09-01T12:00:00Z", removedAt: "2025-10-20T20:00:00Z", reason: "drank",
  },
  {
    id: "hist-010", originalId: null,
    name: "Gewürztraminer Vendange Tardive", winery: "Zind-Humbrecht", vintage: 2018, type: "white",
    region: "Alsace", country: "France", grapeVariety: "Gewürztraminer",
    rating: 4.5, price: 48, imageUrl: "",
    addedAt: "2024-04-10T12:00:00Z", removedAt: "2025-12-25T20:00:00Z", reason: "gifted",
  },
] as Array<Partial<WineHistoryItem> & Pick<WineHistoryItem, "id" | "name" | "winery" | "type" | "rating" | "removedAt" | "reason">>).map(makeHistoryItem);

// ============================================================
// Sample Buy List
// ============================================================

// Buy-list entries in mock data share the same "wanted" defaults — apply via helper.
function makeBuyListItem(partial: Partial<BuyListItem> & Pick<BuyListItem, "id" | "name" | "winery" | "type">): BuyListItem {
  return {
    userId: DEV_USER_ID,
    barcode: "",
    region: "",
    country: "",
    vintage: null,
    grapeVariety: "",
    imageUrl: "",
    retailPrice: null,
    notes: "",
    description: "",
    foodPairings: "",
    alcohol: "",
    disposition: "",
    drinkWindow: "",
    aiRatings: null,
    status: "wanted",
    orderDate: null,
    expectedDelivery: null,
    store: "",
    addedAt: new Date().toISOString(),
    ...partial,
  } as BuyListItem;
}

const sampleBuyList: BuyListItem[] = ([
  {
    id: "buy-001", userId: DEV_USER_ID, barcode: "",
    name: "Screaming Eagle Cabernet Sauvignon", winery: "Screaming Eagle",
    region: "Napa Valley", country: "USA", vintage: 2020, type: "red",
    grapeVariety: "Cabernet Sauvignon", imageUrl: "", retailPrice: 3500,
    notes: "Dream wine — save up for it",
    description: "One of Napa's most sought-after cult wines",
    foodPairings: "Prime rib, wagyu beef", alcohol: "14.5%",
    disposition: "", drinkWindow: "2028-2055",
    aiRatings: { rating_ws: 99, rating_rp: 100 },
    addedAt: "2026-02-10T12:00:00Z",
  },
  {
    id: "buy-002", userId: DEV_USER_ID, barcode: "",
    name: "Riesling Clos Sainte Hune", winery: "Trimbach",
    region: "Alsace", country: "France", vintage: 2018, type: "white",
    grapeVariety: "Riesling", imageUrl: "", retailPrice: 180,
    notes: "Recommended by sommelier",
    description: "One of the world's greatest white wines",
    foodPairings: "Lobster, aged comté, sushi", alcohol: "13%",
    disposition: "", drinkWindow: "2026-2045",
    aiRatings: { rating_ws: 96, rating_rp: 97 },
    addedAt: "2026-01-20T12:00:00Z",
  },
  {
    id: "buy-003", userId: DEV_USER_ID, barcode: "",
    name: "Bollinger La Grande Année", winery: "Bollinger",
    region: "Champagne", country: "France", vintage: 2015, type: "sparkling",
    grapeVariety: "Pinot Noir, Chardonnay", imageUrl: "", retailPrice: 120,
    notes: "For anniversary dinner",
    description: "Prestige cuvée with exceptional depth",
    foodPairings: "Caviar, oysters, celebration toast", alcohol: "12%",
    disposition: "", drinkWindow: "",
    aiRatings: { rating_ws: 95, rating_rp: 94 },
    addedAt: "2026-03-01T12:00:00Z",
  },
  {
    id: "buy-004", userId: DEV_USER_ID, barcode: "",
    name: "Barolo Monfortino Riserva", winery: "Giacomo Conterno",
    region: "Piedmont", country: "Italy", vintage: 2014, type: "red",
    grapeVariety: "Nebbiolo", imageUrl: "", retailPrice: 700,
    notes: "Legendary Italian red",
    description: "The king of Barolo — extraordinary depth and aging potential",
    foodPairings: "Truffle risotto, braised meats", alcohol: "14%",
    disposition: "", drinkWindow: "2030-2060",
    aiRatings: { rating_ws: 98, rating_rp: 99 },
    addedAt: "2026-02-25T12:00:00Z",
  },
  {
    id: "buy-005", userId: DEV_USER_ID, barcode: "",
    name: "Condrieu Les Chaillées de l'Enfer", winery: "Georges Vernay",
    region: "Rhône Valley", country: "France", vintage: 2021, type: "white",
    grapeVariety: "Viognier", imageUrl: "", retailPrice: 90,
    notes: "Benchmark Condrieu",
    description: "Intense stone fruit, floral, with beautiful texture",
    foodPairings: "Foie gras, lobster thermidor", alcohol: "13.5%",
    disposition: "", drinkWindow: "2026-2032",
    aiRatings: { rating_ws: 95 },
    addedAt: "2026-03-05T12:00:00Z",
  },
  {
    id: "buy-006", userId: DEV_USER_ID, barcode: "",
    name: "Châteauneuf-du-Pape", winery: "Château Rayas",
    region: "Rhône Valley", country: "France", vintage: 2019, type: "red",
    grapeVariety: "Grenache", imageUrl: "", retailPrice: 450,
    notes: "The most iconic CdP",
    description: "Pure Grenache brilliance, delicate power",
    foodPairings: "Lamb navarin, wild game", alcohol: "14.5%",
    disposition: "", drinkWindow: "2027-2045",
    aiRatings: { rating_ws: 97, rating_rp: 98 },
    addedAt: "2026-02-18T12:00:00Z",
  },
] as Array<Partial<BuyListItem> & Pick<BuyListItem, "id" | "name" | "winery" | "type">>).map(makeBuyListItem);

// ============================================================
// Dev user profile
// ============================================================

const devProfile = {
  id: DEV_USER_ID,
  displayName: "Demo User",
  email: "demo@cellardoor.app",
  photoURL: null as string | null,
  avatarColor: "#722F37", // Deep wine red
  createdAt: "2025-01-15T00:00:00.000Z",
};

// ============================================================
// Mutable state
// ============================================================

let wines = [...sampleWines];
let walls = [...sampleWalls];
let cabinets = [...sampleCabinets];
let history = [...sampleHistory];
let buyList = [...sampleBuyList];
let nextWineNum = sampleWines.length + 100;
let nextHistNum = 15;
let nextBuyNum = 10;

// ============================================================
// Mock Store API
// ============================================================

export const mockStore = {
  // User / Profile
  getDevUserId: () => DEV_USER_ID,
  getProfile: () => ({ ...devProfile }),
  updateProfile: (data: { displayName?: string; photoURL?: string | null; avatarColor?: string }) => {
    if (data.displayName !== undefined) devProfile.displayName = data.displayName;
    if (data.photoURL !== undefined) devProfile.photoURL = data.photoURL;
    if (data.avatarColor !== undefined) devProfile.avatarColor = data.avatarColor;
    return { ...devProfile };
  },

  // Full data export/import for backup
  getAllData: () => ({
    wines: [...wines],
    walls: [...walls],
    cabinets: [...cabinets],
    history: [...history],
    buyList: [...buyList],
  }),
  replaceAllData: (data: {
    wines?: Wine[];
    walls?: Wall[];
    cabinets?: Cabinet[];
    history?: WineHistoryItem[];
    buyList?: BuyListItem[];
  }) => {
    if (data.wines) { wines = data.wines; nextWineNum = wines.length + 100; }
    if (data.walls) { walls = data.walls; }
    if (data.cabinets) { cabinets = data.cabinets; }
    if (data.history) { history = data.history; nextHistNum = history.length + 15; }
    if (data.buyList) { buyList = data.buyList; nextBuyNum = buyList.length + 10; }
  },

  // Wines
  getWines: (userId: string) => {
    const uid = normalizeUserId(userId);
    return wines.filter((w) => w.userId === uid);
  },
  getWinesByCabinet: (userId: string, cabinetId: string) => {
    const uid = normalizeUserId(userId);
    return wines.filter((w) => w.userId === uid && w.cabinetId === cabinetId);
  },
  getWine: (userId: string, wineId: string) => {
    const uid = normalizeUserId(userId);
    return wines.find((w) => w.id === wineId && w.userId === uid) ?? null;
  },
  addWine: (wine: Omit<Wine, "id" | "addedAt" | "updatedAt">): Wine => {
    const now = new Date().toISOString();
    const newWine: Wine = {
      ...wine,
      id: `wine-${String(nextWineNum++).padStart(4, "0")}`,
      addedAt: now,
      updatedAt: now,
    };
    wines.push(newWine);
    return newWine;
  },
  updateWine: (wineId: string, data: Partial<Wine>): Wine | null => {
    const index = wines.findIndex((w) => w.id === wineId);
    if (index === -1) return null;
    wines[index] = {
      ...wines[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return wines[index];
  },
  removeWine: (wineId: string, reason: string = "other", rating?: number | null, _notes?: string) => {
    const wine = wines.find((w) => w.id === wineId);
    if (wine) {
      // Move to history
      const historyItem: WineHistoryItem = {
        id: `hist-${String(nextHistNum++).padStart(3, "0")}`,
        originalId: wine.id,
        name: wine.name,
        winery: wine.winery,
        vintage: wine.vintage,
        type: wine.type,
        region: wine.region,
        country: wine.country,
        grapeVariety: wine.grapeVariety,
        rating: rating !== undefined ? (rating ?? null) : wine.userRating,
        consumeRating: rating !== undefined ? (rating ?? null) : null,
        consumeNotes: _notes ?? "",
        price: wine.price,
        retailPrice: wine.retailPrice,
        imageUrl: wine.imageUrl,
        description: wine.description,
        foodPairings: wine.foodPairings,
        alcohol: wine.alcohol,
        disposition: wine.disposition,
        drinkWindow: wine.drinkWindow,
        aiRatings: wine.aiRatings as Record<string, number | null> | null,
        addedAt: wine.addedAt,
        removedAt: new Date().toISOString(),
        reason,
      };
      history.push(historyItem);
    }
    wines = wines.filter((w) => w.id !== wineId);
  },

  // Walls
  getWalls: (userId: string) => {
    const uid = normalizeUserId(userId);
    return walls
      .filter((w) => w.userId === uid)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  getWall: (userId: string, wallId: string) => {
    const uid = normalizeUserId(userId);
    return walls.find((w) => w.id === wallId && w.userId === uid) ?? null;
  },
  addWall: (wall: Omit<Wall, "id">): Wall => {
    const newWall: Wall = {
      ...wall,
      id: `wall-${String(walls.length + 1).padStart(3, "0")}`,
    };
    walls.push(newWall);
    return newWall;
  },
  updateWall: (wallId: string, data: Partial<Wall>): Wall | null => {
    const index = walls.findIndex((w) => w.id === wallId);
    if (index === -1) return null;
    walls[index] = { ...walls[index], ...data };
    return walls[index];
  },
  deleteWall: (wallId: string) => {
    // Unassign wines in cabinets belonging to this wall
    const wallCabIds = cabinets
      .filter((c) => c.wallId === wallId)
      .map((c) => c.id);
    wines = wines.map((w) =>
      w.cabinetId && wallCabIds.includes(w.cabinetId)
        ? { ...w, cabinetId: null, row: null, col: null }
        : w
    );
    // Delete cabinets belonging to this wall
    cabinets = cabinets.filter((c) => c.wallId !== wallId);
    // Delete the wall
    walls = walls.filter((w) => w.id !== wallId);
  },

  // Cabinets
  getCabinets: (userId: string) => {
    const uid = normalizeUserId(userId);
    return cabinets
      .filter((c) => c.userId === uid)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
  getCabinet: (userId: string, cabinetId: string) => {
    const uid = normalizeUserId(userId);
    return cabinets.find((c) => c.id === cabinetId && c.userId === uid) ?? null;
  },
  addCabinet: (cabinet: Omit<Cabinet, "id">): Cabinet => {
    const newCabinet: Cabinet = {
      ...cabinet,
      id: `cab-${String(cabinets.length + 1).padStart(3, "0")}`,
    };
    cabinets.push(newCabinet);
    return newCabinet;
  },
  updateCabinet: (cabinetId: string, data: Partial<Cabinet>): Cabinet | null => {
    const index = cabinets.findIndex((c) => c.id === cabinetId);
    if (index === -1) return null;
    cabinets[index] = { ...cabinets[index], ...data };
    return cabinets[index];
  },
  deleteCabinet: (cabinetId: string) => {
    // Unassign wines
    wines = wines.map((w) =>
      w.cabinetId === cabinetId
        ? { ...w, cabinetId: null, row: null, col: null }
        : w
    );
    cabinets = cabinets.filter((c) => c.id !== cabinetId);
  },

  // History
  getHistory: (_userId: string) =>
    history.sort(
      (a, b) =>
        new Date(b.removedAt).getTime() - new Date(a.removedAt).getTime()
    ),
  getHistoryItem: (id: string) =>
    history.find((h) => h.id === id) ?? null,
  deleteHistoryItem: (id: string) => {
    history = history.filter((h) => h.id !== id);
  },

  // Buy List
  getBuyList: (userId: string) => {
    const uid = normalizeUserId(userId);
    return buyList
      .filter((b) => b.userId === uid)
      .sort(
        (a, b) =>
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      );
  },
  addBuyListItem: (
    item: Omit<BuyListItem, "id" | "addedAt">
  ): BuyListItem => {
    const newItem: BuyListItem = {
      ...item,
      id: `buy-${String(nextBuyNum++).padStart(3, "0")}`,
      addedAt: new Date().toISOString(),
    };
    buyList.push(newItem);
    return newItem;
  },
  removeBuyListItem: (id: string) => {
    buyList = buyList.filter((b) => b.id !== id);
  },
  updateBuyListItem: (
    id: string,
    patch: Partial<Omit<BuyListItem, "id" | "addedAt" | "userId">>
  ): BuyListItem => {
    const idx = buyList.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error(`Buy list item ${id} not found`);
    buyList[idx] = { ...buyList[idx], ...patch };
    return buyList[idx];
  },

  // Community Ratings
  getCommunityScore: (
    name: string,
    winery: string,
    vintage: number | null
  ): { cdScore: number | null; cdRatingCount: number } | null => {
    const key = `${winery.toLowerCase()}|${name.toLowerCase()}|${vintage ?? ""}`;
    const scores: Record<string, { cdScore: number; cdRatingCount: number }> = {
      "caymus vineyards|caymus cabernet sauvignon|2021": { cdScore: 4.3, cdRatingCount: 127 },
      "opus one winery|opus one|2019": { cdScore: 4.8, cdRatingCount: 342 },
      "château d'esclans|whispering angel|2023": { cdScore: 3.6, cdRatingCount: 891 },
      "cloudy bay|cloudy bay sauvignon blanc|2023": { cdScore: 4.0, cdRatingCount: 456 },
      "veuve clicquot|veuve clicquot yellow label|": { cdScore: 4.2, cdRatingCount: 1203 },
      "château d'yquem|château d'yquem|2015": { cdScore: 4.9, cdRatingCount: 89 },
      "château lafite rothschild|château lafite rothschild|2010": { cdScore: 4.9, cdRatingCount: 203 },
      "château mouton rothschild|château mouton rothschild|2015": { cdScore: 4.7, cdRatingCount: 178 },
      "penfolds|penfolds grange|2018": { cdScore: 4.8, cdRatingCount: 156 },
    };
    return scores[key] ?? null;
  },

  getCommunityRatings: (
    name: string,
    winery: string,
    vintage: number | null
  ): import("@/types/wine").CommunityRating[] => {
    const key = `${winery.toLowerCase()}|${name.toLowerCase()}|${vintage ?? ""}`;
    const ratingsByWine: Record<string, import("@/types/wine").CommunityRating[]> = {
      "caymus vineyards|caymus cabernet sauvignon|2021": [
        { id: "r1", username: "WineEnthusiast42", rating: 5, review: "Absolutely stunning Napa Cab. Dark fruit, chocolate, and a silky finish.", tastingNotes: { aroma: "Blackberry, dark chocolate, vanilla", taste: "Full-bodied, ripe plum, cassis", finish: "Long, velvety, hints of cedar" }, createdAt: "2025-12-15" },
        { id: "r2", username: "SommLife", rating: 4, review: "Classic Caymus style. Rich but approachable.", tastingNotes: { aroma: "Cherry, oak, mocha", taste: "Smooth tannins, black cherry", finish: "Medium-long, spicy" }, createdAt: "2025-11-20" },
        { id: "r3", username: "CellarRat", rating: 4, review: "Reliable and delicious. Great for a dinner party.", tastingNotes: null, createdAt: "2025-10-05" },
      ],
      "château lafite rothschild|château lafite rothschild|2010": [
        { id: "r4", username: "BordeauxLover", rating: 5, review: "A legendary vintage. Pure elegance and complexity.", tastingNotes: { aroma: "Graphite, cassis, violets, cedar", taste: "Ethereal, perfectly balanced", finish: "Extraordinarily long, mineral" }, createdAt: "2025-09-10" },
        { id: "r5", username: "GrandCruCollector", rating: 5, review: "One of the finest Lafites. Will age for decades more.", tastingNotes: { aroma: "Lead pencil, dark fruit, tobacco", taste: "Seamless, deep concentration", finish: "Endless, silk and iron" }, createdAt: "2025-08-22" },
        { id: "r6", username: "WineEnthusiast42", rating: 5, review: "Perfection in a glass.", tastingNotes: null, createdAt: "2025-07-15" },
        { id: "r7", username: "VintageHunter", rating: 4, review: "Outstanding but needs more time.", tastingNotes: { aroma: "Still tight, cassis emerging", taste: "Powerful structure", finish: "Long, tannic grip" }, createdAt: "2025-06-01" },
      ],
      "château d'yquem|château d'yquem|2015": [
        { id: "r8", username: "SommLife", rating: 5, review: "Liquid gold. Apricot, honey, and saffron with perfect acidity.", tastingNotes: { aroma: "Honey, apricot, saffron", taste: "Luscious, vibrant acidity", finish: "Eternal, crystalline sweetness" }, createdAt: "2025-11-01" },
        { id: "r9", username: "DessertWineFan", rating: 5, review: "The greatest sweet wine. Worth every penny.", tastingNotes: null, createdAt: "2025-10-15" },
      ],
    };
    return ratingsByWine[key] ?? [];
  },

  submitCommunityRating: (
    _userId: string,
    _name: string,
    _winery: string,
    _vintage: number | null,
    _rating: number,
    _review: string
  ): { cdScore: number; cdRatingCount: number } => {
    return {
      cdScore: _rating * 0.8 + 1.0,
      cdRatingCount: Math.floor(Math.random() * 100) + 10,
    };
  },
};
