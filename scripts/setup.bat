@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Sistema de Extraccion de Facturas con IA
echo Setup y Diagnostico
echo ========================================
echo.

REM Verificar Java
echo [1/3] Verificando Java...
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java no esta instalado
    echo.
    echo Por favor instala Java 17 o superior desde:
    echo https://adoptium.net/
    echo.
    echo O usa Chocolatey:
    echo   choco install temurin17
    echo.
    pause
    exit /b 1
) else (
    echo [OK] Java esta instalado
    java -version 2>&1 | findstr /C:"version"
)
echo.

REM Verificar Maven
echo [2/3] Verificando Maven...
mvn --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] Maven no esta instalado
    echo.
    echo Tienes 3 opciones:
    echo.
    echo 1. Instalar Maven con Chocolatey ^(Recomendado^)
    echo    - Abrir PowerShell como Administrador
    echo    - Ejecutar: choco install maven
    echo.
    echo 2. Usar IntelliJ IDEA Community ^(Mas Facil^)
    echo    - Descargar de: https://www.jetbrains.com/idea/download/
    echo    - Abrir proyecto y ejecutar
    echo.
    echo 3. Instalar Maven manualmente
    echo    - Ver guia en: SETUP_MAVEN.md
    echo.
    echo Presiona cualquier tecla para abrir la guia de instalacion...
    pause >nul
    start QUICK_START.md
    exit /b 1
) else (
    echo [OK] Maven esta instalado
    mvn --version 2>&1 | findstr /C:"Apache Maven"
)
echo.

REM Verificar archivo pom.xml
echo [3/3] Verificando proyecto...
if not exist "pom.xml" (
    echo [ERROR] No se encuentra pom.xml
    echo Asegurate de estar en el directorio raiz del proyecto
    pause
    exit /b 1
) else (
    echo [OK] Proyecto encontrado
)
echo.

echo ========================================
echo Diagnostico Completo
echo ========================================
echo.
echo Todo esta listo para ejecutar el proyecto!
echo.
echo Opciones:
echo   1. Compilar proyecto:  mvn clean install
echo   2. Ejecutar proyecto:  mvn spring-boot:run
echo   3. Ejecutar con script: .\run.bat
echo.
echo Presiona cualquier tecla para compilar el proyecto...
pause >nul

echo.
echo ========================================
echo Compilando Proyecto
echo ========================================
echo.

mvn clean install -DskipTests

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] La compilacion fallo
    echo Revisa los errores anteriores
    pause
    exit /b 1
)

echo.
echo ========================================
echo Compilacion Exitosa!
echo ========================================
echo.
echo Deseas ejecutar la aplicacion ahora? ^(S/N^)
set /p choice="> "

if /i "%choice%"=="S" (
    echo.
    echo Iniciando aplicacion...
    echo Accede a: http://localhost:8080
    echo.
    echo Presiona Ctrl+C para detener
    echo.
    mvn spring-boot:run
) else (
    echo.
    echo Para ejecutar la aplicacion mas tarde:
    echo   mvn spring-boot:run
    echo.
    echo O usa el script:
    echo   .\run.bat
    echo.
)

pause
