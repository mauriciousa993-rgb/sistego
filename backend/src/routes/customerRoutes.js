const express = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
const { listCustomers, createCustomer, updateCustomer } = require("../controllers/customerController");

const router = express.Router();

// Vendedor: solo sus clientes; Admin: todos
router.get("/", authenticate, requireRole("Vendedor", "Admin"), listCustomers);
router.post("/", authenticate, requireRole("Vendedor", "Admin"), createCustomer);
router.patch("/:id", authenticate, requireRole("Vendedor", "Admin"), updateCustomer);

module.exports = router;
