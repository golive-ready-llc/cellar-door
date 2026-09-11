"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Wine,
  Grid3X3,
  ShoppingCart,
  History,
  Settings,
  LogOut,
  BarChart3,
  Shield,
  Compass,
  Activity,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";
import { auth, firebaseSignOut } from "@/lib/firebase";
import { TierBadge } from "@/components/tier/tier-badge";
import type { Tier } from "@/lib/tier";

const navItems = [
  {
    title: "Cellar",
    url: "/cellar",
    icon: Grid3X3,
  },
  {
    title: "Discover",
    url: "/discover",
    icon: Compass,
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: Wine,
  },
  {
    title: "Buy List",
    url: "/buy-list",
    icon: ShoppingCart,
  },
  {
    title: "History",
    url: "/history",
    icon: History,
  },
  {
    title: "Taste Profile",
    url: "/taste-profile",
    icon: Sparkles,
  },
  {
    title: "Stats",
    url: "/stats",
    icon: BarChart3,
  },
];

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim();

export function AppSidebar() {
  const pathname = usePathname();
  const { user, tier } = useAuth();

  const isAdminUser =
    !!ADMIN_EMAIL &&
    !!user?.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const handleSignOut = async () => {
    // Clear the server session cookie first so no authenticated server session
    // lingers after the client signs out (matters on shared devices).
    try {
      const { clearSession } = await import("@/server/actions/auth");
      await clearSession();
    } catch {
      /* best effort */
    }
    const firebaseAuth = auth();
    if (firebaseAuth) await firebaseSignOut(firebaseAuth);
    window.location.href = "/login";
  };

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/cellar" />}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Cellar Door" className="h-9 w-auto rounded-lg" />
              <span className="text-xl font-bold">Cellar Door</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.url} />}
                    isActive={pathname === item.url}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdminUser && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/admin" />}
                    isActive={pathname === "/admin"}
                  >
                    <Shield />
                    <span>Admin</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user?.photoURL || undefined} />
                  <AvatarFallback className="text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left text-sm leading-tight min-w-0 flex-1">
                  <span className="truncate font-medium flex items-center gap-1.5">
                    <span className="truncate">{user?.displayName || "User"}</span>
                    {tier && tier !== "FREE" && (
                      <TierBadge tier={tier as Tier} className="shrink-0 text-[9px] px-1.5 py-0" />
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="start"
                side="top"
              >
                <DropdownMenuItem render={<Link href="/settings" />}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
