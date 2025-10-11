import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔹 Configuración CORREGIDA de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB6EI7jjcnbZeoPRdZ2giWznHKrQJeJKZY",
  authDomain: "miseguimientocasosapp.firebaseapp.com",
  projectId: "miseguimientocasosapp",
  storageBucket: "miseguimientocasosapp.appspot.com", // ✅ corregido aquí
  messagingSenderId: "53181891397",
  appId: "1:53181891397:web:fe7a07fbcfbc840cc9742c",
  measurementId: "G-RVLXXJ455K"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { db, auth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut };
