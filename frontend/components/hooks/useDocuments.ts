"use client";

import { useQuery } from "@tanstack/react-query";
import { documentsApi } from "@/lib/api-client";
import type { DocumentListParams } from "@/lib/types";

export function useDocuments(params: DocumentListParams = {}) {
  return useQuery({
    queryKey: ["documents", params],
    queryFn: () => documentsApi.list(params),

    refetchInterval: (query) => {
      const documents = query.state.data?.documents ?? [];

      const hasProcessingDocuments = documents.some(
        (document) =>
          document.processingStatus === "PENDING" ||
          document.processingStatus === "PROCESSING",
      );

      return hasProcessingDocuments ? 3000 : false;
    },

    refetchIntervalInBackground: false,
  });
}
