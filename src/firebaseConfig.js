import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
