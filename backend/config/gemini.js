const { GoogleGenAI } = require('@google/genai');

const isGeminiConfigured = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey && apiKey !== 'your_gemini_api_key' && apiKey !== '';
};

let aiClient = null;

if (isGeminiConfigured()) {
  aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
  console.log('\x1b[33m%s\x1b[0m', '==================================================================');
  console.log('\x1b[33m%s\x1b[0m', 'WARNING: GEMINI_API_KEY is not configured in backend/.env');
  console.log('\x1b[33m%s\x1b[0m', 'Gemini analysis tasks will fail until a valid key is provided.');
  console.log('\x1b[33m%s\x1b[0m', '==================================================================');
}

const getAiClient = () => {
  if (!aiClient) {
    if (isGeminiConfigured()) {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } else {
      throw new Error('Gemini API key is not configured. Please add GEMINI_API_KEY to backend/.env');
    }
  }
  return aiClient;
};

const getGeminiModel = () => {
  return process.env.GEMINI_MODEL || 'gemini-3.7-flash';
};

module.exports = {
  getAiClient,
  getGeminiModel,
  isGeminiConfigured,
};
