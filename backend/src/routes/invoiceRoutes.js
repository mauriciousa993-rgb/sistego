const express = require("express");
const { emitElectronicInvoice, listInvoices, getInvoice } = require("../controllers/invoiceController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Listado / detalle
router.get("/", authenticate, requireRole("Vendedor", "Cliente", "Admin"), listInvoices);
router.get("/:id", authenticate, requireRole("Vendedor", "Cliente", "Admin"), getInvoice);

// Solo Admin puede emitir FE.
router.post("/:orderId/emit", authenticate, requireRole("Admin"), emitElectronicInvoice);

module.exports = router;
