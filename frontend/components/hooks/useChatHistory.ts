import { useQuery } from "@tanstack/react-query";
import {chatapi} from "@/lib/api-client"


export function useChatHistory(
    sessionId: string | null,
    page = 1,
    limit = 10,
) {
    return useQuery({
        queryKey: ["chat-history", sessionId, page, limit],
        queryFn: () => {
            if(!sessionId) {
                throw new Error("Session ID is required.");
            }
            return chatapi.history(sessionId, page, limit);
        },
        enabled: Boolean(sessionId),
        staleTime: 30 * 1000,
        retry: 1,
    });
}