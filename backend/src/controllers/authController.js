const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, USER_ROLES } = require("../models/User");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET en variables de entorno.");
  return secret;
}

function signToken(user) {
  const payload = { sub: String(user._id), role: user.role, email: user.email };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
}

async function register(req, res) {
  try {
    const { email, password, role, nombre } = req.body || {};
    if (!email || !password || !role) {
      return res.status(400).json({ message: "email, password y role son requeridos." });
    }
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: `role inválido. Usa: ${USER_ROLES.join(", ")}` });
    }

    const existing = await User.findOne({ email: String(email).toLowerCase().trim() }).lean();
    if (existing) return res.status(409).json({ message: "El email ya está registrado." });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      passwordHash,
      role,
      nombre: nombre ? String(nombre).trim() : undefined
    });

    const token = signToken(user);
    return res.status(201).json({ token, user: { id: String(user._id), email: user.email, role: user.role } });
  } catch (err) {
    return res.status(500).json({ message: "Error registrando usuario.", error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "email y password son requeridos." });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: "Credenciales inválidas." });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Credenciales inválidas." });

    const token = signToken(user);
    return res.json({ token, user: { id: String(user._id), email: user.email, role: user.role } });
  } catch (err) {
    return res.status(500).json({ message: "Error iniciando sesión.", error: err.message });
  }
}

module.exports = { register, login };

