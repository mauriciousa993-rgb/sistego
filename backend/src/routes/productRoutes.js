const express = require("express");
const multer = require("multer");
const { bulkUploadProducts, listProducts, lowStock, uploadProductImage } = require("../controllers/productController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Catálogo público
router.get("/", listProducts);

// Sugerencia compras por bajo inventario (Admin)
router.get("/low-stock", authenticate, requireRole("Admin"), lowStock);

// Solo Admin puede cargar inventario masivamente.
router.post("/bulk", authenticate, requireRole("Admin"), upload.single("file"), bulkUploadProducts);

// Imagen del producto (Cloudinary)
router.post("/:id/image", authenticate, requireRole("Admin"), uploadImage.single("image"), uploadProductImage);

module.exports = router;
