const axios = require("axios");
require("dotenv").config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("API Key not found in .env file");
    return;
  }

  try {
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    console.log("Available models:");
    response.data.models.forEach((model) => {
      console.log(`- ${model.name}`);
      console.log(`  Display: ${model.displayName}`);
      console.log(
        `  Supported: ${model.supportedGenerationMethods.join(", ")}`
      );
      console.log("---");
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

listModels();
