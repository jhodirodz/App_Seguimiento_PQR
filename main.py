import os
import google.generativeai as genai
from flask import Flask, request, jsonify
from flask_cors import CORS

# Inicializa la aplicación Flask
app = Flask(__name__)

# CONFIGURACIÓN DE SEGURIDAD (MUY IMPORTANTE)
# Habilita CORS para permitir que tu aplicación de React (desde cualquier URL)
# pueda hacerle peticiones a este servidor.
CORS(app)

# CONFIGURACIÓN DE LA API DE GEMINI
# Intenta configurar la API al arrancar la aplicación.
try:
    # Lee la API Key desde la variable de entorno segura que configuramos en Google Cloud Run.
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        print("ERROR CRÍTICO: La variable de entorno GEMINI_API_KEY no está definida.")
        # La aplicación podría funcionar, pero las llamadas a la API fallarán.
    else:
        genai.configure(api_key=api_key)
        print("INFO: API de Gemini configurada exitosamente.")

except Exception as e:
    # Este error se verá en los Logs de Google Cloud Run si algo falla aquí.
    print(f"ERROR CRÍTICO al configurar la API de Gemini: {e}")

# Ruta de bienvenida para verificar que el servidor está funcionando
@app.route('/')
def index():
    return "El motor (backend) está funcionando. Listo para recibir peticiones desde la interfaz."

# Ruta principal para interactuar con la IA
@app.route('/api/generate', methods=['POST'])
def handle_generation():
    """
    Esta es la ruta principal que tu aplicación de React llamará.
    Recibe un JSON con el prompt y la configuración del schema.
    """
    # 1. Verificar que la petición sea correcta
    if not request.is_json:
        return jsonify({"error": "La petición debe ser de tipo JSON"}), 400

    data = request.get_json()
    prompt_text = data.get('prompt')
    response_schema = data.get('responseSchema') # El schema JSON que tu React enviará

    if not prompt_text:
        return jsonify({"error": "El campo 'prompt' es requerido"}), 400

    # 2. Configurar el modelo de Gemini
    try:
        # Define la configuración de generación, incluyendo el schema si fue proporcionado.
        generation_config = {
            "response_mime_type": "application/json" if response_schema else "text/plain",
        }
        if response_schema:
            generation_config["response_schema"] = response_schema

        model = genai.GenerativeModel(
            'gemini-1.5-flash', # Usamos el modelo más reciente y eficiente
            generation_config=generation_config
        )

        # 3. Llamar a la API de Gemini de forma segura desde el servidor
        print(f"INFO: Realizando llamada a la API de Gemini...")
        response = model.generate_content(prompt_text)
        print(f"INFO: Respuesta recibida de Gemini.")
        
        # 4. Devolver la respuesta a la aplicación de React
        # El texto de la respuesta ya viene en el formato solicitado (JSON o texto plano)
        return jsonify({"text": response.text})

    except Exception as e:
        # Si algo falla, envía un error detallado a la interfaz
        print(f"ERROR en /api/generate: {e}")
        return jsonify({"error": f"Error del servidor al contactar la IA: {str(e)}"}), 500

if __name__ == '__main__':
    # Esta parte es para pruebas locales, Google Cloud Run usará Gunicorn.
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
