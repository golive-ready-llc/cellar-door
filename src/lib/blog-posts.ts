/**
 * Blog content for /blog and /blog/[slug] routes.
 *
 * Hardcoded TypeScript instead of MDX/CMS because the post count is
 * small and stable enough that a database / file system layer would
 * be ceremony. When this grows past ~30 posts we should consider
 * Contentlayer, Velite, or similar.
 *
 * Each post body is a tiny subset of HTML: <h2>, <h3>, <p>, <ul>/<li>,
 * <ol>, <strong>, <em>, <a>, <blockquote>, <hr>. Rendered raw via
 * dangerouslySetInnerHTML — keep these strings author-controlled (no
 * user input) and the surface area is fine.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date the post was published. Used for sitemap + JSON-LD. */
  date: string;
  /** Reading time in minutes — shown on cards + post header. */
  readingMinutes: number;
  /** Topical tags shown on the card; first one is the primary category. */
  tags: string[];
  /** HTML body. */
  body: string;
}

export const POSTS: BlogPost[] = [
  {
    slug: "science-of-wine-aging",
    title: "The Science of Wine Aging: What Actually Happens in the Bottle",
    excerpt:
      "Aging is chemistry, not magic — and most wine doesn't benefit from it. Here's what really changes inside a sealed bottle, and why some wines improve for decades.",
    date: "2026-09-09",
    readingMinutes: 9,
    tags: ["Aging", "Reference"],
    body: `
<p>&ldquo;It'll be better in a few years&rdquo; is one of the most repeated — and most misapplied — phrases in wine. The truth is that the overwhelming majority of wine is made to drink now and gets <em>worse</em> with age, not better. Understanding what actually happens inside the bottle tells you which is which.</p>

<h2>The reactions doing the work</h2>
<p>A sealed bottle is a slow chemistry experiment. A few reactions matter most:</p>
<h3>Tannin polymerization</h3>
<p>In young reds, tannin molecules are small and reactive — that's the grippy, mouth-drying sensation. Over years they link into longer chains that eventually grow too heavy to stay dissolved and drop out as <strong>sediment</strong>. The wine tastes softer and rounder, and the color shifts as pigment binds up with them.</p>
<h3>Slow oxidation and ester formation</h3>
<p>A cork lets in a whisper of oxygen over years. In tiny doses this drives the development of <strong>tertiary aromas</strong> — the leather, tobacco, dried fruit, forest floor, and nutty notes that define an aged wine. Acids and alcohols also react to form esters, adding aromatic complexity. Too much oxygen, though, and the same process turns the wine flat and sherry-like. Aging is a controlled burn.</p>
<h3>Color change</h3>
<p>Reds move from purple to ruby to brick to garnet at the rim; whites deepen from pale straw to gold to amber. It's the visible signature of the reactions above, and a quick tell for a wine's age and condition.</p>

<h2>Primary, secondary, tertiary</h2>
<p>A useful way to hear what age does to aroma: <strong>primary</strong> aromas come from the grape (fresh fruit, floral, herbal); <strong>secondary</strong> from winemaking (the vanilla and toast of oak, the bready note of lees); <strong>tertiary</strong> from age (dried fruit, leather, mushroom, honey). Young wine is loud with primary fruit. Aged wine trades that fruit for tertiary complexity. The question every ager faces is whether that trade improves <em>this</em> wine — and for most wines, it doesn't, because there's nothing underneath the fruit worth waiting for.</p>

<h2>What lets a wine age</h2>
<p>Longevity comes from preservatives and structure: <strong>tannin</strong> (reds), <strong>acidity</strong> (whites and reds), <strong>sugar</strong> (sweet wines), <strong>alcohol</strong>, and above all <strong>concentration</strong>. A wine needs enough material to still have something to say once the fruit recedes. This is why a bold, tannic Barolo or a searingly acidic Riesling can go decades while a soft, fruity supermarket red is done in eighteen months — the Barolo and Riesling have preservatives and depth; the everyday red has neither.</p>

<h2>The closure matters</h2>
<p>The seal governs the oxygen supply. Natural cork allows a slow, minute exchange well-suited to long aging — at the cost of occasional &ldquo;corked&rdquo; bottles and random variation. Screwcaps seal far more tightly, keeping wines fresher and more consistent, which is ideal for aromatic whites meant to be drunk young but a subject of ongoing debate for wines intended to age for decades.</p>

<h2>Storage is the throttle</h2>
<p>Every one of these reactions is temperature-driven — roughly, warmer means faster. A wine kept at a steady cellar temperature ages gracefully over years; the same wine in a warm room races through its life and arrives cooked rather than mature. This is the chemical reason the storage rules exist: you're not just protecting the wine, you're setting the speed of the clock. (For the practical side, see our guide to storing wine at home.)</p>

<h2>The bottom line</h2>
<p>Aging swaps fruit for complexity through polymerization and slow oxidation, and only wines with the tannin, acid, and concentration to survive that trade actually improve. Everything else is best enjoyed young. Knowing the difference — and giving the age-worthy bottles steady, cool storage — is the whole game.</p>
    `,
  },

  {
    slug: "buying-wine-at-auction",
    title: "Buying Wine at Auction: A Beginner's Guide",
    excerpt:
      "Auctions are where back-vintages and rarities live — but also where provenance, premiums, and fill levels can trip you up. Here's how to buy smart.",
    date: "2026-09-07",
    readingMinutes: 8,
    tags: ["Buying", "Collecting"],
    body: `
<p>Once you want mature bottles or wines that are simply sold out everywhere, the auction market becomes hard to avoid — it's the main place aged and rare wine changes hands. It's also less intimidating than it looks, provided you understand a few things merchants never make you think about.</p>

<h2>Where auctions fit</h2>
<p>Retailers sell current releases; auctions sell what's already been cellared — back-vintages, large formats, and rarities. That's the appeal (you can buy a wine with twenty years of age already on it) and the risk (you're trusting how a stranger stored it for those twenty years).</p>
<p>The major houses — Sotheby's, Christie's, Zachys, Acker — run live and online sales; platforms like WineBid run continuous online auctions better suited to everyday buying. Merchant &ldquo;fine and rare&rdquo; lists are a related, often simpler, alternative.</p>

<h2>Provenance is everything</h2>
<p>For aged wine, <strong>where it's been</strong> matters as much as what it is. A catalog that says &ldquo;from a single owner's temperature-controlled cellar&rdquo; or &ldquo;ex-château&rdquo; is worth a premium; a bottle with no history is a gamble. Good provenance is the difference between a mature treasure and an expensive bottle of cooked wine.</p>

<h2>Reading condition: fill level and more</h2>
<p>Auction listings describe condition in a shorthand worth learning:</p>
<ul>
  <li><strong>Fill level (ullage):</strong> how high the wine sits in the neck. For older bottles some drop is normal, but a low fill (&ldquo;top-shoulder&rdquo; or below on a Bordeaux) signals seepage or evaporation and higher risk.</li>
  <li><strong>Label and capsule:</strong> stains and wear are cosmetic, but signs of <em>seepage</em> (sticky residue, a pushed cork) suggest heat exposure.</li>
  <li><strong>Provenance notes:</strong> storage history, and whether the bottle was inspected.</li>
</ul>
<p>None of these guarantees what's inside, but together they let you price the risk.</p>

<h2>The buyer's premium — bid accordingly</h2>
<p>The number you bid is not the number you pay. Auction houses add a <strong>buyer's premium</strong> — commonly around 20&ndash;25% — on top of the hammer price, then sales tax and shipping. Always work backward from your true all-in ceiling. A &ldquo;great deal&rdquo; at hammer can be ordinary once the premium lands, so check the wine's current retail on Wine-Searcher first and treat that as your reference.</p>

<h2>How to actually bid</h2>
<p>Register in advance (the house may vet new bidders). Then you can bid live in the room, by phone, online in real time, or leave an <strong>absentee/maximum bid</strong> — you set your ceiling and the house bids up to it on your behalf. Absentee bidding is the disciplined beginner's friend: it removes the adrenaline that makes people overpay.</p>

<h2>Pitfalls</h2>
<ul>
  <li><strong>Counterfeits</strong> exist at the trophy end (old, rare, ultra-expensive). Stick to reputable houses and well-documented provenance as the price climbs.</li>
  <li><strong>Heat damage</strong> is the silent killer — invisible until you open the bottle. Provenance and fill level are your only defenses.</li>
  <li><strong>Auction fever.</strong> Set your all-in maximum before the sale and hold it.</li>
</ul>

<h2>The bottom line</h2>
<p>Auctions open the door to aged and rare wine you can't buy anywhere else — if you buy on provenance, read fill levels, and always bid to your true all-in price after the premium. Start small on online platforms, keep records of what you win and pay, and treat the first few lots as tuition.</p>
    `,
  },

  {
    slug: "bordeaux-vs-burgundy-introduction",
    title: "Bordeaux vs Burgundy: A Collector's Introduction",
    excerpt:
      "The two reference points of the wine world work in opposite ways. Understanding how they differ is the fastest route to understanding fine wine itself.",
    date: "2026-09-04",
    readingMinutes: 9,
    tags: ["Reference", "Regions"],
    body: `
<p>Almost everything in fine wine is measured, consciously or not, against two French regions that could hardly be more different. Learn how Bordeaux and Burgundy each work and you've built the mental framework for the rest of the wine world.</p>

<h2>Bordeaux: the blend, at scale</h2>
<p>Bordeaux reds are <strong>blends</strong>, led by Cabernet Sauvignon or Merlot with supporting grapes. The estates (&ldquo;châteaux&rdquo;) are large, some producing hundreds of thousands of bottles a year, and the wines are built to age — firm, structured, and consistent vintage to vintage.</p>
<p>Two geographic halves define it. The <strong>Left Bank</strong> (Médoc, Graves) is Cabernet-led: powerful, tannic, long-lived. The <strong>Right Bank</strong> (Saint-Émilion, Pomerol) is Merlot-led: rounder and approachable earlier. The famous <strong>1855 Classification</strong> ranked the top Left Bank châteaux into five &ldquo;growths,&rdquo; a hierarchy that still shapes prices today.</p>
<p>For a collector, Bordeaux's virtues are availability and consistency: it's made in quantity, sold through a broad market, offers real quality at every price tier, and ages predictably. It's the more forgiving place to start.</p>

<h2>Burgundy: the single grape, obsessed with place</h2>
<p>Burgundy is the opposite in nearly every respect. The reds are <strong>100% Pinot Noir</strong> and the whites <strong>100% Chardonnay</strong> — no blending to hide behind. The entire region is organized around <em>terroir</em>: the belief that a specific plot of land expresses itself in the glass.</p>
<p>That belief becomes a strict hierarchy. From the ground up: <strong>regional</strong> (basic Bourgogne), <strong>village</strong> (named for a commune), <strong>premier cru</strong> (a superior named vineyard), and <strong>grand cru</strong> (the tiny handful of best plots). A single hillside can hold all four levels within a few hundred meters — each named vineyard is a &ldquo;climat.&rdquo;</p>
<p>Production is minuscule, ownership is fragmented (a famous vineyard may be split among dozens of growers), and demand vastly outstrips supply — so prices for the top wines are punishing. You'll also meet two kinds of producer: <strong>domaines</strong> (grow and make their own) and <strong>négociants</strong> (buy grapes or wine to blend and bottle under their name).</p>

<h2>How they age</h2>
<p>Both age superbly but arrive differently. Bordeaux's tannic structure means top wines can be austere young and need a decade-plus to unwind. Burgundy's charm is more about perfume and texture than grip; village wines drink well relatively young, while premier and grand crus reward patience. Bordeaux tends to be the more <em>consistent</em> ager; Burgundy the more variable and, when it hits, transcendent.</p>

<h2>Where a collector should start</h2>
<p>Start with Bordeaux. It's more available, more consistent, better value at the entry and mid tiers, and it ages on a schedule you can plan around — ideal for learning how a wine evolves over years without betting the cellar. Add Burgundy as your palate (and budget) grows, beginning at the village level to learn the map before chasing crus. And remember that both templates repeat worldwide: &ldquo;Bordeaux-style&rdquo; Cabernet blends and &ldquo;Burgundian&rdquo; single-vineyard Pinot and Chardonnay are made from Napa to New Zealand, often at a fraction of the French price.</p>

<h2>The bottom line</h2>
<p>Bordeaux is blend, scale, structure, and consistency; Burgundy is single-grape, scarcity, terroir, and perfume. They are the two poles fine wine orients around — grasp how each works and you can read almost any wine region as a variation on one of the two.</p>
    `,
  },

  {
    slug: "serving-wine-temperature-glassware",
    title: "Serving Wine: Temperature, Glassware, and Order",
    excerpt:
      "The most underrated way to improve a wine is free: serve it at the right temperature, in a decent glass, in the right order. Here's how.",
    date: "2026-09-01",
    readingMinutes: 7,
    tags: ["Serving", "Practical"],
    body: `
<p>You can spend a fortune on wine and then sabotage it in the last five minutes by serving it too warm, in the wrong glass, in the wrong order. Serving is the cheapest quality upgrade there is — no bottle required, just a few principles.</p>

<h2>Temperature: the biggest lever</h2>
<p>Almost everyone serves whites too cold and reds too warm. Cold mutes aroma and exaggerates acidity; warmth makes wine taste flabby and alcoholic. Rough targets:</p>
<ul>
  <li><strong>Sparkling:</strong> 40&ndash;45°F (well chilled — keeps the bubbles fine and the wine crisp).</li>
  <li><strong>Light, crisp whites &amp; rosé:</strong> 45&ndash;50°F.</li>
  <li><strong>Full-bodied whites (oaked Chardonnay) &amp; light reds (Beaujolais, Pinot):</strong> 50&ndash;55°F.</li>
  <li><strong>Full-bodied reds:</strong> 60&ndash;65°F — cooler than most rooms.</li>
</ul>
<p>&ldquo;Room temperature&rdquo; is a myth from the era of cold stone cellars; a 72°F kitchen is too warm for any red. Two easy fixes: pull reds out and put them in the fridge for 20 minutes before serving, and take whites <em>out</em> of the fridge for 15&ndash;20 minutes so they're not ice-cold. When in doubt, err cool — a wine warms in the glass, and you can always let it come up.</p>

<h2>Glassware: shape over price</h2>
<p>You don't need crystal or a different glass for every grape. What matters is <strong>shape</strong>: a bowl big enough to swirl and gather aroma, tapering slightly at the rim to funnel it to your nose. Practical guidance:</p>
<ul>
  <li><strong>Reds:</strong> a larger bowl to give the wine air and room to open.</li>
  <li><strong>Whites:</strong> a smaller bowl to keep them cool and focused.</li>
  <li><strong>Sparkling:</strong> here's a surprise — for <em>good</em> sparkling wine, a regular white-wine glass beats a narrow flute, which traps aroma. Flutes are for showing off bubbles, not tasting.</li>
</ul>
<p>If you buy one glass, buy a decent mid-size &ldquo;universal&rdquo; wine glass. It handles nearly everything and costs little.</p>

<h2>To decant or not</h2>
<p>Two reasons to decant: to separate an old wine from its sediment, and to aerate a young, tight wine so it opens up. Most everyday bottles need neither, but a young, structured red almost always improves with 30&ndash;60 minutes of air. (We cover the full logic in our decanting guide.)</p>

<h2>Serving order at a dinner</h2>
<p>When you're pouring several wines, sequence them so each shows well and none flattens the next. The reliable order:</p>
<ul>
  <li><strong>Sparkling before still.</strong></li>
  <li><strong>Light before heavy</strong> (a big red first makes everything after it taste thin).</li>
  <li><strong>Dry before sweet</strong> (dessert wine last, or a dry wine afterward tastes sour).</li>
  <li><strong>Young before old</strong> (build toward the most complex and delicate bottle).</li>
</ul>
<p>The through-line is simple: move from lighter and simpler toward richer and finer, so the palate escalates rather than getting blown out early.</p>

<h2>The bottom line</h2>
<p>Serve whites warmer and reds cooler than instinct says, use a glass with a real bowl (and skip the flute for good fizz), decant young structured reds, and pour light-to-heavy and dry-to-sweet. None of it costs anything, and all of it makes the wine in the bottle taste like what you paid for.</p>
    `,
  },

  {
    slug: "understanding-wine-drinking-windows",
    title: "Understanding Wine Drinking Windows: When to Actually Open It",
    excerpt:
      "A drinking window isn't a deadline — it's a curve. Here's how to read one, how different wines age, and how to stop losing bottles to the back of the rack.",
    date: "2026-09-08",
    readingMinutes: 9,
    tags: ["Aging", "Collecting"],
    body: `
<p>The single most expensive mistake collectors make isn't buying the wrong wine — it's forgetting the right one until it's past its best. A &ldquo;drinking window&rdquo; is the tool for avoiding that, but most people treat it as a hard deadline when it's really a curve. Here's how to think about it clearly.</p>

<h2>What a drinking window actually describes</h2>
<p>A window like &ldquo;2027&ndash;2035&rdquo; is a critic's estimate of the years a wine will show at its best. It is not a spoilage date. A wine doesn't turn to vinegar the day after the window closes, and it isn't undrinkable the day before it opens. What changes across the window is the <strong>balance</strong> between three things: fruit, tannin, and acidity.</p>
<ul>
  <li><strong>Before the window:</strong> fruit is loud, tannin is grippy and sometimes harsh, everything feels &ldquo;tight.&rdquo; The parts haven't integrated.</li>
  <li><strong>During the window:</strong> primary fruit softens, tannins resolve, and secondary flavors (leather, tobacco, forest floor, dried fruit) emerge. This is peak drinking.</li>
  <li><strong>After the window:</strong> fruit fades faster than structure, so the wine can taste hollow, acidic, or dominated by tertiary notes. Still drinkable, often interesting, but past its prime.</li>
</ul>
<p>Picture it as a hill, not a cliff. You're trying to catch the wine near the top, and the top is wide.</p>

<h2>How different wines age</h2>
<p>Aging potential comes mostly from tannin, acidity, sugar, and alcohol acting as preservatives. As a rough field guide:</p>
<h3>Drink young (1&ndash;3 years)</h3>
<p>Most whites, rosés, Beaujolais, inexpensive reds under about $20, and nearly everything labeled for easy drinking. These are made for fruit, and fruit is the first thing to go. Waiting doesn't improve them — it just costs you the fruit.</p>
<h3>Medium term (3&ndash;8 years)</h3>
<p>Structured whites (white Burgundy, Riesling, Chenin), mid-tier reds (Chianti Classico, Rioja Crianza/Reserva, Côtes du Rhône Villages, mid-range Cabernet), and vintage-dependent New World reds.</p>
<h3>Long haul (10&ndash;30+ years)</h3>
<p>Classified Bordeaux, Barolo and Barbaresco, top Northern Rhône Syrah, grand cru Burgundy, vintage Port, and the best sweet wines (Sauternes, Tokaji, auslese Riesling). High tannin or high acid plus concentration is the signature.</p>
<p>Two myths worth killing: expensive does not automatically mean age-worthy, and red does not automatically age longer than white. A great Riesling will outlive most Merlot.</p>

<h2>How to estimate a window when you don't have one</h2>
<p>You won't always find a critic score. A workable heuristic: taste the wine now. If the tannins scrape and the fruit is explosive, it wants time. If it's soft, mellow, and showing non-fruit flavors, drink it. If it's balanced and delicious, it's in the window — and there is nothing wrong with drinking a wine throughout its window rather than gambling on a single perfect night.</p>
<p>For age-worthy bottles you own multiples of, open one every year or two and take notes. Your own palate on your own storage beats any published chart, and you'll learn how your conditions treat wine over time.</p>

<h2>The organizational problem</h2>
<p>The reason bottles get lost isn't ignorance — it's logistics. A 200-bottle cellar with windows scattered from 2025 to 2040 is impossible to track in your head. This is exactly the gap software fills: a <em>ready-to-drink queue</em> that surfaces the bottles entering their window this season, so the decision becomes &ldquo;which of these three should I open&rdquo; instead of &ldquo;is anything ready?&rdquo; Cellar Door builds that queue automatically from each wine's drink window and can notify you as bottles come into range — the point being that the system remembers so you don't have to.</p>

<h2>The bottom line</h2>
<p>Treat the window as a hill with a wide top. Drink your everyday wines young and without guilt. Track the age-worthy ones so their peak years don't slip past the back of the rack. And when in doubt, open the bottle — a wine enjoyed slightly early beats a wine mourned slightly late.</p>
    `,
  },

  {
    slug: "how-to-value-a-wine-collection",
    title: "How to Value a Wine Collection (for Insurance and for Yourself)",
    excerpt:
      "Replacement value, market value, and why they differ — plus how to document a collection so an insurer, an heir, or future-you can actually use it.",
    date: "2026-09-05",
    readingMinutes: 8,
    tags: ["Collecting", "Insurance"],
    body: `
<p>At some point a wine collection stops being &ldquo;some bottles&rdquo; and becomes an asset worth a few thousand — or a few hundred thousand — dollars. When it does, two questions follow: what is it worth, and can you prove it? Here's how to answer both.</p>

<h2>The two numbers that matter</h2>
<h3>Replacement value</h3>
<p>What it would cost to buy your collection again today, at retail. This is the number your homeowners or specialty insurer cares about, because it's what they'd pay out. It is usually <em>higher</em> than what you paid, especially for wines that have appreciated or gone out of production.</p>
<h3>Market value</h3>
<p>What you could actually sell the collection for — typically <em>lower</em> than replacement value, because auction houses and merchants take a cut (often 10&ndash;25%) and buyers expect a discount to retail. This is the number that matters if you ever plan to sell or are valuing an estate.</p>
<p>For most collectors, replacement value is the working number. Just know the two aren't the same, and don't insure at market value or you'll be underinsured.</p>

<h2>Where the numbers come from</h2>
<p>Wine pricing is public in a way most collectibles aren't. Reliable references:</p>
<ul>
  <li><strong>Wine-Searcher</strong> — aggregates merchant listings worldwide; the best single source for current retail on a specific wine and vintage.</li>
  <li><strong>Auction results</strong> (Sotheby's, Christie's, Zachys, Acker) — the truest market value for fine and rare bottles.</li>
  <li><strong>Your own purchase records</strong> — the floor, and what you'll need for capital-gains math if you sell.</li>
</ul>
<p>Value is always <strong>wine plus vintage plus condition</strong>. A 2015 and a 2017 of the same label can differ several-fold. Condition — fill level, label, provenance, storage history — can swing a fine-wine price by 30% or more at auction.</p>

<h2>Documenting it so it's actually usable</h2>
<p>An insurer settling a claim (or an heir settling an estate) needs more than a shoebox of receipts. A usable inventory records, per bottle or lot:</p>
<ul>
  <li>Producer, wine name, vintage, bottle size, and quantity</li>
  <li>Purchase price and date, and where you bought it (provenance)</li>
  <li>Current estimated value and the date of that estimate</li>
  <li>Photos of the labels — the single most useful thing for a claim</li>
</ul>
<p>Keep a copy <em>off-site or in the cloud</em>. An inventory that burns in the same fire as the cellar is worth nothing to an adjuster.</p>

<h2>Insurance, briefly</h2>
<p>A standard homeowners policy usually covers wine only as ordinary contents, with low sub-limits and no coverage for the failure most likely to hurt you — a cooling unit dying and cooking the cellar over a hot weekend. If your collection is worth more than a few thousand dollars, ask about a <strong>scheduled personal property rider</strong> or a specialty wine policy (from insurers that cover breakage, spoilage from mechanical failure, and transit). Rates are typically a small fraction of a percent of insured value per year. You will need a documented inventory to schedule it — which is the same inventory you should keep anyway.</p>

<h2>Make it a report, not a spreadsheet</h2>
<p>The practical trick is to keep the valuation current without it becoming a second job. This is the job Cellar Door's insurance report is built for: it takes your catalogued collection with per-bottle values and generates a dated PDF — full valuation, per-bottle replacement values, and label photos — that drops straight into a policy or a rider conversation, and you can export the whole thing as CSV or JSON whenever you want the raw data. The point is that the document exists and is current the day you need it, not the weekend you finally sit down to build one.</p>

<h2>The bottom line</h2>
<p>Insure at replacement value, know your market value separately, and keep a photographed, off-site inventory that's current to within a year. Do that and the collection is protected, transferable, and — if you ever choose — sellable, without a frantic weekend of reconstruction.</p>
    `,
  },

  {
    slug: "cellar-organization-systems",
    title: "Cellar Organization Systems: Bin, Region, or Drink-By?",
    excerpt:
      "The best organization scheme is the one that answers your most common question fastest. Here are the three main systems, their trade-offs, and a hybrid that works.",
    date: "2026-09-02",
    readingMinutes: 7,
    tags: ["Storage", "Collecting"],
    body: `
<p>Every collector past about fifty bottles hits the same wall: you know you own the wine, you just can't <em>find</em> it. The fix is a real organization system. There are three main ones, and choosing well is mostly about which question you ask the rack most often.</p>

<h2>System 1: Bin numbers (organize by location)</h2>
<p>Every slot or bin has a fixed number. A wine lives at &ldquo;C4&rdquo; and you record that. To retrieve it, you look up the wine, get its location, and walk to it.</p>
<p><strong>Strength:</strong> retrieval is instant and unambiguous, and it scales to any size — this is how professional cellars and restaurants run. <strong>Weakness:</strong> it tells you nothing at a glance; the physical layout is meaningless without the index, so it only works if you keep the index current.</p>

<h2>System 2: By region or type (organize by what it is)</h2>
<p>All the Bordeaux together, all the Burgundy, a white section, a sparkling section. The rack itself becomes browsable.</p>
<p><strong>Strength:</strong> intuitive, and great when you shop your own cellar by mood (&ldquo;something Italian tonight&rdquo;). <strong>Weakness:</strong> it breaks as the collection grows and shifts — every new case means reshuffling, and a lopsided collection leaves you with one overflowing section and empty racks elsewhere.</p>

<h2>System 3: By drink-by date (organize by time)</h2>
<p>Front of the cellar: drink now. Back: lay down for years. You physically sort by urgency.</p>
<p><strong>Strength:</strong> it directly fights the biggest collector failure — losing wines past their peak — because the ready bottles are literally in front of you. <strong>Weakness:</strong> drink windows change as wines age and as your plans change, so you're constantly re-sorting, and it ignores type entirely.</p>

<h2>The honest truth: pick the question, then the system</h2>
<p>Ask yourself which sentence you say most:</p>
<ul>
  <li>&ldquo;Where is that specific bottle?&rdquo; &rarr; <strong>bin numbers.</strong></li>
  <li>&ldquo;What do I have from X?&rdquo; &rarr; <strong>region/type.</strong></li>
  <li>&ldquo;What should I drink before it fades?&rdquo; &rarr; <strong>drink-by.</strong></li>
</ul>
<p>Most people, honestly, ask all three at different times — which is exactly why a purely physical system always disappoints. You cannot physically sort one rack three ways at once.</p>

<h2>The hybrid that actually works</h2>
<p>Organize the <em>physical</em> cellar the simplest possible way — usually bin numbers, occasionally loose regional zones — and let <em>software</em> handle the other two questions. When the catalog knows each bottle's location, region, and drink window, you can ask any of the three questions and get an answer without touching a bottle: search for the exact wine and get its slot; filter by region to browse; sort by drink window to see what's urgent. The rack only has to solve retrieval; everything else is a query.</p>
<p>This is the model Cellar Door is built around — a visual map that mirrors your actual racks and slots so &ldquo;C4&rdquo; is a place you can see, layered with the metadata that answers the region and timing questions on demand. You get the instant retrieval of bin numbers without giving up browsing or drink-by awareness.</p>

<h2>Whatever you choose, be consistent</h2>
<p>The system that fails is the one you half-follow. A bin system where a third of the bottles are &ldquo;somewhere in that pile&rdquo; is worse than no system, because you trust the index and get burned. Pick one, apply it to every bottle in and out, and it will save you far more time than it costs.</p>

<h2>The bottom line</h2>
<p>Keep the physical layout dumb and simple, and make the catalog smart. Bin numbers for retrieval, software for region and drink-by. That combination answers every question you'll actually ask the cellar — and it's the only approach that survives the collection doubling in size.</p>
    `,
  },

  {
    slug: "building-a-cellar-on-a-budget",
    title: "Building a Cellar on a Budget: Value Regions Worth Collecting",
    excerpt:
      "You don't need Bordeaux money to build a cellar with real depth. Here are the regions and styles that age beautifully without the collector tax.",
    date: "2026-08-28",
    readingMinutes: 9,
    tags: ["Buying", "Collecting"],
    body: `
<p>The famous names — first-growth Bordeaux, grand cru Burgundy, cult Napa Cabernet — are priced for their reputation as much as their contents. The good news for a collector on a budget: age-worthiness is a property of grape, acid, tannin, and winemaking, not of fame. Plenty of regions deliver serious cellar wines at a fraction of the marquee price. Here's where to look.</p>

<h2>What makes a wine ageworthy on a budget</h2>
<p>Before the regions, the principle: you're buying <strong>structure</strong> — firm tannin or bright acidity, real concentration, and a track record of that region's wines improving over time. You're skipping the &ldquo;brand premium&rdquo; you pay for a label everyone recognizes. Many classic European regions still price on tradition rather than hype, which is where the value hides.</p>

<h2>Reds that age, without the tax</h2>
<h3>Northern Rhône (and its neighbors)</h3>
<p>Crozes-Hermitage and Saint-Joseph give you Syrah with the structure of their grander siblings (Hermitage, Côte-Rôtie) at a third of the price. Good vintages easily go 10&ndash;15 years.</p>
<h3>Rioja and Ribera del Duero</h3>
<p>Spain remains one of the great values in ageworthy red. A Rioja Reserva or Gran Reserva is often <em>released</em> with years of bottle age already on it — the winery did the cellaring for you — and still climbs for another decade.</p>
<h3>Southern Italy and the classics</h3>
<p>Chianti Classico Riserva, Aglianico from Campania and Basilicata (sometimes called &ldquo;the Barolo of the south&rdquo;), and Nerello Mascalese from Etna all offer high-acid, structured reds built for aging at everyday prices. Even Barolo and Barbaresco, while not cheap, are dramatically underpriced next to comparable Burgundy.</p>
<h3>Portugal</h3>
<p>The Douro's dry reds — made from the same grapes as Port — are one of the last genuine bargains in structured, age-worthy wine.</p>

<h2>Whites that reward patience</h2>
<h3>German and Alsatian Riesling</h3>
<p>The most underappreciated ageworthy white in the world. High acidity is a preservative, and a good Riesling can improve for 10&ndash;20+ years while costing less than a mediocre Chardonnay. Kabinett and Spätlese offer the best value-to-longevity ratio anywhere.</p>
<h3>Chenin Blanc from the Loire</h3>
<p>Vouvray and Savennières age for decades on acid and wax and honey. Criminally cheap for what they become.</p>
<h3>Hunter Valley Semillon and Chablis</h3>
<p>Both transform with age into something far greater than their youthful selves, and neither carries a collector premium.</p>

<h2>A strategy, not just a shopping list</h2>
<p>Building depth on a budget rewards a few habits:</p>
<ul>
  <li><strong>Buy by the case, not the bottle,</strong> in strong vintages of wines you've tested. Depth means being able to open one every couple of years and watch it evolve.</li>
  <li><strong>Buy on release</strong> for wines that appreciate, and buy back-vintages of regions the market ignores — aged Rioja and German Riesling are often cheaper than the current release.</li>
  <li><strong>Track your cost basis.</strong> Part of the fun of value collecting is watching a $25 bottle become a $60 experience with ten years of patience — but only if you remember what you paid and when to drink it.</li>
</ul>
<p>That last point is where a catalog earns its keep: a budget cellar with real depth is dozens of multi-bottle lots at different maturities, which is impossible to hold in your head. Recording purchase price, vintage, and drink window per lot turns &ldquo;I think I have some Rioja somewhere&rdquo; into a plan.</p>

<h2>The bottom line</h2>
<p>Age-worthiness is for sale far below the famous labels. Lean into high-acid whites (Riesling, Chenin) and structured European reds (Northern Rhône, Rioja, southern Italy, the Douro), buy depth in good vintages, and let time do the expensive part. A thoughtful $30-a-bottle cellar can out-drink a careless $100 one.</p>
    `,
  },

  {
    slug: "wine-and-food-pairing-framework",
    title: "Wine and Food Pairing: A Framework, Not a Rulebook",
    excerpt:
      "Forget memorizing which wine goes with which dish. Learn the five levers that decide whether a pairing works, and you can reason your way to any table.",
    date: "2026-08-24",
    readingMinutes: 8,
    tags: ["Pairing", "Practical"],
    body: `
<p>&ldquo;Red with meat, white with fish&rdquo; is the pairing advice everyone knows and almost no one finds useful, because real meals don't fit it. The better approach isn't a longer list of rules — it's understanding the handful of levers that make any pairing succeed or fail. Learn those and you can reason your way to a good bottle for anything.</p>

<h2>The five levers</h2>
<h3>1. Weight (match intensity)</h3>
<p>The most important rule and the one that covers &ldquo;red with meat&rdquo; as a special case. A delicate dish is flattened by a powerful wine, and a rich dish makes a light wine disappear. Match the <em>body</em> of the wine to the <em>richness</em> of the food: light sole with a crisp white, braised short ribs with a full-bodied red. This is why a heavy fish (grilled tuna, salmon) is happy with a light red — it's about weight, not color.</p>
<h3>2. Acidity (the great equalizer)</h3>
<p>High-acid wine cuts through fat and richness and refreshes the palate — the reason Champagne loves fried food and Sangiovese loves tomato sauce. As a rule the wine should be at least as acidic as the food, or it will taste flat and flabby beside it. When in doubt about a rich or oily dish, reach for acid.</p>
<h3>3. Tannin (handle with care)</h3>
<p>Tannin (the grippy, drying quality in bold reds) is softened by protein and fat — steak makes a tannic Cabernet taste smoother. But tannin collides violently with two things: <strong>salt</strong> and <strong>spicy heat</strong>, both of which amplify bitterness. A tannic red with a fiery curry is a genuinely bad time.</p>
<h3>4. Sweetness (out-sweet the plate)</h3>
<p>The wine should be at least as sweet as the food, or it turns sour and thin. A dry Riesling next to dessert tastes like lemon juice. This is also the secret to spicy food: a touch of sweetness (off-dry Riesling, Gewürztraminer) tames chili heat far better than a dry wine.</p>
<h3>5. Flavor (complement or contrast)</h3>
<p>Only after the structural levers above do specific flavors matter. You can echo (an earthy Pinot Noir with mushrooms) or contrast (a zesty Sauvignon Blanc against a creamy goat cheese). Both work; flavor is the finishing move, not the foundation.</p>

<h2>Working the framework</h2>
<p>Faced with a dish, run down the levers: How rich is it? How acidic, fatty, salty, spicy, sweet? Then pick a wine that matches the weight, meets or beats the acidity and sweetness, and keeps tannin away from salt and heat. That's it. A few reliable outcomes fall out immediately:</p>
<ul>
  <li><strong>Spicy Asian food:</strong> off-dry Riesling — sweetness tames heat, acid handles richness.</li>
  <li><strong>Tomato-based pasta:</strong> high-acid Italian red (Chianti, Barbera) to meet the acid.</li>
  <li><strong>Roast chicken:</strong> the little black dress — works with almost anything medium-bodied, red or white.</li>
  <li><strong>Salty cheese or cured meat:</strong> sweetness or bubbles, not tannin.</li>
</ul>

<h2>The regional shortcut</h2>
<p>When you're stuck, lean on &ldquo;what grows together goes together.&rdquo; A region's traditional food and wine coevolved for centuries, so Sancerre with goat cheese, Chianti with ragù, or Muscadet with oysters are near-automatic wins. It's a shortcut, not a law — but a reliable one.</p>

<h2>Pairing from your own cellar</h2>
<p>The framework gets more useful, not less, when you're choosing from bottles you already own rather than a shop's entire wall. The constraint is the point: given tonight's dish and the twelve reds in your rack, which one fits? That's a small, answerable question — and it's exactly what Cellar Door's Cork &amp; Fork feature automates, suggesting bottles from <em>your</em> collection that match what you're cooking, so the framework runs itself against the wines actually within reach.</p>

<h2>The bottom line</h2>
<p>Stop memorizing pairings and start reading dishes. Match weight, respect acidity and sweetness, keep tannin away from salt and spice, and treat specific flavors as the last step. Five levers beat a hundred rules — and they work at any table, with any bottle.</p>
    `,
  },

  {
    slug: "how-to-store-wine-at-home",
    title: "How to Store Wine at Home: The Practical Guide",
    excerpt:
      "Temperature, humidity, light, vibration, position. Five variables that matter and the cheapest way to control each.",
    date: "2026-04-12",
    readingMinutes: 8,
    tags: ["Storage", "Beginner"],
    body: `
<p>Most home wine storage advice falls into one of two camps: <em>buy a $3,000 EuroCave</em> or <em>any closet will do</em>. The truth lives in the middle, and which middle you land on depends on what you're storing and how long.</p>

<h2>The five variables that actually matter</h2>

<h3>1. Temperature — and especially temperature stability</h3>
<p>Wine wants 55°F (13°C). It will tolerate a steady 60°F or even 65°F much better than a fluctuating 55°F. The killer is <strong>swings</strong>: every time the wine warms and cools, the cork breathes — pulling air in, pushing wine out around the seal. Over years, this oxidizes the wine.</p>
<p>Practical floor: keep storage below 75°F at all times, and try to limit the seasonal swing to 15°F or less. A garage in Phoenix or a kitchen counter in Boston are equally bad — different problems, same outcome.</p>

<h3>2. Humidity</h3>
<p>The textbook number is 60–70% relative humidity. Below 50% the cork dries out and shrinks (same outcome as temperature swings — air gets in). Above 80% you get mold on labels, which is cosmetic but annoying for resale and gifts.</p>
<p>If your storage is in a dry climate or a fridge (which dehumidifies), put a small dish of water in there. If it's in a damp basement, you're fine — just check labels every few months.</p>

<h3>3. Light</h3>
<p>UV degrades wine fast — especially whites and rosés. This is why most premium wine bottles are dark glass. Light-strike (the &ldquo;wet cardboard&rdquo; off-flavor) shows up in months, not years. Keep wine in the dark or behind UV-coated glass.</p>

<h3>4. Vibration</h3>
<p>Wine doesn't like being shaken, but the &ldquo;ages faster&rdquo; folklore is overstated. The real concern is wine fridges with cheap compressors that buzz constantly — over 5+ years that's measurable. For a closet or basement, this is a non-issue.</p>

<h3>5. Position</h3>
<p>Bottles with traditional corks should be stored on their side (or upside down, which works equally well) so the cork stays moist. Screw-cap, glass-stopper, or synthetic-cork bottles can be stored upright — no cork to keep moist.</p>

<h2>What this means in practice</h2>

<h3>Drinking within 1–2 years</h3>
<p>A pantry, closet, basement shelf, or unheated room works fine. Just keep it dark, away from radiators, and not next to the kitchen oven.</p>

<h3>Holding 5–10 years</h3>
<p>Now you need climate control. A countertop wine fridge ($150–$400 for 18–32 bottles) is the cheapest path. Look for a thermoelectric model if you want silence and a compressor model if you want temperature stability — they trade off.</p>

<h3>Holding 15+ years (collector territory)</h3>
<p>You're investing more in the wine than the storage doesn't make sense. Either a dedicated wine cellar room with a cooling unit (CellarPro, WhisperKool — $1,500–$5,000 for the unit), a passive underground cellar if your geography allows, or off-site storage at a wine warehouse (~$1–3 per bottle per year).</p>

<h2>Common mistakes</h2>
<ul>
  <li><strong>Storing in the kitchen.</strong> Hot, light, vibration from appliances. Worst possible spot in the house.</li>
  <li><strong>Stacking bottles in a heated garage.</strong> Garages swing 50°F+ between summer and winter. Will ruin a bottle in 2–3 years.</li>
  <li><strong>Wine fridge crammed full so air can't circulate.</strong> Leave 10–20% headroom or your hot-spots will roast specific bottles.</li>
  <li><strong>Trusting the wine fridge's built-in thermostat.</strong> They drift. Put a $10 cheap thermometer inside and check it monthly.</li>
</ul>

<h2>Tracking your conditions</h2>
<p>If you're investing in wines worth aging, invest in a $30 Govee or SwitchBot temp+humidity sensor with logging. Better still: connect it to Home Assistant (or use Cellar Door's Home Assistant integration) so you have a chart of conditions over time. When a wine doesn't taste right, you'll want to know if it lived through a 90°F summer week.</p>

<p><strong>The bottom line:</strong> wine is more forgiving than purists claim. Steady temperature in the 55–65°F range, dark, on its side, and not in the kitchen — that handles 90% of home collections.</p>
    `,
  },

  {
    slug: "decanting-wine-when-why-how-long",
    title: "Decanting Wine: When, Why, and How Long",
    excerpt:
      "Decanting isn't just for big Bordeaux. Here's a clear-headed guide to which wines benefit, which don't, and how long is actually long enough.",
    date: "2026-04-05",
    readingMinutes: 6,
    tags: ["Tasting", "Practical"],
    body: `
<p>Decanting is one of those wine rituals that can feel like fussy theater — until you do a side-by-side comparison and realize how much it changes a wine. Here's the practical version: when it matters, when it doesn't, and how to actually do it.</p>

<h2>Two reasons to decant</h2>

<h3>Reason 1: Aeration</h3>
<p>Pouring wine into a wide-bottom decanter exposes much more surface area to oxygen than a glass alone. This wakes up tight, young, tannic wines — bringing out aromatics, softening tannins, and integrating flavors that were locked behind alcohol burn or reduction.</p>
<p>Best candidates: young Bordeaux blends, young Barolo / Barbaresco, young Brunello, big Napa Cabs, Northern Rhône Syrah. Anything tannic, structured, and under 8 years old.</p>

<h3>Reason 2: Sediment</h3>
<p>Older wines (15+ years for reds) develop sediment as tannins and color compounds bind together and fall out of solution. This stuff isn't harmful but it's gritty and bitter. Decanting carefully off the sediment gives you clean wine in the glass.</p>
<p>For sediment alone, you don't need much aeration — and old wines often <em>don't</em> want aeration (they can fade fast once exposed to air). Pour very slowly into a narrow decanter and stop the moment you see sediment crawling toward the neck.</p>

<h2>Wines that don't need decanting</h2>
<ul>
  <li><strong>Light reds:</strong> Pinot Noir, Gamay, Beaujolais, lighter Chianti. Decanting strips delicacy.</li>
  <li><strong>Most whites and rosés:</strong> Aroma is part of the experience and decanting dissipates it. Exception: very tight, mineral whites like young Chablis Premier Cru can benefit from 30 minutes in a decanter.</li>
  <li><strong>Sparkling wines:</strong> Never. You'll lose the bubbles. The only exception is older vintage Champagne where some tasters decant briefly to reveal complexity, accepting the bubble loss.</li>
  <li><strong>Fragile, mature wines:</strong> A 30-year-old Burgundy can fall apart in 20 minutes once decanted. Pour straight from the bottle and drink quickly.</li>
</ul>

<h2>How long</h2>
<p>This is where most advice goes wrong with a single number. Reality is a spectrum:</p>
<ul>
  <li><strong>Young, tannic, big:</strong> 1.5–3 hours. Taste at intervals.</li>
  <li><strong>Medium age, moderate tannin:</strong> 30–60 minutes.</li>
  <li><strong>Older (15+ years):</strong> Decant for sediment only, drink within 30 minutes.</li>
  <li><strong>Very young, very tight:</strong> Some hardcore Bordeaux fans will decant for 4–6 hours, even overnight, for very young first growths. This is divisive — it works for some bottles, hollows out others.</li>
</ul>

<h2>The double-decant trick</h2>
<p>Pour the wine into a decanter. Rinse the bottle with clean water. Pour the wine back into the bottle. You've doubled the aeration in a few minutes — useful when you forgot to decant earlier and dinner is in 20 minutes.</p>

<h2>Practical setup</h2>
<p>You don't need a $300 Riedel decanter. A 1L glass pitcher with a wide bottom works. The shape matters more than the brand: wide base for aeration, narrow neck if you mostly need sediment separation. Avoid metallic decanters (they impart flavor) and crystal with lead (illegal in most regions for food contact).</p>

<h2>How to know if it worked</h2>
<p>Pour two glasses: one straight from the bottle, one from the decanter. Smell both. If the decanter glass smells more open, more layered, more inviting — decanting worked. If the bottle glass is brighter and the decanter feels muted — you've over-aerated. With practice you'll know within 10 minutes whether a given wine wants more time or wants to be drunk now.</p>

<p><strong>The bottom line:</strong> decanting is a tool, not a ritual. Big young reds love it. Light reds, whites, and old wines mostly don't. When in doubt, pour two glasses and taste.</p>
    `,
  },

  {
    slug: "building-your-first-wine-cellar",
    title: "Building Your First Wine Cellar: A Realistic Roadmap",
    excerpt:
      "From your first 12 bottles to a 200-bottle cellar without buying anything you'll regret. A budget-honest guide.",
    date: "2026-03-28",
    readingMinutes: 10,
    tags: ["Beginner", "Collecting"],
    body: `
<p>Most &ldquo;build your first cellar&rdquo; articles assume you're ready to drop $5,000 on a wine fridge and a starter case. This isn't that article. Here's how to grow a real, useful collection at three realistic stages, with the choices that matter at each.</p>

<h2>Stage 1: 12–30 bottles ($300–$1,000 invested)</h2>

<p>You're past &ldquo;I buy a bottle when I cook dinner.&rdquo; You want a few wines on hand, the ability to cellar special bottles for a year or two, and a system to remember what you have.</p>

<h3>Storage</h3>
<p>A countertop wine fridge: 18–32 bottles, $150–$300 from Costco / Amazon / Wayfair. Look for: dual-zone (one temp for reds at 58°F, one for whites at 48°F), thermoelectric if you want silence, removable shelves so you can fit Burgundy bottles (which are wider than Bordeaux). Avoid fridges that vibrate audibly — your wine will hate it over years.</p>

<h3>Buy strategy</h3>
<p>Spend on diversity, not cellaring. At this stage every bottle should be drinkable within 2 years. A reasonable starter mix:</p>
<ul>
  <li>3 Tuesday-night reds ($15–$25): Côtes du Rhône, Malbec, Chianti, Spanish Garnacha</li>
  <li>3 weekend whites ($15–$30): Sauvignon Blanc, Vermentino, Albariño, dry Riesling</li>
  <li>3 nicer reds ($30–$60): California Pinot, Côte de Beaune red, Rioja Reserva, Aussie Shiraz</li>
  <li>2 special-occasion bottles ($60–$120): a serious Bordeaux, a Barolo, a Champagne</li>
  <li>1 sweet wine ($25–$50): Sauternes, late-harvest Riesling, Tawny Port</li>
</ul>

<h3>Track from day one</h3>
<p>Use a wine app (or a spreadsheet) from your very first bottle. The collectors who say &ldquo;I wish I'd started tracking earlier&rdquo; vastly outnumber the ones who think it's overkill. You want to know: when did I buy this, what did I pay, when should I drink it.</p>

<h2>Stage 2: 50–150 bottles ($1,500–$8,000 invested)</h2>

<p>You've graduated. Now you want to start <em>cellaring</em>: buying wines now to drink in 5–10 years when they hit their peak.</p>

<h3>Storage upgrade</h3>
<p>Either a freestanding 100–166 bottle wine fridge ($600–$1,500), or — much more cost-effective per bottle — a wine cooler unit installed in a closet that you've insulated. A 50-bottle wine fridge plus a 100-bottle insulated closet beats a single 150-bottle fridge for both cost and bottle access.</p>

<h3>Buying strategy</h3>
<p>You should now be thinking in <strong>verticals</strong> (multiple vintages of the same wine) and <strong>horizontals</strong> (multiple producers from the same vintage / region). This is when collecting gets interesting:</p>
<ul>
  <li>Pick 2–3 regions you genuinely love and start buying en primeur or on release</li>
  <li>For each, buy 6 bottles when possible — drink one every 2 years to track development</li>
  <li>Set a budget per quarter and stop when you hit it (collectors massively over-buy in their first 2 years)</li>
  <li>Aim for 60% drink-now, 40% holding — you don't want to be cellaring exclusively</li>
</ul>

<h3>The classics worth holding</h3>
<p>If you don't know where to start, these reliably reward 5–10 years of cellaring:</p>
<ul>
  <li><strong>Bordeaux:</strong> Cru Bourgeois ($25–$50) at 8–12 years, classed growths at 15–20+ years</li>
  <li><strong>Barolo / Barbaresco:</strong> 10–15 years from vintage</li>
  <li><strong>Brunello di Montalcino:</strong> 8–12 years</li>
  <li><strong>Northern Rhône Syrah:</strong> Cornas, Côte-Rôtie at 10–15 years</li>
  <li><strong>White Burgundy:</strong> Premier Cru Chablis or Côte de Beaune at 5–10 years</li>
  <li><strong>Vintage Champagne:</strong> 10–20 years for serious houses</li>
</ul>

<h2>Stage 3: 200–500+ bottles (the real cellar)</h2>

<p>Now you have a problem most collectors enjoy: you have more wine than you can reasonably drink in the next 5 years, and you're still buying.</p>

<h3>Storage</h3>
<p>This is when a dedicated cellar room makes sense — a closet, basement corner, or built-in cabinetry with a wine cooling unit (CellarPro 1800XT or WhisperKool SC for $1,500–$3,000). Or skip the build and use professional off-site storage at a wine warehouse — typically $1.50–$3.50 per bottle per year, climate controlled, insured.</p>

<h3>The practical issues you'll hit</h3>
<ul>
  <li><strong>Memory fails.</strong> You won't remember what you have or where it is. A visual cellar map (vs. a list) becomes essential.</li>
  <li><strong>Wines get forgotten.</strong> Schedule quarterly inventory reviews — pull bottles approaching peak and serve them.</li>
  <li><strong>Insurance matters.</strong> 200 bottles at an average $35 = $7,000 in your basement. Most homeowners policies cap personal property at amounts that won't cover this. Ask your insurer about a wine collection rider.</li>
  <li><strong>Estate planning becomes real.</strong> Spouses and heirs need to know what you have and what it's worth. Generate an annual valuation report and put it with your important documents.</li>
</ul>

<h2>Mistakes to avoid</h2>
<ul>
  <li><strong>Buying purely on critic scores.</strong> Develop your own palate. A 92-point wine you love beats a 96-point wine that doesn't move you.</li>
  <li><strong>Cellaring wines that aren't built for it.</strong> A $15 grocery-store Cab won't improve in 10 years. It'll just get older.</li>
  <li><strong>Drinking everything before its peak.</strong> The other side of the coin: many young Bordeaux are pleasant but reveal themselves at 12–15 years. Be patient.</li>
  <li><strong>Confusing cellaring with hoarding.</strong> The point of cellaring is to drink wines at their peak. If you're not drinking, you're collecting trophies.</li>
</ul>

<p><strong>The bottom line:</strong> start with a wine fridge and 20 bottles. Grow from there based on what you actually drink, not what someone else collects. Track everything from day one. Most importantly — open the bottles. The greatest cellar in the world is the one you actually drink your way through.</p>
    `,
  },

  {
    slug: "how-to-read-a-wine-label",
    title: "How to Read a Wine Label: Old World vs New World",
    excerpt:
      "A French label tells you almost nothing the way an American label does — and vice versa. Here's how to decode both.",
    date: "2026-03-20",
    readingMinutes: 7,
    tags: ["Beginner", "Reference"],
    body: `
<p>Wine labels have two completely different conventions. Once you learn the rules, picking up a bottle from any country becomes much easier.</p>

<h2>New World labels (US, Australia, Chile, Argentina, NZ, South Africa)</h2>

<p>These countries label by <strong>grape variety</strong>. The label says &ldquo;Cabernet Sauvignon&rdquo; or &ldquo;Sauvignon Blanc&rdquo; in big letters, plus the producer name, vintage, and region.</p>

<p>What you typically see:</p>
<ul>
  <li><strong>Producer / winery name:</strong> Caymus, Penfolds, Cloudy Bay</li>
  <li><strong>Grape variety:</strong> Cabernet Sauvignon, Shiraz, Sauvignon Blanc</li>
  <li><strong>Vintage year</strong> (the year the grapes were picked)</li>
  <li><strong>Region:</strong> Napa Valley, Barossa, Marlborough</li>
  <li><strong>Alcohol percentage</strong> (somewhere on the back)</li>
  <li>Optional: vineyard name, winemaker notes, stylistic descriptors</li>
</ul>

<p>This is intuitive but slightly misleading — &ldquo;Cabernet Sauvignon&rdquo; from Napa tastes very different from &ldquo;Cabernet Sauvignon&rdquo; from Coonawarra. The grape is the same; everything else (climate, soil, winemaking) varies.</p>

<h2>Old World labels (France, Italy, Spain, Germany, Portugal)</h2>

<p>These countries label by <strong>region</strong> — assuming you know what grapes are grown there. A bottle of &ldquo;Chablis&rdquo; doesn't say &ldquo;Chardonnay&rdquo; on it; you're expected to know that Chablis is always Chardonnay.</p>

<h3>France: the dominant logic</h3>
<p>French wine is regulated by the <strong>AOC / AOP</strong> system. The label tells you the region, and the region tells you the grape. Examples:</p>
<ul>
  <li><strong>Bordeaux</strong> = blend of Cabernet Sauvignon, Merlot, Cabernet Franc (sometimes Petit Verdot, Malbec)</li>
  <li><strong>Burgundy</strong> red = Pinot Noir; Burgundy white = Chardonnay</li>
  <li><strong>Beaujolais</strong> = Gamay</li>
  <li><strong>Châteauneuf-du-Pape</strong> = blend, Grenache-dominant</li>
  <li><strong>Sancerre</strong> red = Pinot Noir; Sancerre white = Sauvignon Blanc</li>
  <li><strong>Champagne</strong> = blend of Chardonnay, Pinot Noir, Pinot Meunier</li>
</ul>

<p>Within a region there's a quality hierarchy:</p>
<ul>
  <li><strong>Regional</strong> (e.g. Bourgogne) — basic level</li>
  <li><strong>Village</strong> (e.g. Gevrey-Chambertin) — better, named village</li>
  <li><strong>Premier Cru</strong> (e.g. Gevrey-Chambertin Premier Cru &ldquo;Les Cazetiers&rdquo;) — better, named vineyard</li>
  <li><strong>Grand Cru</strong> (e.g. Chambertin) — top of pyramid</li>
</ul>

<h3>Italy: similar but with DOC / DOCG</h3>
<p>Italy uses DOC (Denominazione di Origine Controllata) and DOCG (the &ldquo;G&rdquo; for Garantita = guaranteed = top tier). Key regional → grape decoder:</p>
<ul>
  <li><strong>Barolo / Barbaresco</strong> = Nebbiolo</li>
  <li><strong>Chianti</strong> = Sangiovese-dominant blend</li>
  <li><strong>Brunello di Montalcino</strong> = 100% Sangiovese (clone called Brunello)</li>
  <li><strong>Amarone della Valpolicella</strong> = blend of Corvina, Rondinella, Molinara — dried grapes</li>
  <li><strong>Soave</strong> = Garganega-dominant white</li>
</ul>

<h3>Spain: by region + by aging</h3>
<p>Spanish labels add an aging classification you should know:</p>
<ul>
  <li><strong>Joven</strong> = young, no oak required</li>
  <li><strong>Crianza</strong> = aged 2 years (1 in oak)</li>
  <li><strong>Reserva</strong> = aged 3 years (1 in oak)</li>
  <li><strong>Gran Reserva</strong> = aged 5 years (2 in oak) — only made in great vintages</li>
</ul>
<p>Same grape, same producer, drastically different wine depending on the aging tier.</p>

<h3>Germany: by ripeness, by sugar</h3>
<p>German Rieslings are labeled by ripeness at harvest, on a scale from <em>Kabinett</em> (light, often dry-ish) through <em>Spätlese</em>, <em>Auslese</em>, <em>Beerenauslese</em>, to <em>Trockenbeerenauslese</em> (dessert wine from raisined grapes). &ldquo;Trocken&rdquo; means dry; &ldquo;Halbtrocken&rdquo; or &ldquo;Feinherb&rdquo; means off-dry.</p>

<h2>What the back label tells you</h2>
<p>The back is usually more useful than the front for a wine you've never had:</p>
<ul>
  <li><strong>Alcohol percentage</strong> — a 12% wine drinks much lighter than a 15% wine, even if both are the same grape</li>
  <li><strong>Importer</strong> — for US bottles, the importer often signals quality (Kermit Lynch, Skurnik, Eric Solomon all curate well)</li>
  <li><strong>Sulfite warning</strong> — required by US law; tells you nothing useful about quality (almost all wine has some sulfites)</li>
  <li><strong>Government warning</strong> — also required, tells you nothing</li>
</ul>

<h2>The quick decoder for unfamiliar bottles</h2>
<p>Walk into a store, see a wine you don't know:</p>
<ol>
  <li>Look at the front. Does it say a grape? → New World convention. The grape is your starting point.</li>
  <li>If no grape, look for the region. Match the region to its known grape (use this article or an app to help).</li>
  <li>Check vintage. For drinking now: most wines hit their stride 3–8 years after vintage; hold serious reds longer.</li>
  <li>Check alcohol. Lighter (under 13%) = often more elegant; bigger (14.5%+) = often more powerful, more oak.</li>
  <li>Check producer. If you've had something good from them before, that's worth more than any score.</li>
</ol>

<p>It takes about a year of paying attention to read most labels fluently. After that you can walk into a wine shop in any country and have a meaningful conversation with the staff. Worth the time investment.</p>
    `,
  },

  {
    slug: "wine-tasting-at-home-structured",
    title: "Wine Tasting at Home: A Structured Approach",
    excerpt:
      "Most home tastings are unstructured drinking. Here's how to set up a genuinely useful side-by-side that teaches you something.",
    date: "2026-03-12",
    readingMinutes: 7,
    tags: ["Tasting", "Beginner"],
    body: `
<p>The fastest way to develop your palate is comparative tasting — pouring multiple wines side by side and noticing the differences. The fastest way to <em>not</em> develop your palate is what most people do: open one bottle, drink it all night, vaguely remember liking it. Here's a better setup.</p>

<h2>The format that works</h2>

<h3>Number of wines: 4–6</h3>
<p>Fewer than 4 and the comparisons are too narrow to be useful. More than 6 and palate fatigue sets in — by wine 7 you've stopped tasting and started drinking. Four wines × 2 oz each = 8 oz total, less than a normal glass. Spit if you want, swallow if you'd rather; either way you'll stay sharp.</p>

<h3>Pick a theme</h3>
<p>Random wines side by side teach almost nothing. A theme creates a controlled comparison where the variable you're testing actually shows up. Good themes:</p>
<ul>
  <li><strong>Same grape, different regions:</strong> Pinot Noir from Burgundy, Oregon, Sonoma Coast, Central Otago. Each tastes radically different.</li>
  <li><strong>Same region, different vintages:</strong> A vertical of one producer's wine across 5 years. Teaches you what vintage variation actually means.</li>
  <li><strong>Same vintage, different producers:</strong> 2019 Côtes du Rhône from 5 different houses. Producer style becomes obvious.</li>
  <li><strong>Same grape, different price points:</strong> $15 / $25 / $50 / $100 Cabernet. Where does the diminishing returns start for your palate?</li>
  <li><strong>Old vs new world:</strong> French Sauvignon Blanc (Sancerre) vs New Zealand. Same grape, different philosophies.</li>
</ul>

<h2>The tasting steps</h2>

<h3>1. Look</h3>
<p>Hold the glass at an angle against a white background. Note the color (pale ruby, deep purple, brick) and clarity. Color tells you about age (reds get browner, whites get more golden) and grape thickness (thin-skinned grapes = lighter color).</p>

<h3>2. Smell — twice</h3>
<p>First sniff <strong>before</strong> swirling. This catches volatile aromatics that escape with agitation. Second sniff <strong>after</strong> swirling for 5 seconds — releases the heavier compounds.</p>
<p>What to look for: fruit (which fruits specifically?), flowers, spice, earth, oak, secondary characteristics (mushroom, leather, gasoline in mature Riesling). The vocabulary expands with practice; don't worry if you're stuck on &ldquo;berries&rdquo; for the first 6 months.</p>

<h3>3. Taste — slowly</h3>
<p>Take a small sip. Hold it on your tongue. Suck a little air through the wine (it's noisy; that's fine) — this volatilizes more aromatics into your retro-nasal passages, which is where most flavor perception happens. Notice:</p>
<ul>
  <li><strong>Sweetness</strong> — front of tongue, immediate</li>
  <li><strong>Acidity</strong> — sides of tongue, makes you salivate</li>
  <li><strong>Tannin</strong> — drying / grippy feeling on gums, only in reds and orange wines</li>
  <li><strong>Body</strong> — does it feel like skim milk or whole milk in your mouth?</li>
  <li><strong>Alcohol</strong> — warmth on swallowing</li>
  <li><strong>Finish</strong> — how long do flavors persist after you swallow? Great wines can finish for 30+ seconds.</li>
</ul>

<h3>4. Score and write</h3>
<p>You don't need a 100-point system. A 5-star or 1–10 personal scale works fine. The score itself matters less than <strong>the act of writing one or two specific notes</strong>: &ldquo;huge nose, oak dominates the palate, finish too short for the price.&rdquo; You're not writing for anyone but future you.</p>

<h2>Practical setup</h2>

<h3>Glasses</h3>
<p>One glass per wine, all the same shape. They don't have to be expensive — Bormioli Premium or IKEA Storsint work fine. The shape (wide-bowled bordeaux glass for everything, or specific Burgundy bowls for Pinot) matters more than the brand.</p>

<h3>Pour 2 oz</h3>
<p>That's about 4 fingers' width at the bottom of a tasting glass. Don't be tempted to pour more — you want to revisit each wine multiple times during the tasting and that means you need to ration.</p>

<h3>Order matters</h3>
<p>Tradition: white before red, light before heavy, dry before sweet, young before old. Reverse the order at your peril — your palate calibrates upward.</p>

<h3>Have water and bread</h3>
<p>Plain water for palate cleansing, plain bread (not flavored crackers) for resetting. Avoid cheese during a tasting — fat coats your tongue and skews everything sweeter and softer.</p>

<h3>Quiet environment</h3>
<p>No strong cooking smells. No perfume / cologne (ask guests to skip it). Good lighting so you can see colors clearly. Background music is fine.</p>

<h2>Blind tasting: the next level</h2>
<p>Once you've done 4–5 themed tastings, try blind. Cover the bottles in foil, number them, and pour without revealing what's what. Guess the grape, region, vintage, price tier. You'll be wrong 70% of the time at first; that's the point. The wins teach you what's reliable about your palate, the losses teach you what's harder than you thought.</p>

<h2>Track everything</h2>
<p>Keep notes in a wine app or a notebook. The pattern recognition only works if you can look back over 6 months and see &ldquo;huh, I consistently like New Zealand Sauvignon Blanc more than Sancerre&rdquo; — that's data you can buy from.</p>

<p><strong>The bottom line:</strong> a 90-minute structured tasting with 4 wines on a Sunday afternoon will teach you more about wine than 30 random Tuesday-night bottles. Pick a theme, pour small, write things down, drink the rest after.</p>
    `,
  },

  {
    slug: "vintage-charts-explained",
    title: "Vintage Charts Explained: When They Matter and When They Don't",
    excerpt:
      "Vintage charts are often misread. Here's how professionals actually use them and which regions you can mostly ignore them for.",
    date: "2026-03-04",
    readingMinutes: 6,
    tags: ["Reference", "Buying"],
    body: `
<p>Open Wine Spectator or Decanter and you'll see a wall of vintage scores: 2015 Bordeaux 96, 2017 Burgundy 88, 2019 Napa 94. Most home buyers either ignore these completely or weight them way too heavily. Here's the actual usefulness, region by region.</p>

<h2>What a vintage chart is measuring</h2>

<p>Critics rate the <strong>conditions of the growing season</strong> and assess the typical quality of wines from that vintage <em>across the region as a whole</em>. They're not rating individual wines.</p>

<p>That distinction matters: in a "weak" vintage like 2013 Bordeaux (rated low across the board), top producers still made very good wines. In a "great" vintage like 2009, lazy producers still made forgettable wines. The vintage chart is a baseline, not a verdict.</p>

<h2>Where vintage matters a lot</h2>

<h3>Burgundy</h3>
<p>Pinot Noir is the most weather-sensitive grape in serious wine. Cool, wet years like 2008 and 2011 produce delicate, age-worthy wines that feel underweight at release; hot dry years like 2003 and 2018 produce richer wines that some find atypical. Buy producers you trust and pay attention to vintage variation — Burgundy is the one region where vintage information genuinely changes how you should buy.</p>

<h3>Bordeaux</h3>
<p>The first growths can make excellent wine in almost any vintage (their resources buffer weather), but mid-tier Bordeaux varies wildly. A great vintage like 2015 means even Cru Bourgeois are worth holding 10+ years; a weaker vintage like 2017 (frost-damaged) means you should buy higher up the hierarchy or skip and wait.</p>

<h3>Champagne</h3>
<p>Vintage Champagne (the year is on the label) is only declared in years the houses consider exceptional — typically 3 out of 10 vintages. Non-vintage Champagne (no year on the label) is blended specifically to taste consistent year-to-year, so vintage charts are irrelevant for it.</p>

<h3>Northern Rhône</h3>
<p>Syrah from Côte-Rôtie, Hermitage, Cornas — same logic as Burgundy. Cool vs hot years produce dramatically different wines. Worth knowing.</p>

<h2>Where vintage matters less</h2>

<h3>California Cabernet</h3>
<p>Napa weather is consistent enough that vintage variation in well-sited vineyards is real but small. The producer matters far more than the year. A Caymus 2017 vs Caymus 2018 differs at the margin; Caymus vs Stag's Leap differs hugely.</p>

<h3>Australia (mostly)</h3>
<p>Big established regions (Barossa, McLaren Vale) have enough climate consistency that vintage is rarely the deciding factor. Cool-climate Australian regions (Tasmania, Yarra Valley) are more vintage-sensitive — closer to Burgundy than Napa.</p>

<h3>South America</h3>
<p>Argentine Malbec and Chilean Cabernet from established regions are remarkably vintage-consistent. Producer + region + price tier is more useful information than vintage year.</p>

<h3>Most non-vintage anything</h3>
<p>NV Champagne, NV Sherry, NV Port, most rosé, most lower-tier whites — vintage charts don't apply. Buy on producer reputation and freshness.</p>

<h2>How to actually use a vintage chart</h2>

<ol>
  <li><strong>Confirm a region/year is at least decent before buying serious money.</strong> If you're spending $200 on a bottle of 2018 Volnay, a quick check that 2018 was a good Burgundy year (it was) is worth 30 seconds.</li>
  <li><strong>Decide drinking windows.</strong> Vintage charts tell you when wines from a given year will peak — useful for knowing when to open something.</li>
  <li><strong>Spot bargains in &ldquo;weaker&rdquo; vintages.</strong> Top producers in lower-rated vintages often offer the best price-quality ratio. The lazy money avoids weak vintages, leaving good wines available cheaper.</li>
  <li><strong>Build verticals.</strong> Buying multiple vintages of the same wine is more interesting if you understand the vintage characteristics (a hot year vs a cool year of the same wine teaches you a lot).</li>
</ol>

<h2>How to read a chart correctly</h2>

<p>Most charts use 100-point or 5-star scales:</p>
<ul>
  <li><strong>Outstanding (95+ / 5★):</strong> Major vintage. Buy more than you'd normally buy. Hold to peak.</li>
  <li><strong>Very good (90–94 / 4★):</strong> Standard buy. Wines drink well at typical timing.</li>
  <li><strong>Good (85–89 / 3★):</strong> Drink earlier than you would in a great year. Be selective on producer.</li>
  <li><strong>Average (80–84 / 2★):</strong> Buy from top producers only. Drink soon.</li>
  <li><strong>Below average (under 80 / 1★):</strong> Skip unless you know the specific producer beat the vintage.</li>
</ul>

<p><strong>The bottom line:</strong> vintage matters most for Burgundy, Champagne (vintage releases), Bordeaux at every level, and Northern Rhône. It matters somewhat for everything else and barely at all for non-vintage wines. Use vintage charts as one input alongside producer, region, and your own track record. They're a tool — not a verdict.</p>
    `,
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return POSTS.map((p) => p.slug);
}
