#!/bin/bash

echo "========================================"
echo "Sistema de Extracción de Facturas con IA"
echo "========================================"
echo ""

# Verificar si Maven está instalado
if ! command -v mvn &> /dev/null; then
    echo "[ERROR] Maven no está instalado o no está en el PATH"
    echo "Por favor instala Maven desde: https://maven.apache.org/download.cgi"
    exit 1
fi

# Verificar si Java está instalado
if ! command -v java &> /dev/null; then
    echo "[ERROR] Java no está instalado o no está en el PATH"
    echo "Por favor instala Java 17+ desde: https://adoptium.net/"
    exit 1
fi

echo "[INFO] Verificando versión de Java..."
java -version
echo ""

echo "[INFO] Compilando el proyecto..."
mvn clean install -DskipTests
if [ $? -ne 0 ]; then
    echo "[ERROR] Falló la compilación"
    exit 1
fi

echo ""
echo "[INFO] Iniciando la aplicación..."
echo "[INFO] La aplicación estará disponible en: http://localhost:8080"
echo "[INFO] Presiona Ctrl+C para detener la aplicación"
echo ""

SPRING_PROFILE="$1"
if [ -z "$SPRING_PROFILE" ]; then
    mvn spring-boot:run
else
    echo "[INFO] Usando perfil de Spring: $SPRING_PROFILE"
    mvn spring-boot:run -Dspring-boot.run.profiles="$SPRING_PROFILE"
fi
