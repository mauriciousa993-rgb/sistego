const express = require("express");
const { authenticate, requireRole } = require("../middlewares/auth");
const {
  listPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder
} = require("../controllers/purchaseOrderController");

const router = express.Router();

router.get("/", authenticate, requireRole("Admin"), listPurchaseOrders);
router.post("/", authenticate, requireRole("Admin"), createPurchaseOrder);
router.patch("/:id/receive", authenticate, requireRole("Admin"), receivePurchaseOrder);

module.exports = router;
