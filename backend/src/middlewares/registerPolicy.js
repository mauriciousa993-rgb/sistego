const { User } = require("../models/User");

async function isPublicRegisterAllowed() {
  if (String(process.env.DISABLE_PUBLIC_REGISTER || "").toLowerCase() === "true") return false;
  if (String(process.env.ALLOW_PUBLIC_REGISTER || "").toLowerCase() === "true") return true;
  const count = await User.estimatedDocumentCount();
  return count === 0;
}

module.exports = { isPublicRegisterAllowed };
