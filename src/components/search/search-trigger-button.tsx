"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearch } from "./search-provider";

export function SearchTriggerButton() {
  const { setOpen } = useSearch();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      onClick={() => setOpen(true)}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">Search</span>
      <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ml-1">
        ⌘K
      </kbd>
    </Button>
  );
}
