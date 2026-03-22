const express = require("express");
const multer = require("multer");
const { authenticate, requireRole } = require("../middlewares/auth");
const { listCustomers, createCustomer, updateCustomer } = require("../controllers/customerController");
const { listPayments, createPayment } = require("../controllers/paymentController");
const { parseRutFile } = require("../controllers/rutController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// Vendedor: solo sus clientes; Admin: todos
router.get("/", authenticate, requireRole("Vendedor", "Admin"), listCustomers);
router.post("/", authenticate, requireRole("Vendedor", "Admin"), createCustomer);
router.patch("/:id", authenticate, requireRole("Vendedor", "Admin"), updateCustomer);

// RUT: leer y extraer datos para FE (OpenAI)
router.post("/rut/parse", authenticate, requireRole("Vendedor", "Admin"), upload.single("file"), parseRutFile);

// Pagos / abonos a cartera
router.get("/:id/payments", authenticate, requireRole("Vendedor", "Admin"), listPayments);
router.post("/:id/payments", authenticate, requireRole("Vendedor", "Admin"), createPayment);

module.exports = router;
