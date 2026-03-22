const express = require("express");
const {
  dispatchOrder,
  createOrder,
  listOrders,
  getOrder,
  approveOrder,
  cancelOrder
} = require("../controllers/orderController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Crear pedido: Vendedor
router.post("/", authenticate, requireRole("Vendedor"), createOrder);

// Listar / ver pedidos: autenticado
router.get("/", authenticate, requireRole("Vendedor", "Bodega", "Admin"), listOrders);
router.get("/:id", authenticate, requireRole("Vendedor", "Bodega", "Admin"), getOrder);

// Admin aprueba para pasar a bodega
router.patch("/:id/approve", authenticate, requireRole("Admin"), approveOrder);
router.patch("/:id/cancel", authenticate, requireRole("Admin"), cancelOrder);

// Solo Bodega puede despachar pedidos.
router.patch("/:id/dispatch", authenticate, requireRole("Bodega"), dispatchOrder);

module.exports = router;
