"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Grid3X3, BarChart3, Camera, Activity, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAddWine } from "@/components/add-wine-context";

// 5-surface bottom nav: Cellar · Stats · Scan (center) · Activity · Profile.
// Cellar stays leftmost (Cellar Door's home); Scan is the prominent center
// action (camera). Stats earns a tab over Discover — it's the surface users
// actually open daily. Secondary surfaces (Discover, Inventory, Buy List,
// History, Taste Profile, Settings) live under Profile.
const navItems = [
  { title: "Cellar", url: "/cellar", icon: Grid3X3 },
  { title: "Stats", url: "/stats", icon: BarChart3 },
  { title: "Activity", url: "/activity", icon: Activity },
  { title: "Profile", url: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { _onAdd, _openCameraFirst, requestCameraOnReady } = useAddWine();

  const handleScan = () => {
    if (_onAdd) {
      _openCameraFirst();
    } else {
      // Pages without an add handler (e.g. stats) — hop to the cellar and open
      // the camera once it registers.
      requestCameraOnReady();
      router.push("/cellar");
    }
  };

  // Render order interleaves the center Scan button between the 2nd and 3rd
  // links so it sits dead-center, Vivino-style.
  const left = navItems.slice(0, 2);
  const right = navItems.slice(2);

  const renderLink = (item: (typeof navItems)[number]) => {
    const isActive = pathname === item.url;
    return (
      <Link
        key={item.url}
        href={item.url}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] font-medium transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <item.icon className={cn("h-5 w-5", isActive && "text-primary")} strokeWidth={isActive ? 2.5 : 2} />
        <span>{item.title}</span>
      </Link>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {left.map(renderLink)}

        {/* Center Scan — the prominent camera action (Vivino's center tab) */}
        <button
          type="button"
          onClick={handleScan}
          className="flex flex-col items-center justify-center flex-1 h-full"
          aria-label="Scan wine"
        >
          <span className="flex flex-col items-center justify-center gap-0.5 w-12 h-11 rounded-xl bg-red-600 text-white active:scale-95 transition-transform">
            <Camera className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-none">Scan</span>
          </span>
        </button>

        {right.map(renderLink)}
      </div>
    </nav>
  );
}
