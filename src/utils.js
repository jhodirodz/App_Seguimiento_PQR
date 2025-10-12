// src/utils.js

/**
 * Convierte un archivo a formato Base64.
 * @param {File} file - El objeto de archivo a convertir.
 * @returns {Promise<string>} Una promesa que se resuelve con la cadena Base64 del archivo.
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Obtiene la fecha actual en formato 'YYYY-MM-DD' para Colombia.
 * @returns {string} La cadena de fecha formateada.
 */
export const getColombianDateISO = () => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
};

/**
 * Parsea una cadena de fecha de DD/MM/YYYY o MM/DD/YYYY a YYYY-MM-DD.
 * @param {string} dateStr - La cadena de fecha a parsear.
 * @returns {string} La fecha en formato 'YYYY-MM-DD' o la cadena original si falla el parseo.
 */
export const parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    let parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        const year = parts[3];
        return `${year}-${month}-${day}`;
    }
    return dateStr;
};

/**
 * Calcula los días hábiles entre dos fechas.
 * @param {string} startDateStr - La fecha de inicio en formato 'YYYY-MM-DD'.
 * @param {string} endDateStr - La fecha de fin en formato 'YYYY-MM-DD'.
 * @param {Set<string>} nonBusinessDays - Un conjunto de fechas no laborables en formato 'YYYY-MM-DD'.
 * @returns {number|string} Los días hábiles transcurridos o 'N/A' si hay un error.
 */
export const calculateBusinessDays = (startDateStr, endDateStr, nonBusinessDays) => {
    try {
        const startParts = startDateStr.split('-').map(Number);
        const endParts = endDateStr.split('-').map(Number);
        const startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "N/A";
        if (startDate > endDate) return 0;

        let currentDate = new Date(startDate);
        const nonBusinessDaysSet = new Set(nonBusinessDays);

        currentDate.setDate(currentDate.getDate() + 1);
        while (true) {
            const dayOfWeek = currentDate.getDay();
            const dateStr = currentDate.toISOString().slice(0, 10);
            const isNonBusinessDay = nonBusinessDaysSet.has(dateStr);
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isNonBusinessDay) {
                break;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let count = 0;
        let safetyCounter = 0;
        while (currentDate <= endDate && safetyCounter < 10000) {
            const dayOfWeek = currentDate.getDay();
            const dateStr = currentDate.toISOString().slice(0, 10);
            const isNonBusinessDay = nonBusinessDaysSet.has(dateStr);
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isNonBusinessDay) {
                count++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
            safetyCounter++;
        }
        return count;
    } catch (e) {
        console.error("Error en calculateBusinessDays:", e);
        return "N/A";
    }
};

/**
 * Calcula la antigüedad del caso en días hábiles.
 * @param {object} caseItem - El objeto del caso.
 * @param {Set<string>} nonBusinessDays - Un conjunto de fechas no laborables.
 * @returns {number|string} La antigüedad en días o 'N/A'.
 */
export const calculateCaseAge = (caseItem, nonBusinessDays) => {
    if (caseItem.Estado_Gestion === 'Resuelto' || caseItem.Estado_Gestion === 'Finalizado') {
        return caseItem.Dia;
    }
    if (!caseItem || !caseItem['Fecha Radicado']) return 'N/A';
    const startDate = caseItem['Fecha Radicado'];
    const today = getColombianDateISO();
    let age = calculateBusinessDays(startDate, today, nonBusinessDays);
    if (String(caseItem['nombre_oficina'] || '').toUpperCase().includes("OESIA")) {
        if (age !== 'N/A' && !isNaN(age)) {
            age += 2;
        }
    }
    return age;
};

/**
 * Calcula la duración entre dos fechas ISO en minutos.
 * @param {string} startDateISO - La fecha de inicio en formato ISO.
 * @param {string} endDateISO - La fecha de fin en formato ISO.
 * @returns {number|string} La duración en minutos o 'N/A'.
 */
export const getDurationInMinutes = (startDateISO, endDateISO) => {
    if (!startDateISO || !endDateISO) return 'N/A';
    const start = new Date(startDateISO);
    const end = new Date(endDateISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'N/A';
    return Math.round((end.getTime() - start.getTime()) / 60000);
};

/**
 * Pausa la ejecución por un número de milisegundos.
 * @param {number} ms - Milisegundos a esperar.
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Un envoltorio para `fetch` con reintentos de retroceso exponencial.
 * @param {string} url - La URL para la llamada.
 * @param {object} options - Opciones de `fetch`.
 * @param {number} retries - Número de reintentos.
 * @param {number} delay - Retraso inicial en milisegundos.
 * @returns {Promise<Response>}
 */
export const retryFetch = async (url, options, retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            console.warn(`Intento de fetch ${i+1} fallido: ${response.status}. Reintentando...`);
            if (i < retries - 1) await sleep(delay * (i+1) + Math.random() * 500);
        } catch (error) {
            console.error(`Intento de fetch ${i+1} error: ${error.message}. Reintentando...`);
            if (i < retries - 1) await sleep(delay * (i+1) + Math.random() * 500); else throw error;
        }
    }
    throw new Error('Todos los reintentos de fetch fallaron.');
};

/**
 * Parsea una cadena de texto CSV en un array de objetos.
 * Maneja diferentes delimitadores (',' o ';') y campos entre comillas.
 * @param {string} text - El contenido CSV como una cadena.
 * @returns {{headers: string[], data: object[]}} Encabezados y filas de datos analizados.
 */
export const parseCSV = (text) => {
    const headerLineEnd = text.indexOf('\n');
    if (headerLineEnd === -1) return { headers: [], data: [] };
    let headerLine = text.substring(0, headerLineEnd).trim();
    const delimiter = (headerLine.match(/,/g) || []).length >= (headerLine.match(/;/g) || []).length ? ',' : ';';
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = headerLineEnd + 1; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i+1];
        if (inQuotes) {
            if (char === '"' && nextChar !== '"') {
                inQuotes = false;
            } else if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\n') {
                    currentRow.push(currentField);
                    if (currentRow.join('').trim() !== '') {
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentField = '';
                }
            } else {
                currentField += char;
            }
        }
    }
    currentRow.push(currentField);
    if(currentRow.join('').trim() !== '') {
        rows.push(currentRow);
    }
    if (rows.length === 0) {
        return { headers: [], data: [] };
    }
    const headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    const data = [];
    for (const rowData of rows) {
        const row = {};
        headers.forEach((header, index) => {
            if (header && header.trim() !== '') {
                let value = (rowData[index] || '').trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1).replace(/""/g, '"');
                }
                if (header === 'Nro_Nuip_Cliente' && (value.startsWith('8') || value.startsWith('9')) && value.length > 9) {
                    value = value.substring(0, 9);
                } else if (header === 'Nombre_Cliente') {
                    value = value.toUpperCase();
                }
                row[header] = value;
            }
        });
        data.push(row);
    }
    const finalHeaders = headers.filter(h => h && h.trim() !== '');
    return { headers: finalHeaders, data };
};

/**
 * Normaliza un NUIP eliminando guiones y espacios.
 * @param {string} nuip - El NUIP a normalizar.
 * @returns {string} El NUIP normalizado.
 */
export const normalizeNuip = (nuip) => {
    if (!nuip || typeof nuip !== 'string') return '';
    return nuip.split('-')[0].trim();
};

/**
 * Extrae números de reclamo relacionados de un texto de observación.
 * @param {string} obsText - El texto de la observación.
 * @returns {string} El número de reclamo o 'N/A'.
 */
export const extractRelatedComplaintNumber = (obsText) => {
    if (!obsText || typeof obsText !== 'string') return 'N/A';
    const match = obsText.toLowerCase().match(/\b(\d{16}|\d{20})\b/i);
    return match ? (match[1] || 'N/A') : 'N/A';
};

/**
 * Copia texto al portapapeles.
 * @param {string} text - El texto a copiar.
 * @param {string} fieldName - El nombre del campo para el mensaje de confirmación.
 * @param {function} showMessageCallback - Función para mostrar notificaciones.
 */
export const copyToClipboard = (text, fieldName, showMessageCallback) => {
    if (!text) {
        showMessageCallback(`No hay contenido en "${fieldName}" para copiar.`);
        return;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showMessageCallback(`Contenido de "${fieldName}" copiado al portapapeles.`);
    } catch (err) {
        console.error('Error al copiar al portapapeles:', err);
        showMessageCallback(`Error al copiar "${fieldName}". Intenta manualmente.`);
    }
    document.body.removeChild(textArea);
};

/**
 * Extrae correos electrónicos y direcciones físicas de un bloque de texto.
 * @param {string} text - El texto a analizar.
 * @returns {{emails: string[], addresses: string[]}} Un objeto con las direcciones encontradas.
 */
export const extractAddressesFromText = (text) => {
    if (!text || typeof text !== 'string') {
        return { emails: [], addresses: [] };
    }
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const emails = text.match(emailRegex) || [];
    const addressRegex = /(?:calle|cll|carrera|cra|k|avenida|av|transversal|trans|diagonal|diag|dg)\.?\s*[\d\sA-Za-zñÑáéíóúÁÉÍÓÚ#\-\.]+/gi;
    const addresses = text.match(addressRegex) || [];
    return {
        emails: [...new Set(emails)],
        addresses: [...new Set(addresses)]
    };
};

/**
 * Genera un contexto de texto para la API de IA a partir de los datos del caso.
 * @param {object} caseData - El objeto del caso.
 * @returns {string} El contexto de texto formateado.
 */
export const generateAITextContext = (caseData) => {
    const internalHistoryInfo = (caseData.Observaciones_Historial || [])
        .map(obs => ` - Fecha: ${new Date(obs.timestamp).toLocaleString('es-CO')}\n   Observación de gestión: "${obs.text}"`)
        .join('\n\n');
    const accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : []).map((item, index) => 
        `  Reclamo Acumulado ${index + 1}:\n   - SN: ${item.sn} (CUN: ${item.cun || 'No disponible'})\n   - Observación: ${item.obs}`
    ).join('\n');
    const relatedClaimInfo = caseData.Numero_Reclamo_Relacionado && caseData.Numero_Reclamo_Relacionado !== 'N/A' 
        ? `**Reclamo Relacionado (SN: ${caseData.Numero_Reclamo_Relacionado}):**\n   - Observaciones: ${caseData.Observaciones_Reclamo_Relacionado || 'N/A'}\n`
        : 'No hay un reclamo principal relacionado.';
    const textContext = `
    Eres un asistente legal experto en regulaciones de telecomunicaciones colombianas.
    Necesito que me ayudes a redactar una "Proyección de Respuesta" para un cliente.
    La respuesta debe ser exhaustiva, fluida y coherente, y basarse solo en la información que te proporciono a continuación.

    **Instrucciones para la Respuesta:**
    - La respuesta debe abarcar todas las pretensiones y hechos del cliente.
    - Debe dar las razones jurídicas, técnicas o económicas en que se apoya la decisión.
    - Si hay SN/CUN acumulados, respóndelos de forma unificada.
    - Proporciona solo el texto de la respuesta, sin plantillas de formato o JSON.

    ---
    **FUENTES DE INFORMACIÓN DEL CASO:**
    
    **DATOS PRINCIPALES:**
    - SN Principal: ${caseData.SN || 'N/A'} (CUN: ${caseData.CUN || 'N/A'})
    - Observación Inicial del Cliente: "${caseData.obs || 'N/A'}"
    - Tipo de Contrato: ${caseData.Tipo_Contrato || 'N/A'}
    
    **HISTORIAL DE GESTIONES INTERNAS:**
    Este es el registro de los análisis y acciones ya realizadas.
    ${internalHistoryInfo || 'No hay historial de gestiones internas.'}
    
    **HISTORIAL DE RECLAMOS ACUMULADOS:**
    ${accumulatedSNInfo || 'No hay reclamos acumulados.'}
    
    **CONTEXTO ADICIONAL:**
    ${relatedClaimInfo}
    ---
    
    **TU RESPUESTA DEBE COMENZAR A PARTIR DE AQUÍ.**`;
    return textContext;
};
