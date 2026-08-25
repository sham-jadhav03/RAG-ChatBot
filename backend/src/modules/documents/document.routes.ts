import express from "express";
import { uploadMiddleware } from "./document.service.js";
import * as documentController from "./document.controller.js";
import { authenticate, requireAdmin } from "../../middleware/auth.middleware.js";
import DocumentValidator from "./document.validators.js";

const router = express.Router();

router.use(authenticate, requireAdmin);

router.post(
  "/upload",
  uploadMiddleware.single("file"),
  DocumentValidator.validateUpload,
  documentController.uploadController,
);

router.get(
  "/",
  DocumentValidator.validateQuery,
  documentController.listContoller,
);

router.delete(
  "/:id",
  DocumentValidator.validateDocumentId,
  documentController.deleteController,
);

router.get(
  "/:id/reprocess",
  DocumentValidator.validateDocumentId,
  documentController.reprocessController,
);

export default router;
