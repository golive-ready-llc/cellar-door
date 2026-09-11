import { describe, it, expect } from "vitest";
import { decodeCsvBytes, parseWineCsv } from "@/lib/csv-import";

// Real CellarTracker export header rows, verified 2026-09-10 against actual
// exports. The data rows below are invented.
const CT_INVENTORY_HEADER =
  "iWine,Barcode,Location,Bin,Size,Currency,ExchangeRate,Valuation,Price,NativePrice,NativePriceCurrency,StoreName,PurchaseDate,BottleNote,Vintage,Wine,Locale,Country,Region,SubRegion,Appellation,Producer,SortProducer,Type,Color,Category,Varietal,MasterVarietal,Designation,Vineyard,WA,WS,IWC,BH,AG,WE,JR,RH,JG,GV,JK,LD,CW,WFW,PR,SJ,WD,RR,JH,MFW,WWR,IWR,CHG,TT,TWF,DR,FP,JM,PG,WAL,JS,CT,CNotes,MY,PNotes,BeginConsume,EndConsume,PurchasedCommunity,QuantityCommunity,PendingCommunity,ConsumedCommunity";
const CT_BOTTLES_HEADER =
  "BottleState,Barcode,iWine,Vintage,Wine,Locale,Country,Region,SubRegion,Appellation,Producer,SortProducer,Type,Varietal,MasterVarietal,Designation,Vineyard,Quantity,BottleSize,Location,Bin,Store,PurchaseDate,DeliveryDate,BottleCost,BottleCostCurrency,BottleNote,PurchaseNote,ConsumptionDate,ConsumptionType,ShortType,ConsumptionNote,ConsumptionRevenue,ConsumptionRevenueCurrency,BeginConsume,EndConsume";
const CT_AVAILABLE_HEADER =
  "iWine,Type,Color,Category,Available,Linear,Bell,Early,Late,Fast,TwinPeak,Simple,Purchases,ActualPurchases,Pending,ActualPending,LocalQuantityActual,LocalQuantity,Consumed,ActualConsumed,Inventory,ActualInventory,Vintage,Wine,SortWine,Locale,Producer,Varietal,MasterVarietal,Designation,Vineyard,Country,Region,SubRegion,Appellation,PersonalBegin,PersonalEnd,WABegin,WAEnd,WSBegin,WSEnd,IWCBegin,IWCEnd,AGBegin,AGEnd,TWFBegin,TWFEnd,BGBegin,BGEnd,WEBegin,WEEnd,JRBegin,JREnd,DRBegin,DREnd,PGBegin,PGEnd,WALBegin,WALEnd,FTLOPBegin,FTLOPEnd,JGBegin,JGEnd,ComBegin,ComEnd,BeginConsume,EndConsume,Source,WA,WAWeb,WASort,WS,WSWeb,WSSort,BG,BGWeb,BGSort,IWC,IWCWeb,IWCSort,AG,AGWeb,AGSort,FTLOP,FTLOPWeb,FTLOPSort,BR,BRWeb,BRSort,GV,GVWeb,GVSort,LF,LFWeb,LFSort,JK,JKWeb,JKSort,JG,JGWeb,JGSort,LD,LDWeb,LDSort,CW,CWWeb,CWSort,WE,WEWeb,WESort,JR,JRWeb,JRSort,WFW,WFWWeb,WFWSort,PR,PRWeb,PRSort,SJ,SJWeb,SJSort,WD,WDWeb,WDSort,GA,GAWeb,GASort,RR,RRWeb,RRSort,JH,JHWeb,JHSort,MFW,MFWWeb,MFWSort,WWR,WWRWeb,WWRSort,IWR,IWRWeb,IWRSort,CHG,CHGWeb,CHGSort,TT,TTWeb,TTSort,TWF,TWFWeb,TWFSort,DR,DRWeb,DRSort,FP,FPWeb,FPSort,JM,JMWeb,JMSort,PG,PGWeb,PGSort,WAL,WALWeb,WALSort,JS,JSWeb,JSSort,PNotes,PScore,PScoreSort";

/** Build a CSV in CellarTracker's column order from partial rows. */
function ctCsv(header: string, rows: Record<string, string>[]): string {
  const cols = header.split(",");
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\r\n") + "\r\n";
}

const TODAY = "2026-09-10";

describe("parseWineCsv: CellarTracker Inventory export", () => {
  const result = parseWineCsv(
    ctCsv(CT_INVENTORY_HEADER, [
      {
        Type: "White", Color: "White", Category: "Dry", Vintage: "2022",
        Wine: "Domaine Exemple Sancerre Les Caillottes", Producer: "Domaine Exemple",
        Country: "France", Region: "Loire Valley", SubRegion: "Upper Loire", Appellation: "Sancerre",
        Varietal: "Sauvignon Blanc", Price: "0", StoreName: "Unknown", PurchaseDate: "1/5/2025",
        BottleNote: "Gift from Sam", MY: "88", BeginConsume: "2024", EndConsume: "2027",
        Location: "Cellar", Size: "750ml",
      },
      {
        Type: "Red", Color: "Red", Category: "Dry", Vintage: "2017",
        Wine: "Bodega Ejemplo Cabernet Sauvignon", Producer: "Bodega Ejemplo", Country: "Spain",
        Region: "Catalunya", SubRegion: "Unknown", Appellation: "Penedès", Price: "185", PurchaseDate: "10/4/2025",
      },
      { Type: "Orange", Color: "Orange", Category: "Dry", Vintage: "2021", Wine: "Orange Example Rkatsiteli", Producer: "Orange Example" },
      {
        Type: "White - Sparkling", Color: "White", Category: "Sparkling", Vintage: "1001",
        Wine: "Maison Exemple Brut Réserve", Producer: "Maison Exemple", BeginConsume: "9999", EndConsume: "9999",
      },
      { Type: "Rosé - Sparkling", Color: "Rosé", Category: "Sparkling", Vintage: "2020", Wine: "Cantina Esempio Rosé Brut", Producer: "Cantina Esempio" },
      { Type: "White - Sweet/Dessert", Color: "White", Category: "Sweet/Dessert", Vintage: "2015", Wine: "Château Exemple Sauternes", Producer: "Château Exemple" },
      { Type: "Red", Color: "Red", Category: "Dry", Vintage: "2019", Wine: "Crama Exemplu Feteasc&#259; Neagr&#259;", Producer: "Crama Exemplu" },
    ]),
    TODAY
  );
  const [sancerre, cab, orange, brut, rose, sauternes, feteasca] = result.wines;

  it("imports every row without error", () => {
    expect(result.error).toBeNull();
    expect(result.wines).toHaveLength(7);
  });

  it("takes color from Type/Color, not the style-only Category column", () => {
    expect(sancerre.type).toBe("white");
    expect(cab.type).toBe("red");
    expect(orange.type).toBe("orange");
    expect(sauternes.type).toBe("dessert");
  });

  it("flags sparkling wines and keeps a sparkling rosé's color", () => {
    expect(brut).toMatchObject({ type: "sparkling", sparkling: true });
    expect(rose).toMatchObject({ type: "rosé", sparkling: true });
    expect(sancerre.sparkling).toBe(false);
  });

  it("drops the producer prefix CellarTracker repeats in the wine name", () => {
    expect(sancerre).toMatchObject({ name: "Sancerre Les Caillottes", winery: "Domaine Exemple" });
  });

  it("ignores CellarTracker's Unknown placeholder", () => {
    expect(cab.region).toBe("Penedès");
    expect(sancerre.region).toBe("Sancerre, Upper Loire");
    expect(sancerre.notes).not.toMatch(/Unknown/);
  });

  it("converts 100-point scores to the 0-5 rating scale", () => {
    expect(sancerre.userRating).toBe(4.4);
    expect(cab.userRating).toBeNull();
  });

  it("keeps bottle notes", () => {
    expect(sancerre.notes).toBe("Gift from Sam");
  });

  it("treats a zero price as unknown", () => {
    expect(sancerre.price).toBeNull();
    expect(cab.price).toBe(185);
  });

  it("normalizes M/D/YYYY purchase dates to ISO", () => {
    expect(sancerre.purchaseDate).toBe("2025-01-05");
    expect(cab.purchaseDate).toBe("2025-10-04");
    expect(orange.purchaseDate).toBe(TODAY);
  });

  it("builds the drink window and ignores the 1001 and 9999 sentinels", () => {
    expect(sancerre).toMatchObject({ drinkWindow: "2024-2027", drinkBy: "2027" });
    expect(brut).toMatchObject({ vintage: null, drinkWindow: "", drinkBy: "" });
  });

  it("decodes the HTML entities CellarTracker uses for non-Latin-1 letters", () => {
    expect(feteasca.name).toBe("Fetească Neagră");
  });
});

describe("parseWineCsv: CellarTracker Bottles export", () => {
  const result = parseWineCsv(
    ctCsv(CT_BOTTLES_HEADER, [
      {
        BottleState: "0", Vintage: "2019", Wine: "Drunk Example Merlot", Producer: "Drunk Example", Type: "Red",
        Quantity: "1", Store: "Shop", PurchaseDate: "1/2/2025", BottleCost: "100", ConsumptionDate: "5/11/2025",
      },
      {
        BottleState: "1", Vintage: "2021", Wine: "Kept Example Chianti Classico", Producer: "Kept Example", Type: "Red",
        Quantity: "1", Store: "Unknown", PurchaseDate: "2/13/2025", BottleCost: "82", PurchaseNote: "-25% BF",
      },
    ]),
    TODAY
  );

  it("skips bottles already consumed and reports how many", () => {
    expect(result.wines).toHaveLength(1);
    expect(result.skippedConsumed).toBe(1);
    expect(result.wines[0].name).toBe("Chianti Classico");
  });

  it("reads BottleCost as the price and keeps the purchase note", () => {
    expect(result.wines[0].price).toBe(82);
    expect(result.wines[0].notes).toBe("-25% BF");
  });

  it("explains an import where every bottle was consumed", () => {
    const allDrunk = parseWineCsv(
      ctCsv(CT_BOTTLES_HEADER, [{ BottleState: "0", Wine: "Gone Example Red", Producer: "Gone Example", Type: "Red" }]),
      TODAY
    );
    expect(allDrunk.wines).toHaveLength(0);
    expect(allDrunk.error).toMatch(/consumed/);
  });
});

describe("parseWineCsv: CellarTracker Available (drinkability) export", () => {
  const result = parseWineCsv(
    ctCsv(CT_AVAILABLE_HEADER, [
      {
        Type: "Red", Color: "Red", Category: "Dry", Available: "-0.18", Inventory: "2", Vintage: "2019",
        Wine: "Cramele Exemplu Solo Quinta", Producer: "Cramele Exemplu",
        BeginConsume: "1/1/2022", EndConsume: "12/31/2027", PScore: "89",
      },
    ]),
    TODAY
  );

  it("imports one entry per bottle from the Inventory count", () => {
    expect(result.wines).toHaveLength(2);
  });

  it("reads full-date drink windows as years", () => {
    expect(result.wines[0]).toMatchObject({ drinkWindow: "2022-2027", drinkBy: "2027" });
  });

  it("converts the personal score", () => {
    expect(result.wines[0].userRating).toBe(4.5);
  });
});

describe("parseWineCsv: generic spreadsheets", () => {
  it("keeps working for plain CSVs, European prices and 5-star ratings", () => {
    const r = parseWineCsv(
      'Name,Winery,Vintage,Type,Rating,Price,Quantity\r\nMonte Example,Ridge Example,2019,Red,4.5,"1.234,50",3\r\n',
      TODAY
    );
    expect(r.error).toBeNull();
    expect(r.wines).toHaveLength(3);
    expect(r.wines[0]).toMatchObject({
      name: "Monte Example", winery: "Ridge Example", vintage: 2019, type: "red",
      userRating: 4.5, price: 1234.5, purchaseDate: TODAY,
    });
  });

  it("reads tab-delimited files", () => {
    const r = parseWineCsv("Name\tType\nExample Blanc\tWhite\n", TODAY);
    expect(r.wines[0]).toMatchObject({ name: "Example Blanc", type: "white" });
  });

  it("reports a missing Name column", () => {
    expect(parseWineCsv("Producer,Vintage\nExample,2020\n", TODAY).error).toMatch(/Name/);
  });
});

describe("decodeCsvBytes", () => {
  it("falls back to Windows-1252 for files that aren't UTF-8", () => {
    const latin1 = Uint8Array.from("Name,Winery\r\nChâteau Test,Château Exemple\r\n", (c) => c.charCodeAt(0));
    const text = decodeCsvBytes(latin1);
    expect(text).toContain("Château Test");
    expect(parseWineCsv(text, TODAY).wines[0].winery).toBe("Château Exemple");
  });

  it("drops a UTF-8 byte-order mark so the Name header still maps", () => {
    const bytes = new TextEncoder().encode(String.fromCharCode(0xfeff) + "Name\r\nBOM Example\r\n");
    expect(parseWineCsv(decodeCsvBytes(bytes), TODAY).wines[0].name).toBe("BOM Example");
  });
});
