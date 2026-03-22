const express = require("express");
const { emitElectronicInvoice } = require("../controllers/invoiceController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Solo Admin puede emitir FE.
router.post("/:orderId/emit", authenticate, requireRole("Admin"), emitElectronicInvoice);

module.exports = router;
