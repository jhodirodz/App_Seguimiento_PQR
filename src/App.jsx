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

// Importa las instancias de Firebase ya inicializadas
// CORRECTO ✅
import { db, auth } from "./firebaseConfig.js"; 
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
const appId = "App_Seguimiento_PQR";

function App() {
    // --------------------------
    // Declaraciones de estado y referencias
    // --------------------------
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authMode, setAuthMode] = useState('login');

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [cases, setCases] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [modalContent, setModalContent] = useState({ message: '', isConfirm: false, onConfirm: () => { }, confirmText: 'Confirmar', cancelText: 'Cancelar' });
    const [selectedCase, setSelectedCase] = useState(null);
    const [showManualEntryModal, setShowManualEntryModal] = useState(false);
    const [activeModule, setActiveModule] = useState('casos');
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [isGeneratingResponseProjection, setIsGeneratingResponseProjection] = useState(false);
    const [isSuggestingEscalation, setIsSuggestingEscalation] = useState(false);
    const [isGeneratingNextActions, setIsGeneratingNextActions] = useState(false);
    const [isGeneratingRootCause, setIsGeneratingRootCause] = useState(false);
    const [isGeneratingEscalationEmail, setIsGeneratingEscalationEmail] = useState(false);
    const [isGeneratingRiskAnalysis, setIsGeneratingRiskAnalysis] = useState(false);
    const [isGeneratingComprehensiveResponse, setIsGeneratingComprehensiveResponse] = useState(false);
    const [isGeneratingValidation, setIsGeneratingValidation] = useState(false);
    const [isTranscribingObservation, setIsTranscribingObservation] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [contractFilter, setContractFilter] = useState('todos');
    const [priorityFilter, setPriorityFilter] = useState('todos');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
    const [massUpdateTargetStatus, setMassUpdateTargetStatus] = useState('');
    const [isMassUpdating, setIsMassUpdating] = useState(false);
    const [massUpdateObservation, setMassUpdateObservation] = useState('');

    const statusColors = { 
        'Pendiente': 'bg-yellow-200 text-yellow-800', 
        'Resuelto': 'bg-green-200 text-green-800', 
        'Finalizado': 'bg-gray-200 text-gray-800',
        'Escalado': 'bg-red-200 text-red-800',
        'Iniciado': 'bg-blue-200 text-blue-800',
        'Lectura': 'bg-indigo-200 text-indigo-800',
        'Pendiente Ajustes': 'bg-pink-200 text-pink-800',
        'Decretado': 'bg-purple-200 text-purple-800',
        'Traslado SIC': 'bg-orange-200 text-orange-800'
    };
    const priorityColors = { 'Alta': 'text-red-600', 'Media': 'text-yellow-600', 'Baja': 'text-green-600' };


    const initialManualFormData = {
        SN: '', CUN: '', FechaRadicado: '', FechaVencimiento: '', Nro_Nuip_Cliente: '', Nombre_Cliente: '',
        OBS: '', Dia: '', Tipo_Contrato: 'Condiciones Uniformes', Numero_Contrato_Marco: '', isNabis: false,
        Requiere_Aseguramiento_Facturas: false, ID_Aseguramiento: '', Corte_Facturacion: '',
        Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '', Cuenta: '',
        requiereBaja: false, numeroOrdenBaja: '',
        requiereAjuste: false, numeroTT: '', estadoTT: '', requiereDevolucionDinero: false,
        cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '',
        areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', Estado_Gestion: 'Pendiente'
    };
    const [reliquidacionData, setReliquidacionData] = useState([{
        id: 1,
        numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null,
    }]);
    const [manualFormData, setManualFormData] = useState(initialManualFormData);
    const [duplicateCasesDetails, setDuplicateCasesDetails] = useState([]);
    const [reporteCruceData, setReporteCruceData] = useState([]);

    const fileInputRef = useRef(null);
    const observationFileInputRef = useRef(null);
    const cancelUpload = useRef(false);
    const [caseToScan, setCaseToScan] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const scanFileInputRef = useRef(null);
    const contractMarcoFileInputRef = useRef(null);
    const reporteCruceFileInputRef = useRef(null);
    const nonBusinessDays = new Set(constants.COLOMBIAN_HOLIDAYS);

    const [tieneSNAcumulados, setTieneSNAcumulados] = useState(false);
    const [cantidadSNAcumulados, setCantidadSNAcumulados] = useState(0);
    const [snAcumuladosData, setSnAcumuladosData] = useState([]);
    const [showGestionesAdicionales, setShowGestionesAdicionales] = useState(true);
    const [aseguramientoObs, setAseguramientoObs] = useState('');
    const [showAlarmModal, setShowAlarmModal] = useState(false);
    const [alarmCases, setAlarmCases] = useState([]);
    const [alarmObservation, setAlarmObservation] = useState('');
    const [selectedAlarmCase, setSelectedAlarmCase] = useState(null);
    const [showCancelAlarmModal, setShowCancelAlarmModal] = useState(false);
    const [cancelAlarmCases, setCancelAlarmCases] = useState([]);

    // --------------------------
    // Definición de funciones y lógicas
    // --------------------------

    const displayModalMessage = useCallback((message) => {
        setModalContent({ message, isConfirm: false, onConfirm: () => { } });
        setShowModal(true);
    }, []);

    const displayConfirmModal = useCallback((message, { onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar' } = {}) => {
        setModalContent({
            message, isConfirm: true,
            onConfirm: onConfirm || (() => { }),
            onCancel: onCancel || (() => setShowModal(false)),
            confirmText, cancelText
        });
        setShowModal(true);
    }, []);

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

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

    async function createUserAsAdmin(email, password, role = 'user') {
        if (!auth || !userId) { displayModalMessage('No hay sesión activa.'); return { ok: false }; }
        try {
            const currentSnap = await getDoc(doc(db, `artifacts/${appId}/users`, userId));
            if (!currentSnap.exists() || currentSnap.data().role !== 'admin') {
                displayModalMessage('Solo administradores pueden crear usuarios.');
                return { ok: false };
            }
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const newUser = cred.user;
            await setDoc(doc(db, `artifacts/${appId}/users`, newUser.uid), {
                email, displayName: null, role, createdAt: new Date().toISOString(), createdBy: userId
            });
            displayModalMessage('Usuario creado (cliente). En producción use Cloud Function con Admin SDK.');
            return { ok: true, newUser };
        } catch (e) {
            console.error('createUserAsAdmin error:', e);
            displayModalMessage('Error creando usuario: ' + (e.message || e.toString()));
            return { ok: false, error: e };
        }
    }

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

    const checkCancellationAlarms = useCallback(() => {
        const today = new Date();
        const todayISO = utils.getColombianDateISO();
        const casesToAlert = cases.filter(caseItem => {
            const isCancellationRelated = String(caseItem['Categoria del reclamo'] || '').toLowerCase().includes('cancelacion') ||
                String(caseItem['Categoria del reclamo'] || '').toLowerCase().includes('prepago');
            if (!isCancellationRelated) return false;
            const cutOffDay = parseInt(caseItem.Corte_Facturacion);
            if (isNaN(cutOffDay) || cutOffDay < 1 || cutOffDay > 31) return false;
            const alertShownKey = `cancelAlarmShown_${caseItem.id}_${todayISO}`;
            if (sessionStorage.getItem(alertShownKey)) return false;
            let nextCutOffDate = new Date(today.getFullYear(), today.getMonth(), cutOffDay);
            if (today.getDate() > cutOffDay) {
                nextCutOffDate = new Date(today.getFullYear(), today.getMonth() + 1, cutOffDay);
            }
            const daysToSubtract = 3;
            let businessDaysCount = 0;
            let tempDate = new Date(nextCutOffDate);
            while (businessDaysCount < daysToSubtract) {
                tempDate.setDate(tempDate.getDate() - 1);
                const dayOfWeek = tempDate.getDay();
                const dateStr = tempDate.toISOString().slice(0, 10);
                const isNonBusinessDay = nonBusinessDays.has(dateStr);
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isNonBusinessDay) {
                    businessDaysCount++;
                }
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

    const handleReliquidacionChange = (index, e) => {
        const { name, value } = e.target;
        setReliquidacionData(prev => {
            const newForms = [...prev];
            newForms[index][name] = value;
            return newForms;
        });
    };

    const handleAddForm = () => {
        const newId = reliquidacionData.length > 0 ? Math.max(...reliquidacionData.map(f => f.id)) + 1 : 1;
        setReliquidacionData(prev => [...prev, {
            id: newId, numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null,
        }]);
    };

    const handleRemoveForm = (idToRemove) => {
        setReliquidacionData(prev => prev.filter(form => form.id !== idToRemove));
    };

    async function calcularNotaCredito() {
        if (!selectedCase) {
            displayModalMessage("Error: No hay un caso seleccionado para actualizar.");
            return;
        }
        const newForms = reliquidacionData.map(form => {
            const { numeroCuenta, fechaInicioCiclo, fechaFinCiclo, fechaBaja, valorMensual } = form;
            if (!numeroCuenta || !fechaInicioCiclo || !fechaFinCiclo || !fechaBaja || !valorMensual) {
                displayModalMessage(`Por favor, complete todos los campos para la cuenta ${numeroCuenta || 'sin nombre'}.`);
                return form;
            }
            const start = new Date(fechaInicioCiclo + 'T00:00:00-05:00');
            const end = new Date(fechaFinCiclo + 'T00:00:00-05:00');
            const baja = new Date(fechaBaja + 'T00:00:00-05:00');
            if (isNaN(start) || isNaN(end) || isNaN(baja)) {
                displayModalMessage("Una de las fechas ingresadas no es válida.");
                return form;
            }
            if (baja < start || baja > end) {
                displayModalMessage(`La fecha de baja debe estar dentro del ciclo de facturación para la cuenta ${numeroCuenta}.`);
                return form;
            }
            const diasTotales = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
            const diasAReliquidar = (end.getTime() - baja.getTime()) / (1000 * 60 * 60 * 24) + 1;
            const valorDiario = parseFloat(valorMensual) / diasTotales;
            const monto = valorDiario * diasAReliquidar;
            return { ...form, montoNotaCredito: monto.toFixed(2) };
        });
        setReliquidacionData(newForms);
        const newObservationText = newForms.map(form => `Cálculo de nota de crédito para Cuenta ${form.numeroCuenta}:\n- Ciclo: ${form.fechaInicioCiclo} a ${form.fechaFinCiclo}\n- Fecha de baja: ${form.fechaBaja}\n- Valor mensual: $${form.valorMensual}\n- Monto a reliquidar: $${form.montoNotaCredito}`).join('\n\n');
        const newHistoryEntry = { text: newObservationText, timestamp: new Date().toISOString() };
        const updatedHistory = [...(selectedCase.Observaciones_Historial || []), newHistoryEntry];
        await updateCaseInFirestore(selectedCase.id, { Observaciones_Historial: updatedHistory });
        setSelectedCase(prev => ({ ...prev, Observaciones_Historial: updatedHistory }));
        displayModalMessage("Cálculo de nota de crédito completado y guardado en el historial.");
    }

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
                    const parsedFechaRadicado = utils.parseDate(row['Fecha Radicado']);
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
                            fechaEfectivaDevolucion: '', areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: ''
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

    async function handleContractMarcoUpload(event) {
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
                if (!nuipHeader) { throw new Error("El CSV debe contener una columna con 'nuip' en el encabezado (ej: 'Nro_Nuip_Cliente' o 'NUIP')."); }
                const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
                const batch = writeBatch(db);
                let updatedCasesCount = 0, nuipsNotFoundCount = 0, skippedNabisCount = 0;
                const allCasesSnapshot = await getDocs(collRef);
                const casesByClienteNuip = new Map(), casesByReclamanteNuip = new Map();
                allCasesSnapshot.forEach(docSnap => {
                    const caseData = { id: docSnap.id, ...docSnap.data() };
                    const clienteNuip = utils.normalizeNuip(caseData.Nro_Nuip_Cliente);
                    const reclamanteNuip = utils.normalizeNuip(caseData.Nro_Nuip_Reclamante);
                    if (clienteNuip && clienteNuip !== '0' && clienteNuip !== 'N/A') {
                        if (!casesByClienteNuip.has(clienteNuip)) { casesByClienteNuip.set(clienteNuip, []); }
                        casesByClienteNuip.get(clienteNuip).push(caseData);
                    }
                    if (reclamanteNuip && reclamanteNuip !== '0' && reclamanteNuip !== 'N/A') {
                        if (!casesByReclamanteNuip.has(reclamanteNuip)) { casesByReclamanteNuip.set(reclamanteNuip, []); }
                        casesByReclamanteNuip.get(reclamanteNuip).push(caseData);
                    }
                });
                const processedNuips = new Set();
                for (const row of csvDataRows) {
                    const nuipToSearch = utils.normalizeNuip(row[nuipHeader]);
                    if (!nuipToSearch || processedNuips.has(nuipToSearch)) { continue; }
                    processedNuips.add(nuipToSearch);
                    let foundMatch = false;
                    const potentialMatches = [...(casesByClienteNuip.get(nuipToSearch) || []), ...(casesByReclamanteNuip.get(nuipToSearch) || [])];
                    const uniqueMatches = Array.from(new Map(potentialMatches.map(item => [item.id, item])).values());
                    if (uniqueMatches.length > 0) {
                        foundMatch = true;
                        uniqueMatches.forEach(caseToUpdate => {
                            if (caseToUpdate.isNabis === true) { skippedNabisCount++; return; }
                            const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseToUpdate.id);
                            const updateData = { Tipo_Contrato: 'Contrato Marco' };
                            if (row.Numero_Contrato_Marco) { updateData.Numero_Contrato_Marco = String(row.Numero_Contrato_Marco).trim(); }
                            batch.update(docRef, updateData);
                            updatedCasesCount++;
                        });
                    }
                    if (!foundMatch) { nuipsNotFoundCount++; }
                }
                if (updatedCasesCount > 0) { await batch.commit(); }
                displayModalMessage(`Reclasificación completa. Casos actualizados: ${updatedCasesCount}. Casos omitidos por marca manual "CM Nabis": ${skippedNabisCount}. NUIPs del CSV no encontrados: ${nuipsNotFoundCount}.`);
            } catch (err) { displayModalMessage(`Error durante reclasificación por Contrato Marco: ${err.message}`); }
            finally { setUploading(false); if (contractMarcoFileInputRef.current) contractMarcoFileInputRef.current.value = ''; }
        };
        reader.onerror = (err) => { displayModalMessage(`Error leyendo el archivo: ${err.message}`); setUploading(false); };
        reader.readAsText(file);
    }

    async function handleReporteCruceUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(true);
        displayModalMessage('Procesando reporte para cruce de información...');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const { headers, data: reportData } = utils.parseCSV(e.target.result);
                if (reportData.length === 0) { throw new Error('El archivo CSV está vacío o tiene un formato no válido.'); }
                setReporteCruceData(reportData);
                const nuipHeader = headers.find(h => h.toLowerCase().includes('nuip'));
                if (!nuipHeader) { throw new Error("El archivo CSV debe contener una columna con 'nuip' en el encabezado (ej: 'Nro_Nuip_Cliente')."); }
                const reportNuips = new Set(reportData.map(row => utils.normalizeNuip(row[nuipHeader])).filter(nuip => nuip));
                if (reportNuips.size === 0) { throw new Error("No se encontraron Documentos de Identidad (NUIP) válidos en el reporte."); }
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
                    if (casesByNuip.has(nuip)) { matches.set(nuip, casesByNuip.get(nuip)); }
                });
                if (matches.size > 0) {
                    let message = `Reporte cargado. Se encontraron coincidencias para ${matches.size} documentos en sus casos asignados:\n\n`;
                    matches.forEach((snList, nuip) => { message += `- Documento ${nuip}:\n  Casos SN: ${[...new Set(snList)].join(', ')}\n`; });
                    displayModalMessage(message);
                } else { displayModalMessage('Reporte cargado. No se encontraron coincidencias inmediatas en sus casos asignados.'); }
            } catch (err) { displayModalMessage(`Error al procesar el reporte: ${err.message}`); }
            finally { setUploading(false); if (reporteCruceFileInputRef.current) { reporteCruceFileInputRef.current.value = ''; } }
        };
        reader.onerror = (err) => { displayModalMessage(`Error leyendo el archivo: ${err.message}`); setUploading(false); };
        reader.readAsText(file, 'ISO-8859-1');
    }

    function handleAssignFromReport(reportRowData) {
        const nuipHeader = Object.keys(reportRowData).find(h => h.toLowerCase().includes('nuip')) || 'Nro_Nuip_Cliente';
        const snHeader = Object.keys(reportRowData).find(h => h.toLowerCase().trim() === 'sn') || 'SN';
        const cunHeader = Object.keys(reportRowData).find(h => h.toLowerCase().trim() === 'cun') || 'CUN';
        const fechaRadicadoHeader = Object.keys(reportRowData).find(h => h.toLowerCase().replace(/_/g, ' ').trim() === 'fecha radicado') || 'FechaRadicado';
        const prefilledData = {
            ...initialManualFormData,
            SN: reportRowData[snHeader] || '',
            CUN: reportRowData[cunHeader] || '',
            Nro_Nuip_Cliente: reportRowData[nuipHeader] || '',
            FechaRadicado: reportRowData[fechaRadicadoHeader] || '',
        };
        setManualFormData(prefilledData);
        handleCloseCaseDetails();
        setShowManualEntryModal(true);
    }

    async function handleOpenCaseDetails(caseItem) {
        setSelectedCase(caseItem);
        setTieneSNAcumulados(false);
        setCantidadSNAcumulados(0);
        setSnAcumuladosData([]);
        setAseguramientoObs('');
        setDuplicateCasesDetails([]);
        setReliquidacionData([{ id: 1, numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null }]);
        const duplicatesMap = new Map();
        const normalizedCaseNuips = new Set([utils.normalizeNuip(caseItem.Nro_Nuip_Cliente), utils.normalizeNuip(caseItem.Nro_Nuip_Reclamante)].filter(nuip => nuip && nuip !== '0' && nuip !== 'N/A'));
        cases.forEach(otherCase => {
            if (otherCase.id === caseItem.id) return;
            const normalizedOtherNuips = new Set([utils.normalizeNuip(otherCase.Nro_Nuip_Cliente), utils.normalizeNuip(otherCase.Nro_Nuip_Reclamante)].filter(Boolean));
            const hasCommonNuip = [...normalizedCaseNuips].some(nuip => normalizedOtherNuips.has(nuip));
            if (hasCommonNuip) { duplicatesMap.set(otherCase.id, { ...otherCase, type: 'Documento Asignado' }); }
        });
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
        setTieneSNAcumulados(false);
        setCantidadSNAcumulados(0);
        setSnAcumuladosData([]);
        setAseguramientoObs('');
        setReliquidacionData([{ id: 1, numeroCuenta: '', valorMensual: '', fechaInicioCiclo: '', fechaFinCiclo: '', fechaBaja: '', montoNotaCredito: null }]);
    }

    async function handleModalFieldChange(fieldName, value) {
        if (!selectedCase) return;
        const firestoreUpdateData = { [fieldName]: value };
        if (fieldName === 'Fecha Radicado') {
            const tempCaseForCalc = { ...selectedCase, 'Fecha Radicado': value };
            const newAge = utils.calculateCaseAge(tempCaseForCalc, nonBusinessDays);
            firestoreUpdateData.Dia = newAge;
            setSelectedCase(prev => ({ ...prev, 'Fecha Radicado': value, 'Dia': newAge }));
        }
        if (fieldName === 'isNabis') {
            const newContractType = value ? 'Contrato Marco' : 'Condiciones Uniformes';
            firestoreUpdateData.Tipo_Contrato = newContractType;
            setSelectedCase(prev => ({ ...prev, isNabis: value, Tipo_Contrato: newContractType }));
        } else {
            const isChecked = typeof value === 'boolean' ? value : (value === 'true');
            if (fieldName === 'Nombre_Cliente') value = value.toUpperCase();
            else if (fieldName === 'Nro_Nuip_Cliente' && (String(value).startsWith('8') || String(value).startsWith('9')) && String(value).length > 9) value = String(value).substring(0, 9);
            if (['Requiere_Aseguramiento_Facturas', 'requiereBaja', 'requiereAjuste'].includes(fieldName)) {
                if (isChecked) { firestoreUpdateData.Despacho_Respuesta_Checked = false; }
                if (!isChecked) {
                    if (fieldName === 'Requiere_Aseguramiento_Facturas') Object.assign(firestoreUpdateData, { ID_Aseguramiento: '', Corte_Facturacion: '', Cuenta: '', Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '', gestionAseguramientoCompletada: false });
                    else if (fieldName === 'requiereBaja') firestoreUpdateData.numeroOrdenBaja = '';
                    else if (fieldName === 'requiereAjuste') {
                        Object.assign(firestoreUpdateData, { numeroTT: '', estadoTT: '', requiereDevolucionDinero: false, cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '' });
                        if (selectedCase.Estado_Gestion === 'Pendiente Ajustes') firestoreUpdateData.Estado_Gestion = 'Pendiente';
                    }
                }
            } else if (fieldName === 'requiereDevolucionDinero' && !isChecked) { Object.assign(firestoreUpdateData, { cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '' }); }
            if (fieldName === 'gestionAseguramientoCompletada') { firestoreUpdateData.gestionAseguramientoCompletada = value; }
            if (fieldName === 'estadoTT' && selectedCase.requiereAjuste) {
                if (value === 'Pendiente' && selectedCase.Estado_Gestion !== 'Pendiente Ajustes') {
                    firestoreUpdateData.Estado_Gestion = 'Pendiente Ajustes';
                    displayModalMessage('El estado del caso ha cambiado a "Pendiente Ajustes".');
                }
            } else if (fieldName === 'areaEscalada') { firestoreUpdateData.motivoEscalado = ''; }
            if (fieldName === 'gestionAseguramientoCompletada') { firestoreUpdateData.gestionAseguramientoCompletada = value; }
            setSelectedCase(prev => ({ ...prev, ...firestoreUpdateData, [fieldName]: value }));
        }
        updateCaseInFirestore(selectedCase.id, firestoreUpdateData);
    }

    function handleContractTypeChange(newContractType) {
        if (!selectedCase) return;
        const updateData = { Tipo_Contrato: newContractType };
        if (newContractType !== 'Contrato Marco') { updateData.isNabis = false; }
        setSelectedCase(prev => ({ ...prev, ...updateData }));
        updateCaseInFirestore(selectedCase.id, updateData);
    }

    async function proceedWithResolve() {
        if (!selectedCase) return;
        const batch = writeBatch(db);
        let local = { ...selectedCase, Estado_Gestion: 'Resuelto' };
        if (!selectedCase.Despacho_Respuesta_Checked && !selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.requiereBaja && !selectedCase.requiereAjuste) { displayModalMessage('Debe seleccionar "Despacho Respuesta" o una opción de "Gestiones Adicionales" para resolver.'); return; }
        if (selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.ID_Aseguramiento && (!selectedCase.Corte_Facturacion || isNaN(parseFloat(selectedCase.Corte_Facturacion)) || !selectedCase.Cuenta || !selectedCase.Operacion_Aseguramiento || !selectedCase.Tipo_Aseguramiento || !selectedCase.Mes_Aseguramiento)) { displayModalMessage('Para resolver con Aseguramiento, complete todos los campos requeridos.'); return; }
        if (selectedCase.requiereBaja && !selectedCase.numeroOrdenBaja) { displayModalMessage('Si requiere baja, debe ingresar el Número de Orden de Baja.'); return; }
        if (selectedCase.requiereAjuste) {
            if (!selectedCase.numeroTT) { displayModalMessage('Si requiere ajuste, debe ingresar el Número de TT.'); return; }
            if (selectedCase.estadoTT !== 'Aplicado') { displayModalMessage('Si requiere ajuste, el Estado TT debe ser "Aplicado".'); return; }
            if (selectedCase.requiereDevolucionDinero && (!selectedCase.cantidadDevolver || isNaN(parseFloat(selectedCase.cantidadDevolver)) || parseFloat(selectedCase.cantidadDevolver) <= 0 || !selectedCase.idEnvioDevoluciones || !selectedCase.fechaEfectivaDevolucion)) { displayModalMessage('Si requiere devolución, complete todos los campos de devolución.'); return; }
        }
        if ((selectedCase.Requiere_Aseguramiento_Facturas || selectedCase.requiereBaja || selectedCase.requiereAjuste) && !selectedCase.gestionAseguramientoCompletada) {
            displayModalMessage('Error: El caso tiene gestiones adicionales pendientes. Debe marcar la casilla "Marcar gestión de aseguramiento como completada" antes de resolver.');
            return;
        }
        const today = utils.getColombianDateISO();
        const newObservations = [...(selectedCase.Observaciones_Historial || [])];
        if (selectedCase.SNAcumulados_Historial && selectedCase.SNAcumulados_Historial.length > 0) {
            const accumulatedSNs = selectedCase.SNAcumulados_Historial.map(item => item.sn.trim()).filter(Boolean);
            if (accumulatedSNs.length > 0) {
                const snListString = accumulatedSNs.join(', ');
                const mainAnnotationText = `Caso resuelto. Se cerraron también los siguientes SN Acumulados: ${snListString}`;
                newObservations.push({ text: mainAnnotationText, timestamp: new Date().toISOString() });
                const q = query(collection(db, `artifacts/${appId}/users/${userId}/cases`), where('SN', 'in', accumulatedSNs));
                const querySnapshot = await getDocs(q);
                const accumulatedAnnotationText = `Este caso fue resuelto como parte del cierre del caso principal SN: ${selectedCase.SN}`;
                const accumulatedAnnotation = { text: accumulatedAnnotationText, timestamp: new Date().toISOString() };
                querySnapshot.forEach(doc => {
                    const accumulatedCaseData = doc.data();
                    const newAccumulatedHistory = [...(accumulatedCaseData.Observaciones_Historial || []), accumulatedAnnotation];
                    batch.update(doc.ref, { Estado_Gestion: 'Resuelto', 'Fecha Cierre': today, Observaciones_Historial: newAccumulatedHistory });
                });
            }
        }
        const mainCaseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, selectedCase.id);
        const tiempoGestionDia15 = timePerCaseDay15;
        const data = {
            Estado_Gestion: 'Resuelto', 'Fecha Cierre': today,
            Tiempo_Resolucion_Minutos: selectedCase.Fecha_Inicio_Gestion ? utils.getDurationInMinutes(selectedCase.Fecha_Inicio_Gestion, new Date().toISOString()) : 'N/A',
            Tiempo_Gestion_Dia15_Congelado: tiempoGestionDia15, Observaciones_Historial: newObservations
        };
        local['Fecha Cierre'] = today;
        local.Tiempo_Resolucion_Minutos = data.Tiempo_Resolucion_Minutos;
        local.Tiempo_Gestion_Dia15_Congelado = data.Tiempo_Gestion_Dia15_Congelado;
        local.Observaciones_Historial = newObservations;
        batch.update(mainCaseRef, data);
        setSelectedCase(local);
        await batch.commit();
    }

    async function handleDecretarCaso() {
        if (!selectedCase) return;
        if (!selectedCase.Despacho_Respuesta_Checked) { displayModalMessage("Error: Para decretar el caso, primero debe marcar la casilla 'Despacho Respuesta'."); return; }
        if (!Array.isArray(selectedCase.Escalamiento_Historial) || selectedCase.Escalamiento_Historial.length === 0) { displayModalMessage("Error: Debe guardar un registro de escalación antes de decretar el caso."); return; }
        if (!selectedCase.Radicado_SIC || !selectedCase.Fecha_Vencimiento_Decreto) { displayModalMessage("Error: Debe completar los campos 'Radicado SIC' y 'Fecha Vencimiento Decreto' para poder decretar."); return; }
        displayConfirmModal('¿Está seguro de que desea decretar este caso? Esta acción resolverá el caso actual y creará uno nuevo en estado "Decretado".',
            {
                onConfirm: async () => {
                    try {
                        const batch = writeBatch(db);
                        const today = utils.getColombianDateISO();
                        const timestamp = new Date().toISOString();
                        const provisionalSN = `DECRETO-${Date.now()}`;
                        const newCaseData = { ...selectedCase };
                        delete newCaseData.id;
                        delete newCaseData.SN_Original;
                        Object.assign(newCaseData, {
                            SN: provisionalSN, SN_Original: selectedCase.SN, Estado_Gestion: 'Decretado', 'Fecha Radicado': today,
                            'Dia': utils.calculateBusinessDays(today, today, nonBusinessDays), 'Fecha Cierre': '', nombre_oficina: userId,
                            Observaciones_Historial: [...(selectedCase.Observaciones_Historial || []), { text: `Caso creado por decreto del SN original: ${selectedCase.SN}. Radicado SIC: ${selectedCase.Radicado_SIC}`, timestamp }],
                            Aseguramiento_Historial: [], SNAcumulados_Historial: [], Escalamiento_Historial: [],
                            areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: ''
                        });
                        const newCaseRef = doc(collection(db, `artifacts/${appId}/users/${userId}/cases`));
                        batch.set(newCaseRef, newCaseData);
                        const originalCaseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, selectedCase.id);
                        const originalCaseUpdate = {
                            Estado_Gestion: 'Resuelto', 'Fecha Cierre': today,
                            Observaciones_Historial: [...(selectedCase.Observaciones_Historial || []), { text: `Caso resuelto por decreto. Se creó un nuevo caso con SN provisional: ${provisionalSN}`, timestamp }]
                        };
                        batch.update(originalCaseRef, originalCaseUpdate);
                        await batch.commit();
                        displayModalMessage('Caso decretado exitosamente. Se ha resuelto el caso actual y se ha creado uno nuevo.');
                        handleCloseCaseDetails();
                    } catch (error) {
                        console.error("Error al decretar el caso:", error);
                        displayModalMessage(`Error al decretar el caso: ${error.message}`);
                    }
                }, confirmText: 'Sí, decretar', cancelText: 'No, cancelar'
            });
    }

    async function handleTrasladoSIC() {
        if (!selectedCase) return;
        if (!selectedCase.Despacho_Respuesta_Checked) { displayModalMessage("Error: Para trasladar el caso a SIC, primero debe marcar la casilla 'Despacho Respuesta'."); return; }
        if (!selectedCase.Radicado_SIC || !selectedCase.Fecha_Vencimiento_Decreto) { displayModalMessage("Error: Debe completar los campos 'Radicado SIC' y 'Fecha Vencimiento Decreto' para poder trasladar a SIC."); return; }
        displayConfirmModal('¿Está seguro de que desea trasladar este caso a SIC? Esta acción resolverá el caso actual y creará uno nuevo en estado "Traslado SIC".',
            {
                onConfirm: async () => {
                    try {
                        const batch = writeBatch(db);
                        const today = utils.getColombianDateISO();
                        const timestamp = new Date().toISOString();
                        const provisionalSN = `TRASLADO-${Date.now()}`;
                        const newCaseData = { ...selectedCase };
                        delete newCaseData.id;
                        delete newCaseData.SN_Original;
                        Object.assign(newCaseData, {
                            SN: provisionalSN, SN_Original: selectedCase.SN, Estado_Gestion: 'Traslado SIC', 'Fecha Radicado': today,
                            'Dia': utils.calculateBusinessDays(today, today, nonBusinessDays), 'Fecha Cierre': '', nombre_oficina: userId,
                            Observaciones_Historial: [...(selectedCase.Observaciones_Historial || []), { text: `Caso creado por traslado a SIC del SN original: ${selectedCase.SN}. Radicado SIC: ${selectedCase.Radicado_SIC}`, timestamp }],
                            Aseguramiento_Historial: [], SNAcumulados_Historial: [], Escalamiento_Historial: [],
                            areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: ''
                        });
                        const newCaseRef = doc(collection(db, `artifacts/${appId}/users/${userId}/cases`));
                        batch.set(newCaseRef, newCaseData);
                        const originalCaseRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, selectedCase.id);
                        const originalCaseUpdate = {
                            Estado_Gestion: 'Resuelto', 'Fecha Cierre': today,
                            Observaciones_Historial: [...(selectedCase.Observaciones_Historial || []), { text: `Caso resuelto por traslado a SIC. Se creó un nuevo caso con SN provisional: ${provisionalSN}`, timestamp }]
                        };
                        batch.update(originalCaseRef, originalCaseUpdate);
                        await batch.commit();
                        displayModalMessage('Caso trasladado a SIC exitosamente. Se ha resuelto el caso actual y se ha creado uno nuevo.');
                        handleCloseCaseDetails();
                    } catch (error) {
                        console.error("Error al trasladar el caso a SIC:", error);
                        displayModalMessage(`Error al trasladar el caso a SIC: ${error.message}`);
                    }
                }, confirmText: 'Sí, trasladar a SIC', cancelText: 'No, cancelar'
            });
    }

    async function handleSaveEscalamientoHistory() {
        if (!selectedCase) return;
        if (!selectedCase.areaEscalada || !selectedCase.motivoEscalado) { displayModalMessage('Debe seleccionar el área y el motivo de la escalación para guardar.'); return; }
        const escalamientoData = {
            timestamp: new Date().toISOString(),
            areaEscalada: selectedCase.areaEscalada, motivoEscalado: selectedCase.motivoEscalado,
            idEscalado: selectedCase.idEscalado || '', reqGenerado: selectedCase.reqGenerado || '', descripcionEscalamiento: selectedCase.descripcionEscalamiento || ''
        };
        const newHistory = [...(selectedCase.Escalamiento_Historial || []), escalamientoData];
        try {
            await updateCaseInFirestore(selectedCase.id, { Escalamiento_Historial: newHistory });
            setSelectedCase(prev => ({ ...prev, Escalamiento_Historial: newHistory }));
            displayModalMessage('Historial de escalación guardado.');
        } catch (e) { displayModalMessage(`Error guardando historial de escalación: ${e.message}`); }
    }

    async function handleChangeCaseStatus(newStatus) {
        if (!selectedCase) return;
        if (newStatus === 'Decretado') { handleDecretarCaso(); return; }
        if (newStatus === 'Traslado SIC') { handleTrasladoSIC(); return; }
        if (newStatus === 'Resuelto') {
            const needsAssuranceCheck = !selectedCase.Requiere_Aseguramiento_Facturas && !selectedCase.requiereBaja && !selectedCase.requiereAjuste;
            if (needsAssuranceCheck) {
                displayConfirmModal('¿Confirma que el caso NO requiere "Aseguramiento y Gestiones Adicionales"?',
                    { onConfirm: () => proceedWithResolve(), onCancel: () => { setShowModal(false); setShowGestionesAdicionales(true); }, confirmText: 'No, no requiere', cancelText: 'Sí, requiere gestión' });
            } else { await proceedWithResolve(); }
        } else {
            const oldStatus = selectedCase.Estado_Gestion;
            const data = { Estado_Gestion: newStatus };
            if (oldStatus === 'Escalado' && newStatus !== 'Escalado') { Object.assign(data, { areaEscalada: '', motivoEscalado: '', idEscalado: '', reqGenerado: '', descripcionEscalamiento: '' }); }
            if (newStatus === 'Iniciado') { Object.assign(data, { Fecha_Inicio_Gestion: new Date().toISOString(), Tiempo_Resolucion_Minutos: 'N/A' }); }
            setSelectedCase(prev => ({ ...prev, ...data }));
            await updateCaseInFirestore(selectedCase.id, data);
        }
    }

    async function handleDespachoRespuestaChange(e) {
        if (!selectedCase) return;
        const isChecked = e.target.checked;
        let updateData = { Despacho_Respuesta_Checked: isChecked };
        if (isChecked) {
            updateData = {
                ...updateData,
                Requiere_Aseguramiento_Facturas: false, requiereBaja: false, requiereAjuste: false, requiereDevolucionDinero: false,
                ID_Aseguramiento: '', Corte_Facturacion: '', Cuenta: '', Operacion_Aseguramiento: '', Tipo_Aseguramiento: '', Mes_Aseguramiento: '',
                numeroOrdenBaja: '', numeroTT: '', estadoTT: '', cantidadDevolver: '', idEnvioDevoluciones: '', fechaEfectivaDevolucion: '',
            };
            if (isChecked && selectedCase.Estado_Gestion === 'Pendiente Ajustes') { updateData.Estado_Gestion = 'Pendiente'; }
        }
        setSelectedCase(prev => ({ ...prev, ...updateData }));
        await updateCaseInFirestore(selectedCase.id, updateData);
    }

    function handleRadicadoSICChange(e) { setSelectedCase(prev => ({ ...prev, Radicado_SIC: e.target.value })); updateCaseInFirestore(selectedCase.id, { Radicado_SIC: e.target.value }); }
    function handleFechaVencimientoDecretoChange(e) { setSelectedCase(prev => ({ ...prev, Fecha_Vencimiento_Decreto: e.target.value })); updateCaseInFirestore(selectedCase.id, { Fecha_Vencimiento_Decreto: e.target.value }); }
    async function handleAssignUser() { if (!selectedCase || !userId) return; setSelectedCase(prev => ({ ...prev, user: userId })); await updateCaseInFirestore(selectedCase.id, { user: userId }); displayModalMessage(`Caso asignado a: ${userId}`); }
    async function generateAIAnalysis() { if (!selectedCase) return; setIsGeneratingAnalysis(true); try { const res = await aiServices.getAIAnalysisAndCategory(selectedCase); setSelectedCase(prev => ({ ...prev, ...res })); await updateCaseInFirestore(selectedCase.id, res); } catch (e) { displayModalMessage(`Error AI Analysis: ${e.message}`); } finally { setIsGeneratingAnalysis(false); } }
    async function generateAISummaryHandler() { if (!selectedCase) return; setIsGeneratingSummary(true); try { const sum = await aiServices.getAISummary(selectedCase); setSelectedCase(prev => ({ ...prev, Resumen_Hechos_IA: sum })); await updateCaseInFirestore(selectedCase.id, { Resumen_Hechos_IA: sum }); } catch (e) { displayModalMessage(`Error AI Summary: ${e.message}`); } finally { setIsGeneratingSummary(false); } }
    async function generateAIResponseProjectionHandler() {
        if (!selectedCase) return;
        const lastObs = selectedCase.Observaciones_Historial?.slice(-1)[0]?.text || selectedCase.Observaciones || '';
        setIsGeneratingResponseProjection(true);
        try { const proj = await aiServices.getAIResponseProjection(lastObs, selectedCase, selectedCase.Tipo_Contrato || 'Condiciones Uniformes'); setSelectedCase(prev => ({ ...prev, Proyeccion_Respuesta_IA: proj })); await updateCaseInFirestore(selectedCase.id, { Proyeccion_Respuesta_IA: proj }); }
        catch (e) { displayModalMessage(`Error AI Projection: ${e.message}`); }
        finally { setIsGeneratingResponseProjection(false); }
    }

    async function generateNextActionsHandler() {
        if (!selectedCase) return;
        setIsGeneratingNextActions(true);
        try {
            const actions = await aiServices.getAINextActions(selectedCase);
            setSelectedCase(prev => ({ ...prev, Sugerencias_Accion_IA: actions }));
            await updateCaseInFirestore(selectedCase.id, { Sugerencias_Accion_IA: actions });
        } catch (e) { displayModalMessage(`Error generando próximas acciones: ${e.message}`); }
        finally { setIsGeneratingNextActions(false); }
    }

    async function generateRootCauseHandler() {
        if (!selectedCase) return;
        setIsGeneratingRootCause(true);
        try {
            const cause = await aiServices.getAIRootCause(selectedCase);
            setSelectedCase(prev => ({ ...prev, Causa_Raiz_IA: cause }));
            await updateCaseInFirestore(selectedCase.id, { Causa_Raiz_IA: cause });
        } catch (e) { displayModalMessage(`Error generando causa raíz: ${e.message}`); }
        finally { setIsGeneratingRootCause(false); }
    }

    async function handleSuggestEscalation() {
        if (!selectedCase) return;
        setIsSuggestingEscalation(true);
        displayModalMessage('La IA está sugiriendo una escalación...');
        try {
            const suggestion = await aiServices.getAIEscalationSuggestion(selectedCase);
            if (suggestion.area && suggestion.motivo) {
                const firestoreUpdateData = { areaEscalada: suggestion.area, motivoEscalado: suggestion.motivo };
                setSelectedCase(prev => ({ ...prev, ...firestoreUpdateData }));
                await updateCaseInFirestore(selectedCase.id, firestoreUpdateData);
                displayModalMessage('Sugerencia de escalación aplicada.');
            } else { displayModalMessage('No se pudo obtener una sugerencia válida de la IA.'); }
        } catch (e) { displayModalMessage(`Error con la IA: ${e.message}`); }
        finally { setIsSuggestingEscalation(false); }
    }

    const handleObservationsChange = (e) => setSelectedCase(prev => ({ ...prev, Observaciones: e.target.value }));
    async function saveObservation() {
        if (!selectedCase || !selectedCase.Observaciones?.trim()) { displayModalMessage('Escriba observación.'); return; }
        const newHist = { text: selectedCase.Observaciones.trim(), timestamp: new Date().toISOString() };
        const updatedHist = [...(selectedCase.Observaciones_Historial || []), newHist];
        setSelectedCase(prev => ({ ...prev, Observaciones_Historial: updatedHist, Observaciones: '' }));
        await updateCaseInFirestore(selectedCase.id, { Observaciones_Historial: updatedHist, Observaciones: '' });
        displayModalMessage('Observación guardada.');
    }
    function handleFechaCierreChange(e) { setSelectedCase(prev => ({ ...prev, 'Fecha Cierre': e.target.value })); updateCaseInFirestore(selectedCase.id, { 'Fecha Cierre': e.target.value }); }

    function handleManualFormChange(e) {
        const { name, value, type, checked } = e.target;
        let fVal = type === 'checkbox' ? checked : value;
        if (name === 'Nro_Nuip_Cliente' && (value.startsWith('8') || value.startsWith('9')) && value.length > 9) fVal = value.substring(0, 9);
        else if (name === 'Nombre_Cliente') fVal = value.toUpperCase();
        setManualFormData(prev => {
            const newState = { ...prev, [name]: fVal };
            if (name === 'Requiere_Aseguramiento_Facturas' && !fVal) { newState.ID_Aseguramiento = ''; newState.Corte_Facturacion = ''; newState.Cuenta = ''; newState.Operacion_Aseguramiento = ''; newState.Tipo_Aseguramiento = ''; newState.Mes_Aseguramiento = ''; }
            if (name === 'requiereBaja' && !fVal) newState.numeroOrdenBaja = '';
            if (name === 'requiereAjuste' && !fVal) {
                newState.numeroTT = ''; newState.estadoTT = ''; newState.requiereDevolucionDinero = false;
                newState.cantidadDevolver = ''; newState.idEnvioDevoluciones = ''; newState.fechaEfectivaDevolucion = '';
            }
            if (name === 'requiereDevolucionDinero' && !fVal) { newState.cantidadDevolver = ''; newState.idEnvioDevoluciones = ''; newState.fechaEfectivaDevolucion = ''; }
            if (name === 'areaEscalada') { newState.motivoEscalado = ''; }
            if (name === 'Tipo_Contrato' && value !== 'Contrato Marco') { newState.Numero_Contrato_Marco = ''; }
            return newState;
        });
    }

    function handleManualFormDevolucionChange(e) {
        const { name, value } = e.target;
        setManualFormData(prev => ({ ...prev, [name]: value }));
    }

    async function handleManualSubmit(e) {
        e.preventDefault(); setUploading(true); displayModalMessage('Procesando manual con IA...');
        try {
            if (manualFormData.requiereBaja && !manualFormData.numeroOrdenBaja) { displayModalMessage('Si requiere baja, debe ingresar el Número de Orden de Baja.'); setUploading(false); return; }
            if (manualFormData.requiereAjuste) {
                if (!manualFormData.numeroTT) { displayModalMessage('Si requiere ajuste, debe ingresar el Número de TT.'); setUploading(false); return; }
                if (!manualFormData.estadoTT) { displayModalMessage('Si requiere ajuste, debe seleccionar un Estado para el TT.'); setUploading(false); return; }
                if (manualFormData.requiereDevolucionDinero) {
                    if (!manualFormData.cantidadDevolver || isNaN(parseFloat(manualFormData.cantidadDevolver)) || parseFloat(manualFormData.cantidadDevolver) <= 0) { displayModalMessage('Si requiere devolución de dinero, la "Cantidad a Devolver" debe ser un número válido y mayor a cero.'); setUploading(false); return; }
                    if (!manualFormData.idEnvioDevoluciones) { displayModalMessage('Si requiere devolución de dinero, debe ingresar el "ID Envío Devoluciones".'); setUploading(false); return; }
                    if (!manualFormData.fechaEfectivaDevolucion) { displayModalMessage('Si requiere devolución de dinero, debe ingresar la "Fecha Efectiva Devolución".'); setUploading(false); return; }
                }
            }
            if (manualFormData.Estado_Gestion === 'Escalado') {
                if (!manualFormData.areaEscalada) { displayModalMessage('Si el estado es "Escalado", debe seleccionar un Área Escalada.'); setUploading(false); return; }
                if (!manualFormData.motivoEscalado) { displayModalMessage('Si el estado es "Escalado", debe seleccionar un Motivo de Escalado.'); setUploading(false); return; }
            }
            const today = utils.getColombianDateISO();
            const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
            const currentSN = String(manualFormData.SN || '').trim();
            if (currentSN) {
                const existingDocs = await getDocs(query(collRef, where('SN', '==', currentSN)));
                if (!existingDocs.empty) { displayModalMessage(`Error: El SN "${currentSN}" ya existe. No se agregó el caso manual.`); setUploading(false); return; }
            }
            const aiData = { SN: manualFormData.SN, FechaRadicado: manualFormData.FechaRadicado, Nombre_Cliente: manualFormData.Nombre_Cliente, obs: manualFormData.OBS, type_request: manualFormData.type_request || '' };
            let aiAnalysisCat = { 'Analisis de la IA': 'N/A', 'Categoria del reclamo': 'N/A' }, aiPrio = 'Media', relNum = 'N/A', aiSentiment = { Sentimiento_IA: 'Neutral' };
            try {
                const [analysis, priority, sentiment] = await Promise.all([
                    aiServices.getAIAnalysisAndCategory(aiData), aiServices.getAIPriority(manualFormData.OBS), aiServices.getAISentiment(manualFormData.OBS)
                ]);
                aiAnalysisCat = analysis; aiPrio = priority; aiSentiment = sentiment; relNum = utils.extractRelatedComplaintNumber(manualFormData.OBS);
            } catch (aiErr) { console.error(`AI Error manual SN ${currentSN || 'N/A'}:`, aiErr); }
            let estadoGestionInicial = manualFormData.Estado_Gestion || 'Pendiente';
            if (manualFormData.requiereAjuste && manualFormData.estadoTT === 'Pendiente' && estadoGestionInicial !== 'Escalado') { estadoGestionInicial = 'Pendiente Ajustes'; }
            const newCase = {
                ...manualFormData, user: userId, Estado_Gestion: estadoGestionInicial, ...aiAnalysisCat, ...aiSentiment,
                Prioridad: aiPrio, Numero_Reclamo_Relacionado: relNum, Observaciones_Reclamo_Relacionado: '', Aseguramiento_Historial: [],
                Escalamiento_Historial: [], Resumen_Hechos_IA: 'No generado', Proyeccion_Respuesta_IA: 'No generada',
                Sugerencias_Accion_IA: [], Causa_Raiz_IA: '', Correo_Escalacion_IA: '', Riesgo_SIC: {}, fecha_asignacion: today,
                Observaciones_Historial: [], SNAcumulados_Historial: [], Despacho_Respuesta_Checked: false, Fecha_Inicio_Gestion: '',
                Tiempo_Resolucion_Minutos: 'N/A', Radicado_SIC: '', Fecha_Vencimiento_Decreto: ''
            };
            if (newCase.Estado_Gestion !== 'Escalado') {
                newCase.areaEscalada = ''; newCase.motivoEscalado = ''; newCase.idEscalado = '';
                newCase.reqGenerado = ''; newCase.descripcionEscalamiento = '';
            }
            await addDoc(collRef, newCase);
            displayModalMessage('Caso manual agregado con IA.');
            setShowManualEntryModal(false);
            setManualFormData(initialManualFormData);
        } catch (err) { displayModalMessage(`Error manual: ${err.message}`); }
        finally { setUploading(false); }
    }

    async function handleObservationFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !selectedCase) return;
        setIsTranscribingObservation(true);
        displayModalMessage(`Analizando adjunto (${file.type})... Esto puede tardar un momento.`);
        try {
            let summary = '';
            const fileType = file.type;
            if (fileType.startsWith('text/')) {
                const textContent = await file.text();
                const prompt = `Eres un asistente de reclamos. Resume los puntos clave del siguiente texto adjunto:\n\n"${textContent}"`;
                summary = await aiServices.geminiApiCall(prompt);
            } else if (fileType === 'application/pdf') {
                if (!window.pdfjsLib) throw new Error("La librería para leer PDF no está cargada.");
                const pdfData = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument(pdfData).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                }
                const prompt = `Eres un asistente de reclamos. Resume los puntos clave del siguiente documento PDF que ha sido extraído como texto:\n\n"${fullText}"`;
                summary = await aiServices.geminiApiCall(prompt);
            } else if (fileType.startsWith('image/')) {
                const prompt = 'Analiza la siguiente imagen y transcribe cualquier texto relevante que encuentres.';
                const base64Image = await fileToBase64(file);
                const imagePart = { inline_data: { mime_type: file.type, data: base64Image } };
                const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
                const modelName = "gemini-1.5-flash-latest";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                const payload = { contents: [{ role: "user", parts: [{ text: prompt }, imagePart] }] };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`Error en la API de visión: ${response.status}`);
                const result = await response.json();
                if (result.candidates && result.candidates[0].content.parts[0].text) { summary = result.candidates[0].content.parts[0].text; }
                else { throw new Error('La IA no pudo procesar la imagen.'); }
            } else if (fileType.startsWith('audio/')) {
                const prompt = 'Transcribe el texto que escuches en el siguiente audio.';
                const base64Audio = await fileToBase64(file);
                const audioPart = { inline_data: { mime_type: file.type, data: base64Audio } };
                const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
                const modelName = "gemini-1.5-flash-latest";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                const payload = { contents: [{ role: "user", parts: [{ text: prompt }, audioPart] }] };
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) { const errorBody = await response.text(); throw new Error(`Error en la API de audio: ${response.status} - ${errorBody}`); }
                const result = await response.json();
                if (result.candidates && result.candidates[0].content.parts[0].text) { summary = result.candidates[0].content.parts[0].text; }
                else { throw new Error('La IA no pudo procesar el audio.'); }
            } else { throw new Error(`Tipo de archivo no soportado: ${fileType}`); }
            const currentObs = selectedCase.Observaciones || '';
            const newObs = `${currentObs}\n\n--- Análisis de Adjunto (${file.name}) ---\n${summary}`;
            setSelectedCase(prev => ({ ...prev, Observaciones: newObs }));
            await updateCaseInFirestore(selectedCase.id, { Observaciones: newObs });
            displayModalMessage('✅ Adjunto analizado y añadido a las observaciones.');
        } catch (error) { console.error("Error processing observation file:", error); displayModalMessage(`❌ Error al analizar el adjunto: ${error.message}`); }
        finally { setIsTranscribingObservation(false); if (observationFileInputRef.current) { observationFileInputRef.current.value = ""; } }
    }

    function downloadCSV(csvContent, filename) {
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
    }

    function exportCasesToCSV(isTodayResolvedOnly = false) {
        const today = utils.getColombianDateISO();
        const casesToExport = isTodayResolvedOnly
            ? cases.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && c['Fecha Cierre'] === today)
            : cases;
        if (casesToExport.length === 0) { displayModalMessage(isTodayResolvedOnly ? 'No hay casos resueltos o finalizados hoy.' : 'No hay casos para exportar.'); return; }
        const ORIGINAL_CSV_HEADERS = ['SN', 'CUN', 'Fecha Radicado', 'Dia', 'Fecha Vencimiento', 'Nombre_Cliente', 'Nro_Nuip_Cliente', 'Correo_Electronico_Cliente', 'Direccion_Cliente', 'Ciudad_Cliente', 'Depto_Cliente', 'Nombre_Reclamante', 'Nro_Nuip_Reclamante', 'Correo_Electronico_Reclamante', 'Direccion_Reclamante', 'Ciudad_Reclamante', 'Depto_Reclamante', 'HandleNumber', 'AcceptStaffNo', 'type_request', 'obs', 'nombre_oficina', 'Tipopago', 'date_add', 'Tipo_Operacion'];
        const baseHeaders = ['SN', 'CUN', 'Fecha Radicado', 'Fecha Cierre', 'Dia', 'Dia_Original_CSV', 'fecha_asignacion', 'Nombre_Cliente', 'Estado', 'Estado_Gestion', 'Nivel_1', 'Nivel_2', 'Nivel_3', 'Nivel_4', 'Nivel_5', 'Analisis de la IA', 'Categoria del reclamo', 'Prioridad', 'Sentimiento_IA', 'Resumen_Hechos_IA', 'Proyeccion_Respuesta_IA', 'Sugerencias_Accion_IA', 'Causa_Raiz_IA', 'Tipo_Contrato', 'Numero_Contrato_Marco', 'Observaciones', 'Observaciones_Historial', 'SNAcumulados_Historial', 'Escalamiento_Historial', 'Numero_Reclamo_Relacionado', 'Observaciones_Reclamo_Relacionado', 'Aseguramiento_Historial', 'Despacho_Respuesta_Checked', 'Requiere_Aseguramiento_Facturas', 'ID_Aseguramiento', 'Corte_Facturacion', 'Cuenta', 'Operacion_Aseguramiento', 'Tipo_Aseguramiento', 'Mes_Aseguramiento', 'Fecha_Inicio_Gestion', 'Tiempo_Resolucion_Minutos', 'Radicado_SIC', 'Fecha_Vencimiento_Decreto', 'Tipo_Nuip_Cliente', 'Nro_Nuip_Cliente', 'Correo_Electronico_Cliente', 'Direccion_Cliente', 'Ciudad_Cliente', 'Depto_Cliente', 'Nombre_Reclamante', 'Tipo_Nuip_Reclamante', 'Nro_Nuip_Reclamante', 'Correo_Electronico_Reclamante', 'Direccion_Reclamante', 'Ciudad_Reclamante', 'Depto_Reclamante', 'favorabilidad', 'HandleNumber', 'AcceptStaffNo', 'type_request', 'obs', 'Despacho_Fisico', 'Despacho_Electronico', 'Contacto_Cliente', 'nombre_oficina', 'Tipopago', 'date_add', 'Tipo_Operacion', 'Ultima Modificacion', 'Fecha Cargue Planilla', 'Usuario Cargue Planilla', 'Fecha Pre-cierre Fullstack', 'Fecha Planilla Masivo', 'Novedad Despacho', 'Clasificacion', 'Documento_Adjunto', 'requiereBaja', 'numeroOrdenBaja', 'requiereAjuste', 'numeroTT', 'estadoTT', 'requiereDevolucionDinero', 'cantidadDevolver', 'idEnvioDevoluciones', 'fechaEfectivaDevolucion', 'areaEscalada', 'motivoEscalado', 'idEscalado', 'reqGenerado', 'descripcionEscalamiento', 'Correo_Escalacion_IA', 'Riesgo_SIC', 'Respuesta_Integral_IA'];
        const dynamicHeaders = Array.from(new Set(casesToExport.flatMap(c => Object.keys(c))));
        const actualFinalHeaders = Array.from(new Set(baseHeaders.concat(dynamicHeaders)));
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
        let csvOriginal = ORIGINAL_CSV_HEADERS.map(h => `"${h}"`).join(',') + '\n';
        casesToExport.forEach(c => {
            const originalRow = ORIGINAL_CSV_HEADERS.map(h => {
                let v = (h === 'Dia') ? (c['Dia_Original_CSV'] ?? '') : (c[h] ?? '');
                if (typeof v === 'object') v = JSON.stringify(v);
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(',');
            csvOriginal += originalRow + '\n';
        });
        const filenameSuffix = isTodayResolvedOnly ? `resueltos_hoy_${today}` : `todos_${today}`;
        downloadCSV(csvOriginal, `casos_originales_${filenameSuffix}.csv`);
        setTimeout(() => { downloadCSV(csvActual, `casos_actuales_${filenameSuffix}.csv`); }, 500);
    }

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
    const sicDisp = casesForDisplay.filter(c => (c.Estado_Gestion === 'Decretado' || c.Estado_Gestion === 'Traslado SIC') && c.user === userId).sort(sortSN);
    const pendAjustesDisp = casesForDisplay.filter(c => c.Estado_Gestion === 'Pendiente Ajustes' && c.user === userId).sort(sortSN);
    const pendEscDisp = casesForDisplay.filter(c => ['Pendiente', 'Escalado', 'Iniciado', 'Lectura'].includes(c.Estado_Gestion) && c.user === userId).sort(sortSN);
    const resDisp = casesForDisplay.filter(c => c.Estado_Gestion === 'Resuelto' && c.user === userId).sort(sortSN);
    const finalizadosDisp = casesForDisplay.filter(c => c.Estado_Gestion === 'Finalizado' && c.user === userId).sort(sortSN);
    const aseguramientosDisp = casesForDisplay.filter(c => (c.Estado_Gestion === 'Resuelto' || c.Estado_Gestion === 'Finalizado') && Array.isArray(c.Aseguramiento_Historial) && c.Aseguramiento_Historial.length > 0).sort(sortSN);

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

    function handleSelectCase(caseId, isMassSelect) {
        setSelectedCaseIds(prevSelectedIds => {
            const newSelectedIds = new Set(prevSelectedIds);
            if (isMassSelect) { return caseId; }
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

    async function handleReopenCase(caseItem) {
        if (!db || !userId || caseItem.Estado_Gestion !== 'Resuelto') { displayModalMessage('Solo los casos resueltos pueden ser reabiertos.'); return; }
        const caseId = caseItem.id;
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
        try {
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) { displayModalMessage('Error: El caso que intenta reabrir no existe en la base de datos.'); return; }
            const updateData = { Estado_Gestion: 'Pendiente', 'Fecha Cierre': '', Tiempo_Resolucion_Minutos: 'N/A' };
            await updateDoc(docRef, updateData);
            displayModalMessage('Caso reabierto exitosamente.');
        } catch (error) { displayModalMessage(`Error al reabrir el caso: ${error.message}`); }
    }

    function handleDeleteCase(caseId) {
        async function onConfirm() {
            if (!db || !userId) { displayModalMessage('Error: DB no disponible.'); return; }
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/cases`, caseId);
            try {
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) { displayModalMessage('Error: El caso que intenta eliminar no existe en la base de datos.'); handleCloseCaseDetails(); return; }
                await deleteDoc(docRef);
                displayModalMessage('Caso eliminado exitosamente.');
                handleCloseCaseDetails();
            } catch (error) { displayModalMessage(`Error al eliminar el caso: ${error.message}`); }
        }
        displayConfirmModal('¿Estás seguro de que quieres eliminar este caso de forma permanente? Esta acción no se puede deshacer.', { onConfirm });
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

    function handleDeleteAllCases() {
        if (cases.length === 0) { displayModalMessage('No hay casos para eliminar.'); return; }
        async function onConfirm() {
            if (!db || !userId) { displayModalMessage('Error: La conexión con la base de datos no está disponible.'); return; }
            setIsMassUpdating(true);
            displayModalMessage(`Eliminando todos los ${cases.length} casos...`);
            const batch = writeBatch(db);
            const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
            try {
                const allCasesSnapshot = await getDocs(collRef);
                if (allCasesSnapshot.empty) { displayModalMessage('No se encontraron casos para eliminar en la base de datos.'); setIsMassUpdating(false); setCases([]); return; }
                allCasesSnapshot.forEach(doc => { batch.delete(doc.ref); });
                await batch.commit();
                displayModalMessage(`Se eliminaron todos los ${allCasesSnapshot.size} casos exitosamente.`);
                setSelectedCaseIds(new Set());
            } catch (error) {
                console.error("Error en la eliminación total:", error);
                displayModalMessage(`Error al realizar la limpieza total: ${error.message}`);
            } finally { setIsMassUpdating(false); }
        }
        displayConfirmModal(`¿Está absolutamente seguro de que desea eliminar TODOS los ${cases.length} casos de la base de datos? Esta acción es irreversible.`, { onConfirm, confirmText: 'Sí, Eliminar Todo', cancelText: 'No, Cancelar' });
    }

    function handleSNAcumuladoInputChange(index, field, value) {
        const newData = [...snAcumuladosData];
        newData[index][field] = value;
        setSnAcumuladosData(newData);
    }

    async function handleSaveSNAcumulados() {
        if (!selectedCase || snAcumuladosData.some(item => !item.sn.trim())) { displayModalMessage('Todos los campos de SN acumulados deben estar llenos antes de guardar.'); return; }
        const snToCunMap = new Map(cases.map(c => [String(c.SN || '').trim(), c.CUN]));
        const newHistory = snAcumuladosData.map(item => ({ sn: item.sn.trim(), cun: snToCunMap.get(item.sn.trim()) || 'No encontrado', obs: item.obs, timestamp: new Date().toISOString() }));
        const updatedHistory = [...(selectedCase.SNAcumulados_Historial || []), ...newHistory];
        try {
            await updateCaseInFirestore(selectedCase.id, { SNAcumulados_Historial: updatedHistory });
            setSelectedCase(prev => ({ ...prev, SNAcumulados_Historial: updatedHistory }));
            displayModalMessage('SN Acumulados guardados exitosamente.');
            setCantidadSNAcumulados(0);
            setSnAcumuladosData([]);
            setTieneSNAcumulados(false);
        } catch (error) { displayModalMessage(`Error al guardar SN Acumulados: ${error.message}`); }
    }

    async function handleSaveAseguramientoHistory() {
        if (!selectedCase) return;
        const assuranceData = {
            timestamp: new Date().toISOString(), observaciones: aseguramientoObs, Requiere_Aseguramiento_Facturas: selectedCase.Requiere_Aseguramiento_Facturas || false,
            ID_Aseguramiento: selectedCase.ID_Aseguramiento || '', Corte_Facturacion: selectedCase.Corte_Facturacion || '', Cuenta: selectedCase.Cuenta || '',
            Operacion_Aseguramiento: selectedCase.Operacion_Aseguramiento || '', Tipo_Aseguramiento: selectedCase.Tipo_Aseguramiento || '',
            Mes_Aseguramiento: selectedCase.Mes_Aseguramiento || '', requiereBaja: selectedCase.requiereBaja || false, numeroOrdenBaja: selectedCase.numeroOrdenBaja || '',
            requiereAjuste: selectedCase.requiereAjuste || false, numeroTT: selectedCase.numeroTT || '', estadoTT: selectedCase.estadoTT || '',
            requiereDevolucionDinero: selectedCase.requiereDevolucionDinero || false, cantidadDevolver: selectedCase.cantidadDevolver || '',
            idEnvioDevoluciones: selectedCase.idEnvioDevoluciones || '', fechaEfectivaDevolucion: selectedCase.fechaEfectivaDevolucion || ''
        };
        const newHistory = [...(selectedCase.Aseguramiento_Historial || []), assuranceData];
        try {
            await updateCaseInFirestore(selectedCase.id, { Aseguramiento_Historial: newHistory });
            setSelectedCase(prev => ({ ...prev, Aseguramiento_Historial: newHistory }));
            displayModalMessage('Historial de aseguramiento guardado.');
            setAseguramientoObs('');
        } catch (e) { displayModalMessage(`Error guardando historial: ${e.message}`); }
    }

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
            const prompt = "Transcribe el texto de esta imagen del documento.";
            const payload = {
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64ImageData } }]
                }],
            };
            const apiKey = (typeof __gemini_api_key !== "undefined") ? __gemini_api_key : (import.meta.env.VITE_GEMINI_API_KEY || "");
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${apiKey}`;
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

    async function generateEscalationEmailHandler() {
        if (!selectedCase) return;
        setIsGeneratingEscalationEmail(true);
        try {
            const emailBody = await aiServices.getAIEscalationEmail(selectedCase);
            setSelectedCase(prev => ({ ...prev, Correo_Escalacion_IA: emailBody }));
            await updateCaseInFirestore(selectedCase.id, { Correo_Escalacion_IA: emailBody });
        } catch (e) { displayModalMessage(`Error generando correo de escalación: ${e.message}`); }
        finally { setIsGeneratingEscalationEmail(false); }
    }

    async function generateRiskAnalysisHandler() {
        if (!selectedCase) return;
        setIsGeneratingRiskAnalysis(true);
        try {
            const risk = await aiServices.getAIRiskAnalysis(selectedCase);
            setSelectedCase(prev => ({ ...prev, Riesgo_SIC: risk }));
            await updateCaseInFirestore(selectedCase.id, { Riesgo_SIC: risk });
        } catch (e) { displayModalMessage(`Error generando análisis de riesgo: ${e.message}`); }
        finally { setIsGeneratingRiskAnalysis(false); }
    }

    async function generateAIComprehensiveResponseHandler() {
        if (!selectedCase) return;
        setIsGeneratingComprehensiveResponse(true);
        try {
            const res = await aiServices.getAIComprehensiveResponse(selectedCase, selectedCase.Tipo_Contrato || 'Condiciones Uniformes');
            const validation = await aiServices.getAIValidation({ ...selectedCase, Respuesta_Integral_IA: res });
            setSelectedCase(prev => ({ ...prev, Respuesta_Integral_IA: res, Validacion_IA: validation }));
            await updateCaseInFirestore(selectedCase.id, { Respuesta_Integral_IA: res, Validacion_IA: validation });
            displayModalMessage('Respuesta integral generada y validada exitosamente.');
        } catch (e) { displayModalMessage(`Error AI Comprehensive Response: ${e.message}`); }
        finally { setIsGeneratingComprehensiveResponse(false); }
    }

    async function handleDismissAlarm() {
        if (!selectedAlarmCase || !alarmObservation.trim()) { displayModalMessage('Por favor, escriba una observación para gestionar la alarma.'); return; }
        const todayISO = utils.getColombianDateISO();
        const alarmKey = `alarm_dismissed_${selectedAlarmCase.id}_${todayISO}`;
        const newObservation = { text: `(Gestión Alarma Diaria) ${alarmObservation.trim()}`, timestamp: new Date().toISOString() };
        const existingHistory = selectedAlarmCase.Observaciones_Historial || [];
        const updatedHistory = [...existingHistory, newObservation];
        try {
            await updateCaseInFirestore(selectedAlarmCase.id, { Observaciones_Historial: updatedHistory });
            sessionStorage.setItem(alarmKey, 'true');
            setAlarmCases(prev => prev.filter(c => c.id !== selectedAlarmCase.id));
            setSelectedAlarmCase(null);
            setAlarmObservation('');
            if (alarmCases.length - 1 === 0) { setShowAlarmModal(false); }
            displayModalMessage(`Alarma para SN ${selectedAlarmCase.SN} gestionada.`);
        } catch (error) { displayModalMessage(`Error al guardar la observación: ${error.message}`); }
    }

    const renderTable = (data, title) => {
        return (
            <PaginatedTable
                cases={data}
                title={title}
                mainTableHeaders={constants.MAIN_TABLE_HEADERS}
                statusColors={statusColors}
                priorityColors={priorityColors}
                selectedCaseIds={selectedCaseIds}
                handleSelectCase={handleSelectCase}
                handleOpenCaseDetails={handleOpenCaseDetails}
                calculateCaseAge={(caseItem) => utils.calculateCaseAge(caseItem, nonBusinessDays)}
                onScanClick={handleScanClick}
                nonBusinessDays={nonBusinessDays}
            />
        );
    };

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
            const dia = `Día ${curr.Dia || 'N/A'}`;
            acc[dia] = (acc[dia] || 0) + 1;
            return acc;
        }, {});
        return Object.keys(countsByDay).map(dia => ({ dia, cantidad: countsByDay[dia] })).sort((a, b) => (parseInt(a.dia.split(' ')[1]) || 0) - (parseInt(b.dia.split(' ')[1]) || 0));
    }, [cases]);

    const timePerCaseDay15 = useMemo(() => calculateTimePerCaseForDay15(cases), [cases, calculateTimePerCaseForDay15]);
    
    useEffect(() => {
        if (document.getElementById('pdfjs-script')) return;
        const script = document.createElement('script');
        script.id = 'pdfjs-script';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
        script.onload = () => { if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js'; };
        document.body.appendChild(script);
        return () => {
            const scriptTag = document.getElementById('pdfjs-script');
            if (scriptTag) { document.body.removeChild(scriptTag); }
        };
    }, []);

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
        if (cantidadSNAcumulados > 0) {
            setSnAcumuladosData(Array.from({ length: cantidadSNAcumulados }, () => ({ sn: '', obs: '' })));
        } else {
            setSnAcumuladosData([]);
        }
    }, [cantidadSNAcumulados]);

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
            <input type="file" ref={observationFileInputRef} onChange={handleObservationFileUpload} accept="image/png, image/jpeg, application/pdf, text/csv, audio/*" style={{ display: 'none' }} />

            <div className="w-full max-w-7xl bg-white shadow-lg rounded-lg p-6">
                 {/* Aquí va el resto de tu JSX. Asegúrate de que no haya comentarios // */}
            </div>

            {/* Modales */}
            {showModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[100]"><div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                    <h3 className="text-lg font-semibold mb-4">Mensaje del Sistema</h3>
                    <p className="mb-6 whitespace-pre-line">{modalContent.message}</p>
                    <div className="flex justify-end gap-4">
                        {modalContent.isConfirm && (<button onClick={() => { if (modalContent.onConfirm) modalContent.onConfirm(); setShowModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{modalContent.confirmText}</button>)}
                        <button onClick={() => { if (modalContent.onCancel) modalContent.onCancel(); else setShowModal(false); }} className={`px-4 py-2 rounded-md ${modalContent.isConfirm ? 'bg-gray-300 hover:bg-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{modalContent.cancelText || 'Cerrar'}</button>
                    </div>
                </div></div>
            )}

            {selectedCase && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    {/* Contenido del modal selectedCase */}
                </div>
            )}
            
            {showCancelAlarmModal && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[100] p-4">
                    {/* Contenido del modal showCancelAlarmModal */}
                </div>
            )}

            {showManualEntryModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                    {/* Contenido del modal showManualEntryModal */}
                </div>
            )}
            
            {showAlarmModal && (
                <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-[100] p-4">
                    {/* Contenido del modal showAlarmModal */}
                </div>
            )}

            <style>{`
                .input-form { display: block; width: 100%; border-radius: 0.375rem; border-width: 1px; border-color: #D1D5DB; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); padding: 0.5rem; }
                .input-form:focus { border-color: #3B82F6; --tw-ring-color: #3B82F6; box-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color); }
                .input-form:disabled { background-color: #F3F4F6; cursor: not-allowed; }
                .sm\\:text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                .contents { display: contents; }
            `}</style>
        </div>
    );
}

export default App;

