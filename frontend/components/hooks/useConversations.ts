"use client";

import { useQuery } from "@tanstack/react-query";
import { chatapi } from "@/lib/api-client";

export function useConversations(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["conversations", page, limit],
    queryFn: () => chatapi.listConversations(page, limit),
    staleTime: 30 * 1000,
    retry: 1,
  });
}