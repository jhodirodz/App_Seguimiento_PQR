# App Seguimiento PQR — listo para desplegar en Vercel (Vite + React)

Este paquete contiene la app React (App.jsx) extraída de tu archivo original (ver referencia: CODIGO_ORIGINAL_APP_SEGUIMIENTO_modificado_25092025_OPERATIVA.txt). La app se colocó en `src/App.jsx`. Más abajo explico los pasos para ponerlo en GitHub y luego desplegar en Vercel.

**Qué incluye este ZIP**
- `src/App.jsx` (código original modificado ligeramente para leer la API key desde variables de entorno). Referencia original: fileciteturn1file0
- `src/main.jsx`, `src/setupEnv.js`, `src/index.css`
- `index.html`
- `package.json`, `vite.config.js`
- `tailwind.config.cjs`, `postcss.config.cjs`
- `.gitignore`
- `README.md` (este archivo)

## Pasos rápidos (resumen)
1. Descargar y descomprimir este ZIP.
2. Revisar `src/App.jsx` y completar claves/variables (ver nota abajo).
3. Crear un repo en GitHub, inicializar git local, commit y push.
4. En Vercel: "New Project" → conectar tu repo GitHub → configurar variables de entorno → desplegar.

## Variables de entorno que debes configurar en Vercel
(Ajustes → Environment Variables → Production)
- `VITE_FIREBASE_CONFIG` = JSON **string** con la configuración pública de Firebase. Ejemplo:
  `{"apiKey":"AIza...","authDomain":"mi-proyecto.firebaseapp.com","projectId":"mi-proyecto","storageBucket":"mi-proyecto.appspot.com","messagingSenderId":"...","appId":"1:...:web:..."}
  `
  **Importante:** debe ser una cadena JSON (con comillas escapadas si pegas en la UI), ya que el app espera `JSON.parse(window.__firebase_config)`.
- `VITE_GEMINI_API_KEY` = tu API key de Generative Language (Gemini) si quieres que las funciones IA funcionen.
- `VITE_INITIAL_AUTH_TOKEN` (opcional) = token de autenticación inicial si tu app lo requiere.
- `VITE_APP_ID` (opcional) = ID de app para namespacing.

## Comandos locales
```bash
npm install
npm run dev        # desarrollo local
npm run build      # crea /dist para producción
npm run preview    # preview local del build
```

## Configuración en Vercel
- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite (Vercel lo detecta automáticamente)

## Notas importantes
- Para que las llamadas a la API de Gemini funcionen sin editar `src/App.jsx`, configura `VITE_GEMINI_API_KEY`. El código fue modificado automáticamente para leer esta variable en tiempo de ejecución.
- Verifica en `src/App.jsx` si deseas cambiar la lógica de lectura de API keys o mover claves a funciones seguras en un backend — exponer claves en clientes tiene riesgos.
- La app usa Tailwind CSS (ya incluido). Si deseas compilar CSS sin Tailwind, ajusta `src/index.css`.

## Referencia del código fuente original
El archivo original que usé para crear `src/App.jsx` fue: `CODIGO_ORIGINAL_APP_SEGUIMIENTO_modificado_25092025_OPERATIVA.txt`. Puedes consultar su contenido si lo necesitas. fileciteturn1file0
