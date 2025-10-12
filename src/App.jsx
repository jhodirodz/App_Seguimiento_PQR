// App.jsx (archivo consolidado - base: App (7).jsx + UI de App.jsx)
// ===================================================================
// NOTA: Este archivo es la fusión solicitada: mantiene la autenticación
// correcta y la lógica de App (7).jsx y reasigna todo el JSX visual
// proveniente de App.jsx dentro del return principal.
// ===================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import {
  doc, getDoc, updateDoc, setDoc, collection, getDocs, writeBatch, query, where, documentId, addDoc, deleteDoc, onSnapshot
} from "firebase/firestore";

// Importa las utilidades y componentes auxiliares
import * as utils from './utils.js';
import * as aiServices from './aiServices';
import * as constants from './constants';
import PaginatedTable from './components/PaginatedTable';

// Importa las instancias de Firebase ya inicializadas
import {
  db, auth,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword
} from "./firebaseConfig.js";

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

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('todos');
  const [priorityFilter, setPriorityFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
  const [massUpdateTargetStatus, setMassUpdateTargetStatus] = useState('');
  const [isMassUpdating, setIsMassUpdating] = useState(false);
  const [massUpdateObservation, setMassUpdateObservation] = useState('');

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
    id: 1, // Identificador único para cada formulario
    numeroCuenta: '',
    valorMensual: '',
    fechaInicioCiclo: '',
    fechaFinCiclo: '',
    fechaBaja: '',
    montoNotaCredito: null,
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

  // --------------------------
  // Funciones utilitarias y handlers (se mantienen las originales)
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

  // Ejemplo de función que calcula tiempo por caso (usa utils y nonBusinessDays)
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
    // lógica para duplicados
    const duplicatesMap = new Map();
    const normalizedCaseNuips = new Set([utils.normalizeNuip(caseItem.Nro_Nuip_Cliente), utils.normalizeNuip(caseItem.Nro_Nuip_Reclamante)].filter(nuip => nuip && nuip !== '0' && nuip !== 'N/A'));
    cases.forEach(otherCase => {
      if (otherCase.id === caseItem.id) return;
      const normalizedOtherNuips = new Set([utils.normalizeNuip(otherCase.Nro_Nuip_Cliente), utils.normalizeNuip(otherCase.Nro_Nuip_Reclamante)].filter(Boolean));
      const hasCommonNuip = [...normalizedCaseNuips].some(nuip => normalizedOtherNuips.has(nuip));
      if (hasCommonNuip) { duplicatesMap.set(otherCase.id, { ...otherCase, type: 'Documento Asignado' }); }
    });
    // cruce con reporteCruceData si existe
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

  // ---------- efectos ----------
  useEffect(() => {
    // observar auth state
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUserId(fbUser.uid);
        (async () => {
          try {
            const userDocRef = doc(db, `artifacts/${appId}/users`, fbUser.uid);
            const snap = await getDoc(userDocRef);
            if (snap && snap.exists()) {
              setUserRole(snap.data().role || 'user');
            } else {
              // crear doc usuario si no existe
              await setDoc(userDocRef, { email: fbUser.email || null, displayName: fbUser.displayName || null, role: 'user', createdAt: new Date().toISOString() });
              setUserRole('user');
            }
          } catch (err) {
            console.error("Error getting user doc on auth state change:", err);
          }
        })();
      } else {
        setUserId(null);
        setUserRole(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // actualizar reloj cada minuto
    const id = setInterval(() => setCurrentDateTime(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // cuando cambien casos, verificar alarmas de cancelación
    if (cases && cases.length > 0) checkCancellationAlarms();
  }, [cases, checkCancellationAlarms]);

  // --------------------------
  // RENDER / JSX
  // --------------------------

  return (
    <div className="w-full min-h-screen bg-gray-100 p-6">
      <div className="w-full max-w-7xl bg-white shadow-lg rounded-lg p-6 mx-auto">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
              APP
            </div>
            <div>
              <h1 className="text-2xl font-semibold">App Seguimiento PQR</h1>
              <p className="text-sm text-gray-500">Gestión de reclamos y seguimiento - {currentDateTime.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!userId ? (
              <>
                <button
                  onClick={signInWithGoogleHandler}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:opacity-90"
                  disabled={authLoading}
                >
                  {authLoading ? 'Iniciando...' : 'Iniciar con Google'}
                </button>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Login / Registro
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-700 mr-2">Usuario: {userRole || 'user'}</span>
                <button onClick={forceRefreshCases} className="px-4 py-2 bg-blue-600 text-white rounded hover:opacity-90" disabled={refreshing}>
                  {refreshing ? 'Actualizando...' : 'Actualizar casos'}
                </button>
                <button onClick={logout} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        </header>

        {/* CONTROLES PRINCIPALES */}
        <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-2 flex gap-3">
            <input
              type="text"
              placeholder="Buscar por SN, cliente, obs..."
              className="flex-1 p-2 border rounded"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border rounded">
              <option value="todos">Estado: Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Resuelto">Resuelto</option>
              <option value="Finalizado">Finalizado</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="p-2 border rounded">
              <option value="todos">Prioridad: Todas</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </div>

          <div className="col-span-1 flex items-center justify-end gap-3">
            <label className="cursor-pointer">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <span className="px-4 py-2 bg-green-600 text-white rounded cursor-pointer">Cargar CSV</span>
            </label>

            <label className="cursor-pointer">
              <input type="file" ref={contractMarcoFileInputRef} onChange={handleContractMarcoUpload} className="hidden" />
              <span className="px-4 py-2 bg-amber-600 text-white rounded cursor-pointer">Cargar CSV - Contrato Marco</span>
            </label>

            <label className="cursor-pointer">
              <input type="file" ref={reporteCruceFileInputRef} onChange={handleReporteCruceUpload} className="hidden" />
              <span className="px-4 py-2 bg-indigo-600 text-white rounded cursor-pointer">Cargar Reporte Cruce</span>
            </label>
          </div>
        </section>

        {/* ESTADÍSTICAS + GRÁFICO */}
        <section className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-4 border rounded">
            <h3 className="text-sm font-semibold text-gray-600">Casos totales</h3>
            <p className="text-2xl font-bold">{cases.length}</p>
          </div>
          <div className="p-4 border rounded">
            <h3 className="text-sm font-semibold text-gray-600">Día 15 - Tiempo por caso</h3>
            <p className="text-lg">{calculateTimePerCaseForDay15(cases)}</p>
          </div>
          <div className="p-4 border rounded">
            <h3 className="text-sm font-semibold text-gray-600">Carga / Última acción</h3>
            <p className="text-sm text-gray-500">Subida: {uploading ? 'En progreso' : 'Inactiva'}</p>
          </div>
        </section>

        {/* GRÁFICO (recharts) */}
        <section className="mb-6">
          <div className="p-4 border rounded">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Distribución por Estado</h3>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={aggregateStateCounts(cases)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="estado" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* TABLA PAGINADA */}
        <section className="mb-6">
          <div className="p-4 border rounded">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Casos</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowManualEntryModal(true)} className="px-3 py-1 bg-gray-200 rounded">Nuevo manual</button>
                <button onClick={() => {
                  // seleccionar todos / deseleccionar
                  if (selectedCaseIds.size === cases.length) setSelectedCaseIds(new Set());
                  else setSelectedCaseIds(new Set(cases.map(c => c.id)));
                }} className="px-3 py-1 bg-gray-200 rounded">Seleccionar todos</button>
                <button onClick={() => { /* acción masiva */ }} className="px-3 py-1 bg-amber-500 text-white rounded">Actualizar masivo</button>
              </div>
            </div>

            {/* PaginatedTable es tu componente reutilizable */}
            <PaginatedTable
              rows={filterAndSearchCases(cases, { searchTerm, statusFilter, priorityFilter })}
              onRowClick={handleOpenCaseDetails}
              selectedIds={selectedCaseIds}
              setSelectedIds={setSelectedCaseIds}
            />
          </div>
        </section>

        {/* DETALLE DE CASO (drawer/modal simple) */}
        {selectedCase && (
          <div className="fixed right-6 top-20 w-96 bg-white border rounded shadow p-4 z-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Detalle: {selectedCase.SN}</h3>
              <button className="text-sm text-gray-500" onClick={handleCloseCaseDetails}>Cerrar</button>
            </div>
            <div className="text-sm mb-2"><strong>Cliente:</strong> {selectedCase.Nombre_Cliente}</div>
            <div className="text-sm mb-2"><strong>Estado:</strong> <span className={`${statusColors[selectedCase.Estado_Gestion] || ''} px-2 py-1 rounded`}>{selectedCase.Estado_Gestion}</span></div>
            <div className="text-sm mb-2"><strong>Observación:</strong> {selectedCase.OBS}</div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => {
                // ejemplo: abrir modal para editar campo
                displayConfirmModal('¿Marcar como Resuelto?', {
                  onConfirm: async () => {
                    await updateCaseInFirestore(selectedCase.id, { Estado_Gestion: 'Resuelto' });
                    setSelectedCase(prev => ({ ...prev, Estado_Gestion: 'Resuelto' }));
                    setShowModal(false);
                  }
                });
              }} className="px-3 py-1 bg-green-600 text-white rounded">Marcar Resuelto</button>

              <button onClick={() => {
                displayModalMessage('Funcionalidad de generar email de escalación (demo).');
              }} className="px-3 py-1 bg-red-600 text-white rounded">Escalar</button>
            </div>
          </div>
        )}

        {/* MODAL GENERAL (mensaje / confirmaciones) */}
        {showModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg p-6 w-full max-w-xl">
              <div className="mb-4 text-lg">{modalContent.message}</div>
              <div className="flex justify-end gap-3">
                {modalContent.isConfirm ? (
                  <>
                    <button onClick={modalContent.onCancel || (() => setShowModal(false))} className="px-4 py-2 bg-gray-200 rounded">{modalContent.cancelText || 'Cancelar'}</button>
                    <button onClick={() => { modalContent.onConfirm && modalContent.onConfirm(); setShowModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded">{modalContent.confirmText || 'Confirmar'}</button>
                  </>
                ) : (
                  <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded">Aceptar</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE INGRESO MANUAL SIMPLE */}
        {showManualEntryModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Agregar caso manual</h3>
                <button onClick={() => setShowManualEntryModal(false)} className="text-gray-500">Cerrar</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input type="text" placeholder="SN" className="p-2 border rounded" value={manualFormData.SN} onChange={(e) => setManualFormData(prev => ({ ...prev, SN: e.target.value }))} />
                <input type="text" placeholder="CUN" className="p-2 border rounded" value={manualFormData.CUN} onChange={(e) => setManualFormData(prev => ({ ...prev, CUN: e.target.value }))} />
                <input type="text" placeholder="Nombre Cliente" className="p-2 border rounded" value={manualFormData.Nombre_Cliente} onChange={(e) => setManualFormData(prev => ({ ...prev, Nombre_Cliente: e.target.value }))} />
                <input type="date" placeholder="Fecha Radicado" className="p-2 border rounded" value={manualFormData.FechaRadicado} onChange={(e) => setManualFormData(prev => ({ ...prev, FechaRadicado: e.target.value }))} />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowManualEntryModal(false)} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                <button onClick={async () => {
                  // Guardar manualmente
                  if (!manualFormData.SN) { displayModalMessage('SN es requerido'); return; }
                  if (!db || !userId) { displayModalMessage('DB o usuario no disponible'); return; }
                  const collRef = collection(db, `artifacts/${appId}/users/${userId}/cases`);
                  await addDoc(collRef, { ...manualFormData, user: userId, fecha_asignacion: utils.getColombianDateISO() });
                  displayModalMessage('Caso agregado manualmente.');
                  setShowManualEntryModal(false);
                }} className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modales extra, alarmas, cancel alarms — se preservaron variables e invocaciones */}
        {showCancelAlarmModal && cancelAlarmCases.length > 0 && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h3 className="text-lg font-semibold mb-3">Alarmas de cancelación</h3>
              <div className="max-h-56 overflow-auto mb-3">
                {cancelAlarmCases.map(c => (
                  <div key={c.id} className="p-2 border-b">
                    <div className="text-sm font-semibold">SN: {c.SN}</div>
                    <div className="text-xs text-gray-600">{c.Nombre_Cliente}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCancelAlarmModal(false)} className="px-4 py-2 bg-gray-200 rounded">Cerrar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  // --------------------------
  // funciones internas auxiliares usadas por el JSX
  // --------------------------
  function aggregateStateCounts(caseList) {
    // Devuelve array [{ estado, count }]
    const map = new Map();
    (caseList || []).forEach(c => {
      const estado = c.Estado_Gestion || 'Pendiente';
      map.set(estado, (map.get(estado) || 0) + 1);
    });
    return Array.from(map.entries()).map(([estado, count]) => ({ estado, count }));
  }

  function filterAndSearchCases(casesList, { searchTerm, statusFilter, priorityFilter }) {
    let rows = [...(casesList || [])];
    if (statusFilter && statusFilter !== 'todos') rows = rows.filter(r => String(r.Estado_Gestion) === statusFilter);
    if (priorityFilter && priorityFilter !== 'todos') rows = rows.filter(r => String(r.Prioridad) === priorityFilter);
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      rows = rows.filter(r => (
        String(r.SN || '').toLowerCase().includes(q) ||
        String(r.Nombre_Cliente || '').toLowerCase().includes(q) ||
        String(r.OBS || '').toLowerCase().includes(q)
      ));
    }
    return rows;
  }
}

export default App;
