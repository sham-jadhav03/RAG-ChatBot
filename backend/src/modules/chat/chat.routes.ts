import express from "express";
import * as chatController from "./chat.controllers.js";
import chatValidator from "./chat.validators.js";

const router = express.Router();

router.post(
  "/ask",
  chatValidator.validateAskQuestion,
  chatController.askQuestionController,
);

router.get(
  "/:sessionId/history",
  chatValidator.validateHistoryQuery,
  chatController.getHistoryController,
);

export default router;
