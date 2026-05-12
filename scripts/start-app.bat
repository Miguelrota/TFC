@echo off
echo ========================================
echo Sistema de Extraccion de Facturas con IA
echo ========================================
echo.

REM Verificar que existe el JAR
if not exist "target\ai-invoice-extraction-1.0.0.jar" (
    echo [ERROR] No se encontro el archivo JAR
    echo Por favor ejecuta primero: mvn clean package -Dmaven.test.skip=true
    pause
    exit /b 1
)

echo Iniciando la aplicacion...
echo.
echo La aplicacion estara disponible en: http://localhost:8080
echo.
echo Presiona Ctrl+C para detener la aplicacion
echo.

REM Perfil opcional: start-app.bat sqlserver
set "SPRING_PROFILE=%1"
if "%SPRING_PROFILE%"=="" (
    java -jar target\ai-invoice-extraction-1.0.0.jar
) else (
    echo [INFO] Usando perfil de Spring: %SPRING_PROFILE%
    java -jar target\ai-invoice-extraction-1.0.0.jar --spring.profiles.active=%SPRING_PROFILE%
)

pause
