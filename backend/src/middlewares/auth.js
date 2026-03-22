const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail-fast para no levantar el server sin secreto.
    throw new Error("Falta JWT_SECRET en variables de entorno.");
  }
  return secret;
}

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Token Bearer requerido." });
    }

    const payload = jwt.verify(token, getJwtSecret());
    req.user = payload; // { sub, role, email }
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido.", error: err.message });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ message: "No autenticado." });
    if (!roles.includes(role)) {
      return res.status(403).json({ message: "No autorizado para este recurso." });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };

