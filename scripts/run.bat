@echo off
echo ========================================
echo Sistema de Extraccion de Facturas con IA
echo ========================================
echo.

REM Verificar si Maven esta instalado
where mvn >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Maven no esta instalado o no esta en el PATH
    echo Por favor instala Maven desde: https://maven.apache.org/download.cgi
    pause
    exit /b 1
)

REM Verificar si Java esta instalado
where java >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Java no esta instalado o no esta en el PATH
    echo Por favor instala Java 17+ desde: https://adoptium.net/
    pause
    exit /b 1
)

echo [INFO] Verificando version de Java...
java -version
echo.

echo [INFO] Compilando el proyecto...
call mvn clean install -DskipTests
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la compilacion
    pause
    exit /b 1
)

echo.
echo [INFO] Iniciando la aplicacion...
echo [INFO] La aplicacion estara disponible en: http://localhost:8080
echo [INFO] Presiona Ctrl+C para detener la aplicacion
echo.

REM Perfil opcional: run.bat sqlserver
set "SPRING_PROFILE=%1"
if "%SPRING_PROFILE%"=="" (
    call mvn spring-boot:run
) else (
    echo [INFO] Usando perfil de Spring: %SPRING_PROFILE%
    call mvn spring-boot:run -Dspring-boot.run.profiles=%SPRING_PROFILE%
)
