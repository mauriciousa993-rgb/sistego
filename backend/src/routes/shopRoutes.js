const express = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
const { listShopProducts, createShopOrder, listMyShopOrders } = require("../controllers/shopController");

const router = express.Router();

router.get("/products", authenticate, requireRole("Cliente"), listShopProducts);
router.get("/orders", authenticate, requireRole("Cliente"), listMyShopOrders);
router.post("/orders", authenticate, requireRole("Cliente"), createShopOrder);

module.exports = router;
