const STORAGE_KEY = "rag-chat-sessions";

interface StoredSession {
  documentId: string;
  sessionId: string;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  // In test environment, localStorage may be mocked on globalThis
  // Check if localStorage has getItem/setItem (real or mocked)
  const ls = window.localStorage;
  if (ls && typeof ls.getItem === "function" && typeof ls.setItem === "function") {
    return ls;
  }
  // Fall back to sessionStorage (real or mocked on globalThis/window)
  const ss = window.sessionStorage || (typeof globalThis !== "undefined" ? globalThis.sessionStorage : null);
  if (ss && typeof ss.getItem === "function" && typeof ss.setItem === "function") {
    return ss;
  }
  return null;
}

function readSessions(): StoredSession[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(STORAGE_KEY);

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

function writeSessions(sessions: StoredSession[]) {
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }
}

// For testing: clear storage
export function clearStorageForTest(): void {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
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

export function getAllSessions(): StoredSession[] {
  return readSessions();
}

export function getSession(documentId: string): StoredSession | undefined {
  const sessions = readSessions();
  return sessions.find((session) => session.documentId === documentId);
}
