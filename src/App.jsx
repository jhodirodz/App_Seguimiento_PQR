import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { db, auth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "./firebaseConfig.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
import * as constants from "./constants.js";
import * as utils from "./utils.js";

const appId = "App_Seguimiento_PQR"; // 🔹 Identificador del proyecto

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState([]);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  // ✅ Manejo de autenticación Google
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error en inicio de sesión con Google:", error);
      setError("No se pudo iniciar sesión. Intenta nuevamente.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
  };

  // ✅ Detectar cambios de sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ✅ Subida y procesamiento de archivo Excel/CSV
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    utils.parseCSV(file, setFileData, setError);
  };

  // ✅ Guardar datos en Firestore
  const handleSaveData = async () => {
    if (!user) return setError("Debes iniciar sesión para guardar datos.");
    try {
      const collectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/cases`);
      for (const row of fileData) {
        await addDoc(collectionRef, row);
      }
      alert("Datos guardados correctamente en Firestore ✅");
    } catch (err) {
      console.error("Error al guardar en Firestore:", err);
      setError("Error al guardar los datos en Firestore.");
    }
  };

  // ✅ Eliminar todos los datos del usuario
  const handleDeleteAll = async () => {
    if (!user) return;
    try {
      const collectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/cases`);
      const snapshot = await getDocs(collectionRef);
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
      alert("Datos eliminados correctamente ❌");
    } catch (err) {
      console.error("Error al eliminar datos:", err);
    }
  };

  // ==============================
  // 🧾 Interfaz principal
  // ==============================
  if (loading) return <div>Cargando...</div>;

  return (
    <div className="app-container">
      {!user ? (
        <div className="login-container">
          <h2>Bienvenido al Sistema de Seguimiento PQR</h2>
          <button onClick={handleGoogleSignIn}>Iniciar sesión con Google</button>
          {error && <p className="error-text">{error}</p>}
        </div>
      ) : (
        <div className="dashboard">
          <header className="header">
            <h2>Hola, {user.displayName}</h2>
            <button onClick={handleSignOut}>Cerrar sesión</button>
          </header>

          <section className="upload-section">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button onClick={handleSaveData}>Guardar en Firestore</button>
            <button onClick={handleDeleteAll}>Eliminar todo</button>
          </section>

          {fileData.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(fileData[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileData.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, idx) => (
                      <td key={idx}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && <p className="error-text">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default App;
