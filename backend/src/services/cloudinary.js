const { v2: cloudinary } = require("cloudinary");

function ensureCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName ? "CLOUDINARY_CLOUD_NAME" : null,
      !apiKey ? "CLOUDINARY_API_KEY" : null,
      !apiSecret ? "CLOUDINARY_API_SECRET" : null
    ].filter(Boolean);
    throw new Error(`Cloudinary no configurado. Falta: ${missing.join(", ")}`);
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

function uploadImageBuffer({ buffer, publicId, folder }) {
  ensureCloudinaryConfigured();

  const targetFolder = folder || process.env.CLOUDINARY_FOLDER || "sistego/products";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: targetFolder,
        public_id: publicId,
        overwrite: true
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function deleteByPublicId(publicId) {
  if (!publicId) return;
  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

function uploadRawBuffer({ buffer, publicId, folder, filename, contentType }) {
  ensureCloudinaryConfigured();

  const targetFolder = folder || process.env.CLOUDINARY_FOLDER_RUT || "sistego/rut";

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: targetFolder,
        public_id: publicId,
        overwrite: true,
        filename_override: filename,
        use_filename: true,
        unique_filename: false,
        context: contentType ? { content_type: String(contentType) } : undefined
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function deleteRawByPublicId(publicId) {
  if (!publicId) return;
  ensureCloudinaryConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
}

module.exports = { uploadImageBuffer, deleteByPublicId, uploadRawBuffer, deleteRawByPublicId };
