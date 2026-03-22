const express = require("express");
const multer = require("multer");
const { bulkUploadProducts } = require("../controllers/productController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Solo Admin puede cargar inventario masivamente.
router.post("/bulk", authenticate, requireRole("Admin"), upload.single("file"), bulkUploadProducts);

module.exports = router;
