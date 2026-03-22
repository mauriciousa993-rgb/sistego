const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const authRoutes = require("./routes/authRoutes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/invoices", invoiceRoutes);

  // Error handler básico
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // Multer / XLSX / etc.
    return res.status(500).json({ message: "Error inesperado.", error: err.message });
  });

  return app;
}

module.exports = { createApp };
