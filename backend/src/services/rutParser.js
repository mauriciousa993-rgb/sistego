const { getOpenAiClient, getRutModel } = require("./openaiClient");

function toDataUrl(buffer, mimetype) {
  const b64 = buffer.toString("base64");
  return `data:${mimetype};base64,${b64}`;
}

async function parseRut({ buffer, mimetype, filename }) {
  const client = getOpenAiClient();
  const model = getRutModel();

  const isPdf =
    String(mimetype || "").toLowerCase().includes("pdf") ||
    String(filename || "").toLowerCase().endsWith(".pdf");

  const inputContent = isPdf
    ? [
        {
          type: "input_file",
          filename: filename || "rut.pdf",
          file_data: buffer.toString("base64")
        },
        {
          type: "input_text",
          text: "Este archivo es un RUT colombiano. Extrae los datos para facturación electrónica."
        }
      ]
    : [
        {
          type: "input_image",
          image_url: toDataUrl(buffer, mimetype || "image/jpeg")
        },
        {
          type: "input_text",
          text: "Esta imagen es un RUT colombiano. Extrae los datos para facturación electrónica."
        }
      ];

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      nit: { type: "string" },
      dv: { type: "string" },
      razonSocial: { type: "string" },
      nombreComercial: { type: "string" },
      direccion: { type: "string" },
      ciudad: { type: "string" },
      departamento: { type: "string" },
      pais: { type: "string" },
      telefono: { type: "string" },
      email: { type: "string" },
      regimen: { type: "string" },
      responsabilidades: { type: "array", items: { type: "string" } }
    },
    required: [
      "nit",
      "dv",
      "razonSocial",
      "nombreComercial",
      "direccion",
      "ciudad",
      "departamento",
      "pais",
      "telefono",
      "email",
      "regimen",
      "responsabilidades"
    ]
  };

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "user",
        content: [
          ...inputContent,
          {
            type: "input_text",
            text: [
              "Devuelve SOLO JSON válido y estricto con los campos del schema.",
              "Si un campo no se encuentra, usa string vacío o [] según corresponda.",
              "No inventes números: si no está claro, deja vacío."
            ].join("\n")
          }
        ]
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "rut_extract", schema, strict: true }
    }
  });

  const text = response.output_text || "";
  return JSON.parse(text);
}

module.exports = { parseRut };

