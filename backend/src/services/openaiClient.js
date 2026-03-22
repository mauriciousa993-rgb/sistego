const OpenAI = require("openai");

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY en variables de entorno.");
  return new OpenAI({ apiKey });
}

function getRutModel() {
  return process.env.OPENAI_MODEL_RUT || "gpt-4o-mini";
}

module.exports = { getOpenAiClient, getRutModel };

