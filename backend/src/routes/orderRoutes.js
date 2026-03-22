const express = require("express");
const { dispatchOrder } = require("../controllers/orderController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Solo Bodega puede despachar pedidos.
router.patch("/:id/dispatch", authenticate, requireRole("Bodega"), dispatchOrder);

module.exports = router;
