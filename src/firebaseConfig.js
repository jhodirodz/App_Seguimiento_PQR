import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB6EI7jjcnbZeoPRdZ2giWznHKrQJeJKZY",
  authDomain: "miseguimientocasosapp.firebaseapp.com",
  projectId: "miseguimientocasosapp",
  storageBucket: "miseguimientocasosapp.appspot.com",
  messagingSenderId: "53181891397",
  appId: "1:53181891397:web:fe7a07fbcfbc840cc9742c",
  measurementId: "G-RVLXXJ455K"
};

// 🔥 Inicializa Firebase
const app = initializeApp(firebaseConfig);

// ✅ Instancias principales exportadas
export const db = getFirestore(app);
export const auth = getAuth(app);
export { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut };
