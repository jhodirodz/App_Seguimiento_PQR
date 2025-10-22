import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, writeBatch, query, where, documentId, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";

// Importa las utilidades y componentes auxiliares
import * as utils from './utils.js';
import * as aiServices from './aiServices';
import * as constants from './constants';
import PaginatedTable from './components/PaginatedTable';
import CaseDetailModal from './CaseDetailModal';

// Importa las funciones de autenticación desde el SDK de Firebase
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
// Importa las instancias de Firebase ya inicializadas desde tu configuración
import { db, auth } from "./firebaseConfig.js";

const appId = "App_Seguimiento_PQR";

const normalizeTextForSearch = (text) => {
    if (!text) return '';
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const KEYWORD_ALARM_TRIGGERS = [ /impuesto(s)?/, /estampilla(s)?/, /reteica/, /reinstala(r|cion|ndo|ciones)/, /reactiva(r|cion|ndo|ciones)/, /dano\s+tecnico/, /cancela(r|cion|ndo|ciones)\s+(el\s+|de\s+)?servicio/, ];

function App() {
    // --- ESTADOS GLOBALES DE LA APP ---
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- ESTADOS DE LA UI PRINCIPAL ---
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState({ message: '', isConfirm: false, onConfirm: () => { }, confirmText: 'Confirmar', cancelText: 'Cancelar' });
    const [activeModule, setActiveModule] = useState('casos');
    // Usamos 'America/Bogota' para la hora de Colombia
    const [currentDateTime, setCurrentDateTime] = useState(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));

    // --- ESTADOS RELACIONADOS CON EL MODAL ---
    const [selectedCase, setSelectedCase] = useState(null);
    const [duplicateCasesDetails, setDuplicateCasesDetails] = useState([]);

    // --- ESTADOS PARA FILTROS Y BÚSQUEDA ---
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [contractFilter, setContractFilter] = useState('todos');
    const [priorityFilter, setPriorityFilter] = useState('todos');
    const [statusFilter, setStatusFilter] = useState('todos');
    
    // --- ESTADOS PARA ACCIONES MASIVAS ---
    const [selectedCaseIds, setSelectedCaseIds] = new useState(new Set());
    const [massUpdateTargetStatus, setMassUpdateTargetStatus] = useState('');
    const [isMassUpdating, setIsMassUpdating] = useState(false);
    const [massUpdateObservation, setMassUpdateObservation] = useState('');
    
    // --- ESTADOS PARA FORMULARIO MANUAL Y OTROS DATOS ---
    const [showManualEntryModal, setShowManualEntryModal] = useState(false);
    const [manualFormData, setManualFormData] = useState(constants.initialManualFormData);
    const [reporteCruceData, setReporteCruceData] = useState([]);

    // --- REFERENCIAS ---
    const fileInputRef = useRef(null);
    const cancelUpload = useRef(false);
    const [caseToScan, setCaseToScan] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const scanFileInputRef = useRef(null);
    const contractMarcoFileInputRef = useRef(null);
    const reporteCruceFileInputRef = useRef(null);
    const observationFileInputRef = useRef(null); // <-- MANTENER ESTA REF AQUÍ
    
    // --- ALARMAS ---
    const [showAlarmModal, setShowAlarmModal] = useState(false);
    const [alarmCases, setAlarmCases] = useState([]);
    const [alarmObservation, setAlarmObservation] = useState('');
    const [selectedAlarmCase, setSelectedAlarmCase] = useState(null);
    const [showCancelAlarmModal, setShowCancelAlarmModal] = useState(false);
    const [cancelAlarmCases, setCancelAlarmCases] = useState([]);
    const [showKeywordAlarmModal, setShowKeywordAlarmModal] = useState(false);
    const [keywordAlarmCases, setKeywordAlarmCases] = useState([]);
    
    const nonBusinessDays = new Set(constants.COLOMBIAN_HOLIDAYS);
    
    // --- FUNCIONES DE UTILIDAD Y MODALES ---
    const displayModalMessage = useCallback((message) => {
        setModalContent({ message, isConfirm: false });
        setShowModal(true);
    }, []);

    const displayConfirmModal = useCallback((message, { onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) => {
        setModalContent({ message, isConfirm: true, onConfirm, onCancel: onCancel || (() => setShowModal(false)), confirmText, cancelText });
        setShowModal(true);
    }, []);

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    // --- LÓGICA DE FIREBASE ---
    async function updateCaseInFirestore(caseId, newData) {
        if (!db || !userId) return;
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
        try {
            await setDoc(docRef, newData, { merge: true });
        } catch (e) {
            console.error("Error al escribir el documento:", e);
            displayModalMessage(`Error al guardar: ${e.message}`);
        }
    }
    
    async function signInWithGoogleHandler() {
        if (!auth) { displayModalMessage('Firebase Auth no está listo'); return; }
        setAuthLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const res = await signInWithPopup(auth, provider);
            const fbUser = res.user;
            setUserId(fbUser.uid);
            const userDocRef = doc(db, `artifacts/${appId}/users`, fbUser.uid);
            const snap = await getDoc(userDocRef);
            if (!snap || !snap.exists()) {
                await setDoc(userDocRef, {
                    email: fbUser.email || null,
                    displayName: fbUser.displayName || null,
                    role: 'user',
                    createdAt: new Date().toISOString()
                });
                setUserRole('user');
            } else {
                const d = snap.data();
                setUserRole(d.role || 'user');
            }
            displayModalMessage('Inicio de sesión con Google exitoso.');
        } catch (e) {
            console.error('Google signIn error:', e);
            displayModalMessage('Error en inicio con Google: ' + (e.message || e.toString()));
        } finally {
            setAuthLoading(false);
        }
    }

    async function registerWithEmail() {
        if (!auth) { displayModalMessage('Firebase Auth no está listo'); return; }
        setAuthLoading(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
            const fbUser = cred.user;
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
    }

    async function loginWithEmail() {
        if (!auth) { displayModalMessage('Firebase Auth no está listo'); return; }
        setAuthLoading(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, authEmail, authPassword);
            const fbUser = cred.user;
            setUserId(fbUser.uid);
            displayModalMessage('Inicio de sesión exitoso.');
        } catch (e) {
            console.error('Login error:', e);
            displayModalMessage('Error en inicio de sesión: ' + (e.message || e.toString()));
        } finally {
            setAuthLoading(false);
        }
    }

    async function logout() {
        if (!auth) return;
        try {
            await signOut(auth);
            setUserId(null);
            setUserRole(null);
            displayModalMessage('Sesión cerrada.');
        } catch (e) {
            console.error('Sign out error:', e);
            displayModalMessage('Error al cerrar sesión: ' + (e.message || e.toString()));
        }
    }

    // --- LÓGICA DE MANEJO DE CASOS Y CRUD COMPLETO ---

    function handleDeleteCase(caseId) {
        async function onConfirm() {
            if (!db || !userId) { displayModalMessage('Error: DB no disponible.'); return; }
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
            try {
                await deleteDoc(docRef);
                displayModalMessage('Caso eliminado exitosamente.');
                handleCloseCaseDetails();
            } catch (error) { displayModalMessage(`Error al eliminar el caso: ${error.message}`); }
        }
        displayConfirmModal('¿Estás seguro de que quieres eliminar este caso de forma permanente? Esta acción no se puede deshacer.', { onConfirm });
    }

    function handleReopenCase(caseItem) {
        if (!caseItem.id || caseItem.Estado_Gestion !== 'Resuelto') { displayModalMessage('Solo los casos resueltos pueden ser reabiertos.'); return; }
        const updateData = { Estado_Gestion: 'Pendiente', 'Fecha Cierre': '', Tiempo_Resolucion_Minutos: 'N/A' };
        updateCaseInFirestore(caseItem.id, updateData).then(() => {
            displayModalMessage('Caso reabierto exitosamente.');
            handleCloseCaseDetails();
        }).catch(error => {
            displayModalMessage(`Error al reabrir el caso: ${error.message}`);
        });
    }

    function handleAssignFromReport(reportRowData) {
        const nuipHeader = Object.keys(reportRowData).find(h => h.toLowerCase().includes('nuip')) || 'Nro_Nuip_Cliente';
        const snHeader = Object.keys(reportRowData).find(h => h.toLowerCase().trim() === 'sn') || 'SN';
        const cunHeader = Object.keys(reportRowData).find(h => h.toLowerCase().trim() === 'cun') || 'CUN';
        const fechaRadicadoHeader = Object.keys(reportRowData).find(h => h.toLowerCase().replace(/_/g, ' ').trim() === 'fecha radicado') || 'FechaRadicado';
        const formattedDate = utils.formatDateForInput(reportRowData[fechaRadicadoHeader] || '');
        const prefilledData = {
            ...constants.initialManualFormData,
            SN: reportRowData[snHeader] || '',
            CUN: reportRowData[cunHeader] || '',
            Nro_Nuip_Cliente: reportRowData[nuipHeader] || '',
            FechaRadicado: formattedDate,
        };
        setManualFormData(prefilledData);
        handleCloseCaseDetails();
        setShowManualEntryModal(true);
    }

    // --- HANDLERS DE COMUNICACIÓN CON EL MODAL ---
    async function handleUpdateCase(caseId, newData, closeAccumulated = false) {
        await updateCaseInFirestore(caseId, newData);

        if (closeAccumulated && newData.Estado_Gestion === 'Resuelto') {
            const caseToUpdate = cases.find(c => c.id === caseId);
            if(caseToUpdate && caseToUpdate.SNAcumulados_Historial?.length > 0) {
                const batch = writeBatch(db);
                const accumulatedSNs = caseToUpdate.SNAcumulados_Historial.map(item => item.sn.trim()).filter(Boolean);
                if (accumulatedSNs.length > 0) {
                    const q = query(collection(db, `artifacts/${appId}/users/${userId}/cases`), where('SN', 'in', accumulatedSNs));
                    const querySnapshot = await getDocs(q);
                    const accumulatedAnnotationText = `Este caso fue resuelto como parte del cierre del caso principal SN: ${caseToUpdate.SN}`;
                    const accumulatedAnnotation = { text: accumulatedAnnotationText, timestamp: new Date().toISOString() };
                    querySnapshot.forEach(docSnap => {
                        const newHistory = [...(docSnap.data().Observaciones_Historial || []), accumulatedAnnotation];
                        batch.update(docSnap.ref, { Estado_Gestion: 'Resuelto', 'Fecha Cierre': utils.getColombianDateISO(), Observaciones_Historial: newHistory });
                    });
                    await batch.commit();
                }
            }
        }
        // Actualizar el estado local del caso seleccionado en App.jsx para que CaseDetailModal refleje los cambios inmediatamente.
        setSelectedCase(prev => (prev && prev.id === caseId) ? { ...prev, ...newData } : prev);
    }
    
    async function handleCreateNewCase(originalCase, newStatus) {
        try {
            const batch = writeBatch(db);
            const today = utils.getColombianDateISO();
            const timestamp = new Date().toISOString();
            const provisionalPrefix = newStatus === 'Decretado' ? 'DECRETO' : 'TRASLADO';
            const provisionalSN = `${provisionalPrefix}-${Date.now()}`;
            const newCaseData = { ...originalCase };
            delete newCaseData.id;
            delete newCaseData.SN_Original;
            Object.assign(newCaseData, { SN: provisionalSN, SN_Original: originalCase.SN, Estado_Gestion: newStatus, 'Fecha Radicado': today, 'Dia': utils.calculateBusinessDays(today, today, nonBusinessDays), 'Fecha Cierre': '', nombre_oficina: userId, Observaciones_Historial: [...(originalCase.Observaciones_Historial || []), { text: `Caso creado por ${newStatus.toLowerCase()} del SN original: ${originalCase.SN}. Radicado SIC: ${originalCase.Radicado_SIC}`, timestamp }], Aseguramiento_Historial: [], SNAcumulados_Historial: [], Escalamiento_Historial: [], areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: '' });
            batch.set(doc(collection(db, `artifacts/${appId}/users/${userId}/cases`)), newCaseData);
            const originalCaseUpdate = { Estado_Gestion: 'Resuelto', 'Fecha Cierre': today, Observaciones_Historial: [...(originalCase.Observaciones_Historial || []), { text: `Caso resuelto por ${newStatus.toLowerCase()}. Se creó un nuevo caso con SN provisional: ${provisionalSN}`, timestamp }]};
            batch.update(doc(db, `artifacts/${appId}/users/${userId}/cases`, originalCase.id), originalCaseUpdate);
            await batch.commit();
            displayModalMessage(`Caso ${newStatus.toLowerCase()} exitosamente. Se ha resuelto el caso original y creado el nuevo.`);
            handleCloseCaseDetails();
        } catch (error) {
            console.error(`Error al gestionar el caso: ${error}`);
            displayModalMessage(`Error: ${error.message}`);
        }
    }
    
    // --- LÓGICA DE MODALES Y SELECCIÓN DE CASOS ---
    const casesByNuip = useMemo(() => {
        const map = new Map();
        if (!cases || cases.length === 0) return map;
        cases.forEach(caseItem => {
            const nuips = [utils.normalizeNuip(caseItem.Nro_Nuip_Cliente), utils.normalizeNuip(caseItem.Nro_Nuip_Reclamante)].filter(nuip => nuip && nuip !== '0' && nuip !== 'N/A');
            nuips.forEach(nuip => {
                if (!map.has(nuip)) { map.set(nuip, []); }
                map.get(nuip).push(caseItem);
            });
        });
        return map;
    }, [cases]);

    async function handleOpenCaseDetails(caseItem) {
        // --- INICIO DE LA CORRECCIÓN DE FORMATO DE FECHAS (CRUCIAL) ---
        const formattedCaseItem = { ...caseItem };
        
        // Aplica el formato 'YYYY-MM-DD' a las fechas clave para el input type="date"
        if (caseItem['Fecha Radicado']) {
            formattedCaseItem['Fecha Radicado'] = utils.formatDateForInput(caseItem['Fecha Radicado']);
        }
        if (caseItem['Fecha Cierre']) {
            formattedCaseItem['Fecha Cierre'] = utils.formatDateForInput(caseItem['Fecha Cierre']);
        }
        if (caseItem['Fecha Vencimiento']) {
            formattedCaseItem['Fecha Vencimiento'] = utils.formatDateForInput(caseItem['Fecha Vencimiento']);
        }
        if (caseItem['Fecha_Vencimiento_Decreto']) {
            formattedCaseItem['Fecha_Vencimiento_Decreto'] = utils.formatDateForInput(caseItem['Fecha_Vencimiento_Decreto']);
        }
        
        setSelectedCase(formattedCaseItem);
        // --- FIN DE LA CORRECCIÓN DE FORMATO DE FECHAS ---

        const duplicatesMap = new Map();
        const normalizedCaseNuips = new Set([utils.normalizeNuip(caseItem.Nro_Nuip_Cliente), utils.normalizeNuip(caseItem.Nro_Nuip_Reclamante)].filter(nuip => nuip && nuip !== '0' && nuip !== 'N/A'));
        normalizedCaseNuips.forEach(nuip => {
            if (casesByNuip.has(nuip)) {
                casesByNuip.get(nuip).forEach(otherCase => {
                    if (otherCase.id !== caseItem.id) {
                        duplicatesMap.set(otherCase.id, { ...otherCase, type: 'Documento Asignado' });
                    }
                });
            }
        });
        // Lógica de cruce de Reporte (se mantiene en App.jsx)
        if (reporteCruceData.length > 0 && reporteCruceData[0]) {
            const nuipColumns = Object.keys(reporteCruceData[0]).filter(h => h.toLowerCase().includes('nuip'));
            const snHeader = Object.keys(reporteCruceData[0]).find(h => h.toLowerCase().trim() === 'sn');
            if (nuipColumns.length > 0 && snHeader) {
                reporteCruceData.forEach((reportRow, index) => {
                    const reportSN = String(reportRow[snHeader] || '').trim();
                    if (!reportSN) return;
                    const reportRowNuips = new Set(nuipColumns.map(col => utils.normalizeNuip(reportRow[col])).filter(Boolean));
                    const isMatchFound = [...normalizedCaseNuips].some(caseNuip => reportRowNuips.has(caseNuip));
                    if (isMatchFound) {
                        const isAlreadyAssigned = cases.some(c => c.SN === reportSN);
                        const duplicateId = `report-${reportSN}-${index}`;
                        if (!duplicatesMap.has(reportSN)) {
                            duplicatesMap.set(reportSN, { ...reportRow, id: duplicateId, type: 'Reporte Cruce', isAssigned: isAlreadyAssigned, data: reportRow });
                        }
                    }
                });
            }
        }
        setDuplicateCasesDetails(Array.from(duplicatesMap.values()));
    }

    function handleCloseCaseDetails() {
        setSelectedCase(null);
        setDuplicateCasesDetails([]);
    }

    // --- LÓGICA DE CARGA Y EXPORTACIÓN ---
    async function forceRefreshCases() {
        if (!db || !userId) { displayModalMessage("Base de datos no disponible o usuario no autenticado."); return; }
        setRefreshing(true);
        displayModalMessage("Actualizando lista de casos...");
        try {
            const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
            const snapshot = await getDocs(collRef);
            const fetchedCases = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            fetchedCases.sort((a, b) => (new Date(b['Fecha Radicado'] || 0)) - (new Date(a['Fecha Radicado'] || 0) || a.id.localeCompare(b.id)));
            setCases(fetchedCases);
            displayModalMessage("Lista de casos actualizada.");
        } catch (error) {
            console.error("Error during manual refresh:", error);
            displayModalMessage(`Error al actualizar casos: ${error.message}`);
        } finally {
            setRefreshing(false);
        }
    }

    // Función de Exportación (Reincorporada)
    const exportCasesToCSV = (isTodayResolvedOnly = false) => {
        const today = utils.getColombianDateISO();
        const casesToExport = isTodayResolvedOnly
            ? cases.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === today)
            : cases;

        if (casesToExport.length === 0) {
            displayModalMessage(isTodayResolvedOnly ? 'No hay casos resueltos o finalizados hoy.' : 'No hay casos para exportar.');
            return;
        }

        const downloadCSV = (csvContent, filename) => {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                displayModalMessage('La descarga automática no es soportada en tu navegador.');
            }
        };

        const ORIGINAL_CSV_HEADERS = [
            'SN', 'CUN', 'Fecha Radicado', 'Dia', 'Fecha Vencimiento', 'Nombre_Cliente', 'Nro_Nuip_Cliente', 
            'Correo_Electronico_Cliente', 'Direccion_Cliente', 'Ciudad_Cliente', 'Depto_Cliente', 
            'Nombre_Reclamante', 'Nro_Nuip_Reclamante', 'Correo_Electronico_Reclamante', 'Direccion_Reclamante',
            'Ciudad_Reclamante', 'Depto_Reclamante', 'HandleNumber', 'AcceptStaffNo', 'type_request', 'obs',
            'nombre_oficina', 'Tipopago', 'date_add', 'Tipo_Operacion'
        ];

        const baseHeaders = [
            ...ORIGINAL_CSV_HEADERS,
            'Fecha Cierre','Estado_Gestion','Prioridad','Analisis de la IA','Categoria del reclamo', 'Sentimiento_IA',
            'Resumen_Hechos_IA','Proyeccion_Respuesta_IA', 'Sugerencias_Accion_IA', 'Causa_Raiz_IA', 'Riesgo_SIC',
            'Tipo_Contrato', 'Numero_Contrato_Marco', 'isNabis', 'Observaciones', 'Observaciones_Historial', 
            'SNAcumulados_Historial', 'Escalamiento_Historial', 'Aseguramiento_Historial',
            'Despacho_Respuesta_Checked', 'Fecha_Inicio_Gestion','Tiempo_Resolucion_Minutos',
            'Radicado_SIC','Fecha_Vencimiento_Decreto', 'Requiere_Aseguramiento_Facturas', 'ID_Aseguramiento',
            'Corte_Facturacion', 'Cuenta', 'Operacion_Aseguramiento', 'Tipo_Aseguramiento', 'Mes_Aseguramiento',
            'requiereBaja', 'numeroOrdenBaja', 'requiereAjuste', 'numeroTT', 'estadoTT', 
            'requiereDevolucionDinero', 'cantidadDevolver', 'idEnvioDevoluciones', 'fechaEfectivaDevolucion',
        ];
        
        const dynamicHeaders = Array.from(new Set(casesToExport.flatMap(c => Object.keys(c))));
        const actualFinalHeaders = Array.from(new Set(baseHeaders.concat(dynamicHeaders)));

        // --- GENERACIÓN DEL ARCHIVO ACTUALIZADO ---
        let csvActual = actualFinalHeaders.map(h => `"${h}"`).join(',') + '\n';
        casesToExport.forEach(c => {
            const actualRow = actualFinalHeaders.map(h => {
                let v = c[h] ?? '';
                if (h === 'Dia') v = utils.calculateCaseAge(c, nonBusinessDays);
                if (typeof v === 'object') v = JSON.stringify(v);
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(',');
            csvActual += actualRow + '\n';
        });

        // --- GENERACIÓN DEL ARCHIVO ORIGINAL (con la columna 'Dia_Original_CSV' si existe) ---
        let csvOriginal = ORIGINAL_CSV_HEADERS.map(h => `"${h}"`).join(',') + '\n';
        casesToExport.forEach(c => {
            const originalRow = ORIGINAL_CSV_HEADERS.map(h => {
                let v = '';
                // Usamos 'Dia_Original_CSV' para la columna 'Dia' si está disponible
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

        const filenameSuffix = isTodayResolvedOnly ? `resueltos_hoy_${today}` : `todos_${today}`;
        downloadCSV(csvOriginal, `casos_originales_${filenameSuffix}.csv`);
        
        setTimeout(() => {
            downloadCSV(csvActual, `casos_actuales_${filenameSuffix}.csv`);
        }, 500);
    };
async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(true);
        cancelUpload.current = false;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const { data: csvDataRows } = utils.parseCSV(e.target.result);
                if (csvDataRows.length === 0) { displayModalMessage('CSV vacío o inválido.'); setUploading(false); return; }
                if (!db || !userId) { displayModalMessage('DB no lista o usuario no auth.'); setUploading(false); return; }
                const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
                const today = utils.getColombianDateISO();
                const nonBusinessDaysSet = new Set(constants.COLOMBIAN_HOLIDAYS);
                const existingDocsSnapshot = await getDocs(collRef);
                const existingCasesMap = new Map(existingDocsSnapshot.docs.map(d => [String(d.data().SN || '').trim(), { id: d.id, ...d.data() }]));
                let addedCount = 0, updatedCount = 0, skippedCount = 0;
                for (let i = 0; i < csvDataRows.length; i++) {
                    if (cancelUpload.current) { console.log("Carga cancelada por el usuario."); break; }
                    const row = csvDataRows[i];
                    const currentSN = String(row.SN || '').trim();
                    if (!currentSN) { skippedCount++; continue; }
                    displayModalMessage(`Procesando ${i + 1}/${csvDataRows.length}...`);
// --- INICIO DE LA VALIDACIÓN (OESIA) SOLICITADA ---
                    if ((!row.nombre_oficina || row.nombre_oficina.trim() === '') && row.AcceptStaffNo === 'dfgomez') {
                        row.nombre_oficina = 'OESIA';
                    }
                    // --- FIN DE LA VALIDACIÓN (OESIA) SOLICITADA ---
                    // --- INICIO DE LA CORRECCIÓN CLAVE ---
                    // Se llama a una nueva función que intenta forzar el parseo como MM/DD/YYYY,
                    // que es como lo exporta el sistema de origen o Excel por defecto.
                    const parsedFechaRadicado = utils.parseDateFromCSV(row['Fecha Radicado']);
                    // --- FIN DE LA CORRECCIÓN CLAVE ---
                    let calculatedDia = utils.calculateBusinessDays(parsedFechaRadicado, today, nonBusinessDaysSet);
                    if (String(row['nombre_oficina'] || '').toUpperCase().includes("OESIA") && calculatedDia !== 'N/A' && !isNaN(calculatedDia)) {
                        calculatedDia += 2;
                    }
                    if (existingCasesMap.has(currentSN)) {
                        const existingCaseData = existingCasesMap.get(currentSN);
                        const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, existingCaseData.id);
                        const updatedData = { ...row, 'Fecha Radicado': parsedFechaRadicado, 'Dia': calculatedDia };
                        await updateDoc(docRef, updatedData);
                        updatedCount++;
                    } else {
                        let aiAnalysisCat = { 'Analisis de la IA': 'N/A', 'Categoria del reclamo': 'N/A' }, aiPrio = 'Media', relNum = 'N/A', aiSentiment = { Sentimiento_IA: 'N/A' };
                        try {
                            const [analysis, priority, sentiment] = await Promise.all([
                                aiServices.getAIAnalysisAndCategory(row), aiServices.getAIPriority(row['obs']), aiServices.getAISentiment(row['obs'])
                            ]);
                            aiAnalysisCat = analysis; aiPrio = priority; aiSentiment = sentiment; relNum = utils.extractRelatedComplaintNumber(row['obs']);
                        } catch (aiErr) { console.error(`AI Error for new SN ${currentSN}:`, aiErr); }
                        await addDoc(collRef, {
                            ...row, user: userId, 'Fecha Radicado': parsedFechaRadicado, 'Dia': calculatedDia, Estado_Gestion: row.Estado_Gestion || 'Pendiente',
                            ...aiAnalysisCat, ...aiSentiment, Prioridad: aiPrio, Numero_Reclamo_Relacionado: relNum, Observaciones_Reclamo_Relacionado: '',
                            Aseguramiento_Historial: [], Escalamiento_Historial: [], Resumen_Hechos_IA: 'No generado', Proyeccion_Respuesta_IA: 'No generada',
                            Sugerencias_Accion_IA: [], Causa_Raiz_IA: '', Correo_Escalacion_IA: '', Riesgo_SIC: {}, Tipo_Contrato: 'Condiciones Uniformes',
                            Numero_Contrato_Marco: '', isNabis: false, fecha_asignacion: today, Observaciones_Historial: [],
                            SNAcumulados_Historial: Array.isArray(row.SNAcumulados_Historial) ? row.SNAcumulados_Historial : [],
                            Dia_Original_CSV: row['Dia'] ?? 'N/A', Despacho_Respuesta_Checked: false, Fecha_Inicio_Gestion: '',
                            Tiempo_Resolucion_Minutos: 'N/A', Radicado_SIC: '', Fecha_Vencimiento_Decreto: '', Requiere_Aseguramiento_Facturas: false,
                            ID_Aseguramiento: '', Corte_Facturacion: row['Corte_Facturacion'] || '', Cuenta: row['Cuenta'] || '', Operacion_Aseguramiento: '',
                            Tipo_Aseguramiento: '', Mes_Aseguramiento: '', requiereBaja: false, numeroOrdenBaja: '', requiereAjuste: false,
                            numeroTT: '', estadoTT: '', requiereDevolucionDinero: false, cantidadDevolver: '', idEnvioDevoluciones: '',
                            fechaEfectivaDevolucion: '', areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: '', Correo_Electronico_Reclamante: row.Correo_Electronico_Reclamante || 'N/A',
                            Direccion_Reclamante: row.Direccion_Reclamante || 'N/A'
                        });
                        addedCount++;
                        existingCasesMap.set(currentSN, { id: 'temp_new_id', SN: currentSN, ...row });
                    }
                }
                if (cancelUpload.current) { displayModalMessage(`Carga cancelada. ${addedCount} casos nuevos agregados, ${updatedCount} actualizados.`); }
                else { displayModalMessage(`Carga Completa: ${addedCount} casos nuevos agregados. ${updatedCount} casos existentes actualizados. ${skippedCount} casos omitidos.`); }
            } catch (err) { displayModalMessage(`Error durante la carga del CSV: ${err.message}`); }
            finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.onerror = (err) => { displayModalMessage(`Error leyendo el archivo: ${err.message}`); setUploading(false); };
        reader.readAsText(file, 'ISO-8859-1');
    }

    // --- FUNCIONES FALTANTES PARA BOTONES DE CARGA ---

    const handleContractMarcoUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(true);
        displayModalMessage('Procesando CSV de Contrato Marco para reclasificación...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!db || !userId) throw new Error('DB no lista o usuario no autenticado.');
                const { headers, data: csvDataRows } = utils.parseCSV(e.target.result);
                if (csvDataRows.length === 0) throw new Error('CSV de Contrato Marco vacío o inválido.');
                const nuipHeader = headers.find(h => h.toLowerCase().includes('nuip'));
                if (!nuipHeader) {
                    throw new Error("El CSV debe contener una columna con 'nuip' en el encabezado (ej: 'Nro_Nuip_Cliente' o 'NUIP').");
                }

                const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
                const batch = writeBatch(db);
                let updatedCasesCount = 0;
                let nuipsNotFoundCount = 0;
                let skippedNabisCount = 0;

                // Fetch all cases to check the 'isNabis' flag before updating
                const allCasesSnapshot = await getDocs(collRef);
                const casesByClienteNuip = new Map();
                const casesByReclamanteNuip = new Map();

                allCasesSnapshot.forEach(docSnap => {
                    const caseData = { id: docSnap.id, ...docSnap.data() };
                    const clienteNuip = utils.normalizeNuip(caseData.Nro_Nuip_Cliente);
                    const reclamanteNuip = utils.normalizeNuip(caseData.Nro_Nuip_Reclamante);

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

                const processedNuips = new Set();
                for (const row of csvDataRows) {
                    const nuipToSearch = utils.normalizeNuip(row[nuipHeader]);
                    if (!nuipToSearch || processedNuips.has(nuipToSearch)) {
                        continue;
                    }
                    processedNuips.add(nuipToSearch);
                    
                    let foundMatch = false;
                    const potentialMatches = [
                        ...(casesByClienteNuip.get(nuipToSearch) || []),
                        ...(casesByReclamanteNuip.get(nuipToSearch) || [])
                    ];
                    const uniqueMatches = Array.from(new Map(potentialMatches.map(item => [item.id, item])).values());

                    if (uniqueMatches.length > 0) {
                        foundMatch = true;
                        uniqueMatches.forEach(caseToUpdate => {
                            if (caseToUpdate.isNabis === true) {
                                skippedNabisCount++;
                                return; // Skip this case, it was manually marked
                            }

                            const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseToUpdate.id);
                            const updateData = {
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

    const handleReporteCruceUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        displayModalMessage('Procesando reporte para cruce de información...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const { headers, data: reportData } = utils.parseCSV(e.target.result);
                if (reportData.length === 0) {
                    throw new Error('El archivo CSV está vacío o tiene un formato no válido.');
                }
                
                setReporteCruceData(reportData);

                const nuipHeader = headers.find(h => h.toLowerCase().includes('nuip'));
                if (!nuipHeader) {
                    throw new Error("El archivo CSV debe contener una columna con 'nuip' en el encabezado (ej: 'Nro_Nuip_Cliente').");
                }

                const reportNuips = new Set(
                    reportData.map(row => utils.normalizeNuip(row[nuipHeader])).filter(nuip => nuip)
                );
                if (reportNuips.size === 0) {
                    throw new Error("No se encontraron Documentos de Identidad (NUIP) válidos en el reporte.");
                }
                
                const casesByNuip = new Map();
                cases.forEach(caseItem => {
                    const nuips = [utils.normalizeNuip(caseItem.Nro_Nuip_Cliente), utils.normalizeNuip(caseItem.Nro_Nuip_Reclamante)];
                    nuips.forEach(nuip => {
                        if (nuip && nuip !== '0' && nuip !== 'N/A') {
                            if (!casesByNuip.has(nuip)) casesByNuip.set(nuip, []);
                            casesByNuip.get(nuip).push(caseItem.SN);
                        }
                    });
                });
                
                const matches = new Map();
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

    // --- FIN FUNCIONES FALTANTES PARA BOTONES DE CARGA ---
// // ** 1. FUNCIÓN DE RECATEGORIZACIÓN MASIVA **
    async function handleMassRecategorization() {
        if (!db || !userId) {
            displayModalMessage("Base de datos no disponible o usuario no autenticado.");
            return;
        }

        const casesToRecategorize = cases.filter(c =>
            !c['Categoria del reclamo'] || c['Categoria del reclamo'] === 'N/A' || c['Categoria del reclamo'] === 'No especificada'
        );

        if (casesToRecategorize.length === 0) {
            displayModalMessage("No se encontraron casos sin categoría de reclamo para procesar.");
            return;
        }

        displayConfirmModal(
            `Se encontraron ${casesToRecategorize.length} casos sin categoría de reclamo. ¿Deseas enviarlos a la IA para recategorización masiva? Esto puede tomar tiempo y consumir recursos de la API.`,
            {
                confirmText: 'Sí, Recategorizar',
                onConfirm: async () => {
                    setMassUpdateTargetStatus('Recategorizando...');
                    setIsMassUpdating(true);
                    let updatedCount = 0;
                    let currentBatch = writeBatch(db); 
                    const totalCases = casesToRecategorize.length;
                    
                    // --- NUEVA LÓGICA DE DELAY Y RETRY ---
                    const BASE_DELAY_MS = 1000; // 1 segundo de pausa entre peticiones (para ralentizar el proceso)
                    const MAX_RETRIES = 5; 
                    // --- FIN NUEVA LÓGICA ---

                    try {
                        for (let i = 0; i < totalCases; i++) {
                            const caseItem = casesToRecategorize[i];
                            displayModalMessage(`Recategorizando ${i + 1}/${totalCases}: SN ${caseItem.SN}...`);

                            let aiAnalysisCat = null;
                            let retries = 0;
                            let success = false;

                            while (!success && retries < MAX_RETRIES) {
                                try {
                                    // 1. Llama al servicio de IA
                                    aiAnalysisCat = await aiServices.getAIAnalysisAndCategory(caseItem);
                                    success = true;
                                } catch (error) {
                                    retries++;
                                    console.error(`Intento ${retries} fallido para SN ${caseItem.SN}:`, error);

                                    // 2. Verificar error de cuota (429) o servicio (503)
                                    const errorMessage = error.message || String(error);
                                    let delayTime = BASE_DELAY_MS * (retries + 1); // Retraso exponencial básico

                                    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
                                        // Intentar extraer el tiempo de reintento sugerido por la API (si está disponible)
                                        const retryMatch = errorMessage.match(/Please retry in ([0-9]+)s/);
                                        if (retryMatch && retryMatch[1]) {
                                            delayTime = (parseInt(retryMatch[1]) + 5) * 1000; // Agregar 5 segundos extra de buffer
                                        } else {
                                            delayTime = Math.min(60000, 10000 * retries); // Límite de 60 segundos si no hay tiempo sugerido
                                        }
                                        displayModalMessage(`¡CUOTA EXCEDIDA! Pausando ${Math.round(delayTime / 1000)} segundos antes del reintento...`);
                                        await new Promise(resolve => setTimeout(resolve, delayTime));
                                    } else if (errorMessage.includes("503") && retries < MAX_RETRIES) {
                                        // Error de Servicio: solo espera el delay normal
                                        displayModalMessage(`Error de servicio (503). Pausando ${Math.round(delayTime / 1000)} segundos antes del reintento...`);
                                        await new Promise(resolve => setTimeout(resolve, delayTime));
                                    } else {
                                        // Otro error fatal: detener el bucle de reintentos
                                        displayModalMessage(`Error fatal para SN ${caseItem.SN}. Omitiendo.`);
                                        break; 
                                    }
                                }
                            }
                            
                            // 3. Procesar resultado
                            if (aiAnalysisCat && aiAnalysisCat['Categoria del reclamo'] && aiAnalysisCat['Categoria del reclamo'] !== 'N/A') {
                                const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseItem.id);
                                
                                const newObservation = { text: `Categoría actualizada por recategorización masiva de la IA: ${aiAnalysisCat['Categoria del reclamo']}`, timestamp: new Date().toISOString() };
                                const existingHistory = caseItem.Observaciones_Historial || [];

                                const updateData = { 
                                    ...aiAnalysisCat, 
                                    Observaciones_Historial: [...existingHistory, newObservation]
                                };
                                
                                currentBatch.update(docRef, updateData);
                                updatedCount++;

                                if (updatedCount % 50 === 0) { // Commit más frecuente (ej. cada 50) para prevenir timeout
                                    await currentBatch.commit();
                                    currentBatch = writeBatch(db); 
                                }
                            }
                            
                            // 4. Pausa entre casos exitosos para evitar picos de API
                            if (success && i < totalCases - 1) {
                                await new Promise(resolve => setTimeout(resolve, BASE_DELAY_MS)); 
                            }
                        }

                        // Commitea el lote final 
                        if (updatedCount % 50 !== 0) {
                            await currentBatch.commit();
                        }

                        displayModalMessage(`Recategorización masiva completada: ${updatedCount} casos actualizados.`);
                    } catch (error) {
                        console.error("Error en recategorización masiva (fuera del bucle):", error);
                        displayModalMessage(`Error al recategorizar casos masivamente. Solo se actualizaron ${updatedCount} casos. Error: ${error.message}`);
                    } finally {
                        setMassUpdateTargetStatus('');
                        setIsMassUpdating(false);
                    }
                }
            }
        );
    }
    // ** 1. Definición de handleObservationFileClick **
    function handleObservationFileClick() {
        if (observationFileInputRef.current) {
            observationFileInputRef.current.click();
        } else {
            displayModalMessage('Error: El input de archivo de observación no está listo.');
        }
    }

    // --- LÓGICA DE FILTROS Y RENDERING ---
    const filteredAndSearchedCases = useMemo(() => {
        const searchTerms = searchTerm.toLowerCase().split(',').map(term => term.trim()).filter(term => term !== '');
        return cases.filter(c => {
            const searchMatch = searchTerms.length === 0 || searchTerms.some(term => ['SN', 'CUN', 'Nro_Nuip_Cliente', 'Nombre_Cliente', 'Categoria del reclamo', 'Prioridad'].some(f => String(c[f] || '').toLowerCase().includes(term)));
            const contractMatch = contractFilter === 'todos' || c.Tipo_Contrato === contractFilter;
            const priorityMatch = priorityFilter === 'todos' || c.Prioridad === priorityFilter;
            const statusMatch = statusFilter === 'todos' || c.Estado_Gestion === statusFilter;
            return searchMatch && contractMatch && priorityMatch && statusMatch;
        });
    }, [cases, searchTerm, contractFilter, priorityFilter, statusFilter]);

    function applyActiveFilter(cs) {
        const pendStates = ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Traslado SIC', 'Decretado', 'Pendiente Ajustes'];
        switch (activeFilter) {
            case 'all': return cs;
            case 'resolved': return cs.filter(c => c.Estado_Gestion === 'Resuelto');
            case 'finalizado': return cs.filter(c => c.Estado_Gestion === 'Finalizado');
            case 'pending_escalated_initiated': return cs.filter(c => pendStates.includes(c.Estado_Gestion));
            case 'decretado': return cs.filter(c => c.Estado_Gestion === 'Decretado' || c.Estado_Gestion === 'Traslado SIC');
            case 'pendiente_ajustes': return cs.filter(c => c.Estado_Gestion === 'Pendiente Ajustes');
            case 'dia14_pending': return cs.filter(c => pendStates.includes(c.Estado_Gestion) && utils.calculateCaseAge(c, nonBusinessDays) === 14);
            case 'dia15_pending': return cs.filter(c => pendStates.includes(c.Estado_Gestion) && utils.calculateCaseAge(c, nonBusinessDays) === 15);
            case 'dia_gt15_pending': return cs.filter(c => pendStates.includes(c.Estado_Gestion) && utils.calculateCaseAge(c, nonBusinessDays) > 15);
            case 'resolved_today': return cs.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === utils.getColombianDateISO());
            default: return cs;
        }
    }
    const casesForDisplay = applyActiveFilter(filteredAndSearchedCases);

    const sortSN = (a, b) => String(a.SN || '').toLowerCase().localeCompare(String(b.SN || '').toLowerCase());

    const sicDisp = useMemo(() => casesForDisplay.filter(c => (c.Estado_Gestion === 'Decretado' || c.Estado_Gestion === 'Traslado SIC') && c.user === userId).sort(sortSN), [casesForDisplay, userId]);
    const pendAjustesDisp = useMemo(() => casesForDisplay.filter(c => c.Estado_Gestion === 'Pendiente Ajustes' && c.user === userId).sort(sortSN), [casesForDisplay, userId]);
    const pendEscDisp = useMemo(() => casesForDisplay.filter(c => ['Pendiente', 'Escalado', 'Iniciado', 'Lectura'].includes(c.Estado_Gestion) && c.user === userId).sort(sortSN), [casesForDisplay, userId]);
    const resDisp = useMemo(() => casesForDisplay.filter(c => c.Estado_Gestion === 'Resuelto' && c.user === userId).sort(sortSN), [casesForDisplay, userId]);
    const finalizadosDisp = useMemo(() => casesForDisplay.filter(c => c.Estado_Gestion === 'Finalizado' && c.user === userId).sort(sortSN), [casesForDisplay, userId]);
    const aseguramientosDisp = useMemo(() => casesForDisplay.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && Array.isArray(c.Aseguramiento_Historial) && c.Aseguramiento_Historial.length > 0).sort(sortSN), [casesForDisplay]);
    
    const counts = {
        total: cases.length,
        resolved: cases.filter(c => c.Estado_Gestion === 'Resuelto').length,
        finalizado: cases.filter(c => c.Estado_Gestion === 'Finalizado').length,
        pending: cases.filter(c => ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Decretado', 'Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion)).length,
        pendienteAjustes: cases.filter(c => c.Estado_Gestion === 'Pendiente Ajustes').length,
        dia14: cases.filter(c => ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Decretado', 'Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && utils.calculateCaseAge(c, nonBusinessDays) === 14).length,
        dia15: cases.filter(c => ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Decretado', 'Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && utils.calculateCaseAge(c, nonBusinessDays) === 15).length,
        diaGt15: cases.filter(c => ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Decretado', 'Traslado SIC', 'Pendiente Ajustes'].includes(c.Estado_Gestion) && utils.calculateCaseAge(c, nonBusinessDays) > 15).length,
        resolvedToday: cases.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === utils.getColombianDateISO()).length,
    };

    const renderTable = (data, title) => {
        return (
            <PaginatedTable
                cases={data}
                title={title}
                mainTableHeaders={constants.MAIN_TABLE_HEADERS}
                statusColors={constants.statusColors} // <-- Usa la constante importada
                priorityColors={constants.priorityColors} // <-- Usa la constante importada
                selectedCaseIds={selectedCaseIds}
                handleSelectCase={handleSelectCase}
                handleOpenCaseDetails={handleOpenCaseDetails}
                calculateCaseAge={(caseItem) => utils.calculateCaseAge(caseItem, nonBusinessDays)}
                onScanClick={handleScanClick}
                nonBusinessDays={nonBusinessDays}
            />
        );
    };

    // --- LÓGICA DE GRÁFICOS Y TIEMPO ---
    const asignadosPorDiaData = useMemo(() => {
        const countsByDate = cases.reduce((acc, curr) => {
            const date = curr.fecha_asignacion || 'Sin Fecha';
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        return Object.keys(countsByDate).map(fecha => ({ fecha, cantidad: countsByDate[fecha] })).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }, [cases]);

    const distribucionPorDiaData = useMemo(() => {
        const pendStates = ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Traslado SIC', 'Decretado', 'Pendiente Ajustes'];
        const countsByDay = cases.filter(c => pendStates.includes(c.Estado_Gestion)).reduce((acc, curr) => {
            const dia = utils.calculateCaseAge(curr, nonBusinessDays);
            if (dia !== 'N/A' && !isNaN(dia)) {
                const key = `Día ${dia}`;
                acc[key] = (acc[key] || 0) + 1;
            }
            return acc;
        }, {});
            
        return Object.keys(countsByDay).map(dia => ({ dia, cantidad: countsByDay[dia] }))
            .sort((a, b) => (parseInt(a.dia.split(' ')[1]) || 0) - (parseInt(b.dia.split(' ')[1]) || 0));
    }, [cases, nonBusinessDays]);

    const calculateTimePerCaseForDay15 = useCallback((allCases) => {
        const timeAvailableInMinutes = 9 * 60;
        const pendingDay15Cases = allCases.filter(c =>
            ['Pendiente', 'Escalado', 'Iniciado', 'Lectura', 'Traslado SIC', 'Decretado', 'Pendiente Ajustes'].includes(c.Estado_Gestion) &&
            utils.calculateCaseAge(c, nonBusinessDays) === 15
        );
        if (pendingDay15Cases.length === 0) {
            const resolvedCasesWithTime = allCases.filter(c =>
                (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') &&
                utils.calculateCaseAge(c, nonBusinessDays) === 15 &&
                c.Tiempo_Gestion_Dia15_Congelado
            );
            if (resolvedCasesWithTime.length > 0) {
                return resolvedCasesWithTime[0].Tiempo_Gestion_Dia15_Congelado;
            }
            return 'No hay casos en Día 15.';
        }
        const timePerCase = timeAvailableInMinutes / pendingDay15Cases.length;
        return `~${timePerCase.toFixed(2)} minutos por caso`;
    }, [nonBusinessDays]);
    const timePerCaseDay15 = useMemo(() => calculateTimePerCaseForDay15(cases), [cases, calculateTimePerCaseForDay15]);

    function getFilterStyles(isActive, color) {
        if (isActive) {
            switch (color) {
                case 'blue': return 'border-blue-500 bg-blue-100';
                case 'green': return 'border-green-500 bg-green-100';
                case 'gray': return 'border-gray-500 bg-gray-100';
                case 'yellow': return 'border-yellow-500 bg-yellow-100';
                case 'pink': return 'border-pink-500 bg-pink-100';
                case 'orange': return 'border-orange-500 bg-orange-100';
                case 'red': return 'border-red-500 bg-red-100';
                case 'purple': return 'border-purple-500 bg-purple-100';
                default: return 'border-gray-500 bg-gray-100';
            }
        }
        return 'border-gray-200 bg-gray-50 hover:bg-gray-100';
    }

    // --- LÓGICA DE ACCIONES MASIVAS ---
    function handleSelectCase(caseId, isMassSelect) {
        setSelectedCaseIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);
            if (isMassSelect) { return caseId; } // Se asume que 'caseId' es un Set en este caso
            if (newSelectedIds.has(caseId)) { newSelectedIds.delete(caseId); }
            else { newSelectedIds.add(caseId); }
            return newSelectedIds;
        });
    }

    async function handleMassUpdate() {
        if (!db || !userId || selectedCaseIds.size === 0 || !massUpdateTargetStatus) { displayModalMessage('Seleccione casos y un estado destino para la actualización masiva.'); return; }
        setIsMassUpdating(true);
        displayModalMessage(`Actualizando ${selectedCaseIds.size} casos...`);
        try {
            const docIdsToUpdate = Array.from(selectedCaseIds);
            const docsToUpdateSnapshot = await getDocs(query(collection(db, `artifacts/${appId}/users/${userId}/cases`), where(documentId(), 'in', docIdsToUpdate)));
            if (docsToUpdateSnapshot.empty) { displayModalMessage('Ninguno de los casos seleccionados existe en la base de datos.'); setIsMassUpdating(false); return; }
            const batch = writeBatch(db);
            const today = utils.getColombianDateISO();
            const nowISO = new Date().toISOString();
            docsToUpdateSnapshot.docs.forEach(docSnapshot => {
                const currentCase = docSnapshot.data();
                const updateData = { Estado_Gestion: massUpdateTargetStatus };
                if (massUpdateObservation.trim()) {
                    const newObservation = { text: `(Observación Masiva) ${massUpdateObservation.trim()}`, timestamp: nowISO };
                    const existingHistory = currentCase.Observaciones_Historial || [];
                    updateData.Observaciones_Historial = [...existingHistory, newObservation];
                }
                if (massUpdateTargetStatus === 'Iniciado') { updateData.Fecha_Inicio_Gestion = nowISO; updateData.Tiempo_Resolucion_Minutos = 'N/A'; }
                else if (massUpdateTargetStatus === 'Resuelto') { updateData['Fecha Cierre'] = today; updateData.Tiempo_Resolucion_Minutos = currentCase.Fecha_Inicio_Gestion ? utils.getDurationInMinutes(currentCase.Fecha_Inicio_Gestion, nowISO) : 'N/A'; }
                if (currentCase.Estado_Gestion === 'Iniciado' && massUpdateTargetStatus !== 'Iniciado') { sessionStorage.removeItem(`iniciadoAlertShown_${docSnapshot.id}`); }
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
    }

    function handleMassDelete() {
        if (selectedCaseIds.size === 0) { displayModalMessage('No hay casos seleccionados para eliminar.'); return; }
        async function onConfirm() {
            setIsMassUpdating(true);
            displayModalMessage(`Eliminando ${selectedCaseIds.size} casos...`);
            const batch = writeBatch(db);
            selectedCaseIds.forEach(caseId => {
                const caseDocRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
                batch.delete(caseDocRef);
            });
            try {
                await batch.commit();
                displayModalMessage(`${selectedCaseIds.size} casos eliminados exitosamente.`);
                setSelectedCaseIds(new Set());
            } catch (error) { displayModalMessage(`Error al eliminar masivamente: ${error.message}`); }
            finally { setIsMassUpdating(false); }
        }
        displayConfirmModal(`¿Estás seguro de que quieres eliminar ${selectedCaseIds.size} casos permanentemente? Esta acción no se puede deshacer.`, { onConfirm });
    }

    function handleMassReopen() {
        if (selectedCaseIds.size === 0) { displayModalMessage('No hay casos seleccionados para reabrir.'); return; }
        const casesToReopen = cases.filter(c => selectedCaseIds.has(c.id) && c.Estado_Gestion === 'Resuelto');
        if (casesToReopen.length === 0) { displayModalMessage('Ninguno de los casos seleccionados está "Resuelto". Solo los casos resueltos pueden ser reabiertos.'); return; }
        async function onConfirm() {
            setIsMassUpdating(true);
            displayModalMessage(`Reabriendo ${casesToReopen.length} casos...`);
            const batch = writeBatch(db);
            const updateData = { Estado_Gestion: 'Pendiente', 'Fecha Cierre': '', Tiempo_Resolucion_Minutos: 'N/A' };
            casesToReopen.forEach(caseItem => {
                const caseDocRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseItem.id);
                batch.update(caseDocRef, updateData);
            });
            try {
                await batch.commit();
                displayModalMessage(`${casesToReopen.length} casos reabiertos exitosamente.`);
                setSelectedCaseIds(new Set());
            } catch (error) { displayModalMessage(`Error al reabrir masivamente: ${error.message}`); }
            finally { setIsMassUpdating(false); }
        }
        displayConfirmModal(`Se reabrirán ${casesToReopen.length} de los ${selectedCaseIds.size} casos seleccionados (solo los que están en estado "Resuelto"). ¿Continuar?`, { onConfirm });
    }
    
    // Función para el botón de Limpieza Total (handleDeleteAllCases)
    const handleDeleteAllCases = () => {
        if (cases.length === 0) {
            displayModalMessage('No hay casos para eliminar.');
            return;
        }

        const onConfirm = async () => {
            if (!db || !userId) {
                displayModalMessage('Error: La conexión con la base de datos no está disponible.');
                return;
            }

            setIsMassUpdating(true);
            displayModalMessage(`Eliminando todos los ${cases.length} casos...`);
            const batch = writeBatch(db);
            const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);

            try {
                const allCasesSnapshot = await getDocs(collRef);
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

    // --- LÓGICA DE ALARMAS ---
    const checkCancellationAlarms = useCallback(() => {
        const today = new Date();
        // Aseguramos que la fecha de hoy sea en zona horaria colombiana para la clave de sesión.
        const todayISO = utils.getColombianDateISO();
        const casesToAlert = cases.filter(caseItem => {
            const isCancellationRelated = String(caseItem['Categoria del reclamo'] || '').toLowerCase().includes('cancelacion') || String(caseItem['Categoria del reclamo'] || '').toLowerCase().includes('prepago');
            if (!isCancellationRelated) return false;
            const cutOffDay = parseInt(caseItem.Corte_Facturacion);
            if (isNaN(cutOffDay) || cutOffDay < 1 || cutOffDay > 31) return false;
            const alertShownKey = `cancelAlarmShown_${caseItem.id}_${todayISO}`;
            if (sessionStorage.getItem(alertShownKey)) return false;
            let nextCutOffDate = new Date(today.getFullYear(), today.getMonth(), cutOffDay);
            if (today.getDate() > cutOffDay) { nextCutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, cutOffDay); }
            const daysToSubtract = 3;
            let businessDaysCount = 0;
            let tempDate = new Date(nextCutOffDate);
            while (businessDaysCount < daysToSubtract) {
                tempDate.setDate(tempDate.getDate() - 1);
                const dayOfWeek = tempDate.getDay();
                const dateStr = tempDate.toISOString().slice(0, 10);
                const isNonBusinessDay = nonBusinessDays.has(dateStr);
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isNonBusinessDay) { businessDaysCount++; }
            }
            const alertDate = tempDate;
            const todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            return todayWithoutTime.getTime() === alertDate.getTime();
        });
        if (casesToAlert.length > 0) {
            setCancelAlarmCases(casesToAlert);
            setShowCancelAlarmModal(true);
        }
    }, [cases, nonBusinessDays]);

    async function handleMarkAsEscalatedFromAlarm(caseToUpdate) {
        if (!caseToUpdate) return;
        const newObservation = { text: `(Gestión Alarma) Marcado como Escalado desde la alarma de palabras clave.`, timestamp: new Date().toISOString() };
        const updatedHistory = [...(caseToUpdate.Observaciones_Historial || []), newObservation];
        const updateData = { Estado_Gestion: 'Escalado', Observaciones_Historial: updatedHistory };
        try {
            await updateCaseInFirestore(caseToUpdate.id, updateData);
            sessionStorage.setItem(`keyword_alarm_dismissed_${caseToUpdate.id}`, 'true');
            setKeywordAlarmCases(prev => {
                const updatedCases = prev.filter(c => c.id !== caseToUpdate.id);
                if (updatedCases.length === 0) { setShowKeywordAlarmModal(false); }
                return updatedCases;
            });
            displayModalMessage(`El caso SN ${caseToUpdate.SN} se ha marcado como 'Escalado'.`);
        } catch (error) {
            displayModalMessage(`Error al actualizar el caso: ${error.message}`);
        }
    }

    function handleCopyAllAlarmSNs() {
        if (keywordAlarmCases.length === 0) {
            displayModalMessage('No hay SNs para copiar.');
            return;
        }
        const allSNs = keywordAlarmCases.map(c => c.SN).join('\n');
        utils.copyToClipboard(allSNs, 'SNs de Casos en Alarma', displayModalMessage);
    }

    // --- LÓGICA DE ESCANEO DE DOCUMENTOS ---
    function handleScanClick(caseItem) {
        setCaseToScan(caseItem);
        scanFileInputRef.current.click();
    }
    
    async function handleScanFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !caseToScan) return;
        setIsScanning(true);
        displayModalMessage(`Transcribiendo y analizando documento para SN: ${caseToScan.SN}...`);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64ImageData = reader.result.split(',')[1];
            const prompt = "Transcribe el texto de esta imagen del documento y extrae las direcciones y correos electrónicos.";
            const payload = {
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64ImageData } }]
                }],
            };
            const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
            const modelName = "gemini-2.5-flash";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            try {
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const result = await response.json();
                if (response.ok && result.candidates && result.candidates[0].content.parts.length > 0) {
                    const transcribedText = result.candidates[0].content.parts[0].text;
                    const extractedData = utils.extractAddressesFromText(transcribedText);
                    const updatedObs = `${caseToScan.obs || ''}\n\n--- INICIO TRANSCRIPCIÓN ---\n${transcribedText}\n--- FIN TRANSCRIPCIÓN ---`;
                    const newHistoryEntry = { timestamp: new Date().toISOString(), emails: extractedData.emails, addresses: extractedData.addresses };
                    const updatedHistory = [...(caseToScan.Direcciones_Extraidas || []), newHistoryEntry];
                    await updateCaseInFirestore(caseToScan.id, {
                        obs: updatedObs, Documento_Adjunto: 'Transcrito', Direcciones_Extraidas: updatedHistory
                    });
                    displayModalMessage('Transcripción y extracción de direcciones completada.');
                } else { throw new Error(result.error?.message || 'No se pudo transcribir el documento.'); }
            } catch (error) {
                console.error("Error transcribing document:", error);
                displayModalMessage(`Error en la transcripción: ${error.message}`);
            } finally {
                setIsScanning(false);
                setCaseToScan(null);
                if (scanFileInputRef.current) { scanFileInputRef.current.value = ""; }
            }
        };
        reader.onerror = (error) => { console.error("Error reading file:", error); displayModalMessage("Error al leer el archivo."); setIsScanning(false); };
    }
async function handleObservationFileChange(event) {
    const file = event.target.files[0];
    if (!file || !selectedCase) return;

    // Nota: Esta función es invocada por el input file asociado a observationFileInputRef

    displayModalMessage(`Analizando adjunto (${file.type}) para caso ${selectedCase.SN}...`);

    try {
        let summary = '';
        const fileType = file.type;
        const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
        const modelName = "gemini-2.5-flash"; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const processFile = async (base64Content, mimeType, prompt) => {
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Content } }] }] };
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`Error en la API: ${response.status}`);
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || 'La IA no pudo extraer el texto.';
        };

        if (fileType.startsWith('text/') || fileType === 'application/json') {
            summary = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });
            summary = `Contenido del archivo de texto:\n${summary}`;
} else if (fileType === 'application/pdf') { 
            
    // Lógica para PDF: Usar el motor multimodal de Gemini para
    // garantizar la transcripción, incluso en documentos escaneados.
    
    // Convertimos el archivo PDF completo a Base64 para enviarlo a la API de Gemini.
    const base64Content = await fileToBase64(file); 
    
    // Se utiliza un prompt detallado para forzar la transcripción de todo el contenido.
    const prompt = 'Analiza este documento PDF. Transcribe todo el texto contenido en él, incluyendo cualquier texto en imágenes o tablas, y luego genera un resumen conciso del contenido.';
    
    // Llamar a la función que invoca a Gemini con el Base64
    summary = await processFile(base64Content, file.type, prompt);

} else if (fileType.startsWith('image/') || fileType.startsWith('audio/')) { 
    const base64Content = await fileToBase64(file);
    const prompt = fileType.startsWith('image/')
        ? 'Analiza esta imagen y transcribe todo el texto relevante.'
        : 'Transcribe el texto que escuches en el audio.';
    summary = await processFile(base64Content, file.type, prompt);
} else {
    throw new Error(`Tipo de archivo no soportado para análisis: ${fileType}`);
}
        
        // Formatear y actualizar el caso
        const currentObs = selectedCase.Observaciones || '';
        const newObs = `${currentObs}\n\n--- Análisis de Adjunto (${file.name}) ---\n${summary}`;
        
        // Actualizar el caso localmente y en Firestore
        await handleUpdateCase(selectedCase.id, { Observaciones: newObs });
        
        displayModalMessage('✅ Adjunto analizado y añadido a las observaciones. Haz clic en "Guardar Obs." para confirmar los cambios.');

    } catch (error) {
        console.error("Error processing observation file:", error);
        displayModalMessage(`❌ Error al analizar el adjunto: ${error.message || 'Error desconocido'}`);
    } finally {
        // Reseteamos el input file para permitir la subida de otro archivo.
        if (event.target) event.target.value = null; 
    }
}
    // --- USE EFFECTS (LÓGICA DE CONTROL Y SINCRONIZACIÓN) ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        async function fetchRole() {
            if (!db || !userId) return;
            try {
                const uDoc = doc(db, `artifacts/${appId}/users`, userId);
                const snap = await getDoc(uDoc);
                if (snap && snap.exists()) {
                    const d = snap.data();
                    setUserRole(d.role || 'user');
                } else {
                    setUserRole('user');
                }
            } catch (e) { console.error('Error fetching user role:', e); setUserRole('user'); }
        }
        fetchRole();
    }, [userId]);

    useEffect(() => {
        if (!loading && !userId) { setShowAuthModal(true); }
        else { setShowAuthModal(false); }
    }, [loading, userId]);

    useEffect(() => {
        if (!db || !userId) return;
        const q = query(collection(db, `artifacts/${appId}/users/${userId}/cases`));
        const unsub = onSnapshot(q, async snapshot => {
            let fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const updates = fetched.filter(c => c.user === 'jediazro' && c.user !== userId).map(c => updateDoc(doc(db, `artifacts/${appId}/users/${userId}/cases`, c.id), { user: userId }));
            if (updates.length > 0) { await Promise.all(updates).catch(e => console.error("Auto-assign error:", e)); }
            fetched.sort((a, b) => (new Date(b['Fecha Radicado'] || 0)) - (new Date(a['Fecha Radicado'] || 0) || a.id.localeCompare(b.id)));
            setCases(fetched);
            setRefreshing(false);
        }, e => { console.error("Fetch cases error (onSnapshot):", e); displayModalMessage(`Error cargando los casos: ${e.message}`); setRefreshing(false); });
        return () => unsub();
    }, [db, userId, displayModalMessage]);
    
    useEffect(() => {
        if (cases.length === 0) return;
        // Lógica de Alarma de Palabras Clave
        const casesToAlertMap = new Map();
        cases.forEach(c => {
            if (c.Estado_Gestion === 'Finalizado') { return; }
            const alarmKey = `keyword_alarm_dismissed_${c.id}`;
            if (sessionStorage.getItem(alarmKey)) { return; }
            const historicalObs = (c.Observaciones_Historial || []).map(h => h.text).join(' ');
            const allText = `${c.obs || c.OBS || ''} ${historicalObs}`;
            if (!allText.trim()) { return; }
            const normalizedText = normalizeTextForSearch(allText);
            for (const trigger of KEYWORD_ALARM_TRIGGERS) {
                if (trigger.test(normalizedText)) {
                    const matchedKeyword = trigger.source.replace(/\\s\+/g, ' ').replace(/\(s\)\?/g, '').replace(/\(r\|cion\|ndo\|ciones\)/g, '').replace(/\(el\\s\+|de\\s\+\)\?/g, '').replace(/\\/g, '');
                    if (!casesToAlertMap.has(c.id)) { casesToAlertMap.set(c.id, { ...c, matchedKeyword }); }
                    break;
                }
            }
        });
        const casesToAlert = Array.from(casesToAlertMap.values());
        if (casesToAlert.length > 0) {
            setKeywordAlarmCases(casesToAlert);
            setShowKeywordAlarmModal(true);
        }
    }, [cases]);

    useEffect(() => {
        if (!db || !userId || cases.length === 0) return;
        const casesToFinalize = cases.filter(c => {
            const simpleResolved = c.Estado_Gestion === 'Resuelto' && !c.Requiere_Aseguramiento_Facturas && !c.requiereBaja && !c.requiereAjuste;
            const complexResolvedAndCompleted = c.Estado_Gestion === 'Resuelto' && (c.Requiere_Aseguramiento_Facturas || c.requiereBaja || c.requiereAjuste) && c.gestionAseguramientoCompletada;
            return simpleResolved || complexResolvedAndCompleted;
        });
        if (casesToFinalize.length > 0) {
            const batch = writeBatch(db);
            casesToFinalize.forEach(caseItem => {
                const caseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseItem.id);
                batch.update(caseRef, { Estado_Gestion: 'Finalizado' });
            });
            batch.commit().catch(error => { console.error("Error finalizing cases automatically:", error); displayModalMessage(`Error al finalizar casos automáticamente: ${error.message}`); });
        }
    }, [cases, db, userId, displayModalMessage]);

    useEffect(() => {
        if (cases.length > 0 && !sessionStorage.getItem('decretadoAlarmShown')) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const twoDaysHence = new Date(today); twoDaysHence.setDate(today.getDate() + 2); twoDaysHence.setHours(23, 59, 59, 999);
            const expiring = cases.filter(c => c.Estado_Gestion === 'Decretado' && c.Fecha_Vencimiento_Decreto && new Date(c.Fecha_Vencimiento_Decreto) >= today && new Date(c.Fecha_Vencimiento_Decreto) <= twoDaysHence);
            if (expiring.length > 0) {
                displayModalMessage(`ALERTA! Casos "Decretados" próximos a vencer:\n${expiring.map(c => `SN: ${c.SN}, Vence: ${c.Fecha_Vencimiento_Decreto}`).join('\n')}`);
                sessionStorage.setItem('decretadoAlarmShown', 'true');
            }
        }
    }, [cases, displayModalMessage]);

    useEffect(() => {
        function checkIniciadoCases() {
            const now = new Date().toISOString();
            cases.forEach(caseItem => {
                if (caseItem.Estado_Gestion === 'Iniciado' && caseItem.Fecha_Inicio_Gestion) {
                    const duration = utils.getDurationInMinutes(caseItem.Fecha_Inicio_Gestion, now);
                    if (duration !== 'N/A' && duration > 45) {
                        const alertShownKey = `iniciadoAlertShown_${caseItem.id}`;
                        if (!sessionStorage.getItem(alertShownKey)) {
                            displayModalMessage(`¡ALERTA! El caso SN: ${caseItem.SN} (CUN: ${caseItem.CUN || 'N/A'}) ha estado en estado "Iniciado" por más de 45 minutos.`);
                            sessionStorage.setItem(alertShownKey, 'true');
                        }
                    }
                }
            });
        }
        const intervalId = setInterval(checkIniciadoCases, 30000);
        return () => clearInterval(intervalId);
    }, [cases, displayModalMessage]);

    useEffect(() => {
        checkCancellationAlarms();
    }, [cases, checkCancellationAlarms]);

    useEffect(() => {
        if (cases.length > 0) {
            // Actualizar la fecha y hora cada segundo
            const timer = setInterval(() => {
                // Usamos 'America/Bogota' para la hora de Colombia
                setCurrentDateTime(new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }));
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [cases]);

    useEffect(() => {
        if (cases.length === 0) return;
        const checkAlarms = () => {
            const todayISO = utils.getColombianDateISO();
            const casesToAlert = cases.filter(c => {
                const caseId = c.id;
                const alarmKey = `alarm_dismissed_${caseId}_${todayISO}`;
                if (sessionStorage.getItem(alarmKey)) { return false; }
                const dia = utils.calculateCaseAge(c, nonBusinessDays);
                if (isNaN(dia)) return false;
                const isTrasladoSIC = c.Estado_Gestion === 'Traslado SIC' && dia >= 3;
                const isDecretado = c.Estado_Gestion === 'Decretado' && dia >= 7;
                return isTrasladoSIC || isDecretado;
            });
            if (casesToAlert.length > 0) {
                setAlarmCases(casesToAlert);
                setShowAlarmModal(true);
            }
        };
        checkAlarms();
    }, [cases, nonBusinessDays]);

    // --- RENDERIZADO DEL COMPONENTE ---
    if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-lg">Cargando y autenticando...</div></div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Acceso / Registro</h3>
                            <button className="text-gray-500" onClick={() => setShowAuthModal(false)} aria-label="Cerrar">✕</button>
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button className={`flex-1 py-2 rounded-md ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`} onClick={() => setAuthMode('login')}>Iniciar sesión</button>
                                <button className={`flex-1 py-2 rounded-md ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`} onClick={() => setAuthMode('register')}>Registrarse</button>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Correo</label>
                                <input type="email" className="w-full mt-1 p-2 border rounded" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Contraseña</label>
                                <input type="password" className="w-full mt-1 p-2 border rounded" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
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

            <input type="file" ref={scanFileInputRef} onChange={handleScanFileUpload} accept="image/png, image/jpeg" style={{ display: 'none' }} />
            <input type="file" accept=".csv" ref={contractMarcoFileInputRef} onChange={handleContractMarcoUpload} style={{ display: 'none' }} />
            <input type="file" accept=".csv" ref={reporteCruceFileInputRef} onChange={handleReporteCruceUpload} style={{ display: 'none' }} />
            <input
                type="file"
                ref={observationFileInputRef} // <-- REF utilizada por handleObservationFileClick
                onChange={handleObservationFileChange}
                accept="image/png, image/jpeg, application/pdf, text/csv, audio/*"
                style={{ display: 'none' }}
            />

            <div className="w-full max-w-7xl bg-white shadow-lg rounded-lg p-6">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Seguimiento de Casos Asignados</h1>
                <div className="flex justify-center gap-4 mb-6">
                    <button onClick={() => setActiveModule('casos')} className={`px-6 py-2 rounded-lg font-semibold ${activeModule === 'casos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Casos</button>
                    <button onClick={() => setActiveModule('aseguramientos')} className={`px-6 py-2 rounded-lg font-semibold ${activeModule === 'aseguramientos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Aseguramientos</button>
                </div>
                {userId && <p className="text-sm text-center mb-4">User ID: <span className="font-mono bg-gray-200 px-1 rounded">{userId}</span></p>}
                <p className="text-lg text-center mb-4">Fecha y Hora: {currentDateTime}</p>
                <input type="text" placeholder="Buscar por SN, CUN, Nuip... (separar con comas para búsqueda masiva)" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setActiveFilter('all') }} className="p-3 mb-4 border rounded-lg w-full shadow-sm" />
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
                                    {constants.ALL_PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700">Filtrar por Estado</label>
                                <select id="statusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                    <option value="todos">Todos</option>
                                    {constants.ALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                            <div className="p-4 border rounded-lg bg-blue-50 w-full md:w-auto flex-shrink-0">
                                <h2 className="font-bold text-lg mb-2 text-blue-800">Cargar CSV de Casos</h2>
                                <input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" disabled={uploading} />
                                {uploading && (<div className="flex items-center gap-2 mt-2"><p className="text-xs text-blue-600">Cargando...</p><button onClick={() => { cancelUpload.current = true; }} className="px-2 py-1 bg-red-500 text-white rounded-md text-xs hover:bg-red-600">Cancelar</button></div>)}
                            </div>
                            <div className="flex flex-wrap justify-center gap-2">
                                <button onClick={() => setShowManualEntryModal(true)} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75">Ingresar Manual</button>
                                <button onClick={() => contractMarcoFileInputRef.current.click()} className="px-5 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75">Cargar CSV Contrato Marco</button>
                                <button onClick={() => reporteCruceFileInputRef.current.click()} className="px-5 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75" disabled={uploading}>Cargar Reporte Cruce</button>
                                <button onClick={forceRefreshCases} className="px-5 py-2 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75" disabled={refreshing}>{refreshing ? 'Actualizando...' : 'Refrescar Casos'}</button>
                                <button onClick={() => exportCasesToCSV(false)} className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75">Exportar Todos</button>
                                <button onClick={() => exportCasesToCSV(true)} className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75">Exportar Resueltos Hoy</button>
                                <button
        onClick={handleMassRecategorization}
        className="px-5 py-2 bg-pink-600 text-white font-semibold rounded-lg shadow-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-75"
        disabled={uploading || isMassUpdating}
    >
        Recategorizar Casos N/A
    </button>
                                <button onClick={handleDeleteAllCases} className="px-5 py-2 bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75" disabled={isMassUpdating || cases.length === 0}>Limpieza Total</button>
                            </div>
                        </div>
                    </>
                )}

                {selectedCaseIds.size > 0 && (
                    <div className="my-6 p-4 border border-blue-300 bg-blue-50 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold text-blue-700 mb-3">{selectedCaseIds.size} caso(s) seleccionado(s)</h3>
                        <div className="flex flex-wrap items-center gap-3">
                            <select value={massUpdateTargetStatus} onChange={(e) => setMassUpdateTargetStatus(e.target.value)} className="p-2 border rounded-md shadow-sm flex-grow">
                                <option value="">Seleccionar Nuevo Estado...</option>
                                {constants.ALL_STATUS_OPTIONS.map(status => (<option key={status} value={status}>{status}</option>))}
                            </select>
                            <button onClick={handleMassUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md disabled:opacity-50" disabled={!massUpdateTargetStatus || isMassUpdating}>
                                {isMassUpdating ? 'Procesando...' : 'Cambiar Estado'}
                            </button>
                            <button onClick={handleMassReopen} className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 shadow-md disabled:opacity-50" disabled={isMassUpdating}>
                                {isMassUpdating ? 'Procesando...' : 'Reabrir'}
                            </button>
                            <button onClick={handleMassDelete} className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 shadow-md disabled:opacity-50" disabled={isMassUpdating}>
                                {isMassUpdating ? 'Procesando...' : 'Eliminar'}
                            </button>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="massUpdateObs" className="block text-sm font-medium text-gray-700 mb-1">Observación para Actualización Masiva (Opcional):</label>
                            <textarea id="massUpdateObs" rows="2" className="block w-full p-2 border border-gray-300 rounded-md shadow-sm" value={massUpdateObservation} onChange={(e) => setMassUpdateObservation(e.target.value)} placeholder="Ej: Se actualizan casos por finalización de campaña." />
                        </div>
                        {massUpdateTargetStatus === 'Resuelto' && (<p className="text-xs text-orange-600 mt-2">Advertencia: Al cambiar masivamente a "Resuelto", asegúrese de que todos los casos seleccionados tengan "Despacho Respuesta" confirmado. Otros campos como Aseguramiento, Baja, o Ajuste no se validan en esta acción masiva y deben gestionarse individualmente si es necesario antes de resolver.</p>)}
                    </div>
                )}

                {activeModule === 'casos' && (
                    <>
                        <div className="my-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-xl font-semibold text-center text-gray-700 mb-4">Casos Asignados por Día</h4>
                                <ResponsiveContainer width="100%" height={300}><BarChart data={asignadosPorDiaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fecha" /><YAxis /><Tooltip /><Legend /><Bar dataKey="cantidad" fill="#8884d8" name="Casos Asignados" /></BarChart></ResponsiveContainer>
                            </div>
                            <div>
                                <h4 className="text-xl font-semibold text-center text-gray-700 mb-4">Distribución de Casos Pendientes por Antigüedad</h4>
                                <ResponsiveContainer width="100%" height={300}><BarChart data={distribucionPorDiaData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" /><YAxis /><Tooltip /><Legend /><Bar dataKey="cantidad" fill="#82ca9d" name="Casos Pendientes" /></BarChart></ResponsiveContainer>
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg bg-red-100 mb-6 shadow-md">
                            <h4 className="text-lg font-semibold text-red-800">Tiempo de Gestión Estimado para Día 15</h4>
                            <p className="mt-2 text-sm text-red-700">Tiempo disponible: 9 horas.</p>
                            <p className="mt-1 text-xl font-bold text-red-900">{timePerCaseDay15}</p>
                        </div>
                        <div className="mb-8 mt-6 border-t pt-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
                                {[
                                    { l: 'Asignados', c: counts.total, f: 'all', cl: 'blue' }, { l: 'Resueltos', c: counts.resolved, f: 'resolved', cl: 'green' },
                                    { l: 'Finalizados', c: counts.finalizado, f: 'finalizado', cl: 'gray' }, { l: 'Pendientes', c: counts.pending, f: 'pending_escalated_initiated', cl: 'yellow' },
                                    { l: 'Pend. Ajustes', c: counts.pendienteAjustes, f: 'pendiente_ajustes', cl: 'pink' }, { l: 'Día 14 Pend.', c: counts.dia14, f: 'dia14_pending', cl: 'orange' },
                                    { l: 'Día 15 Pend.', c: counts.dia15, f: 'dia15_pending', cl: 'red' }, { l: 'Día >15 Pend.', c: counts.diaGt15, f: 'dia_gt15_pending', cl: 'purple' }
                                ].map(s => (<div key={s.f} onClick={() => setActiveFilter(s.f)} className={`p-3 rounded-lg shadow-sm text-center cursor-pointer border-2 ${getFilterStyles(activeFilter === s.f, s.cl)}`}><p className={`text-sm font-semibold text-gray-700`}>{s.l}</p><p className={`text-2xl font-bold text-${s.cl}-600`}>{s.c}</p></div>))}
                            </div>
                        </div>
                        {activeFilter !== 'all' && (<div className="mb-4 text-center"><button onClick={() => { setActiveFilter('all'); setSelectedCaseIds(new Set()); }} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Limpiar Filtros y Selección</button></div>)}
                        {renderTable(sicDisp, 'Envíos SIC')}
                        {renderTable(pendAjustesDisp, 'Pendiente Ajustes')}
                        {renderTable(pendEscDisp, 'Otros Casos Pendientes o Escalados')}
                        {renderTable(resDisp, 'Casos Resueltos')}
                        {renderTable(finalizadosDisp, 'Casos Finalizados')}
                        {casesForDisplay.length === 0 && <p className="p-6 text-center">No hay casos que coincidan con los filtros seleccionados.</p>}
                    </>
                )}
                {activeModule === 'aseguramientos' && (<>{renderTable(aseguramientosDisp, 'Casos Resueltos con Aseguramiento')}</>)}
            </div>

            {/* --- RENDERIZADO DEL MODAL DE DETALLES --- */}
            {selectedCase && (
                <CaseDetailModal 
                    caseData={selectedCase}
                    onClose={handleCloseCaseDetails}
                    onUpdateCase={handleUpdateCase}
                    onCreateNewCase={handleCreateNewCase}
                    onDeleteCase={handleDeleteCase}
                    onReopenCase={handleReopenCase}
                    onAssignFromReport={handleAssignFromReport}
                    duplicateCasesDetails={duplicateCasesDetails}
                    displayModalMessage={displayModalMessage}
                    displayConfirmModal={displayConfirmModal}
                    nonBusinessDays={nonBusinessDays}
                    timePerCaseDay15={timePerCaseDay15}
                    userId={userId}
                    utils={utils}
                    aiServices={aiServices}
                    constants={constants}
                    allCases={cases} // Necesario para la lógica de SN Acumulados
                    scanFileRef={scanFileInputRef} // Necesario para el escaneo de documentos
                    onObsFileClick={handleObservationFileClick} // <-- NUEVA PROP AÑADIDA
                />
            )}

            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[150]"><div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                    <h3 className="text-lg font-semibold mb-4">Mensaje del Sistema</h3>
                    <p className="mb-6 whitespace-pre-line">{modalContent.message}</p>
                    <div className="flex justify-end gap-4">
                        {modalContent.isConfirm && (<button onClick={() => { if (modalContent.onConfirm) modalContent.onConfirm(); setShowModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{modalContent.confirmText}</button>)}
                        <button onClick={() => { if (modalContent.onCancel) modalContent.onCancel(); else setShowModal(false); }} className={`px-4 py-2 rounded-md ${modalContent.isConfirm ? 'bg-gray-300 hover:bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{modalContent.cancelText || 'Cerrar'}</button>
                    </div>
                </div></div>
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
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">{cancelAlarmCases.map(c => (<div key={c.id} className="p-3 rounded-md border bg-red-50 border-red-200"><div className="flex justify-between items-center"><div><p className="font-bold text-red-800">SN: {c.SN}</p><p className="text-sm"><span className={`px-2 inline-flex text-xs font-semibold rounded-full ${constants.statusColors[c.Estado_Gestion]}`}>{c.Estado_Gestion}</span></p><p className="text-sm text-gray-700 mt-1">Categoría: {c['Categoria del reclamo'] || 'N/A'}</p><p className="text-sm text-gray-700">Corte Facturación: Día {c.Corte_Facturacion}</p></div></div></div>))}</div>
                            <div className="flex justify-end mt-4">
                                <button onClick={() => { cancelAlarmCases.forEach(c => { sessionStorage.setItem(`cancelAlarmShown_${c.id}_${utils.getColombianDateISO()}`, 'true'); }); setShowCancelAlarmModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Cerrar Alertas</button>
                            </div>
                        </div>
                    </div>
                </div>)}
{/* --- INICIO DE LA ALARMA FALTANTE (DECRETADO / TRASLADO SIC POR ANTIGÜEDAD) --- */}
            {showAlarmModal && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-auto overflow-y-auto max-h-[95vh]">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-purple-500">
                            <h3 className="text-2xl font-bold text-purple-700">⚖️ Alarma de Antigüedad (SIC/Decreto)</h3>
                            <button onClick={() => setShowAlarmModal(false)} className="text-2xl font-bold text-gray-500 hover:text-gray-800">&times;</button>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Los siguientes casos han superado el umbral de antigüedad:
                                <br />- <strong>Traslado SIC:</strong> 3 días hábiles o más.
                                <br />- <strong>Decretado:</strong> 7 días hábiles o más.
                            </p>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {alarmCases.map(c => (
                                    <div key={c.id} className="p-3 rounded-md border bg-purple-50 border-purple-200">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-purple-800">SN: {c.SN}</p>
                                                <p className="text-sm">
                                                    <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${constants.statusColors[c.Estado_Gestion]}`}>
                                                        {c.Estado_Gestion}
                                                    </span>
                                                </p>
                                                <p className="text-sm text-gray-700 mt-1">
                                                    Cliente: {c.Nombre_Cliente || 'N/A'}
                                                </p>
                                                <p className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mt-2">
                                                    Antigüedad: {utils.calculateCaseAge(c, nonBusinessDays)} días
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end space-y-2">
                                                <button
                                                    onClick={() => {
                                                        handleOpenCaseDetails(c);
                                                        setShowAlarmModal(false); // Opcional: cierra la alarma al ver el caso
                                                    }}
                                                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 w-full text-center"
                                                >
                                                    Ver Caso
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={() => {
                                        const todayISO = utils.getColombianDateISO();
                                        alarmCases.forEach(c => {
                                            sessionStorage.setItem(`alarm_dismissed_${c.id}_${todayISO}`, 'true');
                                        });
                                        setShowAlarmModal(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Entendido, Cerrar Alertas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- FIN DE LA ALARMA FALTANTE --- */}
            {showKeywordAlarmModal && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-auto overflow-y-auto max-h-[95vh]">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-yellow-500">
                            <h3 className="text-2xl font-bold text-yellow-700">🔔 Alarma de Palabras Clave</h3>
                            <button onClick={() => setShowKeywordAlarmModal(false)} className="text-2xl font-bold text-gray-500 hover:text-gray-800">&times;</button>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Los siguientes casos (no finalizados) contienen palabras clave que requieren atención especial.
                            </p>
                            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                {keywordAlarmCases.map(c => (
                                    <div key={c.id} className="p-3 rounded-md border bg-yellow-50 border-yellow-200">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-yellow-800">SN: {c.SN}</p>
                                                <p className="text-sm">
                                                    <span className={`px-2 inline-flex text-xs font-semibold rounded-full ${constants.statusColors[c.Estado_Gestion]}`}>
                                                        {c.Estado_Gestion}
                                                    </span>
                                                </p>
                                                <p className="text-sm text-gray-700 mt-1">
                                                    Cliente: {c.Nombre_Cliente || 'N/A'}
                                                </p>
                                                <p className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full inline-block mt-2">
                                                    Motivo: {c.matchedKeyword}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end space-y-2">
                                                <button
                                                    onClick={() => handleOpenCaseDetails(c)}
                                                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 w-full text-center"
                                                >
                                                    Ver Caso
                                                </button>
                                                <button
                                                    onClick={() => handleMarkAsEscalatedFromAlarm(c)}
                                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 w-full text-center"
                                                >
                                                    Marcar Escalado
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                <button
                                    onClick={handleCopyAllAlarmSNs}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                                >
                                    Copiar todos los SN
                                </button>
                                <button
                                    onClick={() => {
                                        keywordAlarmCases.forEach(c => {
                                            sessionStorage.setItem(`keyword_alarm_dismissed_${c.id}`, 'true');
                                        });
                                        setShowKeywordAlarmModal(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Entendido, Cerrar Alertas
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
                        {/* CORRECCIÓN: Se asume que handleManualSubmit, handleManualFormChange y sus utilidades están definidas en otro lugar para que este formulario funcione */}
                        <form /* onSubmit={handleManualSubmit} */>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {['SN', 'CUN', 'FechaRadicado', 'FechaVencimiento', 'Nro_Nuip_Cliente', 'Nombre_Cliente', 'Dia'].map(f => (<div key={f}><label htmlFor={`manual${f}`} className="block text-sm font-medium mb-1">{f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:</label><input type={f.includes('Fecha') ? 'date' : (f === 'Dia' ? 'number' : 'text')} id={`manual${f}`} name={f} value={manualFormData[f]} /* onChange={handleManualFormChange} */ required={['SN', 'CUN', 'FechaRadicado'].includes(f)} className="block w-full input-form" /></div>))}
                                <div className="md:col-span-2"><label htmlFor="manualOBS" className="block text-sm font-medium mb-1">OBS:</label><textarea id="manualOBS" name="OBS" rows="3" value={manualFormData.OBS} /* onChange={handleManualFormChange} */ className="block w-full input-form" /></div>
                                <div className="md:col-span-2"><label htmlFor="manualTipo_Contrato" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Contrato:</label><select id="manualTipo_Contrato" name="Tipo_Contrato" value={manualFormData.Tipo_Contrato} /* onChange={handleManualFormChange} */ className="block w-full input-form"><option value="Condiciones Uniformes">Condiciones Uniformes</option><option value="Contrato Marco">Contrato Marco</option></select></div>
                                <div className="md:col-span-2">
                                    <label htmlFor="manualEstado_Gestion" className="block text-sm font-medium text-gray-700 mb-1">Estado Gestión Inicial:</label>
                                    <select id="manualEstado_Gestion" name="Estado_Gestion" value={manualFormData.Estado_Gestion || 'Pendiente'} /* onChange={handleManualFormChange} */ className="block w-full input-form">
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="Iniciado">Iniciado</option>
                                        <option value="Lectura">Lectura</option>
                                        <option value="Escalado">Escalado</option>
                                        <option value="Pendiente Ajustes">Pendiente Ajustes</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowManualEntryModal(false)} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={uploading}>{uploading ? 'Agregando...' : 'Agregar Caso'}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
