// src/utils/ai.js
export const GEMINI_API_KEY = "AIzaSyCHDyifRztWNyrsgHlmPgmCtM2fn3tmR_w";

/**
 * Envía un prompt al modelo Gemini de Google AI.
 * @param {string} prompt - Texto con la instrucción o pregunta.
 * @returns {Promise<string>} - Respuesta generada por la IA.
 */
export async function callGeminiAPI(prompt) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
    const data = await response.json();

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ Sin respuesta de la IA.";
  } catch (error) {
    console.error("❌ Error al conectar con Gemini:", error);
    return "⚠️ Error al conectar con la IA. Intenta más tarde.";
  }
}

