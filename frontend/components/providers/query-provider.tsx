"use client"
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

 


export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures one QueryClient per component tree, not recreated
  // on every render.
    const [queryClient] = useState(
        () => 
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30 * 1000,
                        retry: 1,
                    },
                },
            }),
    );
    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}