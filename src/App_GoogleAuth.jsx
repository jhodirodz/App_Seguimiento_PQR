/**
 * App_GoogleAuth.jsx
 * Autenticación con Google integrada (Firebase)
 * Generado automáticamente por ChatGPT - Octubre 2025
 *
 * Nota:
 * - Este archivo actúa como un envoltorio (wrapper) para tu App original (`App.jsx`).
 * - No modifica `App.jsx` en absoluto. Simplemente inicializa Firebase Auth con Google
 *   y bloquea la aplicación hasta que el usuario inicie sesión.
 * - Para usarlo, reemplaza la entrada principal (entry) de tu proyecto por este archivo
 *   o importa/renómbralo según tus necesidades.
 *
 * Requisitos:
 * - Debes tener el archivo original `App.jsx` en el mismo directorio.
 * - Debes proveer `__firebase_config` global o `import.meta.env` con la configuración.
 */

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

// Intent: reusar tu App.jsx original sin tocarlo.
// Importa el App original (asegúrate de que App.jsx esté en el mismo directorio).
import OriginalApp from './App.jsx';

// Global variables provided by the Canvas/environment. These should not be changed.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : (typeof window !== 'undefined' && window.__firebase_config ? window.__firebase_config : (import.meta.env ? import.meta.env.VITE_FIREBASE_CONFIG || {} : {}));

// Initialize Firebase app instance
const firebaseApp = initializeApp(firebaseConfig || {});
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

/**
 * App_GoogleAuth
 * --------------
 * Wrapper que bloquea la app original hasta que el usuario inicie sesión con Google.
 */
export default function App_GoogleAuth() {
  const [user, setUser] = useState(null);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authError, setAuthError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const init = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {
        console.warn('setPersistence error:', e);
      }

      const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (!mountedRef.current) return;
        if (u) {
          setUser(u);
        } else {
          setUser(null);
        }
        setAuthInitializing(false);
      }, (err) => {
        console.error('onAuthStateChanged error:', err);
        setAuthError(err);
        setAuthInitializing(false);
      });

      return unsubscribe;
    };

    init();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, googleProvider);
      return result;
    } catch (err) {
      console.error('Google sign-in error:', err);
      setAuthError(err);
      throw err;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setAuthError(err);
    }
  };

  // Mostrar pantalla de carga mientras se inicializa auth
  if (authInitializing) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Roboto, Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>Inicializando autenticación...</div>
          <div style={{ color: '#666' }}>Por favor espera</div>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, mostramos pantalla de login (bloqueada)
  if (!user) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #f6f9fc 0%, #ffffff 100%)',
        fontFamily: 'Inter, Roboto, Arial, sans-serif'
      }}>
        <div style={{
          width: 420,
          padding: 28,
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
          background: '#fff',
          textAlign: 'center'
        }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Iniciar sesión</h1>
          <p style={{ color: '#666', marginTop: 8 }}>Necesitas iniciar sesión con Google para acceder a la aplicación.</p>

          {authError && (
            <div style={{ margin: '12px 0', color: '#b00020' }}>
              Error: {String(authError.message || authError)}
            </div>
          )}

          <button
            onClick={async () => {
              try {
                await signInWithGoogle();
              } catch (e) {
                // authError ya seteado en la función
              }
            }}
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              fontSize: 15,
              borderRadius: 8,
              border: '1px solid #ddd',
              cursor: 'pointer',
              background: '#fff'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" style={{ width: 18, height: 18 }}>
              <path fill="#4285f4" d="M533.5 278.4c0-17.7-1.6-35-4.6-51.5H272v97.6h146.9c-6.4 34.8-25.6 64.3-54.8 84v69h88.6c51.8-47.8 82.8-118 82.8-199.1z" />
              <path fill="#34a853" d="M272 544.3c73.8 0 135.8-24.4 181.1-66.4l-88.6-69c-24.5 16.6-55.9 26.3-92.5 26.3-71 0-131.3-47.9-152.8-112.2H29.6v70.5C74.6 478.9 166.7 544.3 272 544.3z" />
              <path fill="#fbbc04" d="M119.2 323.6c-5.6-16.8-8.8-34.9-8.8-53.6s3.2-36.8 8.8-53.6v-70.5H29.6C10.8 170.3 0 219.4 0 269.9s10.8 99.6 29.6 143.9l89.6-90.2z" />
              <path fill="#ea4335" d="M272 109.1c39.7 0 75.5 13.6 103.6 40.2l77.5-77.5C407.6 24.9 349 0 272 0 166.7 0 74.6 65.4 29.6 167.9l89.6 70.5C140.7 156.9 201 109.1 272 109.1z" />
            </svg>
            Iniciar sesión con Google
          </button>

          <div style={{ marginTop: 18, fontSize: 13, color: '#888' }}>
            Al iniciar sesión aceptas las políticas de la organización.
          </div>
        </div>
      </div>
    );
  }

  // Si el usuario está autenticado, renderizamos la App original y le pasamos
  // algunas props útiles (user, handleSignOut) si quiere utilizarlas.
  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f8', fontFamily: 'Inter, Roboto, Arial, sans-serif' }}>
      {/* Renderiza la app original tal cual — no hacemos modificaciones en el archivo original */}
      <OriginalApp user={user} onSignOut={handleSignOut} />
    </div>
  );
}
