require("dotenv").config();
const mongoose = require("mongoose");
const { createApp } = require("./app");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sistego";
const PORT = process.env.PORT || 4000;

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Mongo connection failed (MONGO_URI=${MONGO_URI}).`);
    // eslint-disable-next-line no-console
    console.error("Tip: levanta Mongo con `docker compose up -d mongo` o ajusta MONGO_URI en backend/.env.");
    throw err;
  }
  const app = createApp();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on :${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
