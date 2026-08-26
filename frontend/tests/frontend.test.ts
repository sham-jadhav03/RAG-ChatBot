import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getOrCreateSession, resetSession } from "../lib/session";
import { ApiError } from "../lib/api-client";

// Mock sessionStorage in Node environment
const mockStorage: Record<string, string> = {};
globalThis.sessionStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  length: 0,
  key: () => null,
};
(globalThis as unknown as { window: unknown }).window = {};

describe("Phase 13A — Frontend Baseline Tests", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("1. Session Management", () => {
    it("creates unique session ID for new document", () => {
      const docA = "doc-123";
      const sessA = getOrCreateSession(docA);
      assert.ok(sessA && typeof sessA === "string");
      assert.equal(sessA.length > 10, true);
    });

    it("returns existing session ID for same document", () => {
      const docA = "doc-123";
      const sessA1 = getOrCreateSession(docA);
      const sessA2 = getOrCreateSession(docA);
      assert.equal(sessA1, sessA2);
    });

    it("maintains separate sessions for different documents", () => {
      const docA = "doc-123";
      const docB = "doc-456";
      const sessA = getOrCreateSession(docA);
      const sessB = getOrCreateSession(docB);
      assert.notEqual(sessA, sessB);
    });

    it("resets session properly on demand", () => {
      const docA = "doc-123";
      const sessA1 = getOrCreateSession(docA);
      resetSession(docA);
      const sessA2 = getOrCreateSession(docA);
      assert.notEqual(sessA1, sessA2);
    });
  });

  describe("2. API Error Handling", () => {
    it("instantiates ApiError with status and message", () => {
      const err = new ApiError("Document not found", 404, { success: false, message: "Document not found", errors: ["Doc not found"] });
      assert.equal(err.status, 404);
      assert.equal(err.message, "Document not found");
      assert.deepEqual(err.body?.errors, ["Doc not found"]);
      assert.equal(err.name, "ApiError");
    });
  });
});
