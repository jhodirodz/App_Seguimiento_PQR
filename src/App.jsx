import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- Firebase Imports (desde tu archivo de configuración) ---
import {
  db,
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from './firebaseConfig';
import {
  collection, addDoc, query, onSnapshot, getDocs, deleteDoc,
  doc, updateDoc, where, writeBatch, documentId, getDoc, setDoc
} from 'firebase/firestore';

// --- Library Imports ---
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from 'jspdf';
import { FaGoogle, FaSignOutAlt, FaFilePdf, FaRobot } from "react-icons/fa";

// =================================================================================================
// Constantes y Funciones de Ayuda (Definiciones que la app necesita para funcionar)
// =================================================================================================

const MAIN_TABLE_HEADERS = [
    'SN', 'CUN', 'Fecha Radicado', 'Dia', 'Fecha Vencimiento', 'Nombre_Cliente',
    'Nro_Nuip_Cliente', 'Tipo_Contrato', 'Categoria del reclamo', 'Prioridad', 'Estado_Gestion'
];

const MODAL_DISPLAY_HEADERS = [
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
    'Respuesta_Integral_IA'
];

const ALL_STATUS_OPTIONS = ['Pendiente','Iniciado','Lectura','Resuelto', 'Finalizado', 'Escalado','Decretado','Traslado SIC', 'Pendiente Ajustes'];
const ALL_PRIORITY_OPTIONS = ['Alta', 'Media', 'Baja'];

const COLOMBIAN_HOLIDAYS = [
    '2025-01-01', '2025-01-06', '2025-03-24', '2025-03-20', '2025-03-21', '2025-05-01', '2025-05-26',
    '2025-06-16', '2025-06-23', '2025-07-04', '2025-07-20', '2025-08-07', '2025-08-18', '2025-10-13',
    '2025-11-03', '2025-11-17', '2025-12-08', '2025-12-25','2026-01-01', '2026-01-12',   '2026-03-23',   '2026-04-02',  '2026-04-03', '2026-05-01', '2026-05-18',   '2026-06-08',   '2026-06-15',   '2026-06-29',   '2026-07-20',   '2026-08-07',  '2026-08-17',  '2026-10-12',   '2026-11-02',  '2026-11-16',   '2026-12-08',   '2026-12-25',
];

const getColombianDateISO = () => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
};

const calculateBusinessDays = (startDateStr, endDateStr, nonBusinessDays) => {
    try {
        if (!startDateStr || !endDateStr) return "N/A";
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
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonBusinessDaysSet.has(dateStr)) {
                break;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        let count = 0;
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            const dateStr = currentDate.toISOString().slice(0, 10);
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonBusinessDaysSet.has(dateStr)) {
                count++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return count;
    } catch (e) {
        console.error("Error en calculateBusinessDays:", e);
        return "N/A";
    }
};

const calculateCaseAge = (caseItem, nonBusinessDays) => {
    if (caseItem.Estado_Gestion === 'Resuelto' || caseItem.Estado_Gestion === 'Finalizado') {
        return caseItem.Dia;
    }

    if (!caseItem || !caseItem['Fecha Radicado']) return 'N/A';
    const startDate = caseItem['Fecha Radicado'];
    const today = getColombianDateISO();
    
    let age = calculateBusinessDays(startDate, today, new Set(COLOMBIAN_HOLIDAYS));

    if (String(caseItem['nombre_oficina'] || '').toUpperCase().includes("OESIA")) {
        if (age !== 'N/A' && !isNaN(age)) {
            age += 2;
        }
    }
    return age;
};

// =================================================================================================
// Componente Principal de la Aplicación
// =================================================================================================
export default function App() {
  // --- Estados de Autenticación y Carga ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // --- Estados de la Aplicación ---
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState('todos');
  const [priorityFilter, setPriorityFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedCase, setSelectedCase] = useState(null);
  const [activeModule, setActiveModule] = useState('casos');
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ message: '', isConfirm: false });
  const [activeFilter, setActiveFilter] = useState('all');
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  
  // --- Efectos (Código que se ejecuta en momentos clave) ---

  // 1. Este se ejecuta una vez para saber si hay un usuario conectado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Este se ejecuta cuando el usuario cambia (inicia o cierra sesión)
  useEffect(() => {
    if (!user) {
      setCases([]); 
      return;
    }

    setLoading(true);
    // Busca los casos solo para el usuario actual
    const q = query(collection(db, "users", user.uid, "cases"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCases(data);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener los casos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Este actualiza el reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // --- Funciones (Acciones que ocurren cuando haces clic en botones, etc.) ---

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
      alert("Error al iniciar sesión. Revisa la consola.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Error al cerrar sesión.");
    }
  };

  const displayModalMessage = useCallback((message) => {
    setModalContent({ message, isConfirm: false });
    setShowModal(true);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;
    setUploading(true);
    // Tu lógica de handleFileUpload
    // Asegúrate de usar `user.uid` en las rutas de firestore.
    // Por ejemplo: const collRef = collection(db, "users", user.uid, "cases");
    setTimeout(() => {
        setUploading(false);
        displayModalMessage("Lógica de carga de archivo no implementada en este ejemplo.");
    }, 1000);
  };

  const generarPDF = () => {
      if (!user) return;
      const docPDF = new jsPDF();
      docPDF.text(`Reporte de Casos PQR - ${user.displayName}`, 10, 10);
      cases.forEach((c, i) =>
        docPDF.text(`${i + 1}. ${c.nombre} - ${c.estado}`, 10, 20 + i * 10)
      );
      docPDF.save("reporte_pqr.pdf");
  };

  // --- Renderizado (Lo que se ve en la pantalla) ---

  if (loadingAuth) {
    return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      {!user ? (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center p-10 bg-white rounded-2xl shadow-md max-w-md">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Seguimiento de Casos Asignados</h1>
            <p className="mb-8 text-gray-600">Por favor, inicia sesión para gestionar tus casos.</p>
            <button
              onClick={handleSignIn}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-3 mx-auto text-lg shadow-lg"
            >
              <FaGoogle /> Iniciar Sesión con Google
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-7xl mx-auto bg-white shadow-lg rounded-lg p-6">
          <header className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">Seguimiento de Casos Asignados</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm">Hola, {user.displayName}</span>
              <button onClick={handleSignOut} className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2">
                <FaSignOutAlt /> Salir
              </button>
            </div>
          </header>

          <main>
            <div className="flex justify-center gap-4 mb-6">
                <button onClick={() => setActiveModule('casos')} className={`px-6 py-2 rounded-lg font-semibold ${activeModule === 'casos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                    Casos
                </button>
                <button onClick={() => setActiveModule('aseguramientos')} className={`px-6 py-2 rounded-lg font-semibold ${activeModule === 'aseguramientos' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                    Aseguramientos
                </button>
            </div>

            <p className="text-sm text-center mb-4">User ID: <span className="font-mono bg-gray-200 px-1 rounded">{user.uid}</span></p>
            <p className="text-lg text-center mb-4">Fecha y Hora: {currentDateTime.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            <input type="text" placeholder="Buscar por SN, CUN, Nuip... (separar con comas para búsqueda masiva)" value={searchTerm} onChange={e=>{setSearchTerm(e.target.value); setActiveFilter('all');}} className="p-3 mb-4 border rounded-lg w-full shadow-sm"/>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label htmlFor="contractFilter" className="block text-sm font-medium text-gray-700">Filtrar por Contrato</label>
                <select id="contractFilter" value={contractFilter} onChange={e => setContractFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm">
                    <option value="todos">Todos</option>
                    <option value="Condiciones Uniformes">Condiciones Uniformes</option>
                    <option value="Contrato Marco">Contrato Marco</option>
                </select>
              </div>
              <div>
                <label htmlFor="priorityFilter" className="block text-sm font-medium text-gray-700">Filtrar por Prioridad</label>
                <select id="priorityFilter" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm">
                    <option value="todos">Todas</option>
                    {ALL_PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                  <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700">Filtrar por Estado</label>
                  <select id="statusFilter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm">
                      <option value="todos">Todos</option>
                      {ALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
              <div className="p-4 border rounded-lg bg-blue-50 w-full md:w-auto flex-shrink-0">
                  <h2 className="font-bold text-lg mb-2 text-blue-800">Cargar CSV de Casos</h2>
                  <input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" disabled={uploading}/>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                  <button className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">Ingresar Manual</button>
                  <button className="px-5 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600">Cargar CSV Contrato Marco</button>
                  <button className="px-5 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600">Cargar Reporte Cruce</button>
                  <button className="px-5 py-2 bg-teal-500 text-white font-semibold rounded-lg shadow-md hover:bg-teal-600">Refrescar Casos</button>
                  <button onClick={generarPDF} className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700">Exportar Todos</button>
                  <button className="px-5 py-2 bg-red-700 text-white font-semibold rounded-lg shadow-md hover:bg-red-800">Limpieza Total</button>
              </div>
            </div>
            {/* Aquí irían tus tablas y modales */}

          </main>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="mb-6 whitespace-pre-line">{modalContent.message}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className='bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md'
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

