const { parseRut } = require("../services/rutParser");
const { uploadRawBuffer } = require("../services/cloudinary");

async function parseRutFile(req, res) {
  try {
    if (!req.file?.buffer) return res.status(400).json({ message: "Archivo requerido (field: file)." });

    const filename = req.file.originalname || "rut";
    const mimetype = req.file.mimetype || "application/octet-stream";

    // Subir a Cloudinary (raw) para conservar soporte
    const publicId = `rut-${req.user?.sub || "unknown"}-${Date.now()}`;
    let uploaded = null;
    try {
      uploaded = await uploadRawBuffer({ buffer: req.file.buffer, publicId, filename, contentType: mimetype });
    } catch {
      // Si Cloudinary no está configurado, igual intentamos parsear con OpenAI
      uploaded = null;
    }

    const extracted = await parseRut({ buffer: req.file.buffer, mimetype, filename });
    return res.json({
      extracted,
      rutUrl: uploaded?.secure_url || uploaded?.url || "",
      rutPublicId: uploaded?.public_id || ""
    });
  } catch (err) {
    return res.status(500).json({ message: "No se pudo leer el RUT.", error: err.message });
  }
}

module.exports = { parseRutFile };

