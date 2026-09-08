import type { Metadata } from "next";
import { RestaurantsClient } from "./restaurants-client";

export const metadata: Metadata = {
  title: "Cellar Door for Restaurants & Wine Shops — AI Wine Inventory",
  description:
    "Run your wine program with AI: scan wine lists and invoices in seconds, track every bottle, engineer pour costs, and know exactly what to sell before it's past peak. Self-serve, 14-day free trial.",
  alternates: { canonical: "https://mycellardoor.app/restaurants" },
  openGraph: {
    title: "Cellar Door for Restaurants & Wine Shops",
    description:
      "AI wine inventory for hospitality: wine-list scanning, invoice receiving, pour-cost engineering, and cellar mapping.",
    url: "https://mycellardoor.app/restaurants",
    type: "website",
  },
};

export default function RestaurantsPage() {
  return <RestaurantsClient />;
}
