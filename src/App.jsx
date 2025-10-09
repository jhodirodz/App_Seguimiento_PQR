import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  addDoc, // Necesitaremos esto para añadir nuevos casos
  where, // Si necesitas filtrar por usuario en el futuro
} from "firebase/firestore";
// MODIFICADO: Importa todo lo necesario desde tu firebaseConfig
import {
  db,
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "./firebaseConfig";
import { jsPDF } from "jspdf";
import { FaRobot, FaFilePdf, FaGoogle, FaSignOutAlt } from "react-icons/fa";
import { motion } from "framer-motion";
import { callGeminiAPI } from "./utils/ai";

export default function App() {
  // --- ESTADOS ---
  // MODIFICADO: Añadimos estados para el usuario y la carga de la autenticación
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Para saber si Firebase ya verificó si hay un usuario

  const [casos, setCasos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [analisisIA, setAnalisisIA] = useState("");
  const [promptIA, setPromptIA] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);

  // --- EFECTOS ---
  // AÑADIDO: useEffect para escuchar el estado de la autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // Guarda el usuario actual (o null si no hay sesión)
      setLoadingAuth(false); // Indica que la verificación inicial ha terminado
    });
    // Limpia el listener al desmontar el componente
    return () => unsubscribe();
  }, []);

  // MODIFICADO: useEffect para cargar datos SÓLO SI hay un usuario
  useEffect(() => {
    // Si no hay usuario, no hagas nada y limpia la lista de casos.
    if (!user) {
      setCasos([]);
      return;
    }

    // Crea una referencia a la subcolección de 'casos' específica de este usuario
    const userCasosCollection = collection(db, "users", user.uid, "casos");
    const q = query(userCasosCollection);

    // onSnapshot escucha los cambios en tiempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCasos(data);
    });

    // Limpia el listener cuando el usuario cambie o el componente se desmonte
    return () => unsubscribe();
  }, [user]); // 👈 Este efecto se re-ejecuta si el 'user' cambia

  // --- FUNCIONES DE AUTENTICACIÓN ---
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error al iniciar sesión con Google:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // --- OTRAS FUNCIONES ---
  const analizarConIA = async () => {
    if (!promptIA.trim()) {
      setAnalisisIA("⚠️ Escribe un texto para analizar con la IA.");
      return;
    }
    setCargandoIA(true);
    const respuesta = await callGeminiAPI(promptIA);
    setAnalisisIA(respuesta);
    setCargandoIA(false);
  };

  const generarPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text(`Reporte de Casos PQR - ${user.displayName}`, 10, 10);
    casos.forEach((c, i) =>
      docPDF.text(`${i + 1}. ${c.nombre} - ${c.estado}`, 10, 20 + i * 10)
    );
    docPDF.save("reporte_pqr.pdf");
  };

  // --- RENDERIZADO ---
  // Muestra un mensaje de carga mientras Firebase verifica la sesión
  if (loadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <h1 className="text-xl font-bold">Cargando aplicación...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">📋 Seguimiento de Casos PQR</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm">Hola, {user.displayName}</span>
            <button onClick={handleSignOut} className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2">
              <FaSignOutAlt /> Salir
            </button>
          </div>
        )}
      </header>

      {/* MODIFICADO: Muestra la app si hay usuario, o el botón de login si no lo hay */}
      {!user ? (
        <div className="text-center p-10 bg-white rounded-2xl shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Bienvenido</h2>
          <p className="mb-6">Por favor, inicia sesión con tu cuenta de Google para continuar.</p>
          <button onClick={handleSignIn} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-3 mx-auto text-lg">
            <FaGoogle /> Iniciar Sesión con Google
          </button>
        </div>
      ) : (
        <main>
          {/* Panel de análisis IA (tu código original) */}
          <motion.div
            className="bg-white shadow-md rounded-2xl p-4 mb-6 border border-blue-200"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <FaRobot className="text-blue-600" /> Analizar con IA (Gemini)
            </h2>
            <textarea
              value={promptIA}
              onChange={(e) => setPromptIA(e.target.value)}
              className="w-full p-3 border rounded-lg focus:ring focus:ring-blue-300"
              rows="3"
              placeholder="Escribe una observación, reclamo o texto para analizar..."
            ></textarea>
            <button
              onClick={analizarConIA}
              disabled={cargandoIA}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <FaRobot /> {cargandoIA ? "Analizando..." : "Analizar con IA"}
            </button>
            {analisisIA && (
              <div className="mt-4 p-3 border rounded-lg bg-blue-50 whitespace-pre-wrap">
                <strong>Resultado:</strong>
                <p>{analisisIA}</p>
              </div>
            )}
          </motion.div>

          {/* Bloque de gestión de casos (tu código original) */}
          <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-3">Mis Casos Registrados</h2>
            <input
              type="text"
              placeholder="Buscar en mis casos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="border p-2 rounded-lg w-full mb-3"
            />
            <button onClick={generarPDF} className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
              <FaFilePdf /> Exportar PDF
            </button>
            <ul className="mt-4 divide-y">
              {casos
                .filter((c) =>
                  c.nombre?.toLowerCase().includes(busqueda.toLowerCase())
                )
                .map((c) => (
                  <li key={c.id} className="py-2">
                    <strong>{c.nombre}</strong> — {c.estado}
                  </li>
                ))}
            </ul>
          </div>
        </main>
      )}
    </div>
  );
}
