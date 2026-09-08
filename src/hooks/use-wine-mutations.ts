"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWine, editWine, deleteWine } from "@/lib/data";
import type { Wine } from "@/types/wine";

export function useAddWineMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      userId,
    }: {
      data: Omit<Wine, "id" | "addedAt" | "updatedAt" | "userId">;
      userId?: string | null;
    }) => createWine(data, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wines"] });
    },
  });
}

export function useUpdateWineMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      wineId,
      data,
      userId,
    }: {
      wineId: string;
      data: Partial<Wine>;
      userId?: string | null;
    }) => editWine(wineId, data, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wines"] });
    },
  });
}

export function useDeleteWineMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      wineId,
      reason,
      rating,
      notes,
      userId,
    }: {
      wineId: string;
      reason?: string;
      rating?: number | null;
      notes?: string;
      userId?: string | null;
    }) => deleteWine(wineId, reason, rating, notes, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wines"] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
}
