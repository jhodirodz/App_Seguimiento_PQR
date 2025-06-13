# Usar una imagen base oficial y ligera de Python
FROM python:3.11-slim

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar el archivo de dependencias
COPY requirements.txt .

# Instalar las dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código de tu aplicación (como main.py)
COPY . .

# Indicar a Gunicorn que escuche en el puerto que Cloud Run le asigne
# ------ ESTA ES LA LÍNEA QUE CAMBIAMOS ------
CMD exec gunicorn --bind 0.0.0.0:8080 main:app
