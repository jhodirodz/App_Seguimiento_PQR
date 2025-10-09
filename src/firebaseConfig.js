// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// MODIFICADO: Importa las funciones adicionales de autenticación
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "firebase/auth";

// 🔹 Configuración de Firebase (la tuya es correcta)
const firebaseConfig = {
  apiKey: "AIzaSyAt0641WOEfdzlUbPFmQUj1AL6C4O-06KM",
  authDomain: "miseguimientocasosapp.firebaseapp.com",
  projectId: "miseguimientocasosapp",
  storageBucket: "miseguimientocasosapp.firebasestorage.app",
  messagingSenderId: "53181891397",
  appId: "1:53181891397:web:b1ae28198993ba3ac9742c",
  measurementId: "G-BZ91D4STKK"
};

// 🔹 Inicializa Firebase
const app = initializeApp(firebaseConfig);

// 🔹 Exporta los servicios principales
export const db = getFirestore(app);
export const auth = getAuth(app);

// AÑADIDO: Exporta las funciones y proveedores para un uso más fácil
export {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
};
