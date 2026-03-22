const express = require("express");
const { register, login } = require("../controllers/authController");
const { authenticate, requireRole } = require("../middlewares/auth");
const { isPublicRegisterAllowed } = require("../middlewares/registerPolicy");

const router = express.Router();

// Registro:
// - Permite bootstrap cuando no hay usuarios aún
// - Luego solo Admin autenticado puede crear usuarios
router.post("/register", async (req, res, next) => {
  try {
    const allowed = await isPublicRegisterAllowed();
    if (allowed) return register(req, res);
    return next();
  } catch (err) {
    return res.status(500).json({ message: "Error validando política de registro.", error: err.message });
  }
}, authenticate, requireRole("Admin"), register);
router.post("/login", login);

module.exports = router;
