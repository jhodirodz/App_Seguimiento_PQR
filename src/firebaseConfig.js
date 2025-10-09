import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { db, auth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut };
