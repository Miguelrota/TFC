# Inicio Rápido - Sistema de Extracción de Facturas

## 🚨 Problema Detectado: Maven no está instalado

Tienes **3 opciones** para ejecutar el proyecto:

---

## ✅ Opción 1: Instalar Maven (Recomendada)

### Instalación Rápida con Chocolatey

```powershell
# 1. Abrir PowerShell como Administrador
# 2. Instalar Chocolatey (si no lo tienes)
Set-ExecutionPolicy Bypass -Scope Process -Force
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 3. Instalar Maven
choco install maven

# 4. Cerrar y reabrir PowerShell

# 5. Verificar instalación
mvn --version

# 6. Ejecutar el proyecto
cd "C:\Users\mdbarca\Desktop\Facturas GForma"
.\run.bat
```

**Ver guía completa**: `SETUP_MAVEN.md`

---

## ✅ Opción 2: Usar un IDE (Más Fácil)

### IntelliJ IDEA (Recomendado)
1. Descargar IntelliJ IDEA Community (gratis): https://www.jetbrains.com/idea/download/
2. Abrir el proyecto: `File` → `Open` → Seleccionar carpeta del proyecto
3. IntelliJ detectará automáticamente el `pom.xml`
4. Esperar a que descargue las dependencias
5. Buscar `InvoiceExtractionApplication.java` en `src/main/java/com/invoice/extraction/`
6. Clic derecho → `Run 'InvoiceExtractionApplication'`
7. Acceder a: http://localhost:8080

### VS Code
1. Instalar extensiones:
   - Extension Pack for Java
   - Spring Boot Extension Pack
2. Abrir carpeta del proyecto
3. Presionar `F5` para ejecutar
4. Acceder a: http://localhost:8080

### Eclipse
1. Descargar Eclipse IDE for Java Developers
2. `File` → `Import` → `Existing Maven Projects`
3. Seleccionar carpeta del proyecto
4. Clic derecho en el proyecto → `Run As` → `Spring Boot App`
5. Acceder a: http://localhost:8080

---

## ✅ Opción 3: Crear Maven Wrapper (Sin Instalación Global)

Si tienes Maven instalado en otro lugar o quieres usar Maven Wrapper:

```powershell
# Si tienes Maven instalado temporalmente
mvn wrapper:wrapper

# Luego ejecutar con:
.\mvnw.cmd clean install
.\mvnw.cmd spring-boot:run
```

---

## 📋 Requisitos Previos

### Java 17 o superior

Verificar si Java está instalado:
```powershell
java -version
```

Si no está instalado:

#### Opción A: Chocolatey
```powershell
choco install temurin17
```

#### Opción B: Manual
1. Descargar de: https://adoptium.net/
2. Instalar Eclipse Temurin 17 (LTS)
3. Marcar "Set JAVA_HOME variable"

---

## 🎯 Recomendación

**Para desarrollo**: Usa **IntelliJ IDEA Community** (opción 2)
- Es gratis
- No requiere instalar Maven manualmente
- Tiene excelente soporte para Spring Boot
- Detecta automáticamente el proyecto

**Para producción**: Instala **Maven** (opción 1)
- Necesario para CI/CD
- Permite ejecutar desde línea de comandos
- Más control sobre el build

---

## 🚀 Después de Elegir una Opción

Una vez que la aplicación esté corriendo:

1. Abrir navegador en: **http://localhost:8080**
2. Hacer clic en "Alta Facturas IA"
3. Cargar una factura (PDF o imagen)
4. Hacer clic en "Procesar con IA"
5. Editar campos si es necesario
6. Hacer clic en "Guardar"

---

## 📝 Configuración Necesaria

Antes de ejecutar, configurar la API key de Mindee:

### Archivo: `src/main/resources/application.properties`

```properties
# Mindee API Configuration
mindee.api.key=TU_API_KEY_AQUI
```

### Obtener API Key de Mindee:
1. Ir a: https://platform.mindee.com/
2. Crear cuenta gratuita
3. Ir a "API Keys"
4. Copiar tu API key
5. Pegarla en `application.properties`

**Tier gratuito**: 250 páginas/mes

---

## ❓ Troubleshooting

### "Maven no está instalado"
→ Usa IntelliJ IDEA (Opción 2) o instala Maven (Opción 1)

### "Java no está instalado"
→ Instala Java 17 desde https://adoptium.net/

### "Cannot find main class"
→ Ejecuta primero: `mvn clean install`

### "Port 8080 already in use"
→ Cambia el puerto en `application.properties`:
```properties
server.port=8081
```

### "Mindee API error"
→ Verifica que tu API key esté configurada correctamente

---

## 📚 Documentación Adicional

- **SETUP_MAVEN.md** - Guía detallada de instalación de Maven
- **RUNNING.md** - Guía completa de ejecución
- **STATUS.md** - Estado del proyecto
- **PROJECT_STATUS_SUMMARY.md** - Resumen ejecutivo

---

## 💡 Consejo

**La forma más rápida de empezar es usar IntelliJ IDEA Community**:
1. Descargar e instalar (5 minutos)
2. Abrir proyecto (1 minuto)
3. Ejecutar (1 clic)
4. ¡Listo! 🎉

No necesitas instalar Maven ni configurar nada manualmente.
