import express from "express";
import * as chatController from "./chat.controllers.js";
import chatValidator from "./chat.validators.js";
import { chatRateLimiter } from "../../middleware/rateLimiter.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.post(
  "/ask",
  chatRateLimiter,
  chatValidator.validateAskQuestion,
  chatController.askQuestionController,
);

router.get(
  "/:sessionId/history",
  chatValidator.validateHistoryQuery,
  chatController.getHistoryController,
);

export default router;
