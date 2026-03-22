const mongoose = require("mongoose");

const USER_ROLES = ["Vendedor", "Bodega", "Admin", "Cliente"];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    nombre: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model("User", userSchema),
  USER_ROLES
};
