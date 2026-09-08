"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchWines, fetchWalls, fetchCabinets, fetchHistory } from "@/lib/data";

export function useWinesQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["wines", userId],
    queryFn: () => fetchWines(userId),
    enabled: !!userId,
  });
}

export function useWallsQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["walls", userId],
    queryFn: () => fetchWalls(userId),
    enabled: !!userId,
  });
}

export function useCabinetsQuery(userId: string | null | undefined, wallId?: string) {
  return useQuery({
    queryKey: ["cabinets", userId, wallId],
    queryFn: () => fetchCabinets(userId),
    enabled: !!userId,
    select: wallId ? (cabinets) => cabinets.filter((c) => c.wallId === wallId) : undefined,
  });
}

export function useHistoryQuery(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["history", userId],
    queryFn: () => fetchHistory(userId),
    enabled: !!userId,
  });
}
