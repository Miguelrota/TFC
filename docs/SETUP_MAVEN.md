# Guía de Instalación de Maven en Windows

## Problema Detectado
Maven no está instalado o no está en el PATH del sistema.

---

## Opción 1: Instalación Manual de Maven (Recomendada)

### Paso 1: Descargar Maven
1. Ve a: https://maven.apache.org/download.cgi
2. Descarga: **apache-maven-3.9.6-bin.zip** (o la versión más reciente)
3. Guarda el archivo en tu carpeta de Descargas

### Paso 2: Extraer Maven
1. Extrae el archivo ZIP a: `C:\Program Files\Apache\maven`
2. La ruta final debe ser: `C:\Program Files\Apache\maven\apache-maven-3.9.6`

### Paso 3: Configurar Variables de Entorno

#### Opción A: Usando PowerShell (Administrador)
```powershell
# Abrir PowerShell como Administrador
# Ejecutar estos comandos:

# Configurar MAVEN_HOME
[System.Environment]::SetEnvironmentVariable('MAVEN_HOME', 'C:\Program Files\Apache\maven\apache-maven-3.9.6', 'Machine')

# Agregar Maven al PATH
$path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$newPath = $path + ';C:\Program Files\Apache\maven\apache-maven-3.9.6\bin'
[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')

# Cerrar y reabrir PowerShell para que los cambios surtan efecto
```

#### Opción B: Usando la Interfaz Gráfica
1. Presiona `Win + X` y selecciona "Sistema"
2. Haz clic en "Configuración avanzada del sistema"
3. Haz clic en "Variables de entorno"
4. En "Variables del sistema":
   - Haz clic en "Nueva"
   - Nombre: `MAVEN_HOME`
   - Valor: `C:\Program Files\Apache\maven\apache-maven-3.9.6`
   - Haz clic en "Aceptar"
5. Busca la variable `Path` en "Variables del sistema"
   - Selecciónala y haz clic en "Editar"
   - Haz clic en "Nuevo"
   - Agrega: `%MAVEN_HOME%\bin`
   - Haz clic en "Aceptar"
6. Haz clic en "Aceptar" en todas las ventanas

### Paso 4: Verificar Instalación
```powershell
# Cerrar y reabrir PowerShell
# Ejecutar:
mvn --version
```

Deberías ver algo como:
```
Apache Maven 3.9.6
Maven home: C:\Program Files\Apache\maven\apache-maven-3.9.6
Java version: 17.0.x, vendor: Oracle Corporation
```

---

## Opción 2: Usar Maven Wrapper (Sin Instalación)

Si no quieres instalar Maven globalmente, puedes usar el Maven Wrapper incluido en el proyecto:

### Paso 1: Verificar que existe mvnw.cmd
```powershell
# En la raíz del proyecto
dir mvnw.cmd
```

### Paso 2: Ejecutar con Maven Wrapper
```powershell
# Compilar el proyecto
.\mvnw.cmd clean install

# Ejecutar la aplicación
.\mvnw.cmd spring-boot:run
```

**Nota**: La primera vez que ejecutes `mvnw.cmd`, descargará Maven automáticamente.

---

## Opción 3: Usar Chocolatey (Gestor de Paquetes)

Si tienes Chocolatey instalado:

```powershell
# Abrir PowerShell como Administrador
choco install maven

# Verificar instalación
mvn --version
```

### Instalar Chocolatey (si no lo tienes)
```powershell
# Abrir PowerShell como Administrador
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

---

## Verificar Java

Maven requiere Java 17 o superior. Verifica que Java esté instalado:

```powershell
java -version
```

Deberías ver:
```
java version "17.0.x" o superior
```

### Si Java no está instalado:

#### Opción A: Descargar manualmente
1. Ve a: https://adoptium.net/
2. Descarga: **Eclipse Temurin 17 (LTS)**
3. Instala siguiendo el asistente
4. Asegúrate de marcar "Set JAVA_HOME variable"

#### Opción B: Usar Chocolatey
```powershell
choco install temurin17
```

---

## Solución Rápida: Ejecutar sin Maven

Si quieres probar la aplicación rápidamente sin instalar Maven, puedes:

### 1. Usar un IDE con Maven integrado

#### IntelliJ IDEA
1. Abre el proyecto en IntelliJ IDEA
2. IntelliJ detectará automáticamente el `pom.xml`
3. Haz clic derecho en `InvoiceExtractionApplication.java`
4. Selecciona "Run 'InvoiceExtractionApplication'"

#### Eclipse
1. Abre el proyecto en Eclipse
2. Eclipse detectará automáticamente el `pom.xml`
3. Haz clic derecho en el proyecto
4. Selecciona "Run As" → "Spring Boot App"

#### VS Code
1. Instala la extensión "Extension Pack for Java"
2. Instala la extensión "Spring Boot Extension Pack"
3. Abre el proyecto
4. Presiona F5 para ejecutar

---

## Después de Instalar Maven

Una vez que Maven esté instalado y configurado:

```powershell
# Navegar al directorio del proyecto
cd "C:\Users\mdbarca\Desktop\Facturas GForma"

# Compilar el proyecto
mvn clean install

# Ejecutar la aplicación
mvn spring-boot:run

# O usar el script
.\run.bat
```

---

## Troubleshooting

### Error: "JAVA_HOME is not set"
```powershell
# Configurar JAVA_HOME
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.x', 'Machine')
```

### Error: "mvn: command not found" después de instalar
- Cierra y reabre PowerShell
- Verifica que Maven esté en el PATH: `echo $env:Path`
- Reinicia el sistema si es necesario

### Error: "Cannot find Maven home"
- Verifica que MAVEN_HOME apunte al directorio correcto
- Verifica que `%MAVEN_HOME%\bin` esté en el PATH

---

## Resumen de Comandos

```powershell
# Verificar instalaciones
java -version
mvn --version

# Compilar proyecto
mvn clean install

# Ejecutar aplicación
mvn spring-boot:run

# Ejecutar tests
mvn test

# Ver dependencias
mvn dependency:tree
```

---

## Próximos Pasos

1. ✅ Instalar Maven (elegir una de las opciones)
2. ✅ Verificar Java 17+
3. ✅ Configurar variables de entorno
4. ✅ Ejecutar `mvn --version` para verificar
5. ✅ Ejecutar `.\run.bat` para iniciar la aplicación
6. ✅ Acceder a http://localhost:8080

---

## Ayuda Adicional

Si tienes problemas con la instalación, puedes:
1. Revisar la documentación oficial: https://maven.apache.org/install.html
2. Usar Maven Wrapper (no requiere instalación global)
3. Usar un IDE con Maven integrado (IntelliJ, Eclipse, VS Code)

---

**Nota**: Después de instalar Maven, asegúrate de cerrar y reabrir PowerShell para que los cambios en las variables de entorno surtan efecto.
