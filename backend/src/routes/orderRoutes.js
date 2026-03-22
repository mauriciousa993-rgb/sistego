const express = require("express");
const { dispatchOrder, createOrder, listOrders, getOrder } = require("../controllers/orderController");
const { authenticate, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Crear pedido: Vendedor
router.post("/", authenticate, requireRole("Vendedor"), createOrder);

// Listar / ver pedidos: autenticado
router.get("/", authenticate, requireRole("Vendedor", "Bodega", "Admin"), listOrders);
router.get("/:id", authenticate, requireRole("Vendedor", "Bodega", "Admin"), getOrder);

// Solo Bodega puede despachar pedidos.
router.patch("/:id/dispatch", authenticate, requireRole("Bodega"), dispatchOrder);

module.exports = router;
