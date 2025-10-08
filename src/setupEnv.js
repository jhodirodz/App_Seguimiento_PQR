// This file maps Vite env variables into global window variables expected by the original app.
if (import.meta.env.VITE_FIREBASE_CONFIG) {
  // VITE_FIREBASE_CONFIG should be a JSON string (e.g. '{"apiKey":"...", "projectId":"..."}')
  window.__firebase_config = import.meta.env.VITE_FIREBASE_CONFIG;
}
if (import.meta.env.VITE_INITIAL_AUTH_TOKEN) {
  window.__initial_auth_token = import.meta.env.VITE_INITIAL_AUTH_TOKEN;
}
if (import.meta.env.VITE_APP_ID) {
  window.__app_id = import.meta.env.VITE_APP_ID;
}
if (import.meta.env.VITE_GEMINI_API_KEY) {
  // used by modified App code
  window.__gemini_api_key = import.meta.env.VITE_GEMINI_API_KEY;
}
