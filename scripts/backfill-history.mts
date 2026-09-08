import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  // Get all history records with empty description
  const historyRecords = await prisma.wineHistory.findMany({
    where: { description: "" },
  });

  console.log(`Found ${historyRecords.length} history records to backfill`);

  // For each, try to find matching WineMetadata by name+winery+vintage
  let updated = 0;
  for (const h of historyRecords) {
    // Try WineMetadata first
    const meta = await prisma.wineMetadata.findFirst({
      where: {
        name: { equals: h.name, mode: "insensitive" },
        winery: { equals: h.winery, mode: "insensitive" },
      },
    });

    if (meta) {
      const updates: Record<string, unknown> = {};
      if (meta.description && !h.description) updates.description = meta.description;
      if (meta.foodPairings && !h.foodPairings) updates.foodPairings = meta.foodPairings;
      if (meta.alcohol && !h.alcohol) updates.alcohol = meta.alcohol;
      if (meta.disposition && !h.disposition) updates.disposition = meta.disposition;
      if (meta.drinkWindow && !h.drinkWindow) updates.drinkWindow = meta.drinkWindow;
      if (meta.aiRatings && !h.aiRatings) updates.aiRatings = meta.aiRatings;
      if (meta.estimatedPrice != null && h.retailPrice == null) updates.retailPrice = meta.estimatedPrice;

      if (Object.keys(updates).length > 0) {
        await prisma.wineHistory.update({
          where: { id: h.id },
          data: updates,
        });
        updated++;
        if (updated % 50 === 0) console.log(`  Updated ${updated}...`);
      }
    }
  }

  console.log(`Backfilled ${updated} of ${historyRecords.length} records from WineMetadata`);

  // Check how many still have no data
  const stillEmpty = await prisma.wineHistory.count({ where: { description: "" } });
  console.log(`Still empty: ${stillEmpty}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
