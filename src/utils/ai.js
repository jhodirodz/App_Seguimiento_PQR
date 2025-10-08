export async function callGeminiAPI(prompt) {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Error en la API");
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
  } catch (err) {
    console.error("Error AI:", err);
    return `Error IA: ${err.message}`;
  }
}
