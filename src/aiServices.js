// src/aiServices.js

// Función de utilidad para manejar la llamada a la API de Gemini
async function geminiApiCall(prompt, parts = []) {
  const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const modelName = "gemini-1.5-flash-001";
  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }, ...parts]
    }]
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}


// Exporta todas las funciones de IA que tu App.jsx está intentando usar.
export async function getAIAnalysisAndCategory(caseData) {
  // Lógica para el análisis y la categoría
  // Por ahora, devuelve valores por defecto para que la aplicación compile
  return { 'Analisis de la IA': 'Análisis no disponible', 'Categoria del reclamo': 'No especificada' };
}

export async function getAIPriority(obs) {
  // Lógica para determinar la prioridad
  return 'Media';
}

export async function getAISentiment(obs) {
  // Lógica para determinar el sentimiento
  return { Sentimiento_IA: 'Neutral' };
}

export async function getAISummary(caseData) {
  // Lógica para generar un resumen
  const prompt = `Genera un resumen de los hechos para el siguiente caso: ${JSON.stringify(caseData)}`;
  return geminiApiCall(prompt);
}

export async function getAIResponseProjection(lastObs, caseData, contractType) {
  // Lógica para la proyección de respuesta
  const prompt = `Genera una proyección de respuesta para un caso de reclamo con las siguientes características:\n\nObservaciones: ${lastObs}\nDatos del caso: ${JSON.stringify(caseData)}\nTipo de Contrato: ${contractType}`;
  return geminiApiCall(prompt);
}

export async function getAINextActions(caseData) {
  // Lógica para sugerir próximas acciones
  const prompt = `Analiza el siguiente caso y sugiere las próximas acciones a tomar:\n\n${JSON.stringify(caseData)}`;
  const result = await geminiApiCall(prompt);
  return result.split('\n').filter(action => action.trim() !== '');
}

export async function getAIRootCause(caseData) {
  // Lógica para identificar la causa raíz
  const prompt = `Identifica la causa raíz del problema para el siguiente caso de reclamo:\n\n${JSON.stringify(caseData)}`;
  return geminiApiCall(prompt);
}

export async function getAIEscalationSuggestion(caseData) {
  // Lógica para sugerir escalación
  const prompt = `Basado en este caso, ¿a qué área debería ser escalado y por qué?:\n\n${JSON.stringify(caseData)}`;
  const result = await geminiApiCall(prompt);
  const areaMatch = result.match(/Área: (.*)/);
  const motivoMatch = result.match(/Motivo: (.*)/);
  return { area: areaMatch ? areaMatch[1] : null, motivo: motivoMatch ? motivoMatch[1] : null };
}

export async function getAIComprehensiveResponse(caseData, contractType) {
  // Lógica para generar una respuesta integral
  const prompt = `Genera una respuesta integral y completa para el cliente sobre el siguiente caso:\n\nDatos del caso: ${JSON.stringify(caseData)}\nTipo de Contrato: ${contractType}`;
  return geminiApiCall(prompt);
}

export async function getAIRiskAnalysis(caseData) {
  // Lógica para analizar el riesgo
  const prompt = `Analiza el riesgo de que el siguiente caso escale a la Superintendencia de Industria y Comercio (SIC) y justifica la respuesta. La respuesta debe tener el formato: "riesgo": "Alto", "justificacion": "El cliente ha expresado insatisfacción y amenaza con escalar a la SIC."`;
  const result = await geminiApiCall(prompt);
  try {
    return JSON.parse(result);
  } catch (e) {
    console.error("Failed to parse AI risk analysis result:", e);
    return { riesgo: 'N/A', justificacion: 'Error al procesar el análisis de riesgo.' };
  }
}

export async function getAIValidation(responseAndCase) {
  // Lógica para validar la respuesta
  const prompt = `Valida si la siguiente respuesta generada para un caso de reclamo es completa y adecuada, justificando la respuesta. La respuesta debe tener el formato: "completa": true/false, "justificacion": "La respuesta es completa porque..."`;
  const result = await geminiApiCall(prompt);
  try {
    return JSON.parse(result);
  } catch (e) {
    console.error("Failed to parse AI validation result:", e);
    return { completa: false, justificacion: 'Error al procesar la validación.' };
  }
}
