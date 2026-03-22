const express = require("express");
const multer = require("multer");
const { listPublicProducts, publicMeta, createPublicOrder } = require("../controllers/marketplaceController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// Público: catálogo
router.get("/products", listPublicProducts);
router.get("/meta", publicMeta);

// Público: checkout (multipart)
router.post(
  "/orders",
  upload.fields([
    { name: "rut", maxCount: 1 },
    { name: "paymentProof", maxCount: 1 }
  ]),
  createPublicOrder
);

module.exports = router;

