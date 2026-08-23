const SESSION_STORAGE_KEY = "rag-chat-session";

interface StoredSession {
  documentId: string;
  sessionId: string;
}

function readSessions(): StoredSession[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (session): session is StoredSession =>
        typeof session === "object" &&
        session !== null &&
        "documentId" in session &&
        "sessionId" in session &&
        typeof session.documentId === "string" &&
        typeof session.sessionId === "string",
    );
  } catch {
    return [];
  }
}

function writeSessions(session: StoredSession[]) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function getOrCreateSession(documentId: string): string {
  const sessions = readSessions();

  const existing = sessions.find(
    (session) => session.documentId === documentId,
  );

  if (existing) {
    return existing.sessionId;
  }

  const sessionId = crypto.randomUUID();

  writeSessions([
    ...sessions,
    {
      documentId,
      sessionId,
    },
  ]);

  return sessionId;
}

export function resetSession(documentId: string) {
  const sessions = readSessions();

  writeSessions(
    sessions.filter((session) => session.documentId !== documentId),
  );
}
