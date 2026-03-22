const express = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
const { listCustomers, createCustomer, updateCustomer } = require("../controllers/customerController");
const { listPayments, createPayment } = require("../controllers/paymentController");

const router = express.Router();

// Vendedor: solo sus clientes; Admin: todos
router.get("/", authenticate, requireRole("Vendedor", "Admin"), listCustomers);
router.post("/", authenticate, requireRole("Vendedor", "Admin"), createCustomer);
router.patch("/:id", authenticate, requireRole("Vendedor", "Admin"), updateCustomer);

// Pagos / abonos a cartera
router.get("/:id/payments", authenticate, requireRole("Vendedor", "Admin"), listPayments);
router.post("/:id/payments", authenticate, requireRole("Vendedor", "Admin"), createPayment);

module.exports = router;
