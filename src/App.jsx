import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, getDocs, deleteDoc, doc, updateDoc, where, writeBatch, documentId } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

// =================================================================================================
// Global Configuration
// =================================================================================================

// Global variables provided by the Canvas environment. These should not be changed.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


// MODIFICADO: Lee desde variables de entorno si la variable global no está disponible
function firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

function initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Define the specific headers for the main table display
function MAIN_TABLE_HEADERS = [
    'SN',
    'CUN',
    'Fecha Radicado',
    'Dia',
    'Fecha Vencimiento',
    'Nombre_Cliente',
    'Nro_Nuip_Cliente',
    'Tipo_Contrato',
    'Categoria del reclamo',
    'Prioridad',
    'Estado_Gestion'
];

// Define the specific headers for the case details modal's main grid
function MODAL_DISPLAY_HEADERS = [
    'SN', 'CUN', 'Fecha Radicado', 'Fecha Cierre', 'fecha_asignacion', 'user',
    'Estado_Gestion', 'Fecha_Inicio_Gestion', 'Tiempo_Resolucion_Minutos',
    'Radicado_SIC', 'Fecha_Vencimiento_Decreto', 'Dia', 'Fecha Vencimiento',
    'Tipo_Contrato', 'Numero_Contrato_Marco', 'isNabis', 'Nombre_Cliente', 'Nro_Nuip_Cliente', 'Correo_Electronico_Cliente',
    'Direccion_Cliente', 'Ciudad_Cliente', 'Depto_Cliente', 'Nombre_Reclamante',
    'Nro_Nuip_Reclamante', 'Correo_Electronico_Reclamante', 'Direccion_Reclamante',
    'Ciudad_Reclamante', 'Depto_Reclamante', 'HandleNumber', 'AcceptStaffNo',
    'type_request', 'obs', 'Numero_Reclamo_Relacionado',
    'nombre_oficina', 'Tipopago', 'date_add', 'Tipo_Operacion',
    'Prioridad', 'Analisis de la IA', 'Categoria del reclamo', 'Resumen_Hechos_IA', 'Documento_Adjunto',
    'Respuesta_Integral_IA' // AÑADIDO: Nuevo campo para la respuesta robusta
]

// Constants for various dropdowns and logic
function TIPOS_OPERACION_ASEGURAMIENTO = ["Aseguramiento FS", "Aseguramiento TELCO", "Aseguramiento SINTEL", "Aseguramiento D@VOX"];
function TIPOS_ASEGURAMIENTO = [
    "Eliminar cobros facturados (paz y salvo)", "Ajustes to invoice de cartera", "Aprobación envío SMS",
    "Aseguramiento clientes reconectados", "Aseguramiento FS - No cobro RX - RXM", "Calidad de impresión",
    "Cambio de localidad FS", "Carga a tablas FS", "NO Cobros gastos de cobranza",
    "Generar reconexión FS", "Solicitud ajustes cartera", "Validacion inconsistencias / Aplicar DTO",
    "Validación cambio de suscriptor", "Ajustar cobros por aceleración Baseport", "Confirmar BAJA del servicio",
    "Recepción factura electronica", "Recepción factura fisica", "No cobros plataforma Streaming"
];
function MESES_ASEGURAMIENTO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function ESTADOS_TT = ["Pendiente", "Aplicado"];
function ALL_STATUS_OPTIONS = ['Pendiente','Iniciado','Lectura','Resuelto', 'Finalizado', 'Escalado','Decretado','Traslado SIC', 'Pendiente Ajustes'];
function ALL_PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja'];

// UPDATED: Escalation structure based on the provided tree
function MOTIVOS_ESCALAMIENTO_POR_AREA = {
    "Voz del cliente Individual": [
        "Datos Movil - No navega - No tiene equipo para pruebas", "Datos Movil - No navega - Problemas Red", "Datos Movil - No navega - Problemas Cobertura", "Datos Movil - No navega - Inconveniente Atipico-Requiere Pruebas", "Datos Movil - No navega - Conciliacion - Cierre de ciclo", "Datos Movil - No navega - Conciliacion Plataformas HLR-DPI-TI", "Datos Movil - No navega - Escalamiento tecnico abierto excede SLA", "Datos Movil - No navega - Falla en Bonos - Altamira",
        "Datos Movil - Intermitencia - No tiene equipo para pruebas", "Datos Movil - Intermitencia - Problemas Red", "Datos Movil - Intermitencia - Problemas Cobertura", "Datos Movil - Intermitencia - Inconveniente Atipico-Requiere Pruebas", "Datos Movil - Intermitencia - Conciliacion - Cierre de ciclo", "Datos Movil - Intermitencia - Conciliacion Plataformas HLR-DPI-TI", "Datos Movil - Intermitencia - Escalamiento tecnico abierto excede SLA",
        "Datos Movil - Lentitud - No tiene equipo para pruebas", "Datos Movil - Lentitud - Problemas Red", "Datos Movil - Lentitud - Problemas Cobertura", "Datos Movil - Lentitud - Inconveniente Atipico-Requiere Pruebas", "Datos Movil - Lentitud - Conciliacion - Cierre de ciclo", "Datos Movil - Lentitud - Conciliacion Plataformas HLR-DPI-TI", "Datos Movil - Lentitud - Escalamiento tecnico abierto excede SLA",
    ],
    "Recaudo": [
        "Pagos Tienda Movistar - Aplicacion de pago", "Pagos Tienda Movistar - Devolucion de saldo Entidad financiera", "Pagos Tienda Movistar - Devolucion de saldo Tesoreria",
        "Pagos irregulares - Rehabilitacion pagos irregulares medios electronicos", "Recepcion pagos entidades - No aceptacion de pagos a clientes",
        "Titulos valores devueltos - Rehabilitacion linea por devoluciones cheque", "Titulos valores devueltos - Solicitud envio titulo valor",
        "Recargas no efectivas por pago - Solicitud validacion recarga no efectiva con pago", "Carta de pago - Solicitud certificacion de pagos",
        "Inconformidad con pagos - Pago no aplicado", "Inconformidad con pagos - Correccion de pago", "Inconformidad con pagos - Venta cuota correccion de pago", "Inconformidad con pagos - Devolucion de cheque", "Inconformidad con pagos - Pago automatico no aplicado",
    ],
    "Reno Repo": [
        "Activacion reno-repo - Activacion equipo y-o sim para ingreso DOA o PNC",
        "Solicitudes envio equipos y simcard - Solicitud para aprobacion con subsidio por ONE", "Solicitudes envio equipos y simcard - Solicitudes envio equipos y simcard por fallas en Rn",
        "Reclamos reno-repo - Inconsistencias cambio de plan inmediato Reno Rep", "Reclamos reno-repo - Pedidos sin estado de envio", "Reclamos reno-repo - Reclamacion cambio de plan numeral 654 CE", "Reclamos reno-repo - Reclamacion por cobro errado reno-repo a domicilio",
        "Decreto 587 - Solicitud recogida de equipos RenoRepo",
    ],
    "Roaming - Movil": [
        "R - No tiene linea alterna de contacto", "R - Problemas Red", "R - Problemas Cobertura", "R - Inconveniente Atipico-Requiere Pruebas", "R - Conciliacion - Cierre de ciclo", "R - Conciliacion Plataformas HLR-DPI-TI", "R - Escalamiento tecnico abierto excede SLA",
    ],
    "Ajustes": [
        "Ajuste no reflejado en sistema - Explicacion no aplicacion de ajuste",
        "Devolucion de dinero - Cliente no puede reclamar dinero", "Devolucion de dinero - Devolucion dinero no disponible y-o vigente", "Devolucion de dinero - Solicitud soportes transferencia de dinero", "Devolucion de dinero - Explicacion motivo No Procedente",
    ],
    "Ventas tienda movistar": [
        "Reclamos tienda movistar - Reclamo por obsequio no entregado", "Reclamos tienda movistar - Devolucion de saldo", "Reclamos tienda movistar - Linea no activa", "Reclamos tienda movistar - Pago no aplicado tienda Movistar",
        "Informacion contenidos Reno Repo Tienda Movistar", "Fallas precios y planes Reno Repo",
        "Logistica de entrega de equipos - Solicitud de reenvio de equipo",
        "Reclamos tienda movistar interno - Aplicacion de pagos CE", "Reclamos tienda movistar interno - Diferencia en pago", "Reclamos tienda movistar interno - Ventas sin codigo de cliente",
    ],
    "Movistar TU - Play": [
        "Errores de Activacion", "Devolucion dinero", "Informacion comercial de productos y oferta", "Valores del plan no coinciden con oferta", "Direcciones no creadas no georeferenciadas",
    ],
    "Consultas cobertura": [ "Solicitud de cobertura voz y datos", "Inconvenientes cobertura voz y datos" ],
    "Centrales de riesgo": [ "Modificar", "Eliminar", "Pago voluntario", "Pago al dia" ],
    "Retencion": [ "Movil", "Fija", "Solicitud de Baja no realizada" ],
    "Facturacion": [
        "Factura no llega", "Requerimientos especiais - Fecha de vencimientos especiais", "Requerimientos especiais - Cambio de categoria tributaria",
        "Solicitudes STP - Equipos con seguro movil", "Solicitudes STP - Modificaciones de ordenes", "Solicitudes STP - Solicitud de grabacion llamadas fuera de garantia", "Solicitudes STP - traslado equipo apertura bandas (nokia)", "Solicitudes STP - solicitud devolucion equipo abandonado", "Solicitudes STP - Notificar equipo traido", "Solicitudes STP - Gestion novedad ticket Logytech- seg Empresas", "Solicitudes STP - Solicitud de brigada - seg Empresas",
    ],
    "Riesgo operacional": [
        "Pago irregular", "Peticiones en Gestion Fraude - Reconsideracion Peticiones en Gestion Fraude", "Seriales bajo causal fraude",
        "Desmarcacion Clientes Reventa - Estudio Desmarcacion Clientes Reventa", "Prevalidacion Riesgo Crediticio - Prevalidacion nits Riesgo crediticio",
        "Sistema de Verificacion Clientes - Inclusion antecedentes de riesgo operacional", "Sistema de Verificacion Clientes - Revalidacion antecedentes riesgo operacional",
        "Retiro de SVC - Solicitud retiro serie de negativos", "Contingencia rehabilitacion equipo perdido robo - Contingencia rehabilitacion equipo indispo BES",
        "Suspension terminal - Solicitud retiro series de negativos", "Suspension terminal - Contingencia rehabilitacion equipo indispo BES", "Suspension terminal - Suspension Terminal",
        "Hurto de terminales", "Otras solicitudes fraude - Pago irregular", "Otras solicitudes fraude - Seriales bajo causal fraude",
    ],
    "Logistica Comercial": [
        "Ajuste de Inventario - Solicitud Informacion Regularizacion Series", "Solicitud Regularizacion en SAP Series Corporativos",
        "Entrega solicitud actualizacion - Accesorios faltantes", "Entrega solicitud actualizacion - Despiece simcard", "Entrega solicitud actualizacion - Error activacion simcard movil", "Entrega solicitud actualizacion - Explicacion modificacion cancelacion de pedido", "Entrega solicitud actualizacion - Incumplimiento tiempo de entrega", "Entrega solicitud actualizacion - Pedido entregado en forma errada", "Entrega solicitud actualizacion - Reagendamiento por venta a domicilio", "Entrega solicitud actualizacion - Entrega Kit auto instalacion",
        "Devolucion de celulares, accesorios y baterias", "Reversiones de Ventas - Inconsistencias reversion", "Reversiones de Ventas - Solicitud reversion de venta", "Reversiones de Ventas - Reversion del servicio Provisional",
    ],
    "Gestion y soporte": [
        "Revision inconsistencias solicitudes", "Activacion o desactivacion de servicios a corte", "Cambio de plan pos pre a corte", "Inclusiones al corte inclusion hii",
        "Modificaciones cliente road track a corte", "Otros requerimientos a corte", "Traspasos a corte", "Activacion bonos o beneficios inmediato",
        "Activacion o desactivacion de servicios inmediato", "Anulaciones de baja", "Bajas inmediato - Req autorizacion fidelizacion",
        "Cambios de plan a prepago inmediato", "Cargue de incidencias masivas", "Envio de mensajes institucionales", "Otros requerimientos inmediatos",
        "Requerimientos masivos GST - EQ - SC", "Traspasos inmediato - Req autorizacion jefe", "Tribus inmediato", "Alta y baja de svas cargues masivos",
    ],
    "Activaciones": [
        "Solicitud Cambio de Sim", "Solicitud Reno Repo", "Solicitud activacion de servicios M2M", "Cta bloqueado por intentos permitidos en Evidente", "Fallas proceso activacion prepago", "Soporte Portabilidad", "Proceso 728 No Realizado o Errado",
    ],
    "Planes con restriccion": [
        "Reclamaciones STP - Cobros errados por STP", "Reclamaciones STP - Equipos trocados en STP", "Reclamaciones STP - Reclamacion faltante de accesorios", "Reclamaciones STP - Reclamaciones por reingresos", "Reclamaciones STP - Equipo llega sin diagnostico y-o fotos",
    ],
    "Cartera": [
        "Solicitud de Rehabilitacion", "Inmunidades - Ingreso", "Inmunidades - Retiro", "Listas Negras", "Listas Rojas",
        "Inconsistencias Pre-post", "Acuerdos de pago Corporativo", "Venta de Cartera", "Estados de Cuenta Corporativo", "Pqr Masivo", "Ajustes Masivos",
    ],
    "Voz del Cliente Pyme": [ "Facturacion", "Falla de servicios", "Solicitud Comercial Posventa" ],
    "Riesgo Crediticio": [
        "Excepciones Venta Cuotas - Venta", "Excepciones Venta Cuotas - Pos-Venta", "Excepciones de Credito - Venta - Excepcion del Cupo",
    ],
    "Legalizaciones": [
        "Objecion Ventas Sin Legalizar", "Objecion Novedades Reportadas en la Legalizacion", "Solicitud Documentacion Digital PQR", "Usuario Bloqueado por Ventas Sin Legalizar",
        "Solicitud Documentacion Digital MSC", "Objecion Legalizacion Biometrics", "Asesor Bloqueado Herramientas de Activacion",
    ],
    "Televentas": [ "Cambio de plan de Prepago a Pospago Televentas" ],
    "Voz del Cliente Empresas": [ "Facturacion", "Falla de servicios", "Solicitud Comercial Posventa" ],
    "Modificacion pedidos en vuelo": [
        "Cambio de plan BA FMC en terreno", "Cambio de plan BA en terreno", "Decos de mas en terreno", "Decos de menos en terreno", "Baja de SVA", "Cambio de oferta FMC en terreno",
    ],
};
function AREAS_ESCALAMIENTO = Object.keys(MOTIVOS_ESCALAMIENTO_POR_AREA);
// =================================================================================================
// Helper and Utility Functions
// =================================================================================================
// Función para convertir un archivo a formato Base64. Necesaria para procesar imágenes y audio.
function fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        function reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            function base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};

// Nueva función de llamada a la API de Gemini, más genérica.
function geminiApiCall = async (prompt, modelName = "gemini-2.0-flash", isJson = false) => {
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); // Tu API Key
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch };
    if (isJson) {
        payload.generationConfig = { responseMimeType: "application/json" };
    }

    try {
        function response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        function result = await response.json();

        if (response.ok && result.candidates && result.candidates[0].content.parts.length > 0) {
            function responseText = result.candidates[0].content.parts[0].text;
            return isJson ? JSON.parse(responseText) : responseText;
        } else {
            function errorMessage = result.error ? result.error.message : 'Respuesta de API inesperada.';
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error("Error en geminiApiCall:", error);
        throw error;
    }
};

/**
 * Gets the current date in 'YYYY-MM-DD' format for Colombia.
 * @returns {string} The formatted date string.
 */
function getColombianDateISO = () => {
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
function parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '';

    // Intenta analizar formatos como MM/DD/YYYY, M/D/YYYY, etc.
    let parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
        // Asume MM/DD/YYYY y convierte a YYYY-MM-DD
        function month = parts[1].padStart(2, '0');
        function day = parts[2].padStart(2, '0');
        function year = parts[3];
        return `${year}-${month}-${day}`;
    }

    // Si no coincide, devuelve el valor original para no romper otras lógicas
    return dateStr;
};
/**
 * Calcula los días hábiles entre dos fechas.
 * Esta función ajusta el día de inicio si es un fin de semana o festivo, y
 * también ajusta si el inicio es en un día hábil para que el primer día de conteo sea el siguiente.
 */
function calculateBusinessDays = (startDateStr, endDateStr, nonBusinessDays) => {
    try {
        function startParts = startDateStr.split('-').map(Number);
        function endParts = endDateStr.split('-').map(Number);
        function startDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        function endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "N/A";
        if (startDate > endDate) return 0;

        let currentDate = new Date(startDate);
        function nonBusinessDaysSet = new Set(nonBusinessDays);

        // Lógica para encontrar el primer día hábil después de la radicación
        // Se mueve al día siguiente
        currentDate.setDate(currentDate.getDate() + 1);

        // Bucle para encontrar el siguiente día hábil si el día posterior a la radicación cae en fin de semana o festivo
        while (true) {
            function dayOfWeek = currentDate.getDay();
            function dateStr = currentDate.toISOString().slice(0, 10);
            function isNonBusinessDay = nonBusinessDaysSet.has(dateStr);

            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isNonBusinessDay) {
                break;
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        let count = 0;
        let safetyCounter = 0;

        while (currentDate <= endDate && safetyCounter < 10000) {
            function dayOfWeek = currentDate.getDay();
            function dateStr = currentDate.toISOString().slice(0, 10);
            function isNonBusinessDay = nonBusinessDaysSet.has(dateStr);

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
 * La antigüedad es simplemente el resultado de calculateBusinessDays, sin ajustes adicionales.
 */
function calculateCaseAge = (caseItem, nonBusinessDays) => {
    // Si el caso ya está resuelto o finalizado, devuelve el último valor registrado en 'Dia'.
    if (caseItem.Estado_Gestion === 'Resuelto' || caseItem.Estado_Gestion === 'Finalizado') {
        return caseItem.Dia; // O el campo que almacena el conteo final
    }

    if (!caseItem || !caseItem['Fecha Radicado']) return 'N/A';
    function startDate = caseItem['Fecha Radicado'];
    function today = getColombianDateISO();

    let age = calculateBusinessDays(startDate, today, nonBusinessDays);

    if (String(caseItem['nombre_oficina'] || '').toUpperCase().includes("OESIA")) {
        if (age !== 'N/A' && !isNaN(age)) {
            age += 2;
        }
    }

    return age;
};

/**
 * Parses a CSV text string into an array of objects.
 * Handles different delimiters (',' or ';') and quoted fields.
 * @param {string} text - The CSV content as a string.
 * @returns {{headers: string[], data: object[]}} Parsed headers and data rows.
 */
function parseCSV = (text) => {
    function headerLineEnd = text.indexOf('\n');
    if (headerLineEnd === -1) return { headers: [], data: [] };
    let headerLine = text.substring(0, headerLineEnd).trim();
    function delimiter = (headerLine.match(/,/g) || []).length >= (headerLine.match(/;/g) || []).length ? ',' : ';';

    function rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = headerLineEnd + 1; i < text.length; i++) {
        function char = text[i];
        function nextChar = text[i+1];

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

    function headers = headerLine.split(delimiter).map(h => h.trim().replace(/"/g, ''));
    function data = [];

    for (function rowData of rows) {
        function row = {};
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

    function finalHeaders = headers.filter(h => h && h.trim() !== '');

    return { headers: finalHeaders, data };
};


// List of Colombian holidays for calculations.
function COLOMBIAN_HOLIDAYS = [
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-03-20', '2025-03-21', '2025-05-01', '2025-05-26',
    '2025-06-16', '2025-06-23', '2025-07-04', '2025-07-20', '2025-08-07', '2025-08-18', '2025-10-13',
    '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25','2026-01-01', '2026-01-12',   '2026-03-23',   '2026-04-02',  '2026-04-03', '2026-05-01', '2026-05-18',   '2026-06-08',   '2026-06-15',   '2026-06-29',   '2026-07-20',   '2026-08-07',  '2026-08-17',  '2026-10-12',   '2026-11-02',  '2026-11-16',   '2026-12-08',   '2026-12-25',
];


/**
 * Calculates duration between two ISO date strings in minutes.
 * @param {string} startDateISO - The start date in ISO format.
 * @param {string} endDateISO - The end date in ISO format.
 * @returns {number|string} Duration in minutes or 'N/A'.
 */
function getDurationInMinutes = (startDateISO, endDateISO) => {
    if (!startDateISO || !endDateISO) return 'N/A';
    function start = new Date(startDateISO); function end = new Date(endDateISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'N/A';
    return Math.round((end.getTime() - start.getTime()) / 60000);
};

/**
 * A utility to pause execution.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A fetch wrapper with exponential backoff retry logic.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options.
 * @param {number} retries - Number of retries.
 * @param {number} delay - Initial delay in ms.
 * @returns {Promise<Response>}
 */
function retryFetch = async (url, options, retries = 5, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            function response = await fetch(url, options);
            if (response.ok) return response;
            console.warn(`Fetch attempt ${i+1} failed: ${response.status}. Retrying...`);
            if (i < retries - 1) await sleep(delay * (i+1) + Math.random() * 500);
        } catch (error) {
            console.error(`Fetch attempt ${i+1} error: ${error.message}. Retrying...`);
            if (i < retries - 1) await sleep(delay * (i+1) + Math.random() * 500); else throw error;
        }
    }
    throw new Error('All fetch retries failed.');
};

// =================================================================================================
// AI (Gemini) Integration Functions
// =================================================================================================

function getAIAnalysisAndCategory = async (caseData) => {
    // --- INICIO: Lógica para formatear el historial de SN Acumulados ---
function accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : [])
    .map((item, index) => 
        `Reclamo Acumulado ${index + 1} (SN: ${item.sn}):\n- Observación: ${item.obs}`
    ).join('\n\n');
    // --- FIN: Lógica para formatear ---

    function prompt = `Analiza el siguiente caso de reclamo y su historial para proporcionar:
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
    
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "analisis_ia": { "type": "STRING" }, "categoria_reclamo": { "type": "STRING" } }, "propertyOrdering": ["analisis_ia", "categoria_reclamo"] }}};
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); // Tu API Key
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) {
            function json = JSON.parse(res.candidates[0].content.parts[0].text);
            return { 'Analisis de la IA': json.analisis_ia, 'Categoria del reclamo': json.categoria_reclamo };
        }
        throw new Error(res.error?.message || 'Respuesta IA inesperada (análisis).');
    } catch (e) { console.error("Error AI analysis:", e); throw new Error(`Error IA (análisis): ${e.message}`); }
};

function getAIPriority = async (obsText) => {
    function prompt = `Asigna "Prioridad" ("Alta", "Media", "Baja") a obs: ${obsText || 'N/A'}. Default "Media". JSON: {"prioridad": "..."}`;
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "prioridad": { "type": "STRING" } }, "propertyOrdering": ["prioridad"] }}};
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) return JSON.parse(res.candidates[0].content.parts[0].text).prioridad || 'Media';
        throw new Error(res.error?.message || 'Respuesta IA inesperada (prioridad).');
    } catch (e) { console.error("Error AI priority:", e); throw new Error(`Error IA (prioridad): ${e.message}`); }
};

function getAISentiment = async (obsText) => {
    function prompt = `Analiza el sentimiento del siguiente texto y clasifícalo como "Positivo", "Negativo" o "Neutral".
    Texto: "${obsText || 'N/A'}"
    Responde solo con JSON: {"sentimiento_ia": "..."}`;
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "sentimiento_ia": { "type": "STRING" } }, "propertyOrdering": ["sentimiento_ia"] }}};
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) {
            function json = JSON.parse(res.candidates[0].content.parts[0].text);
            return { Sentimiento_IA: json.sentimiento_ia || 'Neutral' };
        }
        throw new Error(res.error?.message || 'Respuesta IA inesperada (sentimiento).');
    } catch (e) {
        console.error("Error AI sentiment:", e);
        return { Sentimiento_IA: 'Neutral' }; // Return a default value on error
    }
};

function getAISummary = async (caseData) => {
    // --- INICIO: Lógica para formatear el historial de SN Acumulados ---
function accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : [])
    .map((item, index) => 
        `Sobre un reclamo anterior (SN: ${item.sn}), también manifesté: "${item.obs}"`
    ).join('\n');
    // --- FIN: Lógica para formatear ---

    function prompt = `Eres un asistente experto que resume casos de reclamos de telecomunicaciones.
        Genera un resumen conciso (máximo 700 caracteres, en primera persona) de los hechos y pretensiones del caso.
        Tu resumen debe sintetizar la "Observación Principal" y, si se proporcionan, también el "Historial de SN Acumulados" y las "Observaciones del Reclamo Relacionado".

Instrucciones para el Resumen:
-   Sintetiza la información tanto de las "Observaciones del Caso Actual" como del "Historial de Reclamos Anteriores" en un relato coherente.
-   El resumen DEBE ser específico y mencionar datos clave como la línea o la cuenta si se proporcionan.

---
OBSERVACIONES DEL CASO ACTUAL:
"${caseData.obs || 'No hay observaciones para el caso actual.'}"
---
HISTORIAL DE RECLAMOS ANTERIOORES (ACUMULADOS):
${accumulatedSNInfo || 'No hay historial de reclamos anteriores.'}
---
    
Formato de respuesta JSON: {"resumen_cliente": "..."}`;

    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "resumen_cliente": { "type": "STRING" } }, "propertyOrdering": ["resumen_cliente"] }}};
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); // Tu API Key
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) return JSON.parse(res.candidates[0].content.parts[0].text).resumen_cliente || 'No se pudo generar resumen.';
        throw new Error(res.error?.message || 'Respuesta IA inesperada (resumen).');
    } catch (e) { console.error("Error AI summary:", e);
    throw new Error(`Error IA (resumen): ${e.message}`); }
};

function getAIResponseProjection = async (lastObservationText, caseData, contractType) => {
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

    // --- LÓGICA MEJORADA ---
    // Se formatea el historial completo de observaciones para que la IA lo entienda claramente.
    function internalHistoryInfo = (caseData.Observaciones_Historial || [])
        .map(obs =>
            ` - Fecha: ${new Date(obs.timestamp).toLocaleString('es-CO')}\n   Observación de gestión: "${obs.text}"`
        ).join('\n\n');

function accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : []).map((item, index) => 
    `  Reclamo Acumulado ${index + 1}:\n   - SN: ${item.sn} (CUN: ${item.cun || 'No disponible'})\n   - Observación: ${item.obs}`
).join('\n');
    
    function relatedClaimInfo = caseData.Numero_Reclamo_Relacionado && caseData.Numero_Reclamo_Relacionado !== 'N/A' 
        ? `**Reclamo Relacionado (SN: ${caseData.Numero_Reclamo_Relacionado}):**\n   - Observaciones: ${caseData.Observaciones_Reclamo_Relacionado || 'N/A'}\n` 
        : 'No hay un reclamo principal relacionado.';

    // --- INSTRUCCIONES DEL PROMPT MEJORADAS ---
    // El prompt ahora es mucho más específico y exige una respuesta definitiva basada en el historial.
    function prompt = `Eres un asistente legal experto en regulaciones de telecomunicaciones colombianas.
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
    
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "proyeccion_respuesta_ia": { "type": "STRING" } }, "propertyOrdering": ["proyeccion_respuesta_ia"] }}};
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); // Tu API Key
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) return JSON.parse(res.candidates[0].content.parts[0].text).proyeccion_respuesta_ia || 'No se pudo generar proyección.';
        throw new Error(res.error?.message || 'Respuesta IA inesperada (proyección).');
    } catch (e) { console.error("Error AI projection:", e);
        throw new Error(`Error IA (proyección): ${e.message}`); }
};

function getAIEscalationSuggestion = async (caseData) => {
    function prompt = `Basado en los detalles de este caso, sugiere un "Área Escalada" y un "Motivo/Acción Escalado".
Áreas Disponibles: ${AREAS_ESCALAMIENTO.join(', ')}.
Razones por Área: ${JSON.stringify(MOTIVOS_ESCALAMIENTO_POR_AREA)}.
Detalles del Caso:
- Observaciones: ${caseData.obs || 'N/A'}
- Categoría Reclamo: ${caseData['Categoria del reclamo'] || 'N/A'}
- Análisis IA: ${caseData['Analisis de la IA'] || 'N/A'}
Responde SOLO con JSON: {"area": "...", "motivo": "..."}`;

    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = { contents: ch, generationConfig: { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "area": { "type": "STRING" }, "motivo": { "type": "STRING" } }, "propertyOrdering": ["area", "motivo"] }}};
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        function response = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]) {
            return JSON.parse(result.candidates[0].content.parts[0].text);
        }
        throw new Error(result.error?.message || 'Respuesta de IA inesperada (sugerencia escalación).');
    } catch (e) {
        console.error("Error en la sugerencia de escalación por IA:", e);
        throw new Error(`Error IA (sugerencia escalación): ${e.message}`);
    }
};

function getAINextActions = async (caseData) => {
    function prompt = `Basado en el siguiente caso y su historial, sugiere 3 a 5 acciones concretas y priorizadas para que el agente resuelva el caso.
    Historial:
    ${(caseData.Observaciones_Historial || []).map(obs => `- ${obs.text}`).join('\n')}
    Última observación: ${caseData.Observaciones || 'N/A'}
    Categoría: ${caseData['Categoria del reclamo'] || 'N/A'}
    Análisis IA: ${caseData['Analisis de la IA'] || 'N/A'}

    Responde solo con JSON en el formato: {"acciones": ["Acción 1", "Acción 2", "Acción 3"]}`;
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = {
        contents: ch,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: { "acciones": { "type": "ARRAY", "items": { "type": "STRING" } } },
                "propertyOrdering": ["acciones"]
            }
        }
    };
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) {
            function json = JSON.parse(res.candidates[0].content.parts[0].text);
            return json.acciones || [];
        }
        throw new Error(res.error?.message || 'Respuesta IA inesperada (siguientes acciones).');
    } catch (e) {
        console.error("Error AI Next Actions:", e);
        throw new Error(`Error IA (siguientes acciones): ${e.message}`);
    }
};

function getAIRootCause = async (caseData) => {
    function prompt = `Analiza el historial completo de este caso RESUELTO y proporciona un análisis conciso de la causa raíz más probable del problema original.
    Historial:
    ${(caseData.Observaciones_Historial || []).map(obs => `- ${obs.text}`).join('\n')}
    Categoría: ${caseData['Categoria del reclamo'] || 'N/A'}
    Análisis IA Inicial: ${caseData['Analisis de la IA'] || 'N/A'}
    Resolución Final: ${caseData.Observaciones || 'N/A'}

    Responde solo con JSON en el formato: {"causa_raiz": "Análisis detallado de la causa raíz..."}`;
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = {
        contents: ch,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: { "causa_raiz": { "type": "STRING" } },
                "propertyOrdering": ["causa_raiz"]
            }
        }
    };
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) {
            function json = JSON.parse(res.candidates[0].content.parts[0].text);
            return json.causa_raiz || 'No se pudo determinar la causa raíz.';
        }
        throw new Error(res.error?.message || 'Respuesta IA inesperada (causa raíz).');
    } catch (e) {
        console.error("Error AI Root Cause:", e);
        throw new Error(`Error IA (causa raíz): ${e.message}`);
    }
};

function getAIEscalationEmail = async (caseData) => {
    function prompt = `
    Redacta un correo electrónico de escalación interna formal y profesional.
    
    Destinatario: ${caseData.areaEscalada || '[Nombre del área]'}
    Asunto: Escalación Caso - SN: ${caseData.SN} - ${caseData['Categoria del reclamo']}

    Cuerpo del correo:
    - Saludo formal.
    - Introducción indicando que se escala el caso.
    - Resumen claro y conciso de los hechos del caso (basado en el análisis de la IA y observaciones).
    - Solicitud o pretensión del cliente.
    - Acción específica requerida del área escalada (basado en el motivo de escalación).
    - Datos clave del caso: SN, CUN, Nombre Cliente, NUIP Cliente.
    - Despedida formal.

    Información del caso:
    - SN: ${caseData.SN || 'N/A'}
    - CUN: ${caseData.CUN || 'N/A'}
    - Nombre Cliente: ${caseData.Nombre_Cliente || 'N/A'}
    - NUIP Cliente: ${caseData.Nro_Nuip_Cliente || 'N/A'}
    - Análisis IA: ${caseData['Analisis de la IA'] || 'N/A'}
    - Resumen Hechos IA: ${caseData.Resumen_Hechos_IA || 'N/A'}
    - Motivo Escalado: ${caseData.motivoEscalado || '[Motivo no especificado]'}
    - Descripción Escalado: ${caseData.descripcionEscalamiento || 'N/A'}
    
    Responde SOLO con JSON: {"email_body": "Cuerpo completo del correo..."}
    `;
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = {
        contents: ch,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: { "email_body": { "type": "STRING" } },
                "propertyOrdering": ["email_body"]
            }
        }
    };
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function response = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]) {
            function json = JSON.parse(result.candidates[0].content.parts[0].text);
            return json.email_body || 'No se pudo generar el correo.';
        }
        throw new Error(result.error?.message || 'Respuesta IA inesperada (email escalación).');
    } catch (e) {
        console.error("Error AI Escalation Email:", e);
        throw new Error(`Error IA (email escalación): ${e.message}`);
    }
};

function getAIRiskAnalysis = async (caseData) => {
    function prompt = `
    Evalúa el riesgo de que este caso sea escalado a la Superintendencia de Industria y Comercio (SIC).
    Considera los siguientes factores:
    - Antigüedad del caso (Día): ${calculateCaseAge(caseData)}
    - Prioridad: ${caseData.Prioridad || 'N/A'}
    - Sentimiento del Cliente (IA): ${caseData.Sentimiento_IA || 'N/A'}
    - Categoría del Reclamo: ${caseData['Categoria del reclamo'] || 'N/A'}
    - Historial de observaciones (si hay palabras como "queja", "demora", "insatisfecho"): ${(caseData.Observaciones_Historial || []).map(o => o.text).join('; ')}

    Responde SOLO con JSON con una puntuación de riesgo ("Bajo", "Medio", "Alto") y una justificación breve.
    Formato: {"riesgo": "...", "justificacion": "..."}
    `;
    let ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = {
        contents: ch,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "riesgo": { "type": "STRING" },
                    "justificacion": { "type": "STRING" }
                },
                "propertyOrdering": ["riesgo", "justificacion"]
            }
        }
    };
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function response = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]) {
            return JSON.parse(result.candidates[0].content.parts[0].text);
        }
        throw new Error(result.error?.message || 'Respuesta IA inesperada (análisis de riesgo).');
    } catch (e) {
        console.error("Error AI Risk Analysis:", e);
        throw new Error(`Error IA (análisis de riesgo): ${e.message}`);
    }
};

function getAIComprehensiveResponse = async (caseData, contractType) => {
    // Formatea el historial completo de observaciones
    function internalHistoryInfo = (caseData.Observaciones_Historial || [])
        .map(obs =>
           ` - Observación de gestión: "${obs.text}"`
        ).join('\n\n');

    let contractSpecificInstructions = '';
    let resourceSectionInstruction = '';
    
    // Nueva lógica: La sección de recursos se adapta al tipo de contrato.
    if (contractType === 'Contrato Marco') {
        contractSpecificInstructions = `
    **Enfoque Normativo (Contrato Marco):** La respuesta NO DEBE MENCIONAR el Régimen de Protección de Usuarios de Servicios de Comunicaciones (Resolución CRC 5050 de 2016 y sus modificaciones). En su lugar, debe basarse en las disposiciones del Código de Comercio colombiano, los términos y condiciones específicos del contrato marco suscrito entre las partes, y la legislación mercantil aplicable.
    **Citas de Contrato:** En la primera mención, cita el número del contrato marco usando el campo 'Numero_Contrato_Marco'. En menciones posteriores, refiérete a 'Contrato Marco, cláusula X'.`;
        
        resourceSectionInstruction = `
        -   **d) Información sobre recursos y plazos:** Esta sección DEBE ser incluida. NO menciones recursos como el de reposición o apelación ante la SIC. En su lugar, informa al cliente que su caso ha sido resuelto conforme al contrato marco y la legislación mercantil, y que tiene el derecho de acudir a los mecanismos de solución de controversias previstos por la ley.`;
    } else { 
        contractSpecificInstructions = `
    **Enfoque Normativo (Condiciones Uniformes):** La respuesta DEBE basarse principalmente en el Régimen de Protección de los Derechos de los Usuarios de Servicios de Comunicaciones (Establecido por la Comisión de Regulación de Comunicaciones - CRC), la Ley 1480 de 2011 (Estatuto del Consumidor) en lo aplicable, y las directrices de la Superintendencia de Industria y Comercio (SIC).`;
        
        resourceSectionInstruction = `
        -   **d) Información sobre recursos y plazos:** Si la decisión es desfavorable al cliente, informa claramente que puede presentar recurso de reposición y en subsidio de apelación, con el plazo legal para hacerlo. Si la decisión es favorable, indica que no procede recurso.`;
    }
    
    // Nueva plantilla de inicio
    function startTemplate = `En la presente damos atención al CUN/SN ${caseData.CUN || caseData.SN} y si es un caso de traslado por competencia SIC, CRC tambien relacionarlo`;
    
    // Lógica para SN acumulados
    function accumulatedSNInfo = (caseData.SNAcumulados_Historial || []).length > 0
        ? `Adicionalmente, esta respuesta también atiende a los SN/CUN acumulados: ${caseData.SNAcumulados_Historial.map(s => `${s.sn}/${s.cun}`).join(', ')}.`
        : '';

    function prompt = `Eres un asistente legal experto que genera respuestas para clientes de telecomunicaciones.
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
5. **Inclusión de Contacto:** Al final de la respuesta, incluye un párrafo indicando que la notificación se realizará a los correos electrónicos y/o direcciones postales que se han validado en el expediente. Cita las direcciones específicas si están disponibles en la sección "FUENTES DE INFORMACIÓN ADICIONAL".
**Formato de Salida:** Proporciona solo el texto de la respuesta.
Comienza con la plantilla obligatoria y genera el contenido en párrafos separados por una línea en blanco.
**FUENTES DE INFORMACIÓN:**
    ---
    **DATOS DEL CASO PRINCIPAL:**
    - SN Principal: ${caseData.SN ||
'N/A'}
    - CUN: ${caseData.CUN || 'N/A'}
    - Observación Inicial del Cliente (obs): ${caseData.obs ||
'N/A'}
    - Tipo de Contrato: ${caseData.Tipo_Contrato ||
'N/A'}
    - Número de Contrato Marco: ${caseData.Numero_Contrato_Marco ||
'N/A'}

    **HISTORIAL DE GESTIONES INTERNAS:**
    ${internalHistoryInfo ||
'No hay historial de gestiones internas.'}

    **HISTORIAL DE RECLAMOS ACUMULADOS:**
    ${accumulatedSNInfo ||
'No hay reclamos acumulados.'}

    **FUENTES DE INFORMACIÓN ADICIONAL:**
    - Correos Electrónicos del Cliente: ${caseData.Correo_Electronico_Cliente || 'N/A'}
    - Direcciones del Cliente: ${caseData.Direccion_Cliente || 'N/A'}
    - Historial de Direcciones Extraídas de Adjuntos: ${JSON.stringify(caseData.Direcciones_Extraidas || [])}
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

    function ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = {
        contents: ch,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: { "respuesta_integral_ia": { "type": "STRING" } }
            }
        }
    };
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); // Tu API Key
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        function r = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function res = await r.json();
        if (r.ok && res.candidates?.[0]?.content?.parts?.[0]) {
            return JSON.parse(res.candidates[0].content.parts[0].text).respuesta_integral_ia || 'No se pudo generar la respuesta integral.';
        }
        throw new Error(res.error?.message || 'Respuesta IA inesperada (respuesta integral).');
    } catch (e) {
        console.error("Error AI comprehensive response:", e);
        throw new Error(`Error IA (respuesta integral): ${e.message}`);
    }
};
function getAIValidation = async (caseData) => {
    // Se prepara un prompt detallado para la IA, pidiéndole que actúe como el cliente.
    function prompt = `Eres un cliente que presentó un reclamo. Basado en tus pretensiones originales, lee la 'respuesta de la empresa' y determina si todas tus pretensiones fueron atendidas de manera completa. La favorabilidad de la respuesta no es relevante, solo si se abordó cada punto.

**MIS PRETENSIONES ORIGINALES (hechos del caso):**
- Mi observación inicial: "${caseData.obs || 'N/A'}"
- Historial de reclamos relacionados:
${(Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : [])
    .map((item, index) => `- Reclamo anterior (SN ${item.sn}): "${item.obs}"`).join('\n') || 'N/A'}
- Reclamo principal relacionado: ${caseData.Numero_Reclamo_Relacionado || 'N/A'} con observaciones: "${caseData.Observaciones_Reclamo_Relacionado || 'N/A'}"

**RESPUESTA DE LA EMPRESA (Análisis de la IA):**
"${caseData.Respuesta_Integral_IA || 'N/A'}"

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

    function ch = [{ role: "user", parts: [{ text: prompt }] }];
    function payload = {
        contents: ch,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    "completa": { "type": "BOOLEAN" },
                    "justificacion": { "type": "STRING" }
                },
                "propertyOrdering": ["completa", "justificacion"]
            }
        }
    };
    function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
    function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        function response = await retryFetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        function result = await response.json();
        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]) {
            return JSON.parse(result.candidates[0].content.parts[0].text);
        }
        throw new Error(result.error?.message || 'Respuesta de IA inesperada (validación).');
    } catch (e) {
        console.error("Error AI Validation:", e);
        throw new Error(`Error IA (validación): ${e.message}`);
    }
};
function generateAITextContext = (caseData) => {
    // Formatea el historial completo de observaciones
    function internalHistoryInfo = (caseData.Observaciones_Historial || [])
        .map(obs => ` - Fecha: ${new Date(obs.timestamp).toLocaleString('es-CO')}\n   Observación de gestión: "${obs.text}"`)
        .join('\n\n');

    // Lógica para SN acumulados
    function accumulatedSNInfo = (Array.isArray(caseData.SNAcumulados_Historial) ? caseData.SNAcumulados_Historial : []).map((item, index) => 
        `  Reclamo Acumulado ${index + 1}:\n   - SN: ${item.sn} (CUN: ${item.cun || 'No disponible'})\n   - Observación: ${item.obs}`
    ).join('\n');

    // Contexto del reclamo relacionado
    function relatedClaimInfo = caseData.Numero_Reclamo_Relacionado && caseData.Numero_Reclamo_Relacionado !== 'N/A' 
        ? `**Reclamo Relacionado (SN: ${caseData.Numero_Reclamo_Relacionado}):**\n   - Observaciones: ${caseData.Observaciones_Reclamo_Relacionado || 'N/A'}\n`
        : 'No hay un reclamo principal relacionado.';

    function textContext = `
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

function extractRelatedComplaintNumber = (obsText) => {
    if (!obsText || typeof obsText !== 'string') return 'N/A';
    function match = obsText.toLowerCase().match(/\b(\d{16}|\d{20})\b/i);
    return match ? (match[1] || 'N/A') : 'N/A';
};

/**
 * Normalizes a NUIP by taking the part before any hyphen.
 * @param {string} nuip - The NUIP string.
 * @returns {string} The normalized NUIP.
 */
function normalizeNuip = (nuip) => {
    if (!nuip || typeof nuip !== 'string') return '';
    return nuip.split('-')[0].trim();
};

function copyToClipboard = (text, fieldName, showMessageCallback) => {
    if (!text) {
        showMessageCallback(`No hay contenido en "${fieldName}" para copiar.`);
        return;
    }
    function textArea = document.createElement('textarea');
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
function extractAddressesFromText = (text) => {
    if (!text || typeof text !== 'string') {
        return { emails: [], addresses: [] };
    }

    // Expresión regular para encontrar correos electrónicos.
    function emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    function emails = text.match(emailRegex) || [];

    // Expresión regular para encontrar direcciones físicas colombianas (simplificada).
    // Busca patrones comunes como "Calle", "Carrera", "Avenida", "Transversal", "Diagonal" seguidos de números.
    function addressRegex = /(?:calle|cll|carrera|cra|k|avenida|av|transversal|trans|diagonal|diag|dg)\.?\s*[\d\sA-Za-zñÑáéíóúÁÉÍÓÚ#\-\.]+/gi;
    function addresses = text.match(addressRegex) || [];

    // Devuelve los resultados únicos para evitar duplicados.
    return {
        emails: [...new Set(emails)],
        addresses: [...new Set(addresses)]
    };
};
// =================================================================================================
// React Components
// =================================================================================================

function PaginatedTable = ({ cases, title, mainTableHeaders, statusColors, priorityColors, selectedCaseIds, handleSelectCase, handleOpenCaseDetails, onScanClick, nonBusinessDays, calculateCaseAge }) => {
    function [currentPage, setCurrentPage] = useState(1);
    function casesPerPage = 10;

    function indexOfLastCase = currentPage * casesPerPage;
    function indexOfFirstCase = indexOfLastCase - casesPerPage;
    function currentCases = cases.slice(indexOfFirstCase, indexOfLastCase);
    function totalPages = Math.ceil(cases.length / casesPerPage);
    function paginate = (pageNumber) => {
        if (pageNumber < 1 || pageNumber > totalPages) return;
        setCurrentPage(pageNumber);
    };

    return (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 px-2 py-1 bg-gray-200 rounded-md">{title} ({cases.length})</h3>
            <div className="overflow-x-auto rounded-lg shadow-md border">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-teal-500">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-4 w-4 text-blue-600"
                                    onChange={(e) => {
                                        function newSelectedIds = new Set(selectedCaseIds);
                                        if (e.target.checked) {
                                            cases.forEach(c => newSelectedIds.add(c.id));
                                        } else {
                                            cases.forEach(c => newSelectedIds.delete(c.id));
                                        }
                                        handleSelectCase(newSelectedIds, true);
                                    }}
                                    checked={cases.length > 0 && cases.every(c => selectedCaseIds.has(c.id))}
                                    disabled={cases.length === 0}
                                />
                            </th>
                            {mainTableHeaders.map(h => <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">{h}</th>)}
                            <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentCases.length > 0 ?
                            currentCases.map(c => (
                            <tr key={c.id} className={`hover:bg-gray-50 ${selectedCaseIds.has(c.id) ? 'bg-blue-50' : (c.Prioridad === 'Alta' ? 'bg-red-100' : '')}`}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox h-4 w-4 text-blue-600"
                                        checked={selectedCaseIds.has(c.id)}
                                        onChange={() => handleSelectCase(c.id)}
                                    />
                                </td>
                                {mainTableHeaders.map(h => {
                                    let v = c[h] || 'N/A';
                                    if (h === 'Nro_Nuip_Cliente' && (!v || v === '0')) v = c.Nro_Nuip_Reclamante || 'N/A';
                                    
                                    // --- LÍNEA CLAVE AÑADIDA ---
                                    if (h === 'Dia') v = calculateCaseAge(c, nonBusinessDays);
                                    // -------------------------

                                    if (h === 'Estado_Gestion') return <td key={h} className="px-6 py-4"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${statusColors[v] || statusColors['N/A']}`}>{v}</span></td>;
                                    if (h === 'Prioridad') return <td key={h} className="px-6 py-4"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${priorityColors[v] || priorityColors['N/A']}`}>{v}</span></td>;
                                    return <td key={h} className="px-6 py-4 whitespace-nowrap text-sm">{v}</td>
                                })}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                    <button onClick={e => { e.stopPropagation(); handleOpenCaseDetails(c); }} className="text-blue-600 hover:text-blue-900">Ver Detalles</button>
                                    {c.Documento_Adjunto && String(c.Documento_Adjunto).startsWith('http') && (
                                        <a href={c.Documento_Adjunto} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-4 text-green-600 hover:text-green-900 font-semibold">
                                            Ver Adjunto
                                        </a>
                                    )}
                                    {c.Documento_Adjunto === "Si_Adjunto" && (
                                        <button onClick={(e) => { e.stopPropagation(); onScanClick(c); }} className="ml-4 text-green-600 hover:text-green-900 font-semibold">
                                            ✨ Escanear Adjunto
                                        </button>
                                    )}
                                </td>
                            </tr>
                            )) : <tr><td colSpan={mainTableHeaders.length + 2} className="p-6 text-center">No hay casos.</td></tr>}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <nav className="mt-4" aria-label="Pagination">
                    <ul className="flex justify-center items-center -space-x-px">
                        <li><button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-2 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50">Anterior</button></li>
                        {[...Array(totalPages).keys()].map(number => (
                            <li key={number + 1}><button onClick={() => paginate(number + 1)} className={`px-3 py-2 leading-tight border border-gray-300 ${currentPage === number + 1 ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700' : 'text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-700'}`}>{number + 1}</button></li>
                        ))}
                        <li><button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-2 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50">Siguiente</button></li>
                    </ul>
                </nav>
            )}
        </div>
    );
};


/**
 * The main application component.
 */
function App() {
// Asegúrate de importar setDoc también si no lo has hecho

function updateCaseInFirestore = async (caseId, newData) => {
    if (!db || !userId) return;
    function docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
    
    try {
        await setDoc(docRef, newData, { merge: true });
        console.log(`Documento con ID ${caseId} actualizado o creado.`);
    } catch (e) {
        console.error("Error al escribir el documento:", e);
        displayModalMessage(`Error al guardar: ${e.message}`);
    }
};
    // State for Firebase services
    function [db, setDb] = useState(null);
    function [auth, setAuth] = useState(null);
    function [userId, setUserId] = useState(null);

    // --------------------------
    // Autenticación integrada
    // --------------------------
    function [authLoading, setAuthLoading] = useState(false);
    function [userRole, setUserRole] = useState(null);
    function [showAuthModal, setShowAuthModal] = useState(false);
    function [authEmail, setAuthEmail] = useState('');
    function [authPassword, setAuthPassword] = useState('');
    function [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

    // Effect: open auth modal if not signed in (and not loading app)
    useEffect(() => {
        if (!loading && !userId) {
            setShowAuthModal(true);
        } else {
            setShowAuthModal(false);
        }
    }, [loading, userId]);

    // When userId changes, fetch role from Firestore
    useEffect(() => {
        function fetchRole = async () => {
            if (!db || !userId) return;
            try {
                function uDoc = doc(db, `artifacts/${appId}/users`, userId);
                function snap = await getDoc(uDoc);
                if (snap && snap.exists()) {
                    function d = snap.data();
                    setUserRole(d.role || 'user');
                } else {
                    setUserRole('user');
                }
            } catch (e) {
                console.error('Error fetching user role:', e);
                setUserRole('user');
            }
        };
        fetchRole();
    }, [db, userId]);

    function signInWithGoogleHandler = async () => {
        if (!auth) { displayModalMessage('Firebase Auth no está listo'); return; }
        setAuthLoading(true);
        try {
            function provider = new GoogleAuthProvider();
            function res = await signInWithPopup(auth, provider);
            function fbUser = res.user;
            setUserId(fbUser.uid);
            // Ensure Firestore user doc exists
            function userDocRef = doc(db, `artifacts/${appId}/users`, fbUser.uid);
            function snap = await getDoc(userDocRef);
            if (!snap || !snap.exists()) {
                await setDoc(userDocRef, {
                    email: fbUser.email || null,
                    displayName: fbUser.displayName || null,
                    role: 'user',
                    createdAt: new Date().toISOString()
                });
                setUserRole('user');
            } else {
                function d = snap.data();
                setUserRole(d.role || 'user');
            }
            displayModalMessage('Inicio de sesión con Google exitoso.');
        } catch (e) {
            console.error('Google signIn error:', e);
            displayModalMessage('Error en inicio con Google: ' + (e.message || e.toString()));
        } finally {
            setAuthLoading(false);
        }
    };

    function registerWithEmail = async () => {
        if (!auth) { displayModalMessage('Firebase Auth no está listo'); return; }
        setAuthLoading(true);
        try {
            function cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
            function fbUser = cred.user;
            // Create user doc in Firestore
            await setDoc(doc(db, `artifacts/${appId}/users`, fbUser.uid), {
                email: authEmail,
                displayName: null,
                role: 'user',
                createdAt: new Date().toISOString()
            });
            setUserId(fbUser.uid);
            setUserRole('user');
            displayModalMessage('Registro exitoso. Bienvenido.');
        } catch (e) {
            console.error('Registro error:', e);
            displayModalMessage('Error al registrar: ' + (e.message || e.toString()));
        } finally {
            setAuthLoading(false);
        }
    };

    function loginWithEmail = async () => {
        if (!auth) { displayModalMessage('Firebase Auth no está listo'); return; }
        setAuthLoading(true);
        try {
            function cred = await signInWithEmailAndPassword(auth, authEmail, authPassword);
            function fbUser = cred.user;
            setUserId(fbUser.uid);
            displayModalMessage('Inicio de sesión exitoso.');
        } catch (e) {
            console.error('Login error:', e);
            displayModalMessage('Error en inicio de sesión: ' + (e.message || e.toString()));
        } finally {
            setAuthLoading(false);
        }
    };

    function logout = async () => {
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
            setUserId(null);
            setUserRole(null);
            displayModalMessage('Sesión cerrada.');
        } catch (e) {
            console.error('Sign out error:', e);
            displayModalMessage('Error al cerrar sesión: ' + (e.message || e.toString()));
        }
    };

    // Admin helper: create user (client-side fallback — NOT recommended for production)
    function createUserAsAdmin = async (email, password, role = 'user') => {
        if (!auth || !userId) { displayModalMessage('No hay sesión activa.'); return { ok: false }; }
        // Check current user's role
        try {
            function currentSnap = await getDoc(doc(db, `artifacts/${appId}/users`, userId));
            if (!currentSnap.exists() || currentSnap.data().role !== 'admin') {
                displayModalMessage('Solo administradores pueden crear usuarios.');
                return { ok: false };
            }
            // WARNING: client-side creation will sign in as the created user.
            function cred = await createUserWithEmailAndPassword(auth, email, password);
            function newUser = cred.user;
            await setDoc(doc(db, `artifacts/${appId}/users`, newUser.uid), {
                email,
                displayName: null,
                role,
                createdAt: new Date().toISOString(),
                createdBy: userId
            });
            displayModalMessage('Usuario creado (cliente). En producción use Cloud Function con Admin SDK.');
            return { ok: true, newUser };
        } catch (e) {
            console.error('createUserAsAdmin error:', e);
            displayModalMessage('Error creando usuario: ' + (e.message || e.toString()));
            return { ok: false, error: e };
        }
    };

    
    // Application status states
    function [loading, setLoading] = useState(true);
    function [refreshing, setRefreshing] = useState(false);
    function [uploading, setUploading] = useState(false);
    
    // Core data state
    function [cases, setCases] = useState([]);
    
    // UI/Modal states
    function [showModal, setShowModal] = useState(false);
    function [modalContent, setModalContent] = useState({ message: '', isConfirm: false, onConfirm: () => {}, confirmText: 'Confirmar', cancelText: 'Cancelar' });
    function [selectedCase, setSelectedCase] = useState(null);
    function [showManualEntryModal, setShowManualEntryModal] = useState(false);
    function [activeModule, setActiveModule] = useState('casos');
    function [currentDateTime, setCurrentDateTime] = useState(new Date());

    // AI-related loading states
    function [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
    function [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    function [isGeneratingResponseProjection, setIsGeneratingResponseProjection] = useState(false);
    function [isSuggestingEscalation, setIsSuggestingEscalation] = useState(false);
    function [isGeneratingNextActions, setIsGeneratingNextActions] = useState(false);
    function [isGeneratingRootCause, setIsGeneratingRootCause] = useState(false);
    function [isGeneratingEscalationEmail, setIsGeneratingEscalationEmail] = useState(false);
    function [isGeneratingRiskAnalysis, setIsGeneratingRiskAnalysis] = useState(false);
    function [isGeneratingComprehensiveResponse, setIsGeneratingComprehensiveResponse] = useState(false);
function [isGeneratingValidation, setIsGeneratingValidation] = useState(false); 
    function [isTranscribingObservation, setIsTranscribingObservation] = useState(false);

    // Filtering and selection states
    function [searchTerm, setSearchTerm] = useState('');
    function [activeFilter, setActiveFilter] = useState('all');
    function [contractFilter, setContractFilter] = useState('todos');
    function [priorityFilter, setPriorityFilter] = useState('todos');
    function [statusFilter, setStatusFilter] = useState('todos');
    function [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
    function [massUpdateTargetStatus, setMassUpdateTargetStatus] = useState('');
    function [isMassUpdating, setIsMassUpdating] = useState(false);
    function [massUpdateObservation, setMassUpdateObservation] = useState('');

    // Form and data entry states
    function initialManualFormData = {
        SN: '', CUN: '', FechaRadicado: '', FechaVencimiento: '', Nro_Nuip_Cliente: '', Nombre_Cliente: '',
        OBS: '', Dia: '', Tipo_Contrato: 'Condiciones Uniformes', Numero_Contrato_Marco: '', isNabis: false,
        Requiere_Aseguramiento_Facturas: false, ID_Aseguramiento: '', Corte_Facturacion: '',
        Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '', Cuenta: '',
        requiereBaja: false, numeroOrdenBaja: '',
        requiereAjuste: false, numeroTT: '', estadoTT: '', requiereDevolucionDinero: false,
        cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '',
        areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', Estado_Gestion: 'Pendiente'
    };
function [reliquidacionData, setReliquidacionData] = useState([{
    id: 1, // Identificador único para cada formulario
    numeroCuenta: '',
    valorMensual: '',
    fechaInicioCiclo: '',
    fechaFinCiclo: '',
    fechaBaja: '',
    montoNotaCredito: null,
}]);
    function [manualFormData, setManualFormData] = useState(initialManualFormData);
    function [duplicateCasesDetails, setDuplicateCasesDetails] = useState([]);
    function [reporteCruceData, setReporteCruceData] = useState([]);

    // File handling states and refs
    function fileInputRef = useRef(null);
    function observationFileInputRef = useRef(null);
    function cancelUpload = useRef(false);
    function [caseToScan, setCaseToScan] = useState(null);
    function [isScanning, setIsScanning] = useState(false);
    function scanFileInputRef = useRef(null);
    function contractMarcoFileInputRef = useRef(null);
    function reporteCruceFileInputRef = useRef(null);
    function nonBusinessDays = new Set(COLOMBIAN_HOLIDAYS);

    // Case detail modal specific states
    function [tieneSNAcumulados, setTieneSNAcumulados] = useState(false);
    function [cantidadSNAcumulados, setCantidadSNAcumulados] = useState(0);
    function [snAcumuladosData, setSnAcumuladosData] = useState([]);
    function [showGestionesAdicionales, setShowGestionesAdicionales] = useState(true);
    function [aseguramientoObs, setAseguramientoObs] = useState('');
function [showAlarmModal, setShowAlarmModal] = useState(false);
    function [alarmCases, setAlarmCases] = useState([]);
    function [alarmObservation, setAlarmObservation] = useState('');
    function [selectedAlarmCase, setSelectedAlarmCase] = useState(null);
function asignadosPorDiaData = useMemo(() => {
        function counts = cases.reduce((acc, caseItem) => {
            function fecha = caseItem.fecha_asignacion || 'Sin Fecha';
            acc[fecha] = (acc[fecha] || 0) + 1;
            return acc;
        }, {});
        return Object.keys(counts).map(fecha => ({
            fecha,
            cantidad: counts[fecha]
        })).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }, [cases]);

    function distribucionPorDiaData = useMemo(() => {
    function pendStates = ['Pendiente','Escalado','Iniciado','Lectura','Traslado SIC','Decretado', 'Pendiente Ajustes'];
    function counts = cases
        .filter(c => pendStates.includes(c.Estado_Gestion))
        .reduce((acc, caseItem) => {
            function dia = calculateCaseAge(caseItem, nonBusinessDays);
            if (dia !== 'N/A' && !isNaN(dia)) {
                function key = `${String(dia).padStart(2, '0')} Días`;
                acc[key] = (acc[key] || 0) + 1;
            }
            return acc;
        }, {});
   return Object.keys(counts).map(dia => ({
        dia,
        cantidad: counts[dia]
    })).sort((a, b) => a.dia.localeCompare(b.dia));
}, [cases]);

function [showCancelAlarmModal, setShowCancelAlarmModal] = useState(false);
function [cancelAlarmCases, setCancelAlarmCases] = useState([]);
function calculateTimePerCaseForDay15 = (allCases) => {
    function timeAvailableInMinutes = 9 * 60; // 9 horas

    // Se usa la función de cálculo en tiempo real
    function pendingDay15Cases = allCases.filter(c => 
        ['Pendiente','Escalado','Iniciado','Lectura','Traslado SIC', 'Decretado', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && 
        calculateCaseAge(c, nonBusinessDays) === 15
    );

    if (pendingDay15Cases.length === 0) {
        // Se busca si hay casos resueltos en día 15 para mostrar el tiempo congelado
        function resolvedCasesWithTime = allCases.filter(c => 
            (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') &&
            calculateCaseAge(c, nonBusinessDays) === 15 &&
            c.Tiempo_Gestion_Dia15_Congelado
        );
        if (resolvedCasesWithTime.length > 0) {
            return resolvedCasesWithTime[0].Tiempo_Gestion_Dia15_Congelado;
        }
        return 'No hay casos en Día 15.';
    }

    function timePerCase = timeAvailableInMinutes / pendingDay15Cases.length;
    return `~${timePerCase.toFixed(2)} minutos por caso`;
};
    function timePerCaseDay15 = useMemo(
        () => calculateTimePerCaseForDay15(cases), 
        [cases, calculateTimePerCaseForDay15]
    );
function checkCancellationAlarms = useCallback(() => {
    function today = new Date();
    function todayISO = getColombianDateISO();
    
    function casesToAlert = cases.filter(caseItem => {
        // Check if the AI category includes "cancelación" or "prepago"
        function isCancellationRelated = String(caseItem['Categoria del reclamo'] || '').toLowerCase().includes('cancelacion') ||
                                      String(caseItem['Categoria del reclamo'] || '').toLowerCase().includes('prepago');
        
        if (!isCancellationRelated) {
            return false;
        }

        // Extract cut-off day from `Corte_Facturacion`
        function cutOffDay = parseInt(caseItem.Corte_Facturacion);
        if (isNaN(cutOffDay) || cutOffDay < 1 || cutOffDay > 31) {
            return false;
        }

        function alertShownKey = `cancelAlarmShown_${caseItem.id}_${todayISO}`;
        if (sessionStorage.getItem(alertShownKey)) {
            return false;
        }

        // Get the upcoming cut-off date
        let nextCutOffDate = new Date(today.getFullYear(), today.getMonth(), cutOffDay);
        
        // If today is after the cut-off day, use the next month's cut-off
        if (today.getDate() > cutOffDay) {
            nextCutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, cutOffDay);
        }
        
        // Calculate 3 business days before the cut-off date
        function daysToSubtract = 3;
        function threeBusinessDaysBefore = new Date(nextCutOffDate);
        let businessDaysCount = 0;
        let tempDate = new Date(nextCutOffDate);

        while (businessDaysCount < daysToSubtract) {
            tempDate.setDate(tempDate.getDate() - 1);
            function dayOfWeek = tempDate.getDay();
            function dateStr = tempDate.toISOString().slice(0, 10);
            function isNonBusinessDay = nonBusinessDays.has(dateStr);

            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isNonBusinessDay) {
                businessDaysCount++;
            }
        }

        function alertDate = tempDate;
        function todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        return todayWithoutTime.getTime() === alertDate.getTime();
    });

    if (casesToAlert.length > 0) {
        setCancelAlarmCases(casesToAlert);
        setShowCancelAlarmModal(true);
    }
}, [cases, nonBusinessDays, getColombianDateISO]);
// Función para el manejo de cambios en los campos de entrada
function handleReliquidacionChange = (index, e) => {
    function { name, value } = e.target;
    setReliquidacionData(prev => {
        function newForms = [...prev];
        newForms[index][name] = value;
        return newForms;
    });
};

function handleAddForm = () => {
    function newId = reliquidacionData.length > 0 ? Math.max(...reliquidacionData.map(f => f.id)) + 1 : 1;
    setReliquidacionData(prev => [...prev, {
        id: newId,
        numeroCuenta: '',
        valorMensual: '',
        fechaInicioCiclo: '',
        fechaFinCiclo: '',
        fechaBaja: '',
        montoNotaCredito: null,
    }]);
};

function handleRemoveForm = (idToRemove) => {
    setReliquidacionData(prev => prev.filter(form => form.id !== idToRemove));
};

// Función de cálculo principal
function calcularNotaCredito = async () => {
    // Validar que hay un caso seleccionado
    if (!selectedCase) {
        displayModalMessage("Error: No hay un caso seleccionado para actualizar.");
        return;
    }

    function newForms = reliquidacionData.map(form => {
        function { numeroCuenta, fechaInicioCiclo, fechaFinCiclo, fechaBaja, valorMensual } = form;

        // Validaciones internas de cada formulario
        if (!numeroCuenta || !fechaInicioCiclo || !fechaFinCiclo || !fechaBaja || !valorMensual) {
            displayModalMessage(`Por favor, complete todos los campos para la cuenta ${numeroCuenta || 'sin nombre'}.`);
            return form;
        }

        function start = new Date(fechaInicioCiclo + 'T00:00:00-05:00');
        function end = new Date(fechaFinCiclo + 'T00:00:00-05:00');
        function baja = new Date(fechaBaja + 'T00:00:00-05:00');

        if (isNaN(start) || isNaN(end) || isNaN(baja)) {
            displayModalMessage("Una de las fechas ingresadas no es válida.");
            return form;
        }

        if (baja < start || baja > end) {
            displayModalMessage(`La fecha de baja debe estar dentro del ciclo de facturación para la cuenta ${numeroCuenta}.`);
            return form;
        }

        function diasTotales = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
        function diasAReliquidar = (end.getTime() - baja.getTime()) / (1000 * 60 * 60 * 24) + 1;
        function valorDiario = parseFloat(valorMensual) / diasTotales;
        function monto = valorDiario * diasAReliquidar;

        return { ...form, montoNotaCredito: monto.toFixed(2) };
    });

    setReliquidacionData(newForms);

    // Formatear el texto de la observación para el historial
    function newObservationText = newForms.map(form =>
        `Cálculo de nota de crédito para Cuenta ${form.numeroCuenta}:\n- Ciclo: ${form.fechaInicioCiclo} a ${form.fechaFinCiclo}\n- Fecha de baja: ${form.fechaBaja}\n- Valor mensual: $${form.valorMensual}\n- Monto a reliquidar: $${form.montoNotaCredito}`
    ).join('\n\n');

    function newHistoryEntry = {
        text: newObservationText,
        timestamp: new Date().toISOString(),
    };
    
    // Preparar la actualización del historial
    function updatedHistory = [...(selectedCase.Observaciones_Historial || []), newHistoryEntry];
    
    // Llamar a la función para actualizar el documento en Firestore
    await updateCaseInFirestore(selectedCase.id, { Observaciones_Historial: updatedHistory });
    
    // Opcional: Actualizar el estado local para reflejar el cambio inmediatamente
    // Esta línea asegura que el modal muestre el historial actualizado sin tener que cerrar y abrir
    setSelectedCase(prev => ({
        ...prev,
        Observaciones_Historial: updatedHistory
    }));

    displayModalMessage("Cálculo de nota de crédito completado y guardado en el historial.");
};
    function statusColors = {
        'Pendiente':'bg-yellow-200 text-yellow-800', 'Resuelto':'bg-green-200 text-green-800',
        'Finalizado': 'bg-gray-500 text-white', 'Escalado':'bg-red-200 text-red-800',
        'Iniciado':'bg-indigo-200 text-indigo-800', 'Lectura':'bg-blue-200 text-blue-800',
        'Decretado':'bg-purple-200 text-purple-800', 'Traslado SIC':'bg-orange-600 text-white',
        'Pendiente Ajustes': 'bg-pink-200 text-pink-800', 'N/A':'bg-gray-200 text-gray-800'
    };
    function priorityColors = {'Alta':'bg-red-500 text-white','Media':'bg-orange-400 text-white','Baja':'bg-blue-400 text-white','N/A':'bg-gray-400 text-white'};

    // Memoized modal display functions to prevent re-renders
    function displayModalMessage = useCallback((message) => {
        setModalContent({ message, isConfirm: false, onConfirm: () => {} });
        setShowModal(true);
    }, []);

    function displayConfirmModal = useCallback((message, { onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) => {
        setModalContent({
            message, isConfirm: true,
            onConfirm: onConfirm || (() => {}),
            onCancel: onCancel || (() => setShowModal(false)),
            confirmText, cancelText
        });
        setShowModal(true);
    }, []);
// A good place for the useEffect hook would be here, after all state declarations.
useEffect(() => {
    // Evita cargar el script varias veces si el componente se re-renderiza
    if (document.getElementById('pdfjs-script')) return; 

    function script = document.createElement('script');
    script.id = 'pdfjs-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
    script.onload = () => {
        // Configura el worker source una vez que la librería se ha cargado
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
        console.log("pdf.js loaded and worker configured.");
    };
    document.body.appendChild(script);

    return () => {
        // Elimina el script cuando el componente se desmonte para evitar fugas de memoria
        function scriptTag = document.getElementById('pdfjs-script');
        if (scriptTag) {
            document.body.removeChild(scriptTag);
        }
    };
}, []);
    // --- EFFECT: Initialize Firebase and set up auth listener ---
    // This runs once, sets up persistence, and then listens for auth changes.
    // The listener itself handles the sign-in logic if no user is found.
    useEffect(() => {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            console.error("Firebase configuration is missing.");
            displayModalMessage("Error: La configuración de Firebase no está disponible.");
            setLoading(false);
            return;
        }

        function app = initializeApp(firebaseConfig);
        function authInstance = getAuth(app);
        function dbInstance = getFirestore(app);
        
        setDb(dbInstance);
        setAuth(authInstance);

        function authStateUnsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                // A user is signed in (either from persistence, or a fresh sign-in).
                setUserId(user.uid);
                setLoading(false);
            } else {
                // No user is signed in. We need to attempt a sign-in.
                try {
                    await setPersistence(authInstance, browserLocalPersistence);
                    
                    if (initialAuthToken) {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                } catch (error) {
                    console.warn(`Initial sign-in method failed: ${error.code}.`);
                    
                    if (initialAuthToken && (error.code === 'auth/invalid-custom-token' || error.code === 'auth/invalid-claims')) {
                        console.warn("Falling back to anonymous sign-in due to invalid custom token.");
                        try {
                            await signInAnonymously(authInstance);
                        } catch (anonError) {
                            console.error("CRITICAL: Fallback anonymous sign-in also failed.", anonError);
                            displayModalMessage(`Error de Autenticación Crítico: ${anonError.message}`);
                            setLoading(false);
                        }
                    } else {
                        console.error("CRITICAL: Authentication has failed completely.", error);
                        displayModalMessage(`Error de Autenticación Crítico: ${error.message}`);
                        setLoading(false);
                    }
                }
            }
        });

        // Cleanup the listener when the component unmounts.
        return () => authStateUnsubscribe();

    }, [displayModalMessage]);


    // --- EFFECT: Fetch and listen for case data from Firestore ---
    // This effect runs only when `db` or `userId` is established.
    useEffect(() => {
        if (!db || !userId) return; // Wait for Firebase services and user to be ready

        function q = query(collection(db, `artifacts/${appId}/users/${userId}/cases`));
        function unsub = onSnapshot(q, async snapshot => {
            let fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // One-time data migration logic for user 'jediazro'
            function updates = fetched.filter(c => c.user === 'jediazro' && c.user !== userId).map(c => updateDoc(doc(db, `artifacts/${appId}/users/${userId}/cases`, c.id), { user: userId }));
            if (updates.length > 0) {
                await Promise.all(updates).catch(e => console.error("Auto-assign error:", e));
            }

            // Sort cases by date or ID
            fetched.sort((a,b) => (new Date(b['Fecha Radicado'] || 0)) - (new Date(a['Fecha Radicado'] || 0) || a.id.localeCompare(b.id)));
            
            setCases(fetched);
            setRefreshing(false);
        }, e => {
            console.error("Fetch cases error (onSnapshot):", e);
            displayModalMessage(`Error cargando los casos: ${e.message}`);
            setRefreshing(false);
        });

        return () => unsub(); // Cleanup listener on unmount
    }, [db, userId, appId, displayModalMessage]);

    // --- EFFECT: Automatically finalize simple 'Resuelto' cases ---
useEffect(() => {
    if (!db || !userId || cases.length === 0) return;

    function casesToFinalize = cases.filter(c => {
        // Caso 'Resuelto' que no requiere gestiones adicionales
        function simpleResolved = c.Estado_Gestion === 'Resuelto' && 
                               !c.Requiere_Aseguramiento_Facturas && 
                               !c.requiereBaja && 
                               !c.requiereAjuste;
        
        // Caso 'Resuelto' que sí requería gestiones adicionales y ya las tiene completadas
        function complexResolvedAndCompleted = c.Estado_Gestion === 'Resuelto' &&
                                           (c.Requiere_Aseguramiento_Facturas || c.requiereBaja || c.requiereAjuste) &&
                                           c.gestionAseguramientoCompletada;

        return simpleResolved || complexResolvedAndCompleted;
    });

    if (casesToFinalize.length > 0) {
        function batch = writeBatch(db);
        casesToFinalize.forEach(caseItem => {
            function caseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseItem.id);
            batch.update(caseRef, { Estado_Gestion: 'Finalizado' });
        });

        batch.commit().catch(error => {
            console.error("Error finalizing cases automatically:", error);
            displayModalMessage(`Error al finalizar casos automáticamente: ${error.message}`);
        });
    }
}, [cases, db, userId, appId, displayModalMessage]);

    function forceRefreshCases = async () => {
        if (!db || !userId) {
            displayModalMessage("Base de datos no disponible o usuario no autenticado.");
            return;
        }
        setRefreshing(true);
        displayModalMessage("Actualizando lista de casos...");
        try {
            function collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
            function snapshot = await getDocs(collRef);
            function fetchedCases = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            fetchedCases.sort((a,b) => (new Date(b['Fecha Radicado'] || 0)) - (new Date(a['Fecha Radicado'] || 0) || a.id.localeCompare(b.id)));
            setCases(fetchedCases);
            displayModalMessage("Lista de casos actualizada.");
        } catch (error) {
            console.error("Error during manual refresh:", error);
            displayModalMessage(`Error al actualizar casos: ${error.message}`);
        } finally {
            setRefreshing(false);
        }
    };


    useEffect(() => {
        if (cases.length > 0 && !sessionStorage.getItem('decretadoAlarmShown')) {
            function today = new Date(); today.setHours(0,0,0,0);
            function twoDaysHence = new Date(today); twoDaysHence.setDate(today.getDate()+2); twoDaysHence.setHours(23,59,59,999);
            function expiring = cases.filter(c => c.Estado_Gestion === 'Decretado' && c.Fecha_Vencimiento_Decreto && new Date(c.Fecha_Vencimiento_Decreto) >= today && new Date(c.Fecha_Vencimiento_Decreto) <= twoDaysHence);
            if (expiring.length > 0) {
                displayModalMessage(`ALERTA! Casos "Decretados" próximos a vencer:\n${expiring.map(c=>`SN: ${c.SN}, Vence: ${c.Fecha_Vencimiento_Decreto}`).join('\n')}`);
                sessionStorage.setItem('decretadoAlarmShown', 'true');
            }
        }
    }, [cases, displayModalMessage]);

    useEffect(() => {
        function checkIniciadoCases = () => {
            function now = new Date().toISOString();
            cases.forEach(caseItem => {
                if (caseItem.Estado_Gestion === 'Iniciado' && caseItem.Fecha_Inicio_Gestion) {
                    function duration = getDurationInMinutes(caseItem.Fecha_Inicio_Gestion, now);
                    if (duration !== 'N/A' && duration > 45) {
                        function alertShownKey = `iniciadoAlertShown_${caseItem.id}`;
                        if (!sessionStorage.getItem(alertShownKey)) {
                            displayModalMessage(`¡ALERTA! El caso SN: ${caseItem.SN} (CUN: ${caseItem.CUN || 'N/A'}) ha estado en estado "Iniciado" por más de 45 minutos.`);
                            sessionStorage.setItem(alertShownKey, 'true');
                        }
                    }
                }
            });
        };
        function intervalId = setInterval(checkIniciadoCases, 30000);
        return () => clearInterval(intervalId);
    }, [cases, displayModalMessage]);
useEffect(() => {
    if (cases.length === 0) return;
    
    function timerId = setInterval(checkCancellationAlarms, 60000); // Check every 60 seconds
    checkCancellationAlarms(); // Initial check on component mount

    return () => clearInterval(timerId); // Cleanup on unmount
}, [cases, checkCancellationAlarms]);

    useEffect(() => { function timer = setInterval(() => setCurrentDateTime(new Date()), 1000); return () => clearInterval(timer); }, []);
useEffect(() => {
        if (cases.length === 0) return;

        function checkAlarms = () => {
            function todayISO = getColombianDateISO();
            function casesToAlert = cases.filter(c => {
                function caseId = c.id;
                function alarmKey = `alarm_dismissed_${caseId}_${todayISO}`;

                // Si la alarma para este caso ya fue cerrada hoy, no la mostramos.
                if (sessionStorage.getItem(alarmKey)) {
                    return false;
                }

                function dia = calculateCaseAge(c, nonBusinessDays);
                if (isNaN(dia)) return false;

                function isTrasladoSIC = c.Estado_Gestion === 'Traslado SIC' && dia >= 3;
                function isDecretado = c.Estado_Gestion === 'Decretado' && dia >= 7;

                return isTrasladoSIC || isDecretado;
            });

            if (casesToAlert.length > 0) {
                setAlarmCases(casesToAlert);
                setShowAlarmModal(true);
            }
        };

        // Revisa las alarmas 5 segundos después de que los casos se carguen.
        function timer = setTimeout(checkAlarms, 5000);
        return () => clearTimeout(timer);

    }, [cases]);

function handleFileUpload = async (event) => {
    function file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    cancelUpload.current = false;
    function reader = new FileReader();
    reader.onload = async (e) => {
        try {
            function { data: csvDataRows } = parseCSV(e.target.result);
            if (csvDataRows.length === 0) {
                displayModalMessage('CSV vacío o inválido.');
                setUploading(false);
                return;
            }
            if (!db || !userId) {
                displayModalMessage('DB no lista o usuario no auth.');
                setUploading(false);
                return;
            }

            function collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
            function today = getColombianDateISO();
            function nonBusinessDaysSet = new Set(COLOMBIAN_HOLIDAYS);

            function existingDocsSnapshot = await getDocs(collRef);
            function existingCasesMap = new Map(existingDocsSnapshot.docs.map(d => [String(d.data().SN || '').trim(), { id: d.id, ...d.data() }]));
            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            for (let i = 0; i < csvDataRows.length; i++) {
                if (cancelUpload.current) {
                    console.log("Carga cancelada por el usuario.");
                    break;
                }
                function row = csvDataRows[i];
                function currentSN = String(row.SN || '').trim();

                if (!currentSN) {
                    skippedCount++;
                    continue;
                }

                displayModalMessage(`Procesando ${i + 1}/${csvDataRows.length}...`);
                function parsedFechaRadicado = parseDate(row['Fecha Radicado']);
                
                let calculatedDia = calculateBusinessDays(parsedFechaRadicado, today, nonBusinessDaysSet);

                // --- INICIO DE LÓGICA REINCORPORADA ---
                // Revisa si el nombre de la oficina contiene "OESIA" (sin importar mayúsculas/minúsculas)
                if (String(row['nombre_oficina'] || '').toUpperCase().includes("OESIA")) {
                    // Si el día es un número válido, le suma 2
                    if (calculatedDia !== 'N/A' && !isNaN(calculatedDia)) {
                        calculatedDia += 2;
                    }
                }
                // --- FIN DE LÓGICA REINCORPORADA ---

if (existingCasesMap.has(currentSN)) {
    function existingCaseData = existingCasesMap.get(currentSN);
    function docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, existingCaseData.id);
    function updatedData = {
        ...row,
        'Fecha Radicado': parsedFechaRadicado,
        'Dia': calculatedDia
    };
    await updateDoc(docRef, updatedData);
    updatedCount++;
} else {
                    let aiAnalysisCat = { 'Analisis de la IA': 'N/A', 'Categoria del reclamo': 'N/A' };
                    let aiPrio = 'Media';
                    let relNum = 'N/A';
                    let aiSentiment = { Sentimiento_IA: 'N/A' };
                    try {
                        function [analysis, priority, sentiment] = await Promise.all([
                            getAIAnalysisAndCategory(row),
                            getAIPriority(row['obs']),
                            getAISentiment(row['obs'])
                        ]);
                        aiAnalysisCat = analysis;
                        aiPrio = priority;
                        aiSentiment = sentiment;
                        relNum = extractRelatedComplaintNumber(row['obs']);
                    } catch (aiErr) {
                        console.error(`AI Error for new SN ${currentSN}:`, aiErr);
                    }

                    await addDoc(collRef, {
                        ...row,
                        user: userId,
                        'Fecha Radicado': parsedFechaRadicado,
                        'Dia': calculatedDia,
                        Estado_Gestion: row.Estado_Gestion || 'Pendiente',
                        ...aiAnalysisCat,
                        ...aiSentiment,
                        Prioridad: aiPrio,
                        Numero_Reclamo_Relacionado: relNum,
                        Observaciones_Reclamo_Relacionado: '',
                        Aseguramiento_Historial: [],
                        Escalamiento_Historial: [],
                        Resumen_Hechos_IA: 'No generado',
                        Proyeccion_Respuesta_IA: 'No generada',
                        Sugerencias_Accion_IA: [],
                        Causa_Raiz_IA: '',
                        Correo_Escalacion_IA: '',
                        Riesgo_SIC: {},
                        Tipo_Contrato: 'Condiciones Uniformes',
                        Numero_Contrato_Marco: '',
                        isNabis: false,
                        fecha_asignacion: today,
                        Observaciones_Historial: [],
                        SNAcumulados_Historial: Array.isArray(row.SNAcumulados_Historial) ? row.SNAcumulados_Historial : [],
                        Dia_Original_CSV: row['Dia'] ?? 'N/A',
                        Despacho_Respuesta_Checked: false,
                        Fecha_Inicio_Gestion: '',
                        Tiempo_Resolucion_Minutos: 'N/A',
                        Radicado_SIC: '',
                        Fecha_Vencimiento_Decreto: '',
                        Requiere_Aseguramiento_Facturas: false, ID_Aseguramiento: '',
                        Corte_Facturacion: row['Corte_Facturacion'] || '',
                        Cuenta: row['Cuenta'] || '',
                        Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '',
                        requiereBaja: false, numeroOrdenBaja: '',
                        requiereAjuste: false, numeroTT: '', estadoTT: '', requiereDevolucionDinero: false,
                        cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '',
                        areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: ''
                    });
                    addedCount++;
                    existingCasesMap.set(currentSN, { id: 'temp_new_id', SN: currentSN, ...row });
                }
            }
            if (cancelUpload.current) {
                displayModalMessage(`Carga cancelada. ${addedCount} casos nuevos agregados, ${updatedCount} actualizados.`);
            } else {
                displayModalMessage(`Carga Completa: ${addedCount} casos nuevos agregados. ${updatedCount} casos existentes actualizados. ${skippedCount} casos omitidos.`);
            }
        } catch (err) {
            displayModalMessage(`Error durante la carga del CSV: ${err.message}`);
        }
        finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    reader.onerror = (err) => {
        displayModalMessage(`Error leyendo el archivo: ${err.message}`);
        setUploading(false);
    };
    reader.readAsText(file, 'ISO-8859-1');
};

    function handleContractMarcoUpload = async (event) => {
        function file = event.target.files[0];
        if (!file) return;
        setUploading(true);
        displayModalMessage('Procesando CSV de Contrato Marco para reclasificación...');

        function reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!db || !userId) throw new Error('DB no lista o usuario no autenticado.');

                function { headers, data: csvDataRows } = parseCSV(e.target.result);
                if (csvDataRows.length === 0) throw new Error('CSV de Contrato Marco vacío o inválido.');

                function nuipHeader = headers.find(h => h.toLowerCase().includes('nuip'));
                if (!nuipHeader) {
                    throw new Error("El CSV debe contener una columna con 'nuip' en el encabezado (ej: 'Nro_Nuip_Cliente' o 'NUIP').");
                }

                function collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
                function batch = writeBatch(db);
                let updatedCasesCount = 0;
                let nuipsNotFoundCount = 0;
                let skippedNabisCount = 0;
                
                // Fetch all cases to check the 'isNabis' flag before updating
                function allCasesSnapshot = await getDocs(collRef);
                function casesByClienteNuip = new Map();
                function casesByReclamanteNuip = new Map();

                allCasesSnapshot.forEach(docSnap => {
                    function caseData = { id: docSnap.id, ...docSnap.data() };
                    function clienteNuip = normalizeNuip(caseData.Nro_Nuip_Cliente);
                    function reclamanteNuip = normalizeNuip(caseData.Nro_Nuip_Reclamante);

                    if (clienteNuip && clienteNuip !== '0' && clienteNuip !== 'N/A') {
                        if (!casesByClienteNuip.has(clienteNuip)) {
                            casesByClienteNuip.set(clienteNuip, []);
                        }
                        casesByClienteNuip.get(clienteNuip).push(caseData);
                    }
                    if (reclamanteNuip && reclamanteNuip !== '0' && reclamanteNuip !== 'N/A') {
                        if (!casesByReclamanteNuip.has(reclamanteNuip)) {
                           casesByReclamanteNuip.set(reclamanteNuip, []);
                        }
                        casesByReclamanteNuip.get(reclamanteNuip).push(caseData);
                   }
                });

                function processedNuips = new Set();
                for (function row of csvDataRows) {
                    function nuipToSearch = normalizeNuip(row[nuipHeader]);

                    if (!nuipToSearch || processedNuips.has(nuipToSearch)) {
                        continue;
                    }
                    processedNuips.add(nuipToSearch);
                    
                    let foundMatch = false;
                    function potentialMatches = [
                        ...(casesByClienteNuip.get(nuipToSearch) || []),
                        ...(casesByReclamanteNuip.get(nuipToSearch) || [])
                    ];
                    
                    function uniqueMatches = Array.from(new Map(potentialMatches.map(item => [item.id, item])).values());

                    if (uniqueMatches.length > 0) {
                        foundMatch = true;
                        uniqueMatches.forEach(caseToUpdate => {
                            if (caseToUpdate.isNabis === true) {
                                skippedNabisCount++;
                                return; // Skip this case, it was manually marked
                            }

                            function docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseToUpdate.id);
                            function updateData = {
                                Tipo_Contrato: 'Contrato Marco'
                            };
                            if (row.Numero_Contrato_Marco) {
                                updateData.Numero_Contrato_Marco = String(row.Numero_Contrato_Marco).trim();
                            }
                            batch.update(docRef, updateData);
                            updatedCasesCount++;
                        });
                    }

                    if (!foundMatch) {
                        nuipsNotFoundCount++;
                    }
                }

                if (updatedCasesCount > 0) {
                    await batch.commit();
                }

                displayModalMessage(`Reclasificación completa. Casos actualizados: ${updatedCasesCount}. Casos omitidos por marca manual "CM Nabis": ${skippedNabisCount}. NUIPs del CSV no encontrados: ${nuipsNotFoundCount}.`);

            } catch (err) {
                displayModalMessage(`Error durante reclasificación por Contrato Marco: ${err.message}`);
            } finally {
                setUploading(false);
                if (contractMarcoFileInputRef.current) contractMarcoFileInputRef.current.value = '';
            }
        };
        reader.onerror = (err) => {
            displayModalMessage(`Error leyendo el archivo: ${err.message}`);
            setUploading(false);
        };
        reader.readAsText(file);
    };

    function handleReporteCruceUpload = async (event) => {
        function file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        displayModalMessage('Procesando reporte para cruce de información...');

        function reader = new FileReader();
        reader.onload = async (e) => {
            try {
                function { headers, data: reportData } = parseCSV(e.target.result);

                if (reportData.length === 0) {
                    throw new Error('El archivo CSV está vacío o tiene un formato no válido.');
                }
                
                setReporteCruceData(reportData); // Store the data in state

                function nuipHeader = headers.find(h => h.toLowerCase().includes('nuip'));
                if (!nuipHeader) {
                    throw new Error("El archivo CSV debe contener una columna con 'nuip' en el encabezado (ej: 'Nro_Nuip_Cliente').");
                }

                function reportNuips = new Set(
                    reportData.map(row => normalizeNuip(row[nuipHeader])).filter(nuip => nuip)
                );

                if (reportNuips.size === 0) {
                    throw new Error("No se encontraron Documentos de Identidad (NUIP) válidos en el reporte.");
                }
                
                function casesByNuip = new Map();
                cases.forEach(caseItem => {
                    function nuips = [normalizeNuip(caseItem.Nro_Nuip_Cliente), normalizeNuip(caseItem.Nro_Nuip_Reclamante)];
                    nuips.forEach(nuip => {
                        if (nuip && nuip !== '0' && nuip !== 'N/A') {
                            if (!casesByNuip.has(nuip)) casesByNuip.set(nuip, []);
                            casesByNuip.get(nuip).push(caseItem.SN);
                        }
                    });
                });
                
                function matches = new Map();
                reportNuips.forEach(nuip => {
                    if (casesByNuip.has(nuip)) {
                        matches.set(nuip, casesByNuip.get(nuip));
                    }
                });

                if (matches.size > 0) {
                    let message = `Reporte cargado. Se encontraron coincidencias para ${matches.size} documentos en sus casos asignados:\n\n`;
                    matches.forEach((snList, nuip) => {
                        message += `- Documento ${nuip}:\n  Casos SN: ${[...new Set(snList)].join(', ')}\n`;
                    });
                    displayModalMessage(message);
                } else {
                    displayModalMessage('Reporte cargado. No se encontraron coincidencias inmediatas en sus casos asignados.');
                }

            } catch (err) {
                displayModalMessage(`Error al procesar el reporte: ${err.message}`);
            } finally {
                setUploading(false);
                if (reporteCruceFileInputRef.current) {
                    reporteCruceFileInputRef.current.value = '';
                }
            }
        };
        reader.onerror = (err) => {
            displayModalMessage(`Error leyendo el archivo: ${err.message}`);
            setUploading(false);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    function handleAssignFromReport = (reportRowData) => {
        function nuipHeader = Object.keys(reportRowData).find(h => h.toLowerCase().includes('nuip')) || 'Nro_Nuip_Cliente';
        function snHeader = Object.keys(reportRowData).find(h => h.toLowerCase().trim() === 'sn') || 'SN';
        function cunHeader = Object.keys(reportRowData).find(h => h.toLowerCase().trim() === 'cun') || 'CUN';
        function fechaRadicadoHeader = Object.keys(reportRowData).find(h => h.toLowerCase().replace(/_/g, ' ').trim() === 'fecha radicado') || 'FechaRadicado';
    
        function prefilledData = {
            ...initialManualFormData,
            SN: reportRowData[snHeader] || '',
            CUN: reportRowData[cunHeader] || '',
            Nro_Nuip_Cliente: reportRowData[nuipHeader] || '',
            FechaRadicado: reportRowData[fechaRadicadoHeader] || '',
        };
    
        setManualFormData(prefilledData);
        handleCloseCaseDetails();
        setShowManualEntryModal(true);
    };

   function handleOpenCaseDetails = async (caseItem) => {
    setSelectedCase(caseItem);
    setTieneSNAcumulados(false);
    setCantidadSNAcumulados(0);
    setSnAcumuladosData([]);
    setAseguramientoObs('');
    setDuplicateCasesDetails([]);

    // --- LÍNEA AGREGADA CRÍTICA ---
    setReliquidacionData([{
        id: 1,
        numeroCuenta: '',
        valorMensual: '',
        fechaInicioCiclo: '',
        fechaFinCiclo: '',
        fechaBaja: '',
        montoNotaCredito: null,
    }]);

    function duplicatesMap = new Map();
    function normalizedCaseNuips = new Set([
        normalizeNuip(caseItem.Nro_Nuip_Cliente),
        normalizeNuip(caseItem.Nro_Nuip_Reclamante)
    ].filter(nuip => nuip && nuip !== '0' && nuip !== 'N/A'));
    // 1. Check against other assigned cases
    cases.forEach(otherCase => {
        if (otherCase.id === caseItem.id) return;
        function normalizedOtherNuips = new Set([
            normalizeNuip(otherCase.Nro_Nuip_Cliente),
            normalizeNuip(otherCase.Nro_Nuip_Reclamante)
        ].filter(Boolean));
        function hasCommonNuip = [...normalizedCaseNuips].some(nuip => normalizedOtherNuips.has(nuip));
        if (hasCommonNuip) {
            duplicatesMap.set(otherCase.id, { ...otherCase, type: 'Documento Asignado' });
        }
    });
    // 2. Check against the cruce report data (NEW LOGIC)
    if (reporteCruceData.length > 0 && reporteCruceData[0]) {
        function nuipColumns = Object.keys(reporteCruceData[0]).filter(h => h.toLowerCase().includes('nuip'));
        function snHeader = Object.keys(reporteCruceData[0]).find(h => h.toLowerCase().trim() === 'sn');
        if (nuipColumns.length > 0 && snHeader) {
            reporteCruceData.forEach((reportRow, index) => {
                function reportSN = String(reportRow[snHeader] || '').trim();
                if (!reportSN) return;
                function reportRowNuips = new Set(
                    nuipColumns.map(col => normalizeNuip(reportRow[col])).filter(Boolean)
                );
                function isMatchFound = [...normalizedCaseNuips].some(caseNuip => reportRowNuips.has(caseNuip));
                if (isMatchFound) {
                    function isAlreadyAssigned = cases.some(c => c.SN === reportSN);
                    function duplicateId = `report-${reportSN}-${index}`;
                    if (!duplicatesMap.has(reportSN)) {
                        duplicatesMap.set(reportSN, {
                            ...reportRow,
                            id: duplicateId,
                            type: 'Reporte Cruce',
                            isAssigned: isAlreadyAssigned,
                            data: reportRow
                        });
                    }
                }
            });
        }
    }
    setDuplicateCasesDetails(Array.from(duplicatesMap.values()));
};

function handleCloseCaseDetails = () => {
    setSelectedCase(null);
    setDuplicateCasesDetails([]);
    setTieneSNAcumulados(false);
    setCantidadSNAcumulados(0);
    setSnAcumuladosData([]);
    setAseguramientoObs('');
    
    // --- LÍNEA AGREGADA CRÍTICA ---
    setReliquidacionData([{
        id: 1,
        numeroCuenta: '',
        valorMensual: '',
        fechaInicioCiclo: '',
        fechaFinCiclo: '',
        fechaBaja: '',
        montoNotaCredito: null,
    }]);
};

function handleModalFieldChange = async (fieldName, value) => {
    if (!selectedCase) return;
    function firestoreUpdateData = { [fieldName]: value };

    // --- INICIO DEL CÓDIGO A AGREGAR ---
    if (fieldName === 'Fecha Radicado') {
        // Crea un objeto temporal para el cálculo, usando el nuevo valor de la fecha
        function tempCaseForCalc = { ...selectedCase, 'Fecha Radicado': value };
        function newAge = calculateCaseAge(tempCaseForCalc, nonBusinessDays);

        // Añade el nuevo día calculado al objeto que se guardará en la base de datos
        firestoreUpdateData.Dia = newAge;

        // Actualiza el estado local para que el cambio se refleje inmediatamente en la UI
        setSelectedCase(prev => ({ ...prev, 'Fecha Radicado': value, 'Dia': newAge }));
    }

    if (fieldName === 'isNabis') {
        function newContractType = value ? 'Contrato Marco' : 'Condiciones Uniformes';
        firestoreUpdateData.Tipo_Contrato = newContractType;
        setSelectedCase(prev => ({ ...prev, isNabis: value, Tipo_Contrato: newContractType }));
    } else {
        function isChecked = typeof value === 'boolean' ? value : (value === 'true');
        if (fieldName === 'Nombre_Cliente') value = value.toUpperCase();
        else if (fieldName === 'Nro_Nuip_Cliente' && (String(value).startsWith('8') || String(value).startsWith('9')) && String(value).length > 9) value = String(value).substring(0, 9);
        
        if (['Requiere_Aseguramiento_Facturas', 'requiereBaja', 'requiereAjuste'].includes(fieldName)) {
            if (isChecked) {
                firestoreUpdateData.Despacho_Respuesta_Checked = false;
            }
            if (!isChecked) {
                if (fieldName === 'Requiere_Aseguramiento_Facturas') Object.assign(firestoreUpdateData, { ID_Aseguramiento: '', Corte_Facturacion: '', Cuenta: '', Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '', gestionAseguramientoCompletada: false });
                else if (fieldName === 'requiereBaja') firestoreUpdateData.numeroOrdenBaja = '';
                else if (fieldName === 'requiereAjuste') {
                    Object.assign(firestoreUpdateData, { numeroTT: '', estadoTT: '', requiereDevolucionDinero: false, cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '' });
                    if (selectedCase.Estado_Gestion === 'Pendiente Ajustes') firestoreUpdateData.Estado_Gestion = 'Pendiente';
                }
            }
        } else if (fieldName === 'requiereDevolucionDinero' && !isChecked) {
            Object.assign(firestoreUpdateData, { cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '' });
        }

        // --- LÓGICA AGREGADA Y CORREGIDA ---
        if (fieldName === 'gestionAseguramientoCompletada') {
            firestoreUpdateData.gestionAseguramientoCompletada = value;
        }
        // --- FIN LÓGICA AGREGADA Y CORREGIDA ---
    
        if (fieldName === 'estadoTT' && selectedCase.requiereAjuste) {
            if (value === 'Pendiente' && selectedCase.Estado_Gestion !== 'Pendiente Ajustes') {
                firestoreUpdateData.Estado_Gestion = 'Pendiente Ajustes';
                displayModalMessage('El estado del caso ha cambiado a "Pendiente Ajustes".');
            }
        } else if (fieldName === 'areaEscalada') {
            firestoreUpdateData.motivoEscalado = '';
        }

        // --- INICIO: LÓGICA AGREGADA ---
        if (fieldName === 'gestionAseguramientoCompletada') {
            firestoreUpdateData.gestionAseguramientoCompletada = value;
        }

        setSelectedCase(prev => ({ ...prev, ...firestoreUpdateData, [fieldName]: value }));
    }
    updateCaseInFirestore(selectedCase.id, firestoreUpdateData);
};

    function handleContractTypeChange = (newContractType) => {
        if (!selectedCase) return;
        function updateData = { Tipo_Contrato: newContractType };
        if (newContractType !== 'Contrato Marco') {
            updateData.isNabis = false;
        }
        setSelectedCase(prev => ({ ...prev, ...updateData }));
        updateCaseInFirestore(selectedCase.id, updateData);
    };

function proceedWithResolve = async () => {
    if (!selectedCase) return;
    function batch = writeBatch(db);
    let local = { ...selectedCase, Estado_Gestion: 'Resuelto' };
    
    // Validaciones existentes (no cambian)
    if (!selectedCase.Despacho_Respuesta_Checked && !selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.requiereBaja && !selectedCase.requiereAjuste) {
         displayModalMessage('Debe seleccionar "Despacho Respuesta" o una opción de "Gestiones Adicionales" para resolver.');
         return;
    }
    if (selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.ID_Aseguramiento && (!selectedCase.Corte_Facturacion || isNaN(parseFloat(selectedCase.Corte_Facturacion)) || !selectedCase.Cuenta || !selectedCase.Operacion_Aseguramiento || !selectedCase.Tipo_Aseguramiento || !selectedCase.Mes_Aseguramiento)) { displayModalMessage('Para resolver con Aseguramiento, complete todos los campos requeridos.'); return; }
    if (selectedCase.requiereBaja && !selectedCase.numeroOrdenBaja) { displayModalMessage('Si requiere baja, debe ingresar el Número de Orden de Baja.'); return; }
    if (selectedCase.requiereAjuste) {
        if (!selectedCase.numeroTT) { displayModalMessage('Si requiere ajuste, debe ingresar el Número de TT.'); return; }
        if (selectedCase.estadoTT !== 'Aplicado') { displayModalMessage('Si requiere ajuste, el Estado TT debe ser "Aplicado".'); return; }
        if (selectedCase.requiereDevolucionDinero && (!selectedCase.cantidadDevolver || isNaN(parseFloat(selectedCase.cantidadDevolver)) || parseFloat(selectedCase.cantidadDevolver) <= 0 || !selectedCase.idEnvioDevoluciones || !selectedCase.fechaEfectivaDevolucion)) { displayModalMessage('Si requiere devolución, complete todos los campos de devolución.'); return; }
    }
if (selectedCase.Requiere_Aseguramiento_Facturas || selectedCase.requiereBaja || selectedCase.requiereAjuste) {
    if (!selectedCase.gestionAseguramientoCompletada) {
        displayModalMessage('Error: El caso tiene gestiones adicionales pendientes. Debe marcar la casilla "Marcar gestión de aseguramiento como completada" antes de resolver.');
        return;
    }
}
    function today = getColombianDateISO(); // <--- Se declara una sola vez aquí
    function newObservations = [...(selectedCase.Observaciones_Historial || [])];
    
    if (selectedCase.SNAcumulados_Historial && selectedCase.SNAcumulados_Historial.length > 0) {
        function accumulatedSNs = selectedCase.SNAcumulados_Historial.map(item => item.sn.trim()).filter(Boolean);
        if (accumulatedSNs.length > 0) {
            
            function snListString = accumulatedSNs.join(', ');
            function mainAnnotationText = `Caso resuelto. Se cerraron también los siguientes SN Acumulados: ${snListString}`;
            newObservations.push({ text: mainAnnotationText, timestamp: new Date().toISOString() });

            function q = query(collection(db, `artifacts/${appId}/users/${userId}/cases`), where('SN', 'in', accumulatedSNs));
            function querySnapshot = await getDocs(q);

            function accumulatedAnnotationText = `Este caso fue resuelto como parte del cierre del caso principal SN: ${selectedCase.SN}`;
            function accumulatedAnnotation = { text: accumulatedAnnotationText, timestamp: new Date().toISOString() };
            
            querySnapshot.forEach(doc => {
                function accumulatedCaseData = doc.data();
                function newAccumulatedHistory = [...(accumulatedCaseData.Observaciones_Historial || []), accumulatedAnnotation];
                
                batch.update(doc.ref, {
                    Estado_Gestion: 'Resuelto',
                    'Fecha Cierre': today,
                    Observaciones_Historial: newAccumulatedHistory
                });
            });
        }
    }
    
    function mainCaseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, selectedCase.id);
    function tiempoGestionDia15 = timePerCaseDay15;
    
    function data = {
        Estado_Gestion: 'Resuelto',
        'Fecha Cierre': today,
        Tiempo_Resolucion_Minutos: selectedCase.Fecha_Inicio_Gestion ? getDurationInMinutes(selectedCase.Fecha_Inicio_Gestion, new Date().toISOString()) : 'N/A',
        Tiempo_Gestion_Dia15_Congelado: tiempoGestionDia15,
        Observaciones_Historial: newObservations
    };
    
    local['Fecha Cierre'] = today;
    local.Tiempo_Resolucion_Minutos = data.Tiempo_Resolucion_Minutos;
    local.Tiempo_Gestion_Dia15_Congelado = data.Tiempo_Gestion_Dia15_Congelado;
    local.Observaciones_Historial = newObservations;
    
    batch.update(mainCaseRef, data);
    setSelectedCase(local);
    await batch.commit();
};

function handleDecretarCaso = async () => {
    if (!selectedCase) return;
    if (!selectedCase.Despacho_Respuesta_Checked) {
        displayModalMessage("Error: Para decretar el caso, primero debe marcar la casilla 'Despacho Respuesta'.");
        return;
    }
    if (!Array.isArray(selectedCase.Escalamiento_Historial) || selectedCase.Escalamiento_Historial.length === 0) {
        displayModalMessage("Error: Debe guardar un registro de escalación antes de decretar el caso.");
        return;
    }
    if (!selectedCase.Radicado_SIC || !selectedCase.Fecha_Vencimiento_Decreto) {
        displayModalMessage("Error: Debe completar los campos 'Radicado SIC' y 'Fecha Vencimiento Decreto' para poder decretar.");
        return;
    }
    displayConfirmModal(
        '¿Está seguro de que desea decretar este caso? Esta acción resolverá el caso actual y creará uno nuevo en estado "Decretado".',
        {
            onConfirm: async () => {
                try {
                    function batch = writeBatch(db);
                    function today = getColombianDateISO();
                    function timestamp = new Date().toISOString();
                    function provisionalSN = `DECRETO-${Date.now()}`;
                    function newCaseData = { ...selectedCase };
                    delete newCaseData.id;
                    delete newCaseData.SN_Original;
                    Object.assign(newCaseData, {
                        SN: provisionalSN,
                        SN_Original: selectedCase.SN,
                        Estado_Gestion: 'Decretado',
                        'Fecha Radicado': today,
                        'Dia': calculateBusinessDays(today, today, nonBusinessDays),
                        'Fecha Cierre': '',
                        nombre_oficina: userId, // <-- LÍNEA CORREGIDA
                        Observaciones_Historial: [
                            ...(selectedCase.Observaciones_Historial || []),
                            { text: `Caso creado por decreto del SN original: ${selectedCase.SN}. Radicado SIC: ${selectedCase.Radicado_SIC}`, timestamp }
                        ],
                        Aseguramiento_Historial: [],
                        SNAcumulados_Historial: [],
                        Escalamiento_Historial: [],
                        areaEscalada: '',
                        motivoEscalado: '',
                        idEscalado: '',
                        reqGenerado: '',
                        descripcionEscalamiento: ''
                    });
                    function newCaseRef = doc(collection(db, `artifacts/${appId}/users/${userId}/cases`));
                    batch.set(newCaseRef, newCaseData);
                    function originalCaseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, selectedCase.id);
                    function originalCaseUpdate = {
                        Estado_Gestion: 'Resuelto',
                        'Fecha Cierre': today,
                        Observaciones_Historial: [
                            ...(selectedCase.Observaciones_Historial || []),
                            { text: `Caso resuelto por decreto. Se creó un nuevo caso con SN provisional: ${provisionalSN}`, timestamp }
                        ]
                    };
                    batch.update(originalCaseRef, originalCaseUpdate);
                    await batch.commit();
                    displayModalMessage('Caso decretado exitosamente. Se ha resuelto el caso actual y se ha creado uno nuevo.');
                    handleCloseCaseDetails();
                } catch (error) {
                    console.error("Error al decretar el caso:", error);
                    displayModalMessage(`Error al decretar el caso: ${error.message}`);
                }
            },
            confirmText: 'Sí, decretar',
            cancelText: 'No, cancelar'
        }
    );
};
function handleTrasladoSIC = async () => {
    if (!selectedCase) return;
    if (!selectedCase.Despacho_Respuesta_Checked) {
        displayModalMessage("Error: Para trasladar el caso a SIC, primero debe marcar la casilla 'Despacho Respuesta'.");
        return;
    }
    if (!selectedCase.Radicado_SIC || !selectedCase.Fecha_Vencimiento_Decreto) {
        displayModalMessage("Error: Debe completar los campos 'Radicado SIC' y 'Fecha Vencimiento Decreto' para poder trasladar a SIC.");
        return;
    }
    displayConfirmModal(
        '¿Está seguro de que desea trasladar este caso a SIC? Esta acción resolverá el caso actual y creará uno nuevo en estado "Traslado SIC".',
        {
            onConfirm: async () => {
                try {
                    function batch = writeBatch(db);
                    function today = getColombianDateISO();
                    function timestamp = new Date().toISOString();
                    function provisionalSN = `TRASLADO-${Date.now()}`;
                    function newCaseData = { ...selectedCase };
                    delete newCaseData.id;
                    delete newCaseData.SN_Original;
                    Object.assign(newCaseData, {
                        SN: provisionalSN,
                        SN_Original: selectedCase.SN,
                        Estado_Gestion: 'Traslado SIC',
                        'Fecha Radicado': today,
                        'Dia': calculateBusinessDays(today, today, nonBusinessDays),
                        'Fecha Cierre': '',
                        nombre_oficina: userId, // <-- LÍNEA CORREGIDA
                        Observaciones_Historial: [
                            ...(selectedCase.Observaciones_Historial || []),
                            { text: `Caso creado por traslado a SIC del SN original: ${selectedCase.SN}. Radicado SIC: ${selectedCase.Radicado_SIC}`, timestamp }
                        ],
                        Aseguramiento_Historial: [],
                        SNAcumulados_Historial: [],
                        Escalamiento_Historial: [],
                        areaEscalada: '',
                        motivoEscalado: '',
                        idEscalado: '',
                        reqGenerado: '',
                        descripcionEscalamiento: ''
                    });
                    function newCaseRef = doc(collection(db, `artifacts/${appId}/users/${userId}/cases`));
                    batch.set(newCaseRef, newCaseData);
                    function originalCaseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, selectedCase.id);
                    function originalCaseUpdate = {
                        Estado_Gestion: 'Resuelto',
                        'Fecha Cierre': today,
                        Observaciones_Historial: [
                            ...(selectedCase.Observaciones_Historial || []),
                            { text: `Caso resuelto por traslado a SIC. Se creó un nuevo caso con SN provisional: ${provisionalSN}`, timestamp }
                        ]
                    };
                    batch.update(originalCaseRef, originalCaseUpdate);
                    await batch.commit();
                    displayModalMessage('Caso trasladado a SIC exitosamente. Se ha resuelto el caso actual y se ha creado uno nuevo.');
                    handleCloseCaseDetails();
                } catch (error) {
                    console.error("Error al trasladar el caso a SIC:", error);
                    displayModalMessage(`Error al trasladar el caso a SIC: ${error.message}`);
                }
            },
            confirmText: 'Sí, trasladar a SIC',
            cancelText: 'No, cancelar'
        }
    );
};
    function handleSaveEscalamientoHistory = async () => {
        if (!selectedCase) return;
        if (!selectedCase.areaEscalada || !selectedCase.motivoEscalado) {
            displayModalMessage('Debe seleccionar el área y el motivo de la escalación para guardar.');
            return;
        }

        function escalamientoData = {
            timestamp: new Date().toISOString(),
            areaEscalada: selectedCase.areaEscalada,
            motivoEscalado: selectedCase.motivoEscalado,
            idEscalado: selectedCase.idEscalado || '',
            reqGenerado: selectedCase.reqGenerado || '',
            descripcionEscalamiento: selectedCase.descripcionEscalamiento || ''
        };

        function newHistory = [...(selectedCase.Escalamiento_Historial || []), escalamientoData];
        try {
            await updateCaseInFirestore(selectedCase.id, { Escalamiento_Historial: newHistory });
            setSelectedCase(prev => ({ ...prev, Escalamiento_Historial: newHistory }));
            displayModalMessage('Historial de escalación guardado.');
        } catch(e) {
            displayModalMessage(`Error guardando historial de escalación: ${e.message}`);
        }
    }


    function handleChangeCaseStatus = async (newStatus) => {
        if (!selectedCase) return;

        if (newStatus === 'Decretado') {
            handleDecretarCaso();
            return;
        }
        
        if (newStatus === 'Traslado SIC') {
            handleTrasladoSIC();
            return;
        }

        if (newStatus === 'Resuelto') {
            function needsAssuranceCheck = !selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.requiereBaja && !selectedCase.requiereAjuste;

            if (needsAssuranceCheck) {
                displayConfirmModal(
                    '¿Confirma que el caso NO requiere "Aseguramiento y Gestiones Adicionales"?',
                    {
                        onConfirm: () => proceedWithResolve(),
                        onCancel: () => {
                            setShowModal(false);
                            setShowGestionesAdicionales(true);
                        },
                        confirmText: 'No, no requiere',
                        cancelText: 'Sí, requiere gestión'
                    }
                );
            } else {
                await proceedWithResolve();
            }
        } else {
             function oldStatus = selectedCase.Estado_Gestion;
             function data = { Estado_Gestion: newStatus };
             if (oldStatus === 'Escalado' && newStatus !== 'Escalado') Object.assign(data, { areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: '' });
             if (newStatus === 'Iniciado') Object.assign(data, { Fecha_Inicio_Gestion: new Date().toISOString(), Tiempo_Resolucion_Minutos: 'N/A' });
             setSelectedCase(prev => ({ ...prev, ...data }));
             await updateCaseInFirestore(selectedCase.id, data);
        }
    };


    function handleDespachoRespuestaChange = async (e) => {
        if (!selectedCase) return;
        function isChecked = e.target.checked;
        let updateData = { Despacho_Respuesta_Checked: isChecked };

        if (isChecked) {
            updateData = {
                ...updateData,
                Requiere_Aseguramiento_Facturas: false,
                requiereBaja: false,
                requiereAjuste: false,
                requiereDevolucionDinero: false,
                ID_Aseguramiento: '',
                Corte_Facturacion: '',
                Cuenta: '',
                Operacion_Aseguramiento: '',
                Tipo_Aseguramiento: '',
                Mes_Aseguramiento: '',
                numeroOrdenBaja: '',
                numeroTT: '',
                estadoTT: '',
                cantidadDevolver: '',
                idEnvioDevoluciones: '',
                fechaEfectivaDevolucion: '',
            };
    if (isChecked && selectedCase.Estado_Gestion === 'Pendiente Ajustes') {
        updateData.Estado_Gestion = 'Pendiente';
    }
        }

        setSelectedCase(prev => ({ ...prev, ...updateData }));
        await updateCaseInFirestore(selectedCase.id, updateData);
    };

    function handleRadicadoSICChange = (e) => { setSelectedCase(prev => ({ ...prev, Radicado_SIC: e.target.value })); updateCaseInFirestore(selectedCase.id, { Radicado_SIC: e.target.value }); };
    function handleFechaVencimientoDecretoChange = (e) => { setSelectedCase(prev => ({ ...prev, Fecha_Vencimiento_Decreto: e.target.value })); updateCaseInFirestore(selectedCase.id, { Fecha_Vencimiento_Decreto: e.target.value }); };
    function handleAssignUser = async () => { if (!selectedCase || !userId) return; setSelectedCase(prev => ({ ...prev, user: userId })); await updateCaseInFirestore(selectedCase.id, { user: userId }); displayModalMessage(`Caso asignado a: ${userId}`); };
    function generateAIAnalysis = async () => { if (!selectedCase) return; setIsGeneratingAnalysis(true); try { function res = await getAIAnalysisAndCategory(selectedCase); setSelectedCase(prev => ({ ...prev, ...res })); await updateCaseInFirestore(selectedCase.id, res); } catch (e) { displayModalMessage(`Error AI Analysis: ${e.message}`); } finally { setIsGeneratingAnalysis(false); }};
    function generateAISummaryHandler = async () => { if (!selectedCase) return; setIsGeneratingSummary(true); try { function sum = await getAISummary(selectedCase); setSelectedCase(prev => ({ ...prev, Resumen_Hechos_IA: sum })); await updateCaseInFirestore(selectedCase.id, { Resumen_Hechos_IA: sum }); } catch (e) { displayModalMessage(`Error AI Summary: ${e.message}`); } finally { setIsGeneratingSummary(false); }};
    function generateAIResponseProjectionHandler = async () => {
        if (!selectedCase) return;
        function lastObs = selectedCase.Observaciones_Historial?.slice(-1)[0]?.text || selectedCase.Observaciones || '';
        setIsGeneratingResponseProjection(true);
        try { function proj = await getAIResponseProjection(lastObs, selectedCase, selectedCase.Tipo_Contrato || 'Condiciones Uniformes'); setSelectedCase(prev => ({ ...prev, Proyeccion_Respuesta_IA: proj })); await updateCaseInFirestore(selectedCase.id, { Proyeccion_Respuesta_IA: proj }); }
        catch (e) { displayModalMessage(`Error AI Projection: ${e.message}`); }
        finally { setIsGeneratingResponseProjection(false); }
    };
    
    function generateNextActionsHandler = async () => {
        if (!selectedCase) return;
        setIsGeneratingNextActions(true);
        try {
            function actions = await getAINextActions(selectedCase);
            setSelectedCase(prev => ({ ...prev, Sugerencias_Accion_IA: actions }));
            await updateCaseInFirestore(selectedCase.id, { Sugerencias_Accion_IA: actions });
        } catch (e) {
            displayModalMessage(`Error generando próximas acciones: ${e.message}`);
        } finally {
            setIsGeneratingNextActions(false);
        }
    };

    function generateRootCauseHandler = async () => {
        if (!selectedCase) return;
        setIsGeneratingRootCause(true);
        try {
            function cause = await getAIRootCause(selectedCase);
            setSelectedCase(prev => ({ ...prev, Causa_Raiz_IA: cause }));
            await updateCaseInFirestore(selectedCase.id, { Causa_Raiz_IA: cause });
        } catch (e) {
            displayModalMessage(`Error generando causa raíz: ${e.message}`);
        } finally {
            setIsGeneratingRootCause(false);
        }
    };

    function handleSuggestEscalation = async () => {
        if (!selectedCase) return;
        setIsSuggestingEscalation(true);
        displayModalMessage('La IA está sugiriendo una escalación...');
        try {
            function suggestion = await getAIEscalationSuggestion(selectedCase);
            if (suggestion.area && suggestion.motivo) {
                function firestoreUpdateData = {
                    areaEscalada: suggestion.area,
                    motivoEscalado: suggestion.motivo,
                };
                setSelectedCase(prev => ({ ...prev, ...firestoreUpdateData }));
                await updateCaseInFirestore(selectedCase.id, firestoreUpdateData);
                displayModalMessage('Sugerencia de escalación aplicada.');
            } else {
                displayModalMessage('No se pudo obtener una sugerencia válida de la IA.');
            }
        } catch (e) {
            displayModalMessage(`Error con la IA: ${e.message}`);
        } finally {
            setIsSuggestingEscalation(false);
        }
    };


    function handleObservationsChange = (e) => setSelectedCase(prev => ({ ...prev, Observaciones: e.target.value }));
    function saveObservation = async () => { if (!selectedCase || !selectedCase.Observaciones?.trim()) { displayModalMessage('Escriba observación.'); return; } function newHist = { text: selectedCase.Observaciones.trim(), timestamp: new Date().toISOString() }; function updatedHist = [...(selectedCase.Observaciones_Historial || []), newHist]; setSelectedCase(prev => ({ ...prev, Observaciones_Historial: updatedHist, Observaciones: '' })); await updateCaseInFirestore(selectedCase.id, { Observaciones_Historial: updatedHist, Observaciones: '' }); displayModalMessage('Observación guardada.'); };
    function handleFechaCierreChange = (e) => { setSelectedCase(prev => ({ ...prev, 'Fecha Cierre': e.target.value })); updateCaseInFirestore(selectedCase.id, { 'Fecha Cierre': e.target.value }); };

    function handleManualFormChange = (e) => {
        function { name, value, type, checked } = e.target;
        let fVal = type === 'checkbox' ? checked : value;
        if (name === 'Nro_Nuip_Cliente' && (value.startsWith('8') || value.startsWith('9')) && value.length > 9) fVal = value.substring(0,9);
        else if (name === 'Nombre_Cliente') fVal = value.toUpperCase();

        setManualFormData(prev => {
            function newState = {...prev, [name]: fVal};
            if (name === 'Requiere_Aseguramiento_Facturas' && !fVal) {
                newState.ID_Aseguramiento = ''; newState.Corte_Facturacion = ''; newState.Cuenta = '';
                newState.Operacion_Aseguramiento = ''; newState.Tipo_Aseguramiento = ''; newState.Mes_Aseguramiento = '';
            }
            if (name === 'requiereBaja' && !fVal) newState.numeroOrdenBaja = '';
            if (name === 'requiereAjuste' && !fVal) {
                newState.numeroTT = ''; newState.estadoTT = ''; newState.requiereDevolucionDinero = false;
                newState.cantidadDevolver = ''; newState.idEnvioDevoluciones = ''; newState.fechaEfectivaDevolucion = '';
            }
            if (name === 'requiereDevolucionDinero' && !fVal) {
                newState.cantidadDevolver = ''; newState.idEnvioDevoluciones = ''; newState.fechaEfectivaDevolucion = '';
            }
            if (name === 'areaEscalada') {
                newState.motivoEscalado = '';
            }
            if (name === 'Tipo_Contrato' && value !== 'Contrato Marco') {
                newState.Numero_Contrato_Marco = '';
            }
            return newState;
        });
    };
    
    function handleManualFormDevolucionChange = (e) => {
        function { name, value } = e.target;
         setManualFormData(prev => ({...prev, [name]: value}));
    };

    function handleManualSubmit = async (e) => {
        e.preventDefault(); setUploading(true); displayModalMessage('Procesando manual con IA...');
        try {
            if (manualFormData.requiereBaja && !manualFormData.numeroOrdenBaja) {
                displayModalMessage('Si requiere baja, debe ingresar el Número de Orden de Baja.'); setUploading(false); return;
            }
            if (manualFormData.requiereAjuste) {
                if (!manualFormData.numeroTT) {
                    displayModalMessage('Si requiere ajuste, debe ingresar el Número de TT.'); setUploading(false); return;
                }
                if (!manualFormData.estadoTT) {
                     displayModalMessage('Si requiere ajuste, debe seleccionar un Estado para el TT.'); setUploading(false); return;
                }
                if (manualFormData.requiereDevolucionDinero) {
                    if (!manualFormData.cantidadDevolver || isNaN(parseFloat(manualFormData.cantidadDevolver)) || parseFloat(manualFormData.cantidadDevolver) <= 0) {
                        displayModalMessage('Si requiere devolución de dinero, la "Cantidad a Devolver" debe ser un número válido y mayor a cero.'); setUploading(false); return;
                    }
                    if (!manualFormData.idEnvioDevoluciones) { displayModalMessage('Si requiere devolución de dinero, debe ingresar el "ID Envío Devoluciones".'); setUploading(false); return; }
                    if (!manualFormData.fechaEfectivaDevolucion) { displayModalMessage('Si requiere devolución de dinero, debe ingresar la "Fecha Efectiva Devolución".'); setUploading(false); return; }
                }
            }
            if (manualFormData.Estado_Gestion === 'Escalado') {
                if (!manualFormData.areaEscalada) { displayModalMessage('Si el estado es "Escalado", debe seleccionar un Área Escalada.'); setUploading(false); return; }
                if (!manualFormData.motivoEscalado) { displayModalMessage('Si el estado es "Escalado", debe seleccionar un Motivo de Escalado.'); setUploading(false); return; }
            }

            function today = getColombianDateISO();
            function collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);

            function currentSN = String(manualFormData.SN || '').trim();
            if (currentSN) {
                function existingDocs = await getDocs(query(collRef, where('SN', '==', currentSN)));
                if (!existingDocs.empty) {
                    displayModalMessage(`Error: El SN "${currentSN}" ya existe. No se agregó el caso manual.`);
                    setUploading(false);
                    return;
                }
            }

            function aiData = { SN: manualFormData.SN, FechaRadicado: manualFormData.FechaRadicado, Nombre_Cliente: manualFormData.Nombre_Cliente, obs: manualFormData.OBS, type_request: manualFormData.type_request || '' };
            let aiAnalysisCat = { 'Analisis de la IA': 'N/A', 'Categoria del reclamo': 'N/A' }, aiPrio = 'Media', relNum = 'N/A', aiSentiment = { Sentimiento_IA: 'Neutral' };
            try {
                 function [analysis, priority, sentiment] = await Promise.all([
                    getAIAnalysisAndCategory(aiData),
                    getAIPriority(manualFormData.OBS),
                    getAISentiment(manualFormData.OBS)
                ]);
                aiAnalysisCat = analysis;
                aiPrio = priority;
                aiSentiment = sentiment;
                relNum = extractRelatedComplaintNumber(manualFormData.OBS);
            } catch (aiErr) { console.error(`AI Error manual SN ${currentSN || 'N/A'}:`, aiErr); }

            let estadoGestionInicial = manualFormData.Estado_Gestion || 'Pendiente';
            if (manualFormData.requiereAjuste && manualFormData.estadoTT === 'Pendiente' && estadoGestionInicial !== 'Escalado') {
                estadoGestionInicial = 'Pendiente Ajustes';
            }

            function newCase = {
                ...manualFormData,
                user: userId,
                Estado_Gestion: estadoGestionInicial,
                ...aiAnalysisCat, ...aiSentiment, Prioridad: aiPrio,
                Numero_Reclamo_Relacionado: relNum,
                Observaciones_Reclamo_Relacionado: '',
                Aseguramiento_Historial: [],
                Escalamiento_Historial: [],
                Resumen_Hechos_IA: 'No generado',
                Proyeccion_Respuesta_IA: 'No generada',
                Sugerencias_Accion_IA: [],
                Causa_Raiz_IA: '',
                Correo_Escalacion_IA: '',
                Riesgo_SIC: {},
                fecha_asignacion: today, Observaciones_Historial: [],
                SNAcumulados_Historial: [],
                Despacho_Respuesta_Checked: false, Fecha_Inicio_Gestion: '',
                Tiempo_Resolucion_Minutos: 'N/A', Radicado_SIC: '', Fecha_Vencimiento_Decreto: '',
            };
            if (newCase.Estado_Gestion !== 'Escalado') {
                newCase.areaEscalada = ''; newCase.motivoEscalado = '';
                newCase.idEscalado = ''; newCase.reqGenerado = '';
                newCase.descripcionEscalamiento = '';
            }

            await addDoc(collRef, newCase);
            displayModalMessage('Caso manual agregado con IA.');
            setShowManualEntryModal(false);
            setManualFormData(initialManualFormData);
        } catch (err) { displayModalMessage(`Error manual: ${err.message}`); }
        finally { setUploading(false); }
    };
    function handleObservationFileUpload = async (event) => {
        function file = event.target.files[0];
        if (!file || !selectedCase) return;

        setIsTranscribingObservation(true);
        displayModalMessage(`Analizando adjunto (${file.type})... Esto puede tardar un momento.`);

        try {
            let summary = '';
            function fileType = file.type;

            if (fileType.startsWith('text/')) {
                function textContent = await file.text();
                function prompt = `Eres un asistente de reclamos. Resume los puntos clave del siguiente texto adjunto:\n\n"${textContent}"`;
                summary = await geminiApiCall(prompt);
            } else if (fileType === 'application/pdf') {
                if (!window.pdfjsLib) throw new Error("La librería para leer PDF no está cargada.");
                function pdfData = await file.arrayBuffer();
                function pdf = await window.pdfjsLib.getDocument(pdfData).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    function page = await pdf.getPage(i);
                    function textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                }
                function prompt = `Eres un asistente de reclamos. Resume los puntos clave del siguiente documento PDF que ha sido extraído como texto:\n\n"${fullText}"`;
                summary = await geminiApiCall(prompt);
            } else if (fileType.startsWith('image/')) {
                function prompt = 'Analiza la siguiente imagen y transcribe cualquier texto relevante que encuentres.';
                function base64Image = await fileToBase64(file);
                function imagePart = { inline_data: { mime_type: file.type, data: base64Image } };
                function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
                function modelName = "gemini-1.5-flash-latest";
                function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                function payload = { contents: [{ role: "user", parts: [{ text: prompt }, imagePart] }] };
                function response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`Error en la API de visión: ${response.status}`);
                function result = await response.json();
                if (result.candidates && result.candidates[0].content.parts[0].text) {
                    summary = result.candidates[0].content.parts[0].text;
                } else {
                    throw new Error('La IA no pudo procesar la imagen.');
                }
            } else if (fileType.startsWith('audio/')) {
                function prompt = 'Transcribe el texto que escuches en el siguiente audio.';
                function base64Audio = await fileToBase64(file);
                function audioPart = { inline_data: { mime_type: file.type, data: base64Audio } };
                function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
                function modelName = "gemini-1.5-flash-latest";
                function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                function payload = { contents: [{ role: "user", parts: [{ text: prompt }, audioPart] }] };
                function response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) {
                    function errorBody = await response.text();
                    throw new Error(`Error en la API de audio: ${response.status} - ${errorBody}`);
                }
                function result = await response.json();
                if (result.candidates && result.candidates[0].content.parts[0].text) {
                    summary = result.candidates[0].content.parts[0].text;
                } else {
                    throw new Error('La IA no pudo procesar el audio.');
                }
            } else {
                throw new Error(`Tipo de archivo no soportado: ${fileType}`);
            }

            function currentObs = selectedCase.Observaciones || '';
            function newObs = `${currentObs}\n\n--- Análisis de Adjunto (${file.name}) ---\n${summary}`;

            setSelectedCase(prev => ({ ...prev, Observaciones: newObs }));
            await updateCaseInFirestore(selectedCase.id, { Observaciones: newObs });
            
            displayModalMessage('✅ Adjunto analizado y añadido a las observaciones.');
        } catch (error) {
            console.error("Error processing observation file:", error);
            displayModalMessage(`❌ Error al analizar el adjunto: ${error.message}`);
        } finally {
            setIsTranscribingObservation(false);
            if (observationFileInputRef.current) {
                observationFileInputRef.current.value = "";
            }
        }
    };
function downloadCSV = (csvContent, filename) => {
    function blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    function link = document.createElement('a');
    if (link.download !== undefined) {
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // Fallback for older browsers
        displayModalMessage('La descarga automática no es soportada en tu navegador.');
    }
};
function exportCasesToCSV = (isTodayResolvedOnly = false) => {
    function today = getColombianDateISO();
    function casesToExport = isTodayResolvedOnly
        ? cases.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === today)
        : cases;

    if (casesToExport.length === 0) {
        displayModalMessage(isTodayResolvedOnly ? 'No hay casos resueltos o finalizados hoy.' : 'No hay casos para exportar.');
        return;
    }

    // --- CAMBIO PRINCIPAL: DEFINIMOS LAS COLUMNAS EXACTAS PARA EL ARCHIVO ORIGINAL ---
    // Esta lista representa los campos que se asume vienen en el CSV de origen.
    function ORIGINAL_CSV_HEADERS = [
        'SN', 'CUN', 'Fecha Radicado', 'Dia', 'Fecha Vencimiento', 'Nombre_Cliente', 'Nro_Nuip_Cliente', 
        'Correo_Electronico_Cliente', 'Direccion_Cliente', 'Ciudad_Cliente', 'Depto_Cliente', 
        'Nombre_Reclamante', 'Nro_Nuip_Reclamante', 'Correo_Electronico_Reclamante', 'Direccion_Reclamante',
        'Ciudad_Reclamante', 'Depto_Reclamante', 'HandleNumber', 'AcceptStaffNo', 'type_request', 'obs',
        'nombre_oficina', 'Tipopago', 'date_add', 'Tipo_Operacion'
    ];

    // Para el archivo actualizado, seguimos usando todos los headers posibles.
    function baseHeaders = [
        'SN','CUN','Fecha Radicado','Fecha Cierre','Dia','Dia_Original_CSV','fecha_asignacion','Nombre_Cliente','Estado','Estado_Gestion',
        'Nivel_1','Nivel_2','Nivel_3','Nivel_4','Nivel_5','Analisis de la IA','Categoria del reclamo','Prioridad', 'Sentimiento_IA',
        'Resumen_Hechos_IA','Proyeccion_Respuesta_IA', 'Sugerencias_Accion_IA', 'Causa_Raiz_IA', 'Tipo_Contrato', 'Numero_Contrato_Marco', 'Observaciones','Observaciones_Historial', 'SNAcumulados_Historial', 'Escalamiento_Historial',
        'Numero_Reclamo_Relacionado', 'Observaciones_Reclamo_Relacionado', 'Aseguramiento_Historial',
        'Despacho_Respuesta_Checked', 'Requiere_Aseguramiento_Facturas', 'ID_Aseguramiento',
        'Corte_Facturacion', 'Cuenta', 'Operacion_Aseguramiento', 'Tipo_Aseguramiento', 'Mes_Aseguramiento',
        'Fecha_Inicio_Gestion','Tiempo_Resolucion_Minutos','Radicado_SIC','Fecha_Vencimiento_Decreto',
        'Tipo_Nuip_Cliente','Nro_Nuip_Cliente','Correo_Electronico_Cliente','Direccion_Cliente','Ciudad_Cliente','Depto_Cliente',
        'Nombre_Reclamante','Tipo_Nuip_Reclamante','Nro_Nuip_Reclamante','Correo_Electronico_Reclamante','Direccion_Reclamante',
        'Ciudad_Reclamante','Depto_Reclamante','favorabilidad','HandleNumber','AcceptStaffNo','type_request','obs',
        'Despacho_Fisico','Despacho_Electronico','Contacto_Cliente','nombre_oficina','Tipopago','date_add','Tipo_Operacion',
        'Ultima Modificacion','Fecha Cargue Planilla','Usuario Cargue Planilla','Fecha Pre-cierre Fullstack','Fecha Planilla Masivo',
        'Novedad Despacho','Clasificacion','Documento_Adjunto',
        'requiereBaja', 'numeroOrdenBaja', 'requiereAjuste', 'numeroTT', 'estadoTT', 'requiereDevolucionDinero',
        'cantidadDevolver', 'idEnvioDevoluciones', 'fechaEfectivaDevolucion',
        'areaEscalada', 'motivoEscalado', 'idEscalado', 'reqGenerado', 'descripcionEscalamiento', 'Correo_Escalacion_IA', 'Riesgo_SIC', 'Respuesta_Integral_IA'
    ];
    function dynamicHeaders = Array.from(new Set(casesToExport.flatMap(c => Object.keys(c))));
    function actualFinalHeaders = Array.from(new Set(baseHeaders.concat(dynamicHeaders)));

    // --- GENERACIÓN DEL ARCHIVO ACTUALIZADO (SIN CAMBIOS) ---
    let csvActual = actualFinalHeaders.map(h => `"${h}"`).join(',') + '\n';
    casesToExport.forEach(c => {
        function actualRow = actualFinalHeaders.map(h => {
            let v = c[h] ?? '';
            if (h === 'Dia') v = calculateCaseAge(c, nonBusinessDays);
            if (typeof v === 'object') v = JSON.stringify(v);
            return `"${String(v).replace(/"/g, '""')}"`;
        }).join(',');
        csvActual += actualRow + '\n';
    });

    // --- GENERACIÓN DEL ARCHIVO ORIGINAL (LÓGICA NUEVA) ---
    let csvOriginal = ORIGINAL_CSV_HEADERS.map(h => `"${h}"`).join(',') + '\n';
    casesToExport.forEach(c => {
        function originalRow = ORIGINAL_CSV_HEADERS.map(h => {
            let v = '';
            // Usamos 'Dia_Original_CSV' para la columna 'Dia'
            if (h === 'Dia') {
                v = c['Dia_Original_CSV'] ?? '';
            } else {
                v = c[h] ?? '';
            }
            if (typeof v === 'object') v = JSON.stringify(v);
            return `"${String(v).replace(/"/g, '""')}"`;
        }).join(',');
        csvOriginal += originalRow + '\n';
    });

    // Descargar ambos archivos
    function filenameSuffix = isTodayResolvedOnly ? `resueltos_hoy_${today}` : `todos_${today}`;
    downloadCSV(csvOriginal, `casos_originales_${filenameSuffix}.csv`);
    
    setTimeout(() => {
        downloadCSV(csvActual, `casos_actuales_${filenameSuffix}.csv`);
    }, 500);
};

function filteredAndSearchedCases = useMemo(() => {
    // Convierte el string de búsqueda en un array de términos, eliminando espacios y valores vacíos.
    function searchTerms = searchTerm.toLowerCase().split(',')
        .map(term => term.trim())
        .filter(term => term !== '');

    return cases.filter(c => {
        // Si no hay términos de búsqueda, no se aplica el filtro de búsqueda.
        function searchMatch = searchTerms.length === 0 || 
            // Itera sobre cada término de búsqueda.
            searchTerms.some(term => 
                // Para cada término, verifica si coincide en alguno de los campos definidos.
                ['SN','CUN','Nro_Nuip_Cliente','Nombre_Cliente', 'Categoria del reclamo', 'Prioridad'].some(f =>
                    String(c[f] || '').toLowerCase().includes(term)
                )
            );

        function contractMatch = contractFilter === 'todos' || c.Tipo_Contrato === contractFilter;
        function priorityMatch = priorityFilter === 'todos' || c.Prioridad === priorityFilter;
        function statusMatch = statusFilter === 'todos' || c.Estado_Gestion === statusFilter;

        return searchMatch && contractMatch && priorityMatch && statusMatch;
    });
}, [cases, searchTerm, contractFilter, priorityFilter, statusFilter]);
    
function applyActiveFilter = (cs) => {
    function pendStates = ['Pendiente','Escalado','Iniciado','Lectura','Traslado SIC','Decretado', 'Pendiente Ajustes'];
    switch(activeFilter){
        case 'all': return cs;
        case 'resolved': return cs.filter(c => c.Estado_Gestion === 'Resuelto');
        case 'finalizado': return cs.filter(c => c.Estado_Gestion === 'Finalizado');
        case 'pending_escalated_initiated': return cs.filter(c => pendStates.includes(c.Estado_Gestion));
        case 'decretado': return cs.filter(c => c.Estado_Gestion === 'Decretado' || c.Estado_Gestion === 'Traslado SIC');
        case 'pendiente_ajustes': return cs.filter(c => c.Estado_Gestion === 'Pendiente Ajustes');
        
        // ===== LÍNEAS CORREGIDAS AQUÍ =====
        // Ahora el filtro también usa el campo c.Dia
case 'dia14_pending': return cs.filter(c => pendStates.includes(c.Estado_Gestion) && calculateCaseAge(c, nonBusinessDays) === 14);
        case 'dia15_pending': return cs.filter(c => pendStates.includes(c.Estado_Gestion) && calculateCaseAge(c, nonBusinessDays) === 15);
        case 'dia_gt15_pending': return cs.filter(c => pendStates.includes(c.Estado_Gestion) && calculateCaseAge(c, nonBusinessDays) > 15);
        // ===================================
        
        case 'resolved_today': return cs.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === getColombianDateISO());
        default: return cs;
    }
};
    function casesForDisplay = applyActiveFilter(filteredAndSearchedCases);
    function sortSN = (a,b) => String(a.SN||'').toLowerCase().localeCompare(String(b.SN||'').toLowerCase());

    function sicDisp = casesForDisplay.filter(c => (c.Estado_Gestion === 'Decretado' || c.Estado_Gestion === 'Traslado SIC') && c.user === userId).sort(sortSN);
    function pendAjustesDisp = casesForDisplay.filter(c => c.Estado_Gestion === 'Pendiente Ajustes' && c.user === userId).sort(sortSN);
    function pendEscDisp = casesForDisplay.filter(c => ['Pendiente','Escalado','Iniciado','Lectura'].includes(c.Estado_Gestion) && c.user === userId).sort(sortSN);
    function resDisp = casesForDisplay.filter(c => c.Estado_Gestion === 'Resuelto' && c.user === userId).sort(sortSN);
    function finalizadosDisp = casesForDisplay.filter(c => c.Estado_Gestion === 'Finalizado' && c.user === userId).sort(sortSN);
    function aseguramientosDisp = casesForDisplay.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && Array.isArray(c.Aseguramiento_Historial) && c.Aseguramiento_Historial.length > 0).sort(sortSN);

function counts = {
    total: cases.length,
    resolved: cases.filter(c => c.Estado_Gestion === 'Resuelto').length,
    finalizado: cases.filter(c => c.Estado_Gestion === 'Finalizado').length,
    pending: cases.filter(c => ['Pendiente','Escalado','Iniciado','Lectura','Decretado','Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion)).length,
    pendienteAjustes: cases.filter(c => c.Estado_Gestion === 'Pendiente Ajustes').length,
    
    // ===== LÍNEAS CORREGIDAS AQUÍ =====
// Ahora los contadores calculan la antigüedad en tiempo real para ser precisos.
dia14: cases.filter(c => ['Pendiente','Escalado','Iniciado','Lectura','Decretado','Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && calculateCaseAge(c, nonBusinessDays) === 14).length,
dia15: cases.filter(c => ['Pendiente','Escalado','Iniciado','Lectura','Decretado','Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && calculateCaseAge(c, nonBusinessDays) === 15).length,
diaGt15: cases.filter(c => ['Pendiente','Escalado','Iniciado','Lectura','Decretado','Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && calculateCaseAge(c, nonBusinessDays) > 15).length,
    // ===================================

    resolvedToday: cases.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === getColombianDateISO()).length,
};

    function handleSelectCase = (caseId, isMassSelect) => {
        setSelectedCaseIds(prevSelectedIds => {
            function newSelectedIds = new Set(prevSelectedIds);
            if (isMassSelect) {
                return caseId; // caseId is the new Set in this case
            }
            if (newSelectedIds.has(caseId)) {
                newSelectedIds.delete(caseId);
            } else {
                newSelectedIds.add(caseId);
            }
            return newSelectedIds;
        });
    };

function handleMassUpdate = async () => {
    if (!db || !userId || selectedCaseIds.size === 0 || !massUpdateTargetStatus) {
        displayModalMessage('Seleccione casos y un estado destino para la actualización masiva.');
        return;
    }

    setIsMassUpdating(true);
    displayModalMessage(`Actualizando ${selectedCaseIds.size} casos...`);

    try {
        function docIdsToUpdate = Array.from(selectedCaseIds);
        function docsToUpdateSnapshot = await getDocs(query(collection(db, `artifacts/${appId}/users/${userId}/cases`), where(documentId(), 'in', docIdsToUpdate)));

        if (docsToUpdateSnapshot.empty) {
            displayModalMessage('Ninguno de los casos seleccionados existe en la base de datos.');
            setIsMassUpdating(false);
            return;
        }

        function batch = writeBatch(db);
        function today = getColombianDateISO();
        function nowISO = new Date().toISOString();

        docsToUpdateSnapshot.docs.forEach(docSnapshot => {
            function currentCase = docSnapshot.data();
            function updateData = { Estado_Gestion: massUpdateTargetStatus };

            if (massUpdateObservation.trim()) {
                function newObservation = {
                    text: `(Observación Masiva) ${massUpdateObservation.trim()}`,
                    timestamp: nowISO
                };
                function existingHistory = currentCase.Observaciones_Historial || [];
                updateData.Observaciones_Historial = [...existingHistory, newObservation];
            }

            if (massUpdateTargetStatus === 'Iniciado') {
                updateData.Fecha_Inicio_Gestion = nowISO;
                updateData.Tiempo_Resolucion_Minutos = 'N/A';
            } else if (massUpdateTargetStatus === 'Resuelto') {
                updateData['Fecha Cierre'] = today;
                updateData.Tiempo_Resolucion_Minutos = currentCase.Fecha_Inicio_Gestion ? getDurationInMinutes(currentCase.Fecha_Inicio_Gestion, nowISO) : 'N/A';
            }

            if (currentCase.Estado_Gestion === 'Iniciado' && massUpdateTargetStatus !== 'Iniciado') {
                sessionStorage.removeItem(`iniciadoAlertShown_${docSnapshot.id}`);
            }

            batch.update(docSnapshot.ref, updateData);
        });

        await batch.commit();
        displayModalMessage(`${docsToUpdateSnapshot.size} de ${selectedCaseIds.size} casos actualizados exitosamente a "${massUpdateTargetStatus}".`);
        setSelectedCaseIds(new Set());
        setMassUpdateTargetStatus('');
    } catch (error) {
        console.error("Error en actualización masiva:", error);
        displayModalMessage(`Error al actualizar casos masivamente: ${error.message}`);
    } finally {
        setIsMassUpdating(false);
    }
};

<div className="mt-4 mb-6 p-4 border border-teal-200 rounded-md bg-teal-50">
    <h4 className="text-lg font-semibold text-teal-800">Cálculo de Nota de Crédito</h4>
    <p className="text-sm text-gray-600 mb-4">
        Calcula el valor a reliquidar por días no utilizados en el ciclo de facturación.
    </p>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="valorMensual" className="block text-sm font-medium text-gray-700 mb-1">Valor Mensual de Factura ($):</label>
            <input
                type="number"
                id="valorMensual"
                name="valorMensual"
                value={reliquidacionData.valorMensual}
                onChange={handleReliquidacionChange}
                className="block w-full input-form"
            />
        </div>
        <div>
            <label htmlFor="fechaInicioCiclo" className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio del Ciclo:</label>
            <input
                type="date"
                id="fechaInicioCiclo"
                name="fechaInicioCiclo"
                value={reliquidacionData.fechaInicioCiclo}
                onChange={handleReliquidacionChange}
                className="block w-full input-form"
            />
        </div>
        <div>
            <label htmlFor="fechaFinCiclo" className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin del Ciclo:</label>
            <input
                type="date"
                id="fechaFinCiclo"
                name="fechaFinCiclo"
                value={reliquidacionData.fechaFinCiclo}
                onChange={handleReliquidacionChange}
                className="block w-full input-form"
            />
        </div>
        <div>
            <label htmlFor="fechaBaja" className="block text-sm font-medium text-gray-700 mb-1">Fecha de Baja/Portación:</label>
            <input
                type="date"
                id="fechaBaja"
                name="fechaBaja"
                value={reliquidacionData.fechaBaja}
                onChange={handleReliquidacionChange}
                className="block w-full input-form"
            />
        </div>
    </div>

    <div className="mt-4">
        <button
            type="button"
            onClick={calcularNotaCredito}
            className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
        >
            Calcular Nota de Crédito
        </button>
    </div>

    {reliquidacionData.montoNotaCredito !== null && (
        <div className="mt-4 p-3 bg-teal-100 rounded-md border border-teal-300">
            <p className="font-semibold text-teal-800">Resultado del Cálculo:</p>
            <p className="text-sm">El monto de la nota de crédito a aplicar es de **${reliquidacionData.montoNotaCredito} COP**.</p>
            <p className="text-xs text-gray-600 mt-2">
                Se ha añadido una entrada con este cálculo al historial de observaciones del caso.
            </p>
        </div>
    )}
</div>
    function handleReopenCase = async (caseItem) => {
    if (!db || !userId || caseItem.Estado_Gestion !== 'Resuelto') {
        displayModalMessage('Solo los casos resueltos pueden ser reabiertos.');
        return;
    }
    function caseId = caseItem.id;
    function docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
    
    try {
        function docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            displayModalMessage('Error: El caso que intenta reabrir no existe en la base de datos.');
            return;
        }

        function updateData = { Estado_Gestion: 'Pendiente', 'Fecha Cierre': '', Tiempo_Resolucion_Minutos: 'N/A' };
        await updateDoc(docRef, updateData);
        displayModalMessage('Caso reabierto exitosamente.');
    } catch (error) {
        displayModalMessage(`Error al reabrir el caso: ${error.message}`);
    }
};

    function handleDeleteCase = (caseId) => {
    function onConfirm = async () => {
        if (!db || !userId) {
            displayModalMessage('Error: DB no disponible.');
            return;
        }
        function docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
        try {
            function docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                displayModalMessage('Error: El caso que intenta eliminar no existe en la base de datos.');
                handleCloseCaseDetails();
                return;
            }

            await deleteDoc(docRef);
            displayModalMessage('Caso eliminado exitosamente.');
            handleCloseCaseDetails();
        } catch (error) {
            displayModalMessage(`Error al eliminar el caso: ${error.message}`);
        }
    };
    displayConfirmModal('¿Estás seguro de que quieres eliminar este caso de forma permanente? Esta acción no se puede deshacer.', { onConfirm });
};

    function handleMassDelete = () => {
        if (selectedCaseIds.size === 0) { displayModalMessage('No hay casos seleccionados para eliminar.'); return; }
        function onConfirm = async () => {
            setIsMassUpdating(true);
            displayModalMessage(`Eliminando ${selectedCaseIds.size} casos...`);
            function batch = writeBatch(db);
            selectedCaseIds.forEach(caseId => {
                function caseDocRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
                batch.delete(caseDocRef);
            });
            try {
                await batch.commit();
                displayModalMessage(`${selectedCaseIds.size} casos eliminados exitosamente.`);
                setSelectedCaseIds(new Set());
            } catch (error) {
                displayModalMessage(`Error al eliminar masivamente: ${error.message}`);
            } finally {
                setIsMassUpdating(false);
            }
        };
        displayConfirmModal(`¿Estás seguro de que quieres eliminar ${selectedCaseIds.size} casos permanentemente? Esta acción no se puede deshacer.`, {onConfirm});
    };

    function handleMassReopen = () => {
        if (selectedCaseIds.size === 0) { displayModalMessage('No hay casos seleccionados para reabrir.'); return; }
        function casesToReopen = cases.filter(c => selectedCaseIds.has(c.id) && c.Estado_Gestion === 'Resuelto');
        if (casesToReopen.length === 0) { displayModalMessage('Ninguno de los casos seleccionados está "Resuelto". Solo los casos resueltos pueden ser reabiertos.'); return; }
        function onConfirm = async () => {
            setIsMassUpdating(true);
            displayModalMessage(`Reabriendo ${casesToReopen.length} casos...`);
            function batch = writeBatch(db);
            function updateData = { Estado_Gestion: 'Pendiente', 'Fecha Cierre': '', Tiempo_Resolucion_Minutos: 'N/A' };
            casesToReopen.forEach(caseItem => {
                function caseDocRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseItem.id);
                batch.update(caseDocRef, updateData);
            });
            try {
                await batch.commit();
                displayModalMessage(`${casesToReopen.length} casos reabiertos exitosamente.`);
                setSelectedCaseIds(new Set());
            } catch (error) {
                displayModalMessage(`Error al reabrir masivamente: ${error.message}`);
            } finally {
                setIsMassUpdating(false);
            }
        };
        displayConfirmModal(`Se reabrirán ${casesToReopen.length} de los ${selectedCaseIds.size} casos seleccionados (solo los que están en estado "Resuelto"). ¿Continuar?`, {onConfirm});
    };

    function handleDeleteAllCases = () => {
        if (cases.length === 0) {
            displayModalMessage('No hay casos para eliminar.');
            return;
        }

        function onConfirm = async () => {
            if (!db || !userId) {
                displayModalMessage('Error: La conexión con la base de datos no está disponible.');
                return;
            }

            setIsMassUpdating(true);
            displayModalMessage(`Eliminando todos los ${cases.length} casos...`);

            function batch = writeBatch(db);
            function collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);

            try {
                function allCasesSnapshot = await getDocs(collRef);
                if (allCasesSnapshot.empty) {
                     displayModalMessage('No se encontraron casos para eliminar en la base de datos.');
                     setIsMassUpdating(false);
                     setCases([]);
                     return;
                }

                allCasesSnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                displayModalMessage(`Se eliminaron todos los ${allCasesSnapshot.size} casos exitosamente.`);
                setSelectedCaseIds(new Set());
            } catch (error) {
                console.error("Error en la eliminación total:", error);
                displayModalMessage(`Error al realizar la limpieza total: ${error.message}`);
            } finally {
                setIsMassUpdating(false);
            }
        };

        displayConfirmModal(
            `¿Está absolutamente seguro de que desea eliminar TODOS los ${cases.length} casos de la base de datos? Esta acción es irreversible.`,
            {
                onConfirm,
                confirmText: 'Sí, Eliminar Todo',
                cancelText: 'No, Cancelar'
            }
        );
    };

    function handleSNAcumuladoInputChange = (index, field, value) => {
        function newData = [...snAcumuladosData];
        newData[index][field] = value;
        setSnAcumuladosData(newData);
    };

    function handleSaveSNAcumulados = async () => {
        if (!selectedCase || snAcumuladosData.some(item => !item.sn.trim())) {
            displayModalMessage('Todos los campos de SN acumulados deben estar llenos antes de guardar.');
            return;
        }

        // MODIFICACIÓN: Busca el CUN para cada SN acumulado en la lista de casos existentes.
        function snToCunMap = new Map(cases.map(c => [String(c.SN || '').trim(), c.CUN]));

        function newHistory = snAcumuladosData.map(item => ({
            sn: item.sn.trim(),
            cun: snToCunMap.get(item.sn.trim()) || 'No encontrado', // Se añade el CUN al historial.
            obs: item.obs,
            timestamp: new Date().toISOString()
        }));

        function updatedHistory = [...(selectedCase.SNAcumulados_Historial || []), ...newHistory];

        try {
            await updateCaseInFirestore(selectedCase.id, { SNAcumulados_Historial: updatedHistory });
            setSelectedCase(prev => ({ ...prev, SNAcumulados_Historial: updatedHistory }));
            displayModalMessage('SN Acumulados guardados exitosamente.');
            // Reset fields after saving
            setCantidadSNAcumulados(0);
            setSnAcumuladosData([]);
            setTieneSNAcumulados(false);
        } catch (error) {
            displayModalMessage(`Error al guardar SN Acumulados: ${error.message}`);
        }
    };

    function handleSaveAseguramientoHistory = async () => {
        if (!selectedCase) return;
        function assuranceData = {
            timestamp: new Date().toISOString(),
            observaciones: aseguramientoObs,
            Requiere_Aseguramiento_Facturas: selectedCase.Requiere_Aseguramiento_Facturas || false,
            ID_Aseguramiento: selectedCase.ID_Aseguramiento || '',
            Corte_Facturacion: selectedCase.Corte_Facturacion || '',
            Cuenta: selectedCase.Cuenta || '',
            Operacion_Aseguramiento: selectedCase.Operacion_Aseguramiento || '',
            Tipo_Aseguramiento: selectedCase.Tipo_Aseguramiento || '',
            Mes_Aseguramiento: selectedCase.Mes_Aseguramiento || '',
            requiereBaja: selectedCase.requiereBaja || false,
            numeroOrdenBaja: selectedCase.numeroOrdenBaja || '',
            requiereAjuste: selectedCase.requiereAjuste || false,
            numeroTT: selectedCase.numeroTT || '',
            estadoTT: selectedCase.estadoTT || '',
            requiereDevolucionDinero: selectedCase.requiereDevolucionDinero || false,
            cantidadDevolver: selectedCase.cantidadDevolver || '',
            idEnvioDevoluciones: selectedCase.idEnvioDevoluciones || '',
            fechaEfectivaDevolucion: selectedCase.fechaEfectivaDevolucion || ''
        };

        function newHistory = [...(selectedCase.Aseguramiento_Historial || []), assuranceData];
        try {
            await updateCaseInFirestore(selectedCase.id, { Aseguramiento_Historial: newHistory });
            setSelectedCase(prev => ({ ...prev, Aseguramiento_Historial: newHistory }));
            displayModalMessage('Historial de aseguramiento guardado.');
            setAseguramientoObs('');
        } catch(e) {
            displayModalMessage(`Error guardando historial: ${e.message}`);
        }
    }

    function handleScanClick = (caseItem) => {
        setCaseToScan(caseItem);
        scanFileInputRef.current.click();
    };

function handleScanFileUpload = async (event) => {
    function file = event.target.files[0];
    if (!file || !caseToScan) return;

    setIsScanning(true);
    displayModalMessage(`Transcribiendo y analizando documento para SN: ${caseToScan.SN}...`);

    function reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
        function base64ImageData = reader.result.split(',')[1];
        function prompt = "Transcribe el texto de esta imagen del documento.";
        function payload = {
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: file.type, data: base64ImageData } }
                ]
            }],
        };
        function apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || ""); // Tu API Key
        function apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        try {
            function response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            function result = await response.json();
            if (response.ok && result.candidates && result.candidates[0].content.parts.length > 0) {
                function transcribedText = result.candidates[0].content.parts[0].text;

                // 1. Usamos la nueva función para extraer direcciones del texto transcrito.
                function extractedData = extractAddressesFromText(transcribedText);

                // 2. Preparamos los datos para guardarlos en la base de datos.
                function updatedObs = `${caseToScan.obs || ''}\n\n--- INICIO TRANSCRIPCIÓN ---\n${transcribedText}\n--- FIN TRANSCRIPCIÓN ---`;
                function newHistoryEntry = {
                    timestamp: new Date().toISOString(),
                    emails: extractedData.emails,
                    addresses: extractedData.addresses
                };
                function updatedHistory = [...(caseToScan.Direcciones_Extraidas || []), newHistoryEntry];
                
                // 3. Actualizamos el caso con las observaciones y las nuevas direcciones.
                await updateCaseInFirestore(caseToScan.id, {
                    obs: updatedObs,
                    Documento_Adjunto: 'Transcrito',
                    Direcciones_Extraidas: updatedHistory // Guardamos el historial de direcciones
                });

                displayModalMessage('Transcripción y extracción de direcciones completada.');
            } else {
                throw new Error(result.error?.message || 'No se pudo transcribir el documento.');
            }
        } catch (error) {
            console.error("Error transcribing document:", error);
            displayModalMessage(`Error en la transcripción: ${error.message}`);
        } finally {
            setIsScanning(false);
            setCaseToScan(null);
            if (scanFileInputRef.current) {
                scanFileInputRef.current.value = "";
            }
        }
    };
    reader.onerror = (error) => {
        console.error("Error reading file:", error);
        displayModalMessage("Error al leer el archivo.");
        setIsScanning(false);
    };
};

    useEffect(() => {
        if (cantidadSNAcumulados > 0) {
            setSnAcumuladosData(Array.from({ length: cantidadSNAcumulados }, () => ({ sn: '', obs: '' })));
        } else {
            setSnAcumuladosData([]);
        }
    }, [cantidadSNAcumulados]);

    function generateEscalationEmailHandler = async () => {
        if (!selectedCase) return;
        setIsGeneratingEscalationEmail(true);
        try {
            function emailBody = await getAIEscalationEmail(selectedCase);
            setSelectedCase(prev => ({ ...prev, Correo_Escalacion_IA: emailBody }));
            await updateCaseInFirestore(selectedCase.id, { Correo_Escalacion_IA: emailBody });
        } catch (e) {
            displayModalMessage(`Error generando correo de escalación: ${e.message}`);
        } finally {
            setIsGeneratingEscalationEmail(false);
        }
    };
    
    function generateRiskAnalysisHandler = async () => {
        if (!selectedCase) return;
        setIsGeneratingRiskAnalysis(true);
        try {
            function risk = await getAIRiskAnalysis(selectedCase);
            setSelectedCase(prev => ({ ...prev, Riesgo_SIC: risk }));
            await updateCaseInFirestore(selectedCase.id, { Riesgo_SIC: risk });
        } catch (e) {
            displayModalMessage(`Error generando análisis de riesgo: ${e.message}`);
        } finally {
            setIsGeneratingRiskAnalysis(false);
        }
    };
function generateAIComprehensiveResponseHandler = async () => {
    if (!selectedCase) return;
    setIsGeneratingComprehensiveResponse(true);
    try {
        function res = await getAIComprehensiveResponse(selectedCase, selectedCase.Tipo_Contrato || 'Condiciones Uniformes');
        // NUEVO: Guardar el resultado de la validación.
        function validation = await getAIValidation({ ...selectedCase, Respuesta_Integral_IA: res });

        setSelectedCase(prev => ({
            ...prev,
            Respuesta_Integral_IA: res,
            Validacion_IA: validation
        }));
        await updateCaseInFirestore(selectedCase.id, {
            Respuesta_Integral_IA: res,
            Validacion_IA: validation
        });
        displayModalMessage('Respuesta integral generada y validada exitosamente.'); // Mensaje actualizado.
    }
    catch (e) {
        displayModalMessage(`Error AI Comprehensive Response: ${e.message}`);
    }
    finally {
        setIsGeneratingComprehensiveResponse(false);
    }
};


    function handleDismissAlarm = async () => {
        if (!selectedAlarmCase || !alarmObservation.trim()) {
            displayModalMessage('Por favor, escriba una observación para gestionar la alarma.');
            return;
        }

        function todayISO = getColombianDateISO();
        function alarmKey = `alarm_dismissed_${selectedAlarmCase.id}_${todayISO}`;
        
        function newObservation = {
            text: `(Gestión Alarma Diaria) ${alarmObservation.trim()}`,
            timestamp: new Date().toISOString()
        };
        
        function existingHistory = selectedAlarmCase.Observaciones_Historial || [];
        function updatedHistory = [...existingHistory, newObservation];

        try {
            await updateCaseInFirestore(selectedAlarmCase.id, { Observaciones_Historial: updatedHistory });
            
            // Marcar la alarma como gestionada para hoy
            sessionStorage.setItem(alarmKey, 'true');
            
            // Actualizar la UI
            setAlarmCases(prev => prev.filter(c => c.id !== selectedAlarmCase.id));
            setSelectedAlarmCase(null);
            setAlarmObservation('');

            if (alarmCases.length - 1 === 0) {
                setShowAlarmModal(false);
            }
            
            displayModalMessage(`Alarma para SN ${selectedAlarmCase.SN} gestionada.`);

        } catch (error) {
            displayModalMessage(`Error al guardar la observación: ${error.message}`);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Cargando y autenticando...</div></div>;

    function renderTable = (data, title) => {
        return (
<PaginatedTable
  cases={data}
  title={title}
  mainTableHeaders={MAIN_TABLE_HEADERS}
  statusColors={statusColors}
  priorityColors={priorityColors}
  selectedCaseIds={selectedCaseIds}
  handleSelectCase={handleSelectCase}
  handleOpenCaseDetails={handleOpenCaseDetails}
  calculateCaseAge={(caseItem) => calculateCaseAge(caseItem, nonBusinessDays)}
  onScanClick={handleScanClick}
  nonBusinessDays={nonBusinessDays}
/>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">

            {/* --- Auth Modal (Tailwind) --- */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Acceso / Registro</h3>
                            <button className="text-gray-500" onClick={() => setShowAuthModal(false)} aria-label="Cerrar">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button className={`flex-1 py-2 rounded-md ${authMode==='login'?'bg-indigo-600 text-white':'bg-gray-100'}`} onClick={() => setAuthMode('login')}>Iniciar sesión</button>
                                <button className={`flex-1 py-2 rounded-md ${authMode==='register'?'bg-indigo-600 text-white':'bg-gray-100'}`} onClick={() => setAuthMode('register')}>Registrarse</button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium">Correo</label>
                                <input type="email" className="w-full mt-1 p-2 border rounded" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Contraseña</label>
                                <input type="password" className="w-full mt-1 p-2 border rounded" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} />
                            </div>

                            <div className="flex flex-col gap-2">
                                {authMode === 'login' ? (
                                    <button className="py-2 rounded-md bg-indigo-600 text-white" onClick={loginWithEmail} disabled={authLoading}>{authLoading ? 'Cargando...' : 'Iniciar sesión'}</button>
                                ) : (
                                    <button className="py-2 rounded-md bg-indigo-600 text-white" onClick={registerWithEmail} disabled={authLoading}>{authLoading ? 'Cargando...' : 'Registrarse'}</button>
                                )}

                                <button className="py-2 rounded-md border" onClick={signInWithGoogleHandler} disabled={authLoading}>
                                    {authLoading ? 'Cargando...' : 'Iniciar con Google'}
                                </button>
                            </div>

                            <p className="text-xs text-gray-500">Al registrarte aceptas los términos. Para creación administrativa de usuarios utiliza la sección de administración (solo admins).</p>
                        </div>
                    </div>
                </div>
            )}

            <input
                type="file"
                ref={scanFileInputRef}
                onChange={handleScanFileUpload}
                accept="image/png, image/jpeg"
                style={{ display: 'none' }}
            />
            <input
                type="file"
                accept=".csv"
                ref={contractMarcoFileInputRef}
                onChange={handleContractMarcoUpload}
                style={{ display: 'none' }}
            />
            <input
                type="file"
                accept=".csv"
                ref={reporteCruceFileInputRef}
                onChange={handleReporteCruceUpload}
                style={{ display: 'none' }}
            />
<input 
    type="file" 
    ref={observationFileInputRef} 
    onChange={handleObservationFileUpload}
    accept="image/png, image/jpeg, application/pdf, text/csv, audio/*" 
    style={{ display: 'none' }}
/>
            <div className="w-full max-w-7xl bg-white shadow-lg rounded-lg p-6">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Seguimiento de Casos Asignados</h1>
                <div className="flex justify-center gap-4 mb-6">
                    <button onClick={() => setActiveModule('casos')} className={`px-6 py-2 rounded-lg font-semibold ${activeModule === 'casos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                        Casos
                    </button>
                    <button onClick={() => setActiveModule('aseguramientos')} className={`px-6 py-2 rounded-lg font-semibold ${activeModule === 'aseguramientos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                        Aseguramientos
                    </button>
                </div>

                {userId && <p className="text-sm text-center mb-4">User ID: <span className="font-mono bg-gray-200 px-1 rounded">{userId}</span></p>}
                <p className="text-lg text-center mb-4">Fecha y Hora: {currentDateTime.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
                <input type="text" placeholder="Buscar por SN, CUN, Nuip... (separar con comas para búsqueda masiva)" value={searchTerm} onChange={e=>{setSearchTerm(e.target.value);setActiveFilter('all')}} className="p-3 mb-4 border rounded-lg w-full shadow-sm"/>

                {activeModule === 'casos' && (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label htmlFor="contractFilter" className="block text-sm font-medium text-gray-700">Filtrar por Contrato</label>
                            <select id="contractFilter" value={contractFilter} onChange={e => setContractFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="todos">Todos</option>
                                <option value="Condiciones Uniformes">Condiciones Uniformes</option>
                                <option value="Contrato Marco">Contrato Marco</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="priorityFilter" className="block text-sm font-medium text-gray-700">Filtrar por Prioridad</label>
                            <select id="priorityFilter" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                <option value="todos">Todas</option>
                                {ALL_PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                        <div>
                             <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700">Filtrar por Estado</label>
                             <select id="statusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                  <option value="todos">Todos</option>
                                  {ALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                             </select>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                         <div className="p-4 border rounded-lg bg-blue-50 w-full md:w-auto flex-shrink-0">
                             <h2 className="font-bold text-lg mb-2 text-blue-800">Cargar CSV de Casos</h2>
                             <input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" disabled={uploading}/>
                             {uploading && (
                                 <div className="flex items-center gap-2 mt-2">
                                     <p className="text-xs text-blue-600">Cargando...</p>
                                     <button onClick={() => { cancelUpload.current = true; }} className="px-2 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600">
                                         Cancelar
                                     </button>
                                 </div>
                             )}
                         </div>
                         <div className="flex flex-wrap justify-center gap-2">
                             <button onClick={()=>setShowManualEntryModal(true)} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75">Ingresar Manual</button>
                             <button onClick={() => contractMarcoFileInputRef.current.click()} className="px-5 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75">Cargar CSV Contrato Marco</button>
                             <button onClick={() => reporteCruceFileInputRef.current.click()} className="px-5 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75" disabled={uploading}>
                                 Cargar Reporte Cruce
                             </button>
                             <button onClick={forceRefreshCases} className="px-5 py-2 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75" disabled={refreshing}>
                                 {refreshing ? 'Actualizando...' : 'Refrescar Casos'}
                             </button>
                             <button onClick={()=>exportCasesToCSV(false)} className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75">Exportar Todos</button>
                             <button onClick={()=>exportCasesToCSV(true)} className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75">Exportar Resueltos Hoy</button>
                             <button onClick={handleDeleteAllCases} className="px-5 py-2 bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75" disabled={isMassUpdating || cases.length === 0}>
                                Limpieza Total
                             </button>
                         </div>
                    </div>
                    </>
                )}


                {selectedCaseIds.size > 0 && (
                    <div className="my-6 p-4 border border-blue-300 bg-blue-50 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-blue-700 mb-3">{selectedCaseIds.size} caso(s) seleccionado(s)</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={massUpdateTargetStatus}
                                onChange={(e) => setMassUpdateTargetStatus(e.target.value)}
                                className="p-2 border rounded-md shadow-sm flex-grow"
                            >
                                <option value="">Seleccionar Nuevo Estado...</option>
                                {ALL_STATUS_OPTIONS.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleMassUpdate}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md disabled:opacity-50"
                                disabled={!massUpdateTargetStatus || isMassUpdating}
                            >
                                {isMassUpdating ? 'Procesando...' : 'Cambiar Estado'}
                            </button>
                             <button
                                onClick={handleMassReopen}
                                className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 shadow-md disabled:opacity-50"
                                disabled={isMassUpdating}
                            >
                                {isMassUpdating ? 'Procesando...' : 'Reabrir'}
                            </button>
                            <button
                                onClick={handleMassDelete}
                                className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 shadow-md disabled:opacity-50"
                                disabled={isMassUpdating}
                            >
                                {isMassUpdating ? 'Procesando...' : 'Eliminar'}
                            </button>
                        </div>
<div className="mt-4">
                            <label htmlFor="massUpdateObs" className="block text-sm font-medium text-gray-700 mb-1">
                                Observación para Actualización Masiva (Opcional):
                            </label>
                            <textarea
                                id="massUpdateObs"
                                rows="2"
                                className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                value={massUpdateObservation}
                                onChange={(e) => setMassUpdateObservation(e.target.value)}
                                placeholder="Ej: Se actualizan casos por finalización de campaña."
                            />
                        </div>
                        {massUpdateTargetStatus === 'Resuelto' && (
                             <p className="text-xs text-orange-600 mt-2">
                                 Advertencia: Al cambiar masivamente a "Resuelto", asegúrese de que todos los casos seleccionados tengan "Despacho Respuesta" confirmado.
                                 Otros campos como Aseguramiento, Baja, o Ajuste no se validan en esta acción masiva y deben gestionarse individualmente si es necesario antes de resolver.
                             </p>
                        )}
                    </div>
                )}
                {activeModule === 'casos' && (
                    <div className="my-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-xl font-semibold text-center text-gray-700 mb-4">Casos Asignados por Día</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={asignadosPorDiaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="fecha" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="cantidad" fill="#8884d8" name="Casos Asignados" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <h4 className="text-xl font-semibold text-center text-gray-700 mb-4">Distribución de Casos Pendientes por Antigüedad</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={distribucionPorDiaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="dia" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="cantidad" fill="#82ca9d" name="Casos Pendientes" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
<div className="p-4 border rounded-lg bg-red-100 mb-6 shadow-md">
                    <h4 className="text-lg font-semibold text-red-800">Tiempo de Gestión Estimado para Día 15</h4>
                    <p className="mt-2 text-sm text-red-700">
                        Tiempo disponible: 9 horas.
                    </p>
                    <p className="mt-1 text-xl font-bold text-red-900">
                        {timePerCaseDay15}
                    </p>
                </div>
                {activeModule === 'casos' && (
                    <>
                        <div className="mb-8 mt-6 border-t pt-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                                {[
                                    {l:'Asignados',c:counts.total,f:'all',cl:'blue'},
                                    {l:'Resueltos',c:counts.resolved,f:'resolved',cl:'green'},
                                    {l:'Finalizados',c:counts.finalizado,f:'finalizado',cl:'gray'},
                                    {l:'Pendientes',c:counts.pending,f:'pending_escalated_initiated',cl:'yellow'},
                                    {l:'Pend. Ajustes',c:counts.pendienteAjustes,f:'pendiente_ajustes',cl:'pink'},
                                    {l:'Día 14 Pend.',c:counts.dia14,f:'dia14_pending',cl:'orange'},
                                    {l:'Día 15 Pend.',c:counts.dia15,f:'dia15_pending',cl:'red'},
                                    {l:'Día >15 Pend.',c:counts.diaGt15,f:'dia_gt15_pending',cl:'purple'}
                                ].map(s => (
                                    <div
                                        key={s.f}
                                        onClick={() => setActiveFilter(s.f)}
                                        className={`p-3 rounded-lg shadow-sm text-center cursor-pointer border-2 ${activeFilter === s.f ? `border-${s.cl}-500 bg-${s.cl}-100` : `border-gray-200 bg-gray-50 hover:bg-gray-100`}`}
                                    >
                                        <p className={`text-sm font-semibold text-gray-700`}>{s.l}</p>
                                        <p className={`text-2xl font-bold text-${s.cl}-600`}>{s.c}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {activeFilter!=='all'&&<div className="mb-4 text-center"><button onClick={()=>{setActiveFilter('all'); setSelectedCaseIds(new Set());}} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Limpiar Filtros y Selección</button></div>}

                        {renderTable(sicDisp, 'Envíos SIC')}
                        {renderTable(pendAjustesDisp, 'Pendiente Ajustes')}
                        {renderTable(pendEscDisp, 'Otros Casos Pendientes o Escalados')}
                        {renderTable(resDisp, 'Casos Resueltos')}
                        {renderTable(finalizadosDisp, 'Casos Finalizados')}
                        {casesForDisplay.length === 0 && <p className="p-6 text-center">No hay casos que coincidan con los filtros seleccionados.</p>}
                    </>
                )}
                 {activeModule === 'aseguramientos' && (
                    <>
                        {renderTable(aseguramientosDisp, 'Casos Resueltos con Aseguramiento')}
                    </>
                )}

            </div>

            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[100]">
<div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">Mensaje del Sistema</h3>
                        <p className="mb-6 whitespace-pre-line">{modalContent.message}</p>
                        <div className="flex justify-end gap-4">
                            {modalContent.isConfirm && (
                                <button
                                    onClick={() => {
                                        if(modalContent.onConfirm) modalContent.onConfirm();
                                        setShowModal(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    {modalContent.confirmText}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if(modalContent.onCancel) modalContent.onCancel();
                                    else setShowModal(false);
                                }}
                                className={`px-4 py-2 rounded-md ${modalContent.isConfirm ? 'bg-gray-300 hover:bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                                {modalContent.cancelText || 'Cerrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedCase && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-auto overflow-y-auto max-h-[90vh]">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Detalles del Caso: {selectedCase.SN}</h3>
                        {duplicateCasesDetails.length > 0 && 
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                                <strong className="font-bold">¡Alerta!</strong>
                                <span className="block sm:inline ml-2">{duplicateCasesDetails.length} caso(s) relacionado(s) encontrado(s).</span>
                                <ul className="mt-2 list-disc list-inside">
                                    {duplicateCasesDetails.map(d => (
                                        <li key={d.id} className="text-sm flex justify-between items-center">
                                            <span>SN: {d.SN}, CUN: {d.CUN || 'N/A'}, Cliente: {d.Nombre_Cliente} (Match por {d.type})</span>
                                            {d.type === 'Reporte Cruce' && !d.isAssigned && (
                                                <button 
                                                    onClick={() => handleAssignFromReport(d.data)} 
                                                    className="ml-4 px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                                >
                                                    Asignar
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        }
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                            {MODAL_DISPLAY_HEADERS.map(header => {
                                // NOTE: The following definitions inside the map are inefficient.
                                // It's a temporary fix to implement the user's request with minimal code changes.
                                // Ideally, these should be defined once outside the map function.
                                function nonEditableFields = ['CUN', 'fecha_asignacion', 'user', 'Estado_Gestion', 'Fecha_Inicio_Gestion', 'Tiempo_Resolucion_Minutos', 'Resumen_Hechos_IA', 'date_add'];
                                function dateFields = ['Fecha Radicado', 'Fecha Cierre', 'Fecha_Vencimiento_Decreto', 'Fecha Vencimiento'];
                                function textAreaFields = ['obs', 'Analisis de la IA'];

                                let isEditable = !nonEditableFields.includes(header);
                                if (header === 'SN' && selectedCase.Estado_Gestion !== 'Decretado') {
                                    isEditable = false;
                                }

                                if (header === 'isNabis') {
                                    return (
                                        <div key={header} className="bg-gray-50 p-3 rounded-md flex items-center">
                                            <label className="inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    name="isNabis"
                                                    className="form-checkbox h-5 w-5 text-purple-600 rounded"
                                                    checked={selectedCase.isNabis || false}
                                                    onChange={(e) => handleModalFieldChange('isNabis', e.target.checked)}
                                                />
                                                <span className="ml-2 font-medium text-gray-800">CM Nabis</span>
                                            </label>
                                        </div>
                                    );
                                }

                                if (header === 'Tipo_Contrato') {
                                    return (
                                        <div key={header} className="bg-gray-50 p-3 rounded-md">
                                            <label htmlFor="modal-Tipo_Contrato" className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Contrato:</label>
                                            <select id="modal-Tipo_Contrato" value={selectedCase.Tipo_Contrato || 'Condiciones Uniformes'} onChange={(e) => handleContractTypeChange(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2">
                                                <option value="Condiciones Uniformes">Condiciones Uniformes</option>
                                                <option value="Contrato Marco">Contrato Marco</option>
                                            </select>
                                        </div>
                                    );
                                }
                                
                                function isDate = dateFields.includes(header);
                                function isTextArea = textAreaFields.includes(header);


                                return (
                                    <React.Fragment key={header}>
                                    <div className={`bg-gray-50 p-3 rounded-md ${isTextArea || header === 'Resumen_Hechos_IA' || header === 'Observaciones_Reclamo_Relacionado' ? 'lg:col-span-3 md:col-span-2' : ''}`}>
                                        <label htmlFor={`modal-${header}`} className="block text-sm font-semibold text-gray-700 mb-1">{header.replace(/_/g, ' ')}:</label>
                                        { isEditable ? (
                                            <>
                                            <div className="relative">
                                                {isTextArea ?
                                                    <textarea id={`modal-${header}`} rows={3} className="block w-full rounded-md p-2 pr-10" value={selectedCase[header]||''} onChange={e=>handleModalFieldChange(header,e.target.value)} />
                                                    :
                                                    <input type={isDate ? 'date' : header === 'Dia' ? 'number' : 'text'} id={`modal-${header}`} className="block w-full rounded-md p-2 pr-10" value={header === 'Dia' ? calculateCaseAge(selectedCase, nonBusinessDays) : (selectedCase[header] || '')} onChange={e=>handleModalFieldChange(header, e.target.value)} />
                                                }
                                                {['obs', 'Analisis de la IA'].includes(header) && (
                                                    <button onClick={() => copyToClipboard(selectedCase[header] || '', header.replace(/_/g, ' '), displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title={`Copiar ${header.replace(/_/g, ' ')}`}>Copiar</button>
                                                )}
                                            </div>
                                             {(header === 'obs' || header === 'Analisis de la IA') && (
                                                 <button onClick={generateAIAnalysis} className="mt-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50" disabled={isGeneratingAnalysis}>
                                                      {isGeneratingAnalysis ? 'Regenerando...' : 'Regenerar Análisis y Categoría'}
                                                  </button>
                                             )}
                                            </>
                                        )
                                        : header === 'user' ? (<div className="flex items-center gap-2"><input type="text" id="caseUser" value={selectedCase.user||''} readOnly className="block w-full rounded-md p-2 bg-gray-100"/><button onClick={handleAssignUser} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Asignar</button></div>)
                                        : header === 'Resumen_Hechos_IA' ? (
                                            <div className="relative">
                                                <textarea rows="3" className="block w-full rounded-md p-2 pr-10 bg-gray-100" value={selectedCase.Resumen_Hechos_IA||'No generado'} readOnly/>
                                                <button onClick={() => copyToClipboard(selectedCase.Resumen_Hechos_IA || '', 'Resumen Hechos IA', displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title="Copiar Resumen Hechos IA">Copiar</button>
                                                <button onClick={generateAISummaryHandler} className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded-md text-sm" disabled={isGeneratingSummary}>{isGeneratingSummary?'Generando...':'Generar Resumen IA'}</button>
                                            </div>
                                        )
                                        : <p className={`text-base break-words`}>{selectedCase[header]||'N/A'}</p>}
                                    </div>
                                    {header === 'Numero_Reclamo_Relacionado' && selectedCase.Numero_Reclamo_Relacionado && selectedCase.Numero_Reclamo_Relacionado !== 'N/A' && (
                                         <div className="bg-gray-50 p-3 rounded-md lg:col-span-2 md:col-span-2">
                                             <label htmlFor="Observaciones_Reclamo_Relacionado" className="block text-sm font-semibold text-gray-700 mb-1">Observaciones del Reclamo Relacionado:</label>
                                             <textarea id="Observaciones_Reclamo_Relacionado" rows="3" className="block w-full rounded-md p-2" value={selectedCase.Observaciones_Reclamo_Relacionado || ''} onChange={e => handleModalFieldChange('Observaciones_Reclamo_Relacionado', e.target.value)} placeholder="Añadir observaciones sobre el reclamo relacionado..."/>
                                         </div>
                                    )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                        
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            {/* Next Actions Section */}
                            <div className="p-4 border rounded-lg bg-indigo-50">
                                <h4 className="text-lg font-semibold text-indigo-800 mb-3">Sugerencias de Próxima Acción (IA)</h4>
                                {isGeneratingNextActions ? (
                                    <p className="text-sm text-indigo-700">Generando sugerencias...</p>
                                ) : (
                                    <>
                                        {(!selectedCase.Sugerencias_Accion_IA || selectedCase.Sugerencias_Accion_IA.length === 0) ? (
                                            <button onClick={generateNextActionsHandler} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm">
                                                ✨ Generar Próximas Acciones
                                            </button>
                                        ) : (
                                            <div>
                                                <ul className="list-disc list-inside space-y-2 text-sm text-gray-800">
                                                    {(Array.isArray(selectedCase.Sugerencias_Accion_IA) ? selectedCase.Sugerencias_Accion_IA : []).map((action, index) => <li key={index}>{action}</li>)}

                                                </ul>
                                                <button onClick={generateNextActionsHandler} className="mt-3 px-3 py-1 bg-indigo-200 text-indigo-800 rounded-md hover:bg-indigo-300 text-xs">
                                                    ✨ Regenerar
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Root Cause Analysis Section */}
                            {(selectedCase.Estado_Gestion === 'Resuelto' || selectedCase.Estado_Gestion === 'Finalizado') && (
                                <div className="p-4 border rounded-lg bg-green-50">
                                    <h4 className="text-lg font-semibold text-green-800 mb-3">Análisis de Causa Raíz (IA)</h4>
                                    {isGeneratingRootCause ? (
                                        <p className="text-sm text-green-700">Generando análisis...</p>
                                    ) : (
                                        <>
                                            {!selectedCase.Causa_Raiz_IA ? (
                                                 <button onClick={generateRootCauseHandler} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                                                     ✨ Analizar Causa Raíz
                                                 </button>
                                            ) : (
                                                <div>
                                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedCase.Causa_Raiz_IA}</p>
                                                    <button onClick={generateRootCauseHandler} className="mt-3 px-3 py-1 bg-green-200 text-green-800 rounded-md hover:bg-green-300 text-xs">
                                                        ✨ Regenerar Análisis
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                             {/* Risk Analysis Section */}
                            <div className="p-4 border rounded-lg bg-red-50 md:col-span-2">
                                <h4 className="text-lg font-semibold text-red-800 mb-3">Análisis de Riesgo de Escalación a SIC (IA)</h4>
                                {isGeneratingRiskAnalysis ? (
                                    <p className="text-sm text-red-700">Calculando riesgo...</p>
                                ) : (
                                    <>
                                        {(!selectedCase.Riesgo_SIC || !selectedCase.Riesgo_SIC.riesgo) ? (
                                            <button onClick={generateRiskAnalysisHandler} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">
                                                ✨ Calcular Riesgo
                                            </button>
                                        ) : (
                                            <div>
                                                <p className="text-base">
                                                    <span className="font-bold">Nivel de Riesgo:</span>
                                                    <span className={`font-semibold ml-2 px-2 py-1 rounded-full ${
                                                        selectedCase.Riesgo_SIC.riesgo === 'Bajo' ? 'bg-green-200 text-green-800' :
                                                        selectedCase.Riesgo_SIC.riesgo === 'Medio' ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'
                                                    }`}>
                                                        {selectedCase.Riesgo_SIC.riesgo}
                                                    </span>
                                                </p>
                                                <p className="text-sm text-gray-800 mt-2"><strong>Justificación:</strong> {selectedCase.Riesgo_SIC.justificacion}</p>
                                                <button onClick={generateRiskAnalysisHandler} className="mt-3 px-3 py-1 bg-red-200 text-red-800 rounded-md hover:bg-red-300 text-xs">
                                                    ✨ Recalcular
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                        </div>


                        <div className="mt-4 mb-6 p-4 border border-orange-200 rounded-md bg-orange-50">
                            <h4 className="text-lg font-semibold text-orange-800 mb-3">Gestión de SN Acumulados</h4>
                            <div className="mb-3">
                                <label className="inline-flex items-center">
                                    <input type="checkbox" className="form-checkbox h-5 w-5 text-orange-600" checked={tieneSNAcumulados} onChange={(e) => { setTieneSNAcumulados(e.target.checked); if (!e.target.checked) setCantidadSNAcumulados(0); }} />
                                    <span className="ml-2 text-gray-700 font-medium">¿Tiene SN Acumulados?</span>
                                </label>
                            </div>

                            {tieneSNAcumulados && (
                                <div className="mb-4">
                                    <label htmlFor="cantidadSNAcumulados" className="block text-sm font-medium text-gray-700 mb-1">Cantidad de SN a acumular:</label>
                                    <select id="cantidadSNAcumulados" value={cantidadSNAcumulados} onChange={(e) => setCantidadSNAcumulados(Number(e.target.value))} className="block w-full max-w-xs input-form">
                                        <option value="0">Seleccione...</option>
                                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                            )}

                            {snAcumuladosData.map((item, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-3 border rounded-md bg-white">
                                    <div>
                                        <label htmlFor={`sn-acumulado-${index}`} className="block text-sm font-medium text-gray-700 mb-1">SN Acumulado {index + 1}:</label>
                                        <input type="text" id={`sn-acumulado-${index}`} value={item.sn} onChange={(e) => handleSNAcumuladoInputChange(index, 'sn', e.target.value)} className="block w-full input-form" placeholder="Ingrese el SN" required />
                                    </div>
                                    <div>
                                        <label htmlFor={`obs-acumulado-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Observaciones SN {index + 1}:</label>
                                        <textarea id={`obs-acumulado-${index}`} value={item.obs} onChange={(e) => handleSNAcumuladoInputChange(index, 'obs', e.target.value)} className="block w-full input-form" rows="2" placeholder="Observaciones del SN acumulado" />
                                    </div>
                                </div>
                            ))}

                            {cantidadSNAcumulados > 0 && (
                                <button onClick={handleSaveSNAcumulados} className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700" disabled={snAcumuladosData.some(item => !item.sn.trim())}>
                                    Guardar SN Acumulados
                                </button>
                            )}

                            <div className="mt-4">
                                <h5 className="text-md font-semibold mb-2">Historial de SN Acumulados:</h5>
                                {Array.isArray(selectedCase.SNAcumulados_Historial) && selectedCase.SNAcumulados_Historial.length > 0 ? (
                                    <ul className="space-y-2 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">
                                        {selectedCase.SNAcumulados_Historial.map((item, idx) => (
                                            <li key={idx} className="border-b pb-1 last:border-b-0">
                                                <p className="font-semibold">SN: {item.sn} <span className="font-normal text-gray-500">({new Date(item.timestamp).toLocaleString()})</span></p>
                                                <p className="whitespace-pre-wrap pl-2">Obs: {item.obs}</p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500">No hay SN acumulados guardados.</p>
                                )}
                            </div>
                        </div>

                        {selectedCase.Estado_Gestion === 'Escalado' && (
                            <div className="mt-4 mb-6 p-4 border border-red-200 rounded-md bg-red-50">
                                <h4 className="text-lg font-semibold text-red-800 mb-3">Detalles de Escalación</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="areaEscalada" className="block text-sm font-medium text-gray-700 mb-1">Área Escalada:</label>
                                        <select id="areaEscalada" name="areaEscalada" value={selectedCase.areaEscalada || ''} onChange={(e) => handleModalFieldChange('areaEscalada', e.target.value)} className="block w-full input-form">
                                            <option value="">Seleccione Área...</option>{AREAS_ESCALAMIENTO.map(area => <option key={area} value={area}>{area}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="motivoEscalado" className="block text-sm font-medium text-gray-700 mb-1">Motivo/Acción Escalado:</label>
                                        <select id="motivoEscalado" name="motivoEscalado" value={selectedCase.motivoEscalado || ''} onChange={(e) => handleModalFieldChange('motivoEscalado', e.target.value)} className="block w-full input-form" disabled={!selectedCase.areaEscalada}>
                                            <option value="">Seleccione Motivo/Acción...</option>{(MOTIVOS_ESCALAMIENTO_POR_AREA[selectedCase.areaEscalada] || []).map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <button onClick={handleSuggestEscalation} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50" disabled={isSuggestingEscalation}>
                                            ✨ {isSuggestingEscalation ? 'Sugiriendo...' : 'Sugerir Escalación (IA)'}
                                        </button>
                                        <button onClick={generateEscalationEmailHandler} className="ml-3 px-4 py-2 bg-teal-600 text-white rounded-md text-sm hover:bg-teal-700 disabled:opacity-50" disabled={isGeneratingEscalationEmail || !selectedCase.areaEscalada}>
                                            ✨ {isGeneratingEscalationEmail ? 'Redactando...' : 'Redactar Correo (IA)'}
                                        </button>
                                    </div>
                                    <div><label htmlFor="idEscalado" className="block text-sm font-medium text-gray-700 mb-1">ID Escalado:</label><input type="text" id="idEscalado" name="idEscalado" value={selectedCase.idEscalado || ''} onChange={(e) => handleModalFieldChange('idEscalado', e.target.value)} className="block w-full input-form" placeholder="ID del escalamiento"/></div>
                                    <div><label htmlFor="reqGenerado" className="block text-sm font-medium text-gray-700 mb-1">REQ Generado:</label><input type="text" id="reqGenerado" name="reqGenerado" value={selectedCase.reqGenerado || ''} onChange={(e) => handleModalFieldChange('reqGenerado', e.target.value)} className="block w-full input-form" placeholder="REQ o ticket generado"/></div>
                                    <div className="md:col-span-2"><label htmlFor="descripcionEscalamiento" className="block text-sm font-medium text-gray-700 mb-1">Descripción Breve del Escalamiento:</label><textarea id="descripcionEscalamiento" name="descripcionEscalamiento" rows="3" value={selectedCase.descripcionEscalamiento || ''} onChange={(e) => handleModalFieldChange('descripcionEscalamiento', e.target.value)} className="block w-full input-form" placeholder="Añada una descripción del escalamiento..."/></div>
                                </div>
                                {selectedCase.Correo_Escalacion_IA && (
                                    <div className="mt-4">
                                        <h5 className="text-md font-semibold mb-2">Correo de Escalación (IA):</h5>
                                        <div className="relative">
                                            <textarea rows="6" className="block w-full rounded-md p-2 pr-10 bg-gray-50 border" value={selectedCase.Correo_Escalacion_IA} readOnly />
                                            <button onClick={() => copyToClipboard(selectedCase.Correo_Escalacion_IA, 'Correo de Escalación', displayModalMessage)} className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded" title="Copiar Correo">Copiar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-4 border-t pt-4">
                                    <button onClick={handleSaveEscalamientoHistory} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Guardar Escalación</button>
                                </div>
                                <div className="mt-4">
                                    <h5 className="text-md font-semibold mb-2">Historial de Escalaciones:</h5>
                                     {Array.isArray(selectedCase.Escalamiento_Historial) && selectedCase.Escalamiento_Historial.length > 0 ? (
                                         <ul className="space-y-2 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">
                                             {selectedCase.Escalamiento_Historial.map((item, idx) => (
                                                 <li key={idx} className="border-b pb-1 last:border-b-0">
                                                     <p className="font-semibold text-gray-700">Escalado: {new Date(item.timestamp).toLocaleString()}</p>
                                                     <p><strong>Área:</strong> {item.areaEscalada}, <strong>Motivo:</strong> {item.motivoEscalado}</p>
                                                     <p><strong>ID:</strong> {item.idEscalado || 'N/A'}, <strong>REQ:</strong> {item.reqGenerado || 'N/A'}</p>
                                                     {item.descripcionEscalamiento && <p><strong>Desc:</strong> {item.descripcionEscalamiento}</p>}
                                                 </li>
                                             ))}
                                         </ul>
                                     ) : (
                                         <p className="text-sm text-gray-500">No hay historial de escalación.</p>
                                     )}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 mb-6 p-4 border border-blue-200 rounded-md bg-blue-50">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowGestionesAdicionales(prev => !prev)}>
                                <h4 className="text-lg font-semibold text-blue-800">Aseguramiento y Gestiones Adicionales</h4>
                                <span className="text-blue-600 font-bold text-xl">{showGestionesAdicionales ? '-' : '+'}</span>
                            </div>
                            {showGestionesAdicionales && (
                            <div className="mt-3">
                                <div className="mb-3">
                                    <label className="inline-flex items-center">
                                        <input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600" name="Requiere_Aseguramiento_Facturas" checked={selectedCase.Requiere_Aseguramiento_Facturas || false} onChange={(e) => handleModalFieldChange('Requiere_Aseguramiento_Facturas', e.target.checked)} />
                                        <span className="ml-2 text-gray-700 font-medium">¿Requiere Aseguramiento Próximas Facturas?</span>
                                    </label>
                                </div>
                                {selectedCase.Requiere_Aseguramiento_Facturas && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-5 mb-4 border-l-2 border-blue-300">
                                        <div><label htmlFor="ID_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">ID Aseguramiento:</label><input type="text" id="ID_Aseguramiento" name="ID_Aseguramiento" className="block w-full input-form" value={selectedCase.ID_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('ID_Aseguramiento', e.target.value)} placeholder="ID"/></div>
                                        <div><label htmlFor="Corte_Facturacion_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Corte Facturación:</label><input type="text" id="Corte_Facturacion_Aseguramiento" name="Corte_Facturacion" className="block w-full input-form" value={selectedCase.Corte_Facturacion || ''} onChange={(e) => handleModalFieldChange('Corte_Facturacion', e.target.value)} placeholder="Ej: 15" disabled={!!selectedCase.ID_Aseguramiento}/></div>
                                        <div><label htmlFor="Cuenta_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Cuenta:</label><input type="text" id="Cuenta_Aseguramiento" name="Cuenta" className="block w-full input-form" value={selectedCase.Cuenta || ''} onChange={(e) => handleModalFieldChange('Cuenta', e.target.value)} placeholder="Número cuenta" disabled={!!selectedCase.ID_Aseguramiento}/></div>
                                        <div><label htmlFor="Operacion_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Operación Aseguramiento:</label><select id="Operacion_Aseguramiento" name="Operacion_Aseguramiento" value={selectedCase.Operacion_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('Operacion_Aseguramiento', e.target.value)} className="block w-full input-form" disabled={!!selectedCase.ID_Aseguramiento}><option value="">Seleccione...</option>{TIPOS_OPERACION_ASEGURAMIENTO.map(op => <option key={op} value={op}>{op}</option>)}</select></div>
                                        <div><label htmlFor="Mes_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Mes Aseguramiento:</label><select id="Mes_Aseguramiento" name="Mes_Aseguramiento" value={selectedCase.Mes_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('Mes_Aseguramiento', e.target.value)} className="block w-full input-form" disabled={!!selectedCase.ID_Aseguramiento}><option value="">Seleccione...</option>{MESES_ASEGURAMIENTO.map(mes => <option key={mes} value={mes}>{mes.charAt(0).toUpperCase() + mes.slice(1)}</option>)}</select></div>
                                        <div className="md:col-span-2"><label htmlFor="Tipo_Aseguramiento" className="block text-sm font-medium text-gray-700 mb-1">Tipo Aseguramiento:</label><select id="Tipo_Aseguramiento" name="Tipo_Aseguramiento" value={selectedCase.Tipo_Aseguramiento || ''} onChange={(e) => handleModalFieldChange('Tipo_Aseguramiento', e.target.value)} className="block w-full input-form" disabled={!!selectedCase.ID_Aseguramiento}><option value="">Seleccione...</option>{TIPOS_ASEGURAMIENTO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}</select></div>
                                    </div>
                                )}

                                <div className="mb-3 mt-4">
                                    <label className="inline-flex items-center">
                                        <input type="checkbox" className="form-checkbox h-5 w-5 text-red-600" name="requiereBaja" checked={selectedCase.requiereBaja || false} onChange={(e) => handleModalFieldChange('requiereBaja', e.target.checked)} />
                                        <span className="ml-2 text-gray-700 font-medium">¿Requiere Baja?</span>
                                    </label>
                                </div>
                                {selectedCase.requiereBaja && (
                                    <div className="pl-5 mb-4 border-l-2 border-red-300">
                                        <label htmlFor="numeroOrdenBaja" className="block text-sm font-medium text-gray-700 mb-1">Número de Orden de Baja:</label>
                                        <input type="text" id="numeroOrdenBaja" name="numeroOrdenBaja" className="block w-full input-form" value={selectedCase.numeroOrdenBaja || ''} onChange={(e) => handleModalFieldChange('numeroOrdenBaja', e.target.value)} placeholder="Número de Orden"/>
                                    </div>
                                )}

                                <div className="mb-3 mt-4">
                                    <label className="inline-flex items-center">
                                        <input type="checkbox" className="form-checkbox h-5 w-5 text-green-600" name="requiereAjuste" checked={selectedCase.requiereAjuste || false} onChange={(e) => handleModalFieldChange('requiereAjuste', e.target.checked)} />
                                        <span className="ml-2 text-gray-700 font-medium">¿Requiere Ajuste?</span>
                                    </label>
                                </div>
                                {selectedCase.requiereAjuste && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-5 mb-4 border-l-2 border-green-300">
                                        <div>
                                            <label htmlFor="numeroTT" className="block text-sm font-medium text-gray-700 mb-1">Número de TT:</label>
                                            <input type="text" id="numeroTT" name="numeroTT" className="block w-full input-form" value={selectedCase.numeroTT || ''} onChange={(e) => handleModalFieldChange('numeroTT', e.target.value)} placeholder="Número TT"/>
                                        </div>
                                        <div>
                                            <label htmlFor="estadoTT" className="block text-sm font-medium text-gray-700 mb-1">Estado TT:</label>
                                            <select id="estadoTT" name="estadoTT" value={selectedCase.estadoTT || ''} onChange={(e) => handleModalFieldChange('estadoTT', e.target.value)} className="block w-full input-form">
                                                <option value="">Seleccione Estado...</option>
                                                {ESTADOS_TT.map(estado => <option key={estado} value={estado}>{estado}</option>)}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="inline-flex items-center mt-2">
                                                <input type="checkbox" className="form-checkbox h-5 w-5 text-green-600" name="requiereDevolucionDinero" checked={selectedCase.requiereDevolucionDinero || false} onChange={(e) => handleModalFieldChange('requiereDevolucionDinero', e.target.checked)} disabled={!selectedCase.requiereAjuste}/>
                                                <span className="ml-2 text-gray-700">¿Requiere Devolución Dinero?</span>
                                            </label>
                                        </div>
                                        {selectedCase.requiereDevolucionDinero && (
                                            <div className="contents">
                                                <div><label htmlFor="cantidadDevolver" className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Devolver:</label><input type="number" step="0.01" id="cantidadDevolver" name="cantidadDevolver" className="block w-full input-form" value={selectedCase.cantidadDevolver || ''} onChange={(e) => handleModalFieldChange('cantidadDevolver', e.target.value)} placeholder="0.00" disabled={!selectedCase.requiereAjuste || !selectedCase.requiereDevolucionDinero}/></div>
                                                <div><label htmlFor="idEnvioDevoluciones" className="block text-sm font-medium text-gray-700 mb-1">ID Envío Devoluciones:</label><input type="text" id="idEnvioDevoluciones" name="idEnvioDevoluciones" className="block w-full input-form" value={selectedCase.idEnvioDevoluciones || ''} onChange={(e) => handleModalFieldChange('idEnvioDevoluciones', e.target.value)} placeholder="ID" disabled={!selectedCase.requiereAjuste || !selectedCase.requiereDevolucionDinero}/></div>
                                                <div><label htmlFor="fechaEfectivaDevolucion" className="block text-sm font-medium text-gray-700 mb-1">Fecha Efectiva Devolución:</label><input type="date" id="fechaEfectivaDevolucion" name="fechaEfectivaDevolucion" value={selectedCase.fechaEfectivaDevolucion || ''} onChange={(e) => handleModalFieldChange('fechaEfectivaDevolucion', e.target.value)} disabled={!selectedCase.requiereAjuste || !selectedCase.requiereDevolucionDinero}/></div>
                                            </div>
                                        )}
                                    </div>
                                )}
<div className="mt-4">
                                <label htmlFor="aseguramientoObs" className="block text-sm font-medium text-gray-700 mb-1">Observaciones de la Gestión:</label>
                                <textarea id="aseguramientoObs" rows="3" className="block w-full input-form" value={aseguramientoObs} onChange={(e) => setAseguramientoObs(e.target.value)} placeholder="Añadir observaciones sobre la gestión de aseguramiento, baja o ajuste..."/>
                            </div>

                            {/* --- BLOQUE DE CÓDIGO NUEVO --- */}
                            <div className="mt-4 border-t pt-4">
                                <label className="inline-flex items-center">
                                    <input 
                                        type="checkbox" 
                                        className="form-checkbox h-5 w-5 text-blue-600" 
                                        name="gestionAseguramientoCompletada" 
                                        checked={selectedCase.gestionAseguramientoCompletada || false} 
                                        onChange={(e) => handleModalFieldChange('gestionAseguramientoCompletada', e.target.checked)} 
                                    />
                                    <span className="ml-2 font-medium text-gray-700">Marcar gestión de aseguramiento como completada</span>
                                </label>
                            </div>
                            {/* ------------------------------- */}

                            <div className="mt-4 border-t pt-4">
                                <button onClick={handleSaveAseguramientoHistory} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={!selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.requiereBaja && !selectedCase.requiereAjuste}>
                                    Guardar Gestión de Aseguramiento
                                </button>
                            </div>
                                 <div className="mt-4">
                                     <h5 className="text-md font-semibold mb-2">Historial de Aseguramientos:</h5>
                                     {Array.isArray(selectedCase.Aseguramiento_Historial) && selectedCase.Aseguramiento_Historial.length > 0 ? (
                                         <ul className="space-y-3 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">
                                             {selectedCase.Aseguramiento_Historial.map((item, idx) => (
                                                 <li key={idx} className="border-b pb-2 last:border-b-0">
                                                     <p className="font-semibold text-gray-700">Guardado: {new Date(item.timestamp).toLocaleString()}</p>
                                                     {item.Requiere_Aseguramiento_Facturas && <div><p className="font-medium text-gray-600">Aseguramiento Facturas:</p><p className="pl-2">ID: {item.ID_Aseguramiento}, Corte: {item.Corte_Facturacion}, Cuenta: {item.Cuenta}, Op: {item.Operacion_Aseguramiento}, Tipo: {item.Tipo_Aseguramiento}, Mes: {item.Mes_Aseguramiento}</p></div>}
                                                     {item.requiereBaja && <div><p className="font-medium text-gray-600">Baja:</p><p className="pl-2">Orden: {item.numeroOrdenBaja}</p></div>}
                                                     {item.requiereAjuste && <div><p className="font-medium text-gray-600">Ajuste:</p><p className="pl-2">TT: {item.numeroTT}, Estado: {item.estadoTT}</p></div>}
                                                     {item.observaciones && <p className="mt-1"><strong>Obs:</strong> {item.observaciones}</p>}
                                                 </li>
                                             ))}
                                         </ul>
                                     ) : (
                                         <p className="text-sm text-gray-500">No hay historial de aseguramiento.</p>
                                     )}
                                 </div>
                            </div>
                            )}
                        </div>
<div className="mt-4 mb-6 p-4 border border-teal-200 rounded-md bg-teal-50">
    <h4 className="text-lg font-semibold text-teal-800">Cálculo de Nota de Crédito</h4>
    <p className="text-sm text-gray-600 mb-4">
        Calcula el valor a reliquidar por días no utilizados en el ciclo de facturación.
    </p>

    {reliquidacionData.map((form, index) => (
        <div key={form.id} className="p-4 mb-4 border rounded-md bg-teal-100 relative">
            {reliquidacionData.length > 1 && (
                <button
                    onClick={() => handleRemoveForm(form.id)}
                    className="absolute top-2 right-2 text-gray-500 hover:text-red-700 font-bold"
                >
                    &times;
                </button>
            )}
            <h5 className="text-md font-semibold text-teal-900 mb-3">Cálculo para Cuenta #{index + 1}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`numeroCuenta-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta:</label>
                    <input
                        type="text"
                        id={`numeroCuenta-${form.id}`}
                        name="numeroCuenta"
                        value={form.numeroCuenta}
                        onChange={(e) => handleReliquidacionChange(index, e)}
                        className="block w-full input-form"
                    />
                </div>
                <div>
                    <label htmlFor={`valorMensual-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Valor Mensual de Factura ($):</label>
                    <input
                        type="number"
                        id={`valorMensual-${form.id}`}
                        name="valorMensual"
                        value={form.valorMensual}
                        onChange={(e) => handleReliquidacionChange(index, e)}
                        className="block w-full input-form"
                    />
                </div>
                <div>
                    <label htmlFor={`fechaInicioCiclo-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio del Ciclo:</label>
                    <input
                        type="date"
                        id={`fechaInicioCiclo-${form.id}`}
                        name="fechaInicioCiclo"
                        value={form.fechaInicioCiclo}
                        onChange={(e) => handleReliquidacionChange(index, e)}
                        className="block w-full input-form"
                    />
                </div>
                <div>
                    <label htmlFor={`fechaFinCiclo-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin del Ciclo:</label>
                    <input
                        type="date"
                        id={`fechaFinCiclo-${form.id}`}
                        name="fechaFinCiclo"
                        value={form.fechaFinCiclo}
                        onChange={(e) => handleReliquidacionChange(index, e)}
                        className="block w-full input-form"
                    />
                </div>
                <div>
                    <label htmlFor={`fechaBaja-${form.id}`} className="block text-sm font-medium text-gray-700 mb-1">Fecha de Baja/Portación:</label>
                    <input
                        type="date"
                        id={`fechaBaja-${form.id}`}
                        name="fechaBaja"
                        value={form.fechaBaja}
                        onChange={(e) => handleReliquidacionChange(index, e)}
                        className="block w-full input-form"
                    />
                </div>
            </div>
            {form.montoNotaCredito !== null && (
                <div className="mt-4 p-3 bg-teal-200 rounded-md border border-teal-400">
                    <p className="font-semibold text-teal-800">Resultado:</p>
                    <p className="text-sm">El monto de la nota de crédito para la cuenta **{form.numeroCuenta}** es de **${form.montoNotaCredito} COP**.</p>
                </div>
            )}
        </div>
    ))}

    <div className="flex gap-2 mt-4">
        <button
            type="button"
            onClick={handleAddForm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
            Añadir Cuenta
        </button>
        <button
            type="button"
            onClick={calcularNotaCredito}
            className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
        >
            Calcular Nota de Crédito
        </button>
    </div>
</div>
                        <div className="mt-6 border-t pt-6">
                            <h4 className="text-xl font-semibold mb-4">Análisis y Observaciones</h4>
                            <div className="mb-4">
                                <label htmlFor="observations-input" className="block text-sm font-medium mb-1">Observaciones (Gestión):</label>
                               <div className="flex flex-col gap-2 mb-2">
    <textarea
        id="observations-input"
        rows="4"
        className="block w-full rounded-md p-2 border"
        value={selectedCase.Observaciones || ''}
        onChange={handleObservationsChange}
        placeholder="Añade observaciones..."
    />
    <div className="flex gap-2 self-end">
        <button
            onClick={() => observationFileInputRef.current.click()}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            disabled={isTranscribingObservation}
        >
            {isTranscribingObservation ? 'Transcribiendo...' : '✨ Transcribir Adjunto'}
        </button>
        <button onClick={saveObservation} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Guardar Obs.
        </button>
    </div>
</div>
                                <h5 className="text-md font-semibold mb-2">Historial Observaciones:</h5>
                                {Array.isArray(selectedCase.Observaciones_Historial) && selectedCase.Observaciones_Historial.length > 0 ? (
                                    <ul className="space-y-2 text-sm bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto border">
                                        {selectedCase.Observaciones_Historial.map((en, idx) => (
                                            <li key={idx} className="border-b pb-1 last:border-b-0">
                                                <p className="font-medium">{new Date(en.timestamp).toLocaleString()}</p>
                                                <p className="whitespace-pre-wrap">{en.text}</p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500">No hay historial.</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 border-t pt-6">
    <h4 className="text-xl font-semibold mb-2">Proyección de Respuesta IA</h4>
    <div className="relative">
        <textarea
            id="proyeccionRespuestaIA"
            rows="8"
            className="block w-full rounded-md p-2 pr-10 bg-gray-50 border whitespace-pre-wrap"
            value={selectedCase.Respuesta_Integral_IA || 'No generada'} // CAMBIADO: Ahora usa el nuevo campo
            readOnly
            placeholder="Respuesta Integral IA aparecerá aquí..."
        />
        <button
            onClick={() => copyToClipboard(selectedCase.Respuesta_Integral_IA || '', 'Respuesta Integral IA', displayModalMessage)}
            className="absolute top-1 right-1 p-1.5 text-xs bg-gray-200 hover:bg-gray-300 rounded"
            title="Copiar Respuesta Integral IA"
        >
            Copiar
        </button>
    </div>
 <button
    onClick={generateAIComprehensiveResponseHandler}
    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
    disabled={isGeneratingComprehensiveResponse}
>
    ✨ {isGeneratingComprehensiveResponse ? 'Generando...' : 'Generar Respuesta Integral (IA)'}
</button>
<button
    onClick={() => {
        function textContext = generateAITextContext(selectedCase);
        copyToClipboard(textContext, 'Contexto para Gemini', displayModalMessage);
    }}
    className="mt-3 ml-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
>
    Copiar Contexto para Gemini
</button>
</div>
                        <div className="mt-6 border-t pt-6">
                            <h4 className="text-xl font-semibold mb-2">Validación de la Respuesta (IA)</h4>
                            {selectedCase.Validacion_IA ? (
                                <div className={`p-4 rounded-md ${selectedCase.Validacion_IA.completa ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
                                    <p className="font-bold">
                                        Estatus de Validación: {selectedCase.Validacion_IA.completa ? '✅ Completa' : '❌ Incompleta'}
                                    </p>
                                    <p className="text-sm mt-2">
                                        <span className="font-semibold">Justificación:</span> {selectedCase.Validacion_IA.justificacion}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No hay validación de la IA disponible. Genere una respuesta integral primero.</p>
                            )}
                        </div>
                        <div className="mt-6 border-t pt-6">
                            <h4 className="text-xl font-semibold mb-4">Gestión del Caso</h4>
                            <div className="flex flex-wrap gap-3 mb-6">
                                {[
                                    {l:'Iniciado',s:'Iniciado',cl:'indigo'},
                                    {l:'Lectura',s:'Lectura',cl:'blue'},
                                    {l:'Decretado',s:'Decretado',cl:'purple'},
                                    {l:'Traslado SIC',s:'Traslado SIC',cl:'orange'},
                                    {l:'Pendiente Ajustes',s:'Pendiente Ajustes',cl:'pink'},
                                    {l:'Resuelto',s:'Resuelto',cl:'green'},
                                    {l:'Pendiente',s:'Pendiente',cl:'yellow'},
                                    {l:'Escalado',s:'Escalado',cl:'red'}
                                ].map(b=>(<button key={b.s} onClick={()=>handleChangeCaseStatus(b.s)} className={`px-4 py-2 rounded-md font-semibold ${selectedCase.Estado_Gestion===b.s?`bg-${b.cl}-600 text-white`:`bg-${b.cl}-200 text-${b.cl}-800 hover:bg-${b.cl}-300`} `}>{b.l}</button>))}
                            </div>
                            <div className="mb-4"><label className="inline-flex items-center"><input type="checkbox" className="form-checkbox h-5 w-5" checked={selectedCase.Despacho_Respuesta_Checked||false} onChange={handleDespachoRespuestaChange}/><span className="ml-2 font-semibold">Despacho Respuesta</span></label></div>
                        </div>

                        <div className="flex justify-end mt-6 gap-4">
                            {selectedCase.Estado_Gestion === 'Resuelto' && (
                                <button onClick={() => handleReopenCase(selectedCase)} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 mr-auto">
                                    Reabrir Caso
                                </button>
                            )}
                            <button onClick={() => handleDeleteCase(selectedCase.id)} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                                Eliminar
                            </button>
                            <button onClick={handleCloseCaseDetails} className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

{showCancelAlarmModal && (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-auto overflow-y-auto max-h-[95vh]">
            <div className="flex items-center justify-between pb-3 border-b-2 border-red-500">
                <h3 className="text-2xl font-bold text-red-700">🚨 ¡Alarma de Cancelación!</h3>
                <button onClick={() => setShowCancelAlarmModal(false)} className="text-2xl font-bold text-gray-500 hover:text-gray-800">&times;</button>
            </div>
            <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">Los siguientes casos de **cancelación de servicio o cambio a prepago** requieren tu atención. Se activó la alarma por estar a 3 días hábiles de la fecha de corte.</p>
                
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {cancelAlarmCases.map(c => (
                        <div key={c.id} className="p-3 rounded-md border bg-red-50 border-red-200">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-red-800">SN: {c.SN}</p>
                                    <p className="text-sm">
                                        <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${statusColors[c.Estado_Gestion]}`}>
                                            {c.Estado_Gestion}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">Categoría: {c['Categoria del reclamo'] || 'N/A'}</p>
                                    <p className="text-sm text-gray-700">Corte Facturación: Día {c.Corte_Facturacion}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end mt-4">
                    <button onClick={() => {
                        cancelAlarmCases.forEach(c => {
                            sessionStorage.setItem(`cancelAlarmShown_${c.id}_${getColombianDateISO()}`, 'true');
                        });
                        setShowCancelAlarmModal(false);
                    }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Cerrar Alertas
                    </button>
                </div>
            </div>
        </div>
    </div>
)}
            {showManualEntryModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-auto overflow-y-auto max-h-[90vh]">
                        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Ingresar Caso Manualmente</h3>
                        <form onSubmit={handleManualSubmit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {['SN','CUN','FechaRadicado','FechaVencimiento','Nro_Nuip_Cliente','Nombre_Cliente','Dia'].map(f=>(<div key={f}><label htmlFor={`manual${f}`} className="block text-sm font-medium mb-1">{f.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}:</label><input type={f.includes('Fecha')?'date':(f === 'Dia' ? 'number' : 'text')} id={`manual${f}`} name={f} value={manualFormData[f]} onChange={handleManualFormChange} required={['SN','CUN','FechaRadicado'].includes(f)} className="block w-full input-form"/></div>))}
                                <div className="md:col-span-2"><label htmlFor="manualOBS" className="block text-sm font-medium mb-1">OBS:</label><textarea id="manualOBS" name="OBS" rows="3" value={manualFormData.OBS} onChange={handleManualFormChange} className="block w-full input-form"/></div>
                                <div className="md:col-span-2"><label htmlFor="manualTipo_Contrato" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato:</label><select id="manualTipo_Contrato" name="Tipo_Contrato" value={manualFormData.Tipo_Contrato} onChange={handleManualFormChange} className="block w-full input-form"><option value="Condiciones Uniformes">Condiciones Uniformes</option><option value="Contrato Marco">Contrato Marco</option></select></div>
                                <div className="md:col-span-2">
                                    <label htmlFor="manualEstado_Gestion" className="block text-sm font-medium text-gray-700 mb-1">Estado Gestión Inicial:</label>
                                    <select id="manualEstado_Gestion" name="Estado_Gestion" value={manualFormData.Estado_Gestion || 'Pendiente'} onChange={handleManualFormChange} className="block w-full input-form">
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="Iniciado">Iniciado</option>
                                        <option value="Lectura">Lectura</option>
                                        <option value="Escalado">Escalado</option>
                                        <option value="Pendiente Ajustes">Pendiente Ajustes</option>
                                    </select>
                                </div>
                            </div>

                            {manualFormData.Estado_Gestion === 'Escalado' && (
                                <div className="mt-4 mb-6 p-3 border border-red-200 rounded-md bg-red-50">
                                    <h4 className="text-md font-semibold text-red-700 mb-2">Detalles de Escalación (Manual)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div><label htmlFor="manualAreaEscalada" className="block text-xs mb-1">Área Escalada:</label><select id="manualAreaEscalada" name="areaEscalada" value={manualFormData.areaEscalada} onChange={handleManualFormChange} className="block w-full input-form text-sm"><option value="">Seleccione Área...</option>{AREAS_ESCALAMIENTO.map(area => <option key={area} value={area}>{area}</option>)}</select></div>
                                        <div><label htmlFor="manualMotivoEscalado" className="block text-xs mb-1">Motivo/Acción:</label><select id="manualMotivoEscalado" name="motivoEscalado" value={manualFormData.motivoEscalado} onChange={handleManualFormChange} className="block w-full input-form text-sm" disabled={!manualFormData.areaEscalada}><option value="">Seleccione Motivo...</option>{(MOTIVOS_ESCALAMIENTO_POR_AREA[manualFormData.areaEscalada] || []).map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}</select></div>
                                        <div><label htmlFor="manualIdEscalado" className="block text-xs mb-1">ID Escalado:</label><input type="text" id="manualIdEscalado" name="idEscalado" value={manualFormData.idEscalado} onChange={handleManualFormChange} className="block w-full input-form text-sm" placeholder="ID"/></div>
                                        <div><label htmlFor="manualReqGenerado" className="block text-xs mb-1">REQ Generado:</label><input type="text" id="manualReqGenerado" name="reqGenerado" value={manualFormData.reqGenerado} onChange={handleManualFormChange} className="block w-full input-form text-sm" placeholder="REQ"/></div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 mb-6 p-3 border border-blue-200 rounded-md bg-blue-50">
                                <h4 className="text-md font-semibold text-blue-700 mb-2">Aseguramiento y Gestiones Adicionales (Manual)</h4>
                                <div className="mb-2"><label className="inline-flex items-center"><input type="checkbox" name="Requiere_Aseguramiento_Facturas" checked={manualFormData.Requiere_Aseguramiento_Facturas} onChange={handleManualFormChange} className="form-checkbox"/><span className="ml-2 text-sm">¿Aseguramiento Facturas?</span></label></div>
                                {manualFormData.Requiere_Aseguramiento_Facturas && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 mb-3 border-l-2 border-blue-300">
                                        <div><label htmlFor="manualID_Aseguramiento" className="block text-xs mb-1">ID Aseguramiento:</label><input type="text" id="manualID_Aseguramiento" name="ID_Aseguramiento" value={manualFormData.ID_Aseguramiento} onChange={handleManualFormChange} className="block w-full input-form text-sm"/></div>
                                        <div><label htmlFor="manualCorte_Facturacion" className="block text-xs mb-1">Corte Facturación:</label><input type="text" id="manualCorte_Facturacion" name="Corte_Facturacion" value={manualFormData.Corte_Facturacion} onChange={handleManualFormChange} className="block w-full input-form text-sm" disabled={!!manualFormData.ID_Aseguramiento}/></div>
                                        <div><label htmlFor="manualCuenta" className="block text-xs mb-1">Cuenta:</label><input type="text" id="manualCuenta" name="Cuenta" value={manualFormData.Cuenta} onChange={handleManualFormChange} className="block w-full input-form text-sm" disabled={!!manualFormData.ID_Aseguramiento}/></div>
                                        <div><label htmlFor="manualOperacion_Aseguramiento" className="block text-xs mb-1">Operación:</label><select name="Operacion_Aseguramiento" value={manualFormData.Operacion_Aseguramiento} onChange={handleManualFormChange} className="block w-full input-form text-sm" disabled={!!manualFormData.ID_Aseguramiento}><option value="">Seleccione...</option>{TIPOS_OPERACION_ASEGURAMIENTO.map(op=><option key={op} value={op}>{op}</option>)}</select></div>
                                        <div className="md:col-span-2"><label htmlFor="manualTipo_Aseguramiento" className="block text-xs mb-1">Tipo:</label><select name="Tipo_Aseguramiento" value={manualFormData.Tipo_Aseguramiento} onChange={handleManualFormChange} className="block w-full input-form text-sm" disabled={!!manualFormData.ID_Aseguramiento}><option value="">Seleccione...</option>{TIPOS_ASEGURAMIENTO.map(tipo=><option key={tipo} value={tipo}>{tipo}</option>)}</select></div>
                                        <div><label htmlFor="manualMes_Aseguramiento" className="block text-xs mb-1">Mes:</label><select name="Mes_Aseguramiento" value={manualFormData.Mes_Aseguramiento} onChange={handleManualFormChange} className="block w-full input-form text-sm" disabled={!!manualFormData.ID_Aseguramiento}><option value="">Seleccione...</option>{MESES_ASEGURAMIENTO.map(mes=><option key={mes} value={mes}>{mes.charAt(0).toUpperCase()+mes.slice(1)}</option>)}</select></div>
                                    </div>
                                )}

                                <div className="mb-2 mt-3"><label className="inline-flex items-center"><input type="checkbox" name="requiereBaja" checked={manualFormData.requiereBaja} onChange={handleManualFormChange} className="form-checkbox"/><span className="ml-2 text-sm">¿Requiere Baja?</span></label></div>
                                {manualFormData.requiereBaja && (
                                    <div className="pl-4 mb-3 border-l-2 border-red-300">
                                        <label htmlFor="manualNumeroOrdenBaja" className="block text-xs mb-1">Nro. Orden Baja:</label><input type="text" id="manualNumeroOrdenBaja" name="numeroOrdenBaja" value={manualFormData.numeroOrdenBaja} onChange={handleManualFormChange} className="block w-full input-form text-sm"/>
                                    </div>
                                )}

                                <div className="mb-2 mt-3"><label className="inline-flex items-center"><input type="checkbox" name="requiereAjuste" checked={manualFormData.requiereAjuste} onChange={handleManualFormChange} className="form-checkbox"/><span className="ml-2 text-sm">¿Requiere Ajuste?</span></label></div>
                                {manualFormData.requiereAjuste && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4 mb-3 border-l-2 border-green-300">
                                        <div><label htmlFor="manualNumeroTT" className="block text-xs mb-1">Nro. TT:</label><input type="text" id="manualNumeroTT" name="numeroTT" value={manualFormData.numeroTT} onChange={handleManualFormChange} className="block w-full input-form text-sm"/></div>
                                        <div><label htmlFor="manualEstadoTT" className="block text-xs mb-1">Estado TT:</label><select id="manualEstadoTT" name="estadoTT" value={manualFormData.estadoTT} onChange={handleManualFormChange} className="block w-full input-form text-sm"><option value="">Seleccione...</option>{ESTADOS_TT.map(estado=><option key={estado} value={estado}>{estado}</option>)}</select></div>
                                        <div className="md:col-span-2"><label className="inline-flex items-center mt-1"><input type="checkbox" name="requiereDevolucionDinero" checked={manualFormData.requiereDevolucionDinero} onChange={handleManualFormChange} className="form-checkbox" disabled={!manualFormData.requiereAjuste}/><span className="ml-2 text-xs">¿Devolución Dinero?</span></label></div>
                                        {manualFormData.requiereDevolucionDinero && (
                                            <div className="contents">
                                                <div><label htmlFor="manualCantidadDevolver" className="block text-xs mb-1">Cantidad a Devolver:</label><input type="number" step="0.01" id="manualCantidadDevolver" name="cantidadDevolver" value={manualFormData.cantidadDevolver} onChange={handleManualFormDevolucionChange} className="block w-full input-form text-sm" placeholder="0.00" disabled={!manualFormData.requiereAjuste || !manualFormData.requiereDevolucionDinero}/></div>
                                                <div><label htmlFor="manualIdEnvioDevoluciones" className="block text-xs mb-1">ID Envío Devoluciones:</label><input type="text" id="manualIdEnvioDevoluciones" name="idEnvioDevoluciones" value={manualFormData.idEnvioDevoluciones} onChange={handleManualFormDevolucionChange} placeholder="ID" disabled={!manualFormData.requiereAjuste || !manualFormData.requiereDevolucionDinero}/></div>
                                                <div><label htmlFor="manualFechaEfectivaDevolucion" className="block text-sm font-medium text-gray-700 mb-1">Fecha Efectiva Devolución:</label><input type="date" id="manualFechaEfectivaDevolucion" name="fechaEfectivaDevolucion" value={manualFormData.fechaEfectivaDevolucion || ''} onChange={handleManualFormDevolucionChange} className="block w-full input-form text-sm" disabled={!manualFormData.requiereAjuste || !manualFormData.requiereDevolucionDinero}/></div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3"><button type="button" onClick={()=>setShowManualEntryModal(false)} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={uploading}>{uploading?'Agregando...':'Agregar Caso'}</button></div>
                        </form>
                    </div>
                </div>
            )}
            {showAlarmModal && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-auto overflow-y-auto max-h-[95vh]">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-red-500">
                            <h3 className="text-2xl font-bold text-red-700">🚨 ¡Alarma de Casos Críticos!</h3>
                            <button onClick={() => setShowAlarmModal(false)} className="text-2xl font-bold text-gray-500 hover:text-gray-800">&times;</button>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-4">Los siguientes casos requieren tu atención inmediata. Para cerrar la alerta, debes dejar una observación de la gestión realizada.</p>
                            
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {alarmCases.map(c => (
                                    <div key={c.id} className={`p-3 rounded-md border ${selectedAlarmCase?.id === c.id ? 'bg-yellow-100 border-yellow-400' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-gray-800">SN: {c.SN} (Día {c.Dia})</p>
                                                <p className="text-sm">
                                                    <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${statusColors[c.Estado_Gestion]}`}>
                                                        {c.Estado_Gestion}
                                                    </span>
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => setSelectedAlarmCase(c)}
                                                className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600"
                                            >
                                                Gestionar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {selectedAlarmCase && (
                                <div className="mt-6 pt-4 border-t">
                                    <h4 className="text-lg font-semibold mb-2">Gestionar SN: {selectedAlarmCase.SN}</h4>
                                    <textarea
                                        rows="3"
                                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                        value={alarmObservation}
                                        onChange={(e) => setAlarmObservation(e.target.value)}
                                        placeholder="Escribe aquí la observación de la gestión realizada para cerrar esta alerta..."
                                    />
                                    <div className="flex justify-end gap-3 mt-3">
                                        <button 
                                            onClick={() => setSelectedAlarmCase(null)}
                                            className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={handleDismissAlarm}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                        >
                                            Guardar y Cerrar Alarma
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .input-form {
                    display: block;
                    width: 100%;
                    border-radius: 0.375rem; /* rounded-md */
                    border-width: 1px;
                    border-color: #D1D5DB; /* border-gray-300 */
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
                    padding: 0.5rem; /* p-2 */
                }
                .input-form:focus {
                    border-color: #3B82F6; /* focus:border-blue-500 */
                    --tw-ring-color: #3B82F6; /* focus:ring-blue-500 */
                    box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
                }
                .input-form:disabled {
                    background-color: #F3F4F6; /* bg-gray-100 or similar for disabled state */
                    cursor: not-allowed;
                }
                .sm\:text-sm {
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
                .contents { display: contents; }

            `}</style>
        </div>
    );
}
export default App;
