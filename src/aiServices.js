// src/aiServices.js

// Función de utilidad para manejar la llamada a la API de Gemini
async function geminiApiCall(prompt, parts = [], isJson = false, responseSchema = {}) {
  const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }

  const modelName = "gemini-2.0-flash";
  const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }, ...parts]
    }]
  };
  
  if (isJson) {
    payload.generationConfig = { responseMimeType: "application/json", responseSchema };
  }

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
    if (result.candidates && result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    }
    throw new Error('Respuesta de la IA inesperada. No se encontraron candidatos.');
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

// Exporta todas las funciones de IA
export async function getAIAnalysisAndCategory(caseData) {
  const accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : [])
    .map((item, index) => 
        `Reclamo Acumulado ${index + 1} (SN: ${item.sn}):\n- Observación: ${item.obs}`
    ).join('\n\n');

  const prompt = `Analiza el siguiente caso de reclamo y su historial para proporcionar:
1.  Un "Analisis de la IA" detallado y completo.
2.  Una "Categoria del reclamo" que refleje la problemática principal.

Instrucciones para el Análisis:
-   DEBES considerar la información del "Historial de Reclamos Acumulados" para entender el panorama completo de las pretensiones del cliente. El análisis debe sintetizar tanto el reclamo actual como los anteriores.
-   Menciona explícitamente datos clave como números de cuenta o líneas si están disponibles.

---
DETALLES DEL CASO PRINCIPAL:
-   SN: ${caseData.SN || 'N/A'}
-   Fecha Radicado: ${caseData['Fecha Radicado'] || 'N/A'}
-   Observaciones (obs): ${caseData.obs || 'N/A'}
---
HISTORIAL DE RECLAMOS ACUMULADOS (CONTEXTO ADICIONAL):
${accumulatedSNInfo || 'No hay reclamos acumulados.'}
---

Formato de respuesta JSON:
{
  "analisis_ia": "...",
  "categoria_reclamo": "..."
}`;
  const responseSchema = { type: "OBJECT", properties: { "analisis_ia": { "type": "STRING" }, "categoria_reclamo": { "type": "STRING" } }, "propertyOrdering": ["analisis_ia", "categoria_reclamo"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    const json = JSON.parse(result);
    return { 'Analisis de la IA': json.analisis_ia, 'Categoria del reclamo': json.categoria_reclamo };
  } catch (e) {
    console.error("Error AI analysis:", e);
    return { 'Analisis de la IA': 'Análisis no disponible', 'Categoria del reclamo': 'No especificada' };
  }
}

export async function getAIPriority(obs) {
  const prompt = `Asigna "Prioridad" ("Alta", "Media", "Baja") a obs: ${obs || 'N/A'}. Default "Media". JSON: {"prioridad": "..."}`;
  const responseSchema = { type: "OBJECT", properties: { "prioridad": { "type": "STRING" } }, "propertyOrdering": ["prioridad"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    return JSON.parse(result).prioridad || 'Media';
  } catch (e) {
    console.error("Error AI priority:", e);
    return 'Media';
  }
}

export async function getAISentiment(obs) {
  const prompt = `Analiza el sentimiento del siguiente texto y clasifícalo como "Positivo", "Negativo" o "Neutral".
    Texto: "${obs || 'N/A'}"
    Responde solo con JSON: {"sentimiento_ia": "..."}`;
  const responseSchema = { type: "OBJECT", properties: { "sentimiento_ia": { "type": "STRING" } }, "propertyOrdering": ["sentimiento_ia"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    const json = JSON.parse(result);
    return { Sentimiento_IA: json.sentimiento_ia || 'Neutral' };
  } catch (e) {
    console.error("Error AI sentiment:", e);
    return { Sentimiento_IA: 'Neutral' };
  }
}

export async function getAISummary(caseData) {
  const accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : [])
    .map((item, index) => 
        `Sobre un reclamo anterior (SN: ${item.sn}), también manifesté: "${item.obs}"`
    ).join('\n');
  const prompt = `Eres un asistente experto que resume casos de reclamos de telecomunicaciones.
        Genera un resumen conciso (máximo 700 caracteres, en primera persona) de los hechos y pretensiones del caso.
        Tu resumen debe sintetizar la "Observación Principal" y, si se proporcionan, también el "Historial de SN Acumulados" y las "Observaciones del Reclamo Relacionado".

Instrucciones para el Resumen:
-   Sintetiza la información tanto de las "Observaciones del Caso Actual" como del "Historial de Reclamos Anteriores" en un relato coherente.
-   El resumen DEBE ser específico y mencionar datos clave como la línea o la cuenta si se proporcionan.

---
OBSERVACIONES DEL CASO ACTUAL:
"${caseData.obs || 'No hay observaciones para el caso actual.'}"
---
HISTORIAL DE RECLAMOS ANTERIORES (ACUMULADOS):
${accumulatedSNInfo || 'No hay historial de reclamos anteriores.'}
---
    
Formato de respuesta JSON: {"resumen_cliente": "..."}`;
  const responseSchema = { type: "OBJECT", properties: { "resumen_cliente": { "type": "STRING" } }, "propertyOrdering": ["resumen_cliente"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    return JSON.parse(result).resumen_cliente || 'No se pudo generar resumen.';
  } catch (e) {
    console.error("Error AI summary:", e);
    return 'No generado';
  }
}

export async function getAIResponseProjection(lastObs, caseData, contractType) {
  let contractSpecificInstructions = '';
  if (contractType === 'Contrato Marco') {
    contractSpecificInstructions = `
    **Enfoque Normativo (Contrato Marco):** La respuesta NO DEBE MENCIONAR el Régimen de Protección de Usuarios de Servicios de Comunicaciones (Resolución CRC 5050 de 2016 y sus modificaciones).
    En su lugar, debe basarse en las disposiciones del Código de Comercio colombiano, los términos y condiciones específicos del contrato marco suscrito entre las partes, y la legislación mercantil aplicable.
    NO incluir la frase: "le recordamos que puede acudir a la Superintendencia de Industria y Comercio (SIC)...".`;
  } else { 
    contractSpecificInstructions = `
    **Enfoque Normativo (Condiciones Uniformes):** La respuesta DEBE basarse principalmente en el Régimen de Protección de los Derechos de los Usuarios de Servicios de Comunicaciones (Establecido por la Comisión de Regulación de Comunicaciones - CRC), la Ley 1480 de 2011 (Estatuto del Consumidor) en lo aplicable, y las directrices de la Superintendencia de Industria y Comercio (SIC).`;
  }

  const internalHistoryInfo = (caseData.Observaciones_Historial || [])
    .map(obs => ` - Fecha: ${new Date(obs.timestamp).toLocaleString('es-CO')}\n   Observación de gestión: "${obs.text}"`
    ).join('\n\n');

  const accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : []).map((item, index) => 
    `  Reclamo Acumulado ${index + 1}:\n   - SN: ${item.sn} (CUN: ${item.cun || 'No disponible'})\n   - Observación: ${item.obs}`
  ).join('\n');
    
  const relatedClaimInfo = caseData.Numero_Reclamo_Relacionado && caseData.Numero_Reclamo_Relacionado !== 'N/A' 
    ? `**Reclamo Relacionado (SN: ${caseData.Numero_Reclamo_Relacionado}):**\n   - Observaciones: ${caseData.Observaciones_Reclamo_Relacionado || 'N/A'}\n` 
    : 'No hay un reclamo principal relacionado.';

  const prompt = `Eres un asistente legal experto en regulaciones de telecomunicaciones colombianas.
Genera una 'Proyección de Respuesta' integral para la empresa (COLOMBIA TELECOMUNICACIONES S.A. E.S.P BIC) dirigida al cliente.

**Instrucciones CRÍTICAS para la Proyección de Respuesta:**
1.  **Asociación SN-CUN:** Es mandatorio que cada vez que se mencione un número de radicado (SN), se incluya también su CUN asociado.
2.  **Contexto Completo y Respuesta Definitiva:** La respuesta DEBE sintetizar la información de TODAS las fuentes. Crucialmente, debes basar tu conclusión en las gestiones y hallazgos registrados en el "Historial de Gestiones Internas". La respuesta debe ser **definitiva sobre lo que la empresa ya analizó y decidió, NO una promesa de análisis futuro**.
3.  **Adherencia a los Hechos:** Céntrate ÚNICA Y EXCLUSIVAMENTE en los hechos y pretensiones mencionados. NO introduzcas información o soluciones no mencionadas.
4.  **Sustento Normativo:** Fundamenta CADA PARTE de la respuesta con normas colombianas VIGENTES (SIC, CRC, leyes).
5.  **Formato de Valores Monetarios:** Cuando menciones un valor monetario, el formato exacto debe ser: \`$VALOR (valor en letras pesos) IVA incluido\`. Ejemplo: \`$5.000 (cinco mil pesos) IVA incluido\`.
6.  ${contractSpecificInstructions}

**FUENTES DE INFORMACIÓN A CONSIDERAR:**
---
DATOS DEL CASO PRINCIPAL:
- SN Principal: ${caseData.SN || 'N/A'} (CUN: ${caseData.CUN || 'N/A'})
- Observación Inicial del Cliente (obs): ${caseData.obs || 'N/A'}
- Análisis de la IA (Resumen inicial): ${caseData['Analisis de la IA'] || 'N/A'}
---
CONTEXTO ADICIONAL:
${relatedClaimInfo}
${accumulatedSNInfo ? `---
HISTORIAL DE RECLAMOS ACUMULADOS:
${accumulatedSNInfo}
---` : ''}
---
**HISTORIAL DE GESTIONES INTERNAS (OBSERVACIONES):**
Este es el registro de los análisis y acciones ya realizadas. Basa tu respuesta final en esta información.
${internalHistoryInfo || 'No hay historial de gestiones internas.'}
---

Formato de respuesta JSON: {"proyeccion_respuesta_ia": "..."}`;
  const responseSchema = { type: "OBJECT", properties: { "proyeccion_respuesta_ia": { "type": "STRING" } }, "propertyOrdering": ["proyeccion_respuesta_ia"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    return JSON.parse(result).proyeccion_respuesta_ia || 'No se pudo generar proyección.';
  } catch (e) {
    console.error("Error AI projection:", e);
    return 'No generada';
  }
}

export async function getAINextActions(caseData) {
  const prompt = `Basado en el siguiente caso y su historial, sugiere 3 a 5 acciones concretas y priorizadas para que el agente resuelva el caso.
    Historial:
    ${(caseData.Observaciones_Historial || []).map(obs => `- ${obs.text}`).join('\n')}
    Última observación: ${caseData.Observaciones || 'N/A'}
    Categoría: ${caseData['Categoria del reclamo'] || 'N/A'}
    Análisis IA: ${caseData['Analisis de la IA'] || 'N/A'}

    Responde solo con JSON en el formato: {"acciones": ["Acción 1", "Acción 2", "Acción 3"]}`;
  const responseSchema = { type: "OBJECT", properties: { "acciones": { "type": "ARRAY", "items": { "type": "STRING" } } }, "propertyOrdering": ["acciones"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    const json = JSON.parse(result);
    return json.acciones || [];
  } catch (e) {
    console.error("Error AI Next Actions:", e);
    return [];
  }
}

export async function getAIRootCause(caseData) {
  const prompt = `Analiza el historial completo de este caso RESUELTO y proporciona un análisis conciso de la causa raíz más probable del problema original.
    Historial:
    ${(caseData.Observaciones_Historial || []).map(obs => `- ${obs.text}`).join('\n')}
    Categoría: ${caseData['Categoria del reclamo'] || 'N/A'}
    Análisis IA Inicial: ${caseData['Analisis de la IA'] || 'N/A'}
    Resolución Final: ${caseData.Observaciones || 'N/A'}

    Responde solo con JSON en el formato: {"causa_raiz": "Análisis detallado de la causa raíz..."}`;
  const responseSchema = { type: "OBJECT", properties: { "causa_raiz": { "type": "STRING" } }, "propertyOrdering": ["causa_raiz"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    const json = JSON.parse(result);
    return json.causa_raiz || 'No se pudo determinar la causa raíz.';
  } catch (e) {
    console.error("Error AI Root Cause:", e);
    return 'No se pudo determinar la causa raíz.';
  }
}

export async function getAIEscalationSuggestion(caseData) {
  const prompt = `Basado en los detalles de este caso, sugiere un "Área Escalada" y un "Motivo/Acción Escalado".
Áreas Disponibles: Voz del cliente Individual, Recaudo, Reno Repo, Roaming - Movil, Ajustes, Ventas tienda movistar, Movistar TU - Play, Consultas cobertura, Centrales de riesgo, Retencion, Facturacion, Riesgo operacional, Logistica Comercial, Gestion y soporte, Activaciones, Planes con restriccion, Cartera, Voz del Cliente Pyme, Riesgo Crediticio, Legalizaciones, Televentas, Voz del Cliente Empresas, Modificacion pedidos en vuelo.
Detalles del Caso:
- Observaciones: ${caseData.obs || 'N/A'}
- Categoría Reclamo: ${caseData['Categoria del reclamo'] || 'N/A'}
- Análisis IA: ${caseData['Analisis de la IA'] || 'N/A'}
Responde SOLO con JSON: {"area": "...", "motivo": "..."}`;
  const responseSchema = { type: "OBJECT", properties: { "area": { "type": "STRING" }, "motivo": { "type": "STRING" } }, "propertyOrdering": ["area", "motivo"] };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    return JSON.parse(result);
  } catch (e) {
    console.error("Error en la sugerencia de escalación por IA:", e);
    return { area: null, motivo: null };
  }
}

export async function getAIComprehensiveResponse(caseData, contractType) {
  const internalHistoryInfo = (caseData.Observaciones_Historial || [])
    .map(obs =>
       ` - Observación de gestión: "${obs.text}"`
    ).join('\n\n');

  let contractSpecificInstructions = '';
  if (contractType === 'Contrato Marco') {
    contractSpecificInstructions = `
    **Enfoque Normativo (Contrato Marco):** La respuesta NO DEBE MENCIONAR el Régimen de Protección de Usuarios de Servicios de Comunicaciones (Resolución CRC 5050 de 2016 y sus modificaciones). En su lugar, debe basarse en las disposiciones del Código de Comercio colombiano, los términos y condiciones específicos del contrato marco suscrito entre las partes, y la legislación mercantil aplicable.
    **Citas de Contrato:** En la primera mención, cita el número del contrato marco usando el campo 'Numero_Contrato_Marco'. En menciones posteriores, refiérete a 'Contrato Marco, cláusula X'.`;
  } else { 
    contractSpecificInstructions = `
    **Enfoque Normativo (Condiciones Uniformes):** La respuesta DEBE basarse principalmente en el Régimen de Protección de los Derechos de los Usuarios de Servicios de Comunicaciones (Establecido por la Comisión de Regulación de Comunicaciones - CRC), la Ley 1480 de 2011 (Estatuto del Consumidor) en lo aplicable, y las directrices de la Superintendencia de Industria y Comercio (SIC).`;
  }
  
  const startTemplate = `En la presente damos atención al CUN/SN ${caseData.CUN || caseData.SN} y si es un caso de traslado por competencia SIC, CRC tambien relacionarlo`;
  
  const accumulatedSNInfo = (caseData.SNAcumulados_Historial || []).length > 0
    ? `Adicionalmente, esta respuesta también atiende a los SN/CUN acumulados: ${caseData.SNAcumulados_Historial.map(s => `${s.sn}/${s.cun}`).join(', ')}.`
    : '';

  const prompt = `Eres un asistente legal experto que genera respuestas para clientes de telecomunicaciones.
Tu identidad es Colombia Telecomunicaciones S.A. E.S.P BIC - Movistar.
**Tarea Crítica:** Genera una proyección de respuesta integral para el cliente, que sea exhaustiva, fluida y coherente.
La respuesta debe ser inmediata, no a futuro, y basarse exclusivamente en la información del caso.
**Instrucciones Críticas:**
    1. **Foco en el Servicio:** Revisa el caso e identifica el servicio o línea de reclamo.
Exclusivamente usa cálculos y explicaciones que se refieran a ese servicio.
Ignora otros servicios de la cuenta que no estén relacionados.
2. **Cálculos Precisos:** Si hay un ajuste monetario, muestra la fórmula de cálculo y relaciona el valor que queda posterior a la nota crédito.
Usa solo los valores del "Resumen Financiero" o "Movimiento de Cuenta" que apliquen directamente al reclamo.
3. **Contrato Correcto:**
        ${contractSpecificInstructions}
    4. **Respuesta Completa:**
        - Abarca una respuesta para todas las pretensiones y hechos, y da las razones jurídicas, técnicas o económicas en que se apoya la decisión.
- Si hay SN/CUN acumulados, menciónalos en el primer párrafo y respóndelos de forma unificada.
- Finaliza con un párrafo sobre los saldos pendientes (tomados del movimiento de cuenta), si existen.
5. **Inclusión de Contacto:** Al final de la respuesta, incluye un párrafo indicando que la notificación se realizará a los correos electrónicos y/o direcciones postales que se han validado en el expediente.
**Formato de Salida:** Proporciona solo el texto de la respuesta.
Comienza con la plantilla obligatoria y genera el contenido en párrafos separados por una línea en blanco.
**FUENTES DE INFORMACIÓN:**
    ---
    **DATOS DEL CASO PRINCIPAL:**
    - SN Principal: ${caseData.SN || 'N/A'}
    - CUN: ${caseData.CUN || 'N/A'}
    - Observación Inicial del Cliente (obs): ${caseData.obs || 'N/A'}
    - Tipo de Contrato: ${caseData.Tipo_Contrato || 'N/A'}
    - Número de Contrato Marco: ${caseData.Numero_Contrato_Marco || 'N/A'}

    **HISTORIAL DE GESTIONES INTERNAS:**
    ${internalHistoryInfo || 'No hay historial de gestiones internas.'}

    **HISTORIAL DE RECLAMOS ACUMULADOS:**
    ${accumulatedSNInfo || 'No hay reclamos acumulados.'}

    **FUENTES DE INFORMACIÓN ADICIONAL:**
    - Correos Electrónicos del Cliente: ${caseData.Correo_Electronico_Cliente || 'N/A'}
    - Direcciones del Cliente: ${caseData.Direccion_Cliente || 'N/A'}
    ---

    Comienza tu respuesta ahora, siguiendo este formato estricto:
    ${startTemplate}

    a) Resumen de los hechos (corto y conciso):
    ...

    b) Acciones adelantadas:
    ...

    c) Razones (jurídicas, técnicas o económicas):
    ...

    d) Información sobre recursos y plazos:
    ...


Párrafo de saldos pendientes (si aplica):
    ...`;
  return geminiApiCall(prompt);
}

export async function getAIRiskAnalysis(caseData) {
  const prompt = `
    Evalúa el riesgo de que este caso sea escalado a la Superintendencia de Industria y Comercio (SIC).
    Considera los siguientes factores:
    - Antigüedad del caso (Día): ${caseData.Dia || 'N/A'}
    - Prioridad: ${caseData.Prioridad || 'N/A'}
    - Sentimiento del Cliente (IA): ${caseData.Sentimiento_IA || 'N/A'}
    - Categoría del Reclamo: ${caseData['Categoria del reclamo'] || 'N/A'}
    - Historial de observaciones (si hay palabras como "queja", "demora", "insatisfecho"): ${(caseData.Observaciones_Historial || []).map(o => o.text).join('; ')}

    Responde SOLO con JSON con una puntuación de riesgo ("Bajo", "Medio", "Alto") y una justificación breve.
    Formato: {"riesgo": "...", "justificacion": "..."}
    `;
  const responseSchema = {
    type: "OBJECT",
    properties: {
      "riesgo": { "type": "STRING" },
      "justificacion": { "type": "STRING" }
    },
    "propertyOrdering": ["riesgo", "justificacion"]
  };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    return JSON.parse(result);
  } catch (e) {
    console.error("Error AI Risk Analysis:", e);
    return { riesgo: 'N/A', justificacion: 'Error al procesar el análisis de riesgo.' };
  }
}

export async function getAIValidation(responseAndCase) {
  const prompt = `Eres un cliente que presentó un reclamo. Basado en tus pretensiones originales, lee la 'respuesta de la empresa' y determina si todas tus pretensiones fueron atendidas de manera completa. La favorabilidad de la respuesta no es relevante, solo si se abordó cada punto.

**MIS PRETENSIONES ORIGINALES (hechos del caso):**
- Mi observación inicial: "${responseAndCase.obs || 'N/A'}"
- Historial de reclamos relacionados:
${(Array.isArray(responseAndCase.SNAcumulados_Historial) ? responseAndCase.SNAcumulados_Historial : [])
    .map((item, index) => `- Reclamo anterior (SN ${item.sn}): "${item.obs}"`).join('\n') || 'N/A'}
- Reclamo principal relacionado: ${responseAndCase.Numero_Reclamo_Relacionado || 'N/A'} con observaciones: "${responseAndCase.Observaciones_Reclamo_Relacionado || 'N/A'}"

**RESPUESTA DE LA EMPRESA (Análisis de la IA):**
"${responseAndCase.Respuesta_Integral_IA || 'N/A'}"

**Instrucciones CRÍTICAS:**
1. Lee tu 'observación inicial' y la 'respuesta de la empresa'.
2. Identifica si hay alguna pretensión o punto clave en tu 'observación inicial' que la 'respuesta de la empresa' no haya abordado.
3. Ignora el tono o la favorabilidad de la respuesta; solo concéntrate en la completitud.
4. Si la 'respuesta de la empresa' está vacía, no es válida.
5. Responde con un JSON.
   - Si se abordaron todas las pretensiones, la propiedad 'completa' debe ser 'true' y 'justificacion' una confirmación simple.
   - Si se omitió alguna pretensión, 'completa' debe ser 'false' y 'justificacion' debe detallar qué pretensión no fue atendida.

Formato de respuesta JSON:
{
  "completa": true,
  "justificacion": "..."
}`;
  const responseSchema = {
    type: "OBJECT",
    properties: {
      "completa": { "type": "BOOLEAN" },
      "justificacion": { "type": "STRING" }
    },
    "propertyOrdering": ["completa", "justificacion"]
  };
  try {
    const result = await geminiApiCall(prompt, [], true, responseSchema);
    return JSON.parse(result);
  } catch (e) {
    console.error("Failed to parse AI validation result:", e);
    return { completa: false, justificacion: 'Error al procesar la validación.' };
  }
}
