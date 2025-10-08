import React, { useState, useEffect } from "react";
import { getDocs, collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";
import { FaRobot, FaFilePdf } from "react-icons/fa";
import { motion } from "framer-motion";
import { callGeminiAPI } from "./utils/ai"; // ✅ nueva integración IA

export default function App() {
  const [casos, setCasos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [analisisIA, setAnalisisIA] = useState("");
  const [promptIA, setPromptIA] = useState("");
  const [cargandoIA, setCargandoIA] = useState(false);

  // 🔹 Cargar datos Firestore
  useEffect(() => {
    const q = query(collection(db, "casos"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCasos(data);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 Función para enviar prompt a Gemini
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

  // 🔹 Generar PDF
  const generarPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text("Reporte de Casos PQR", 10, 10);
    casos.forEach((c, i) => docPDF.text(`${i + 1}. ${c.nombre} - ${c.estado}`, 10, 20 + i * 10));
    docPDF.save("reporte_pqr.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4">
      <h1 className="text-3xl font-bold text-blue-700 mb-4">📋 Seguimiento de Casos PQR</h1>

      {/* 🔹 Panel de análisis IA */}
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

      {/* 🔹 Bloque de gestión de casos */}
      <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold mb-3">Casos registrados</h2>
        <input
          type="text"
          placeholder="Buscar..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border p-2 rounded-lg w-full mb-3"
        />
        <button onClick={generarPDF} className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700">
          <FaFilePdf /> Exportar PDF
        </button>

        <ul className="mt-4 divide-y">
          {casos
            .filter((c) => c.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
            .map((c) => (
              <li key={c.id} className="py-2">
                <strong>{c.nombre}</strong> — {c.estado}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
