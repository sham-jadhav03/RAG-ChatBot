import express from "express";
import { uploadMiddleware } from "./document.service";
import * as documentController from "./document.controller";
import { authenticate, requireAdmin } from "../../middleware/auth.middleware";
import DocumentValidator from "./document.validators";

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
