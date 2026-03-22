const express = require("express");
const multer = require("multer");
const {
  bulkUploadProducts,
  listProducts,
  productsMeta,
  createProduct,
  lowStock,
  exportProductsXlsx,
  catalogPdf,
  uploadProductImage
} = require("../controllers/productController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Catálogo público
router.get("/", listProducts);

// Meta combos (categorías/subcategorías/barcodes)
router.get("/meta", authenticate, requireRole("Vendedor", "Cliente", "Admin", "Bodega"), productsMeta);

// Sugerencia compras por bajo inventario (Admin)
router.get("/low-stock", authenticate, requireRole("Admin"), lowStock);

// Export inventario (Admin)
router.get("/export.xlsx", authenticate, requireRole("Admin"), exportProductsXlsx);

// Catálogo PDF (Vendedor/Cliente/Admin)
router.get("/catalog.pdf", authenticate, requireRole("Vendedor", "Cliente", "Admin"), catalogPdf);

// Crear producto manual (Admin)
router.post("/", authenticate, requireRole("Admin"), createProduct);

// Solo Admin puede cargar inventario masivamente.
router.post("/bulk", authenticate, requireRole("Admin"), upload.single("file"), bulkUploadProducts);

// Imagen del producto (Cloudinary)
router.post("/:id/image", authenticate, requireRole("Admin"), uploadImage.single("image"), uploadProductImage);

module.exports = router;
