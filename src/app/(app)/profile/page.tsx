"use client";

import Link from "next/link";
import {
  Sparkles,
  Compass,
  BarChart3,
  Wine as WineIcon,
  History,
  ShoppingCart,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TierBadge } from "@/components/tier/tier-badge";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/components/auth-provider";
import { auth, firebaseSignOut } from "@/lib/firebase";
import type { Tier } from "@/lib/tier";

// Vivino's Profile tab: identity + Taste Profile + your stats + settings.
// In Cellar Door this is the hub for everything that isn't a primary tab, so
// the 5-tab nav loses nothing — Inventory, History, Buy List, Stats, Settings
// all live here.

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim();

interface LinkRow {
  href: string;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  accent: string;
}

const PRIMARY: LinkRow[] = [
  { href: "/taste-profile", title: "Taste Profile", subtitle: "What you like, by style, region & grape", icon: Sparkles, accent: "text-primary" },
  { href: "/discover", title: "Discover", subtitle: "AI search, matches for your taste & browse", icon: Compass, accent: "text-emerald-500" },
  { href: "/stats", title: "Stats", subtitle: "Collection value, breakdowns & trends", icon: BarChart3, accent: "text-blue-500" },
];

const COLLECTION: LinkRow[] = [
  { href: "/inventory", title: "Inventory", subtitle: "Your full bottle list", icon: WineIcon, accent: "text-rose-500" },
  { href: "/buy-list", title: "Wishlist", subtitle: "Wines you want to buy", icon: ShoppingCart, accent: "text-amber-500" },
  { href: "/history", title: "History", subtitle: "Tasted & removed bottles", icon: History, accent: "text-green-500" },
  { href: "/insurance-report", title: "Insurance Report", subtitle: "Valuation export for your records", icon: FileText, accent: "text-muted-foreground" },
];

function Rows({ rows }: { rows: LinkRow[] }) {
  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {rows.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
          >
            <r.icon className={`h-5 w-5 shrink-0 ${r.accent}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { user, tier } = useAuth();

  const isAdminUser =
    !!ADMIN_EMAIL && !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const initials = user?.displayName
    ? user.displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "?";

  const handleSignOut = async () => {
    try {
      const { clearSession } = await import("@/server/actions/auth");
      await clearSession();
    } catch {
      /* best effort */
    }
    const firebaseAuth = auth();
    if (firebaseAuth) await firebaseSignOut(firebaseAuth);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full page reload resets auth and demo state
    window.location.href = "/login";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />

      {/* Identity */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user?.photoURL || undefined} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold truncate">{user?.displayName || "Wine lover"}</p>
              {tier && tier !== "FREE" && <TierBadge tier={tier as Tier} className="shrink-0 text-[10px] px-1.5 py-0" />}
            </div>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Your taste</h2>
        <Rows rows={PRIMARY} />
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Collection</h2>
        <Rows rows={COLLECTION} />
      </div>

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">Account</h2>
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
              <Settings className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Settings</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            {isAdminUser && (
              <Link href="/admin" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors">
                <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">Admin</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
            >
              <LogOut className="h-5 w-5 shrink-0 text-destructive" />
              <span className="flex-1 text-sm font-medium text-destructive">Sign out</span>
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
