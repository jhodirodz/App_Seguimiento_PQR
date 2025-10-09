// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

// 👇 Importa el wrapper con autenticación de Google
import App from './App_GoogleAuth.jsx';

// Si usas estilos globales, mantenlos igual
import './index.css';

// Render principal de la app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
