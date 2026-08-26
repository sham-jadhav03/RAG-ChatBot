import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AuthValidator } from "../src/modules/auth/auth.validators.js";
import DocumentValidator from "../src/modules/documents/document.validators.js";
import ChatValidator from "../src/modules/chat/chat.validators.js";
import { pendingRequests } from "../src/redis/pendingRequests.js";

describe("Phase 13A — Backend Baseline Tests", () => {
  describe("1. Auth Validation", () => {
    it("rejects missing username in registration", () => {
      let statusCalled = 0;
      let jsonBody: any = null;
      const req: any = { body: { email: "test@example.com", password: "Password123!" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json(data: any) { jsonBody = data; return this; }
      };
      let nextCalled = false;
      AuthValidator.validateRegister(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
      assert.ok(jsonBody.errors.some((e: string) => e.includes("Username is required")));
    });

    it("rejects invalid email format", () => {
      let statusCalled = 0;
      const req: any = { body: { username: "alice", email: "not-an-email", password: "Password123!" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      AuthValidator.validateRegister(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });

    it("rejects weak password under 6 chars", () => {
      let statusCalled = 0;
      const req: any = { body: { username: "alice", email: "alice@example.com", password: "123" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      AuthValidator.validateRegister(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });

    it("passes valid registration and sanitizes input", () => {
      const req: any = { body: { username: "  alice  ", email: "  Alice@Example.COM  ", password: "Password123!" } };
      const res: any = {};
      let nextCalled = false;
      AuthValidator.validateRegister(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
      assert.equal(req.body.username, "alice");
      assert.equal(req.body.email, "alice@example.com");
    });
  });

  describe("2. Document Validation", () => {
    it("rejects missing file in upload", () => {
      let statusCalled = 0;
      const req: any = { file: undefined };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      DocumentValidator.validateUpload(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });

    it("rejects non-pdf mimetype in upload validator", () => {
      let statusCalled = 0;
      const req: any = { file: { mimetype: "image/png" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      DocumentValidator.validateUpload(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });

    it("rejects invalid documentId ObjectId format", () => {
      let statusCalled = 0;
      const req: any = { params: { id: "123-invalid-id" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      DocumentValidator.validateDocumentId(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });

    it("enforces REL-02 pagination cap of max 50", () => {
      let statusCalled = 0;
      const req: any = { query: { limit: "100" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      DocumentValidator.validateQuery(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });
  });

  describe("3. Chat Validation", () => {
    it("rejects missing question", () => {
      let statusCalled = 0;
      const req: any = { body: { sessionId: "sess-1", documentId: "507f1f77bcf86cd799439011", question: "" } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      ChatValidator.validateAskQuestion(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });

    it("rejects question exceeding 1000 chars", () => {
      let statusCalled = 0;
      const req: any = { body: { sessionId: "sess-1", documentId: "507f1f77bcf86cd799439011", question: "a".repeat(1001) } };
      const res: any = {
        status(code: number) { statusCalled = code; return this; },
        json() { return this; }
      };
      let nextCalled = false;
      ChatValidator.validateAskQuestion(req, res, () => { nextCalled = true; });
      assert.equal(statusCalled, 400);
      assert.equal(nextCalled, false);
    });
  });

  describe("4. Redis Request Correlation", () => {
    it("registers and resolves correlated pending requests", async () => {
      const reqId = "test-corr-1";
      const promise = pendingRequests.register(reqId, 5000);
      
      const payload = { answer: "Test response", sources: [] };
      const resolved = pendingRequests.resolve(reqId, payload);
      assert.equal(resolved, true);

      const result = await promise;
      assert.deepEqual(result, payload);
    });

    it("times out pending requests exceeding timeout limit", async () => {
      const reqId = "test-timeout-1";
      const promise = pendingRequests.register(reqId, 50); // 50ms timeout
      
      await assert.rejects(async () => {
        await promise;
      }, (err: any) => {
        return err.statusCode === 504;
      });
    });
  });
});
