# Guía de Ejecución - Sistema de Extracción de Facturas con IA

## 📋 Requisitos Previos

### Software Necesario:
1. **Java 17 o superior** (JDK)
   - Verificar: `java -version`
   - Descargar: https://adoptium.net/

2. **Maven 3.6+** (para compilar y ejecutar)
   - Verificar: `mvn -version`
   - Descargar: https://maven.apache.org/download.cgi

3. **API Key de Mindee** (para extracción de facturas)
   - Obtener en: https://platform.mindee.com/
   - Tier gratuito: 250 páginas/mes

## 🚀 Pasos para Ejecutar la Aplicación

### Opción 1: Ejecución Rápida con Maven (Recomendado)

```bash
# 1. Navegar al directorio del proyecto
cd ai-invoice-extraction

# 2. Compilar el proyecto (descarga dependencias)
mvn clean install -DskipTests

# 3. Ejecutar la aplicación
mvn spring-boot:run
```

La aplicación estará disponible en: **http://localhost:8080**

### Opción 2: Compilar y Ejecutar JAR

```bash
# 1. Compilar y empaquetar
mvn clean package -DskipTests

# 2. Ejecutar el JAR generado
java -jar target/ai-invoice-extraction-1.0.0.jar
```

### Opción 3: Desde tu IDE (IntelliJ IDEA / Eclipse / VS Code)

1. Importar el proyecto como proyecto Maven
2. Esperar a que se descarguen las dependencias
3. Ejecutar la clase principal: `InvoiceExtractionApplication.java`
4. La aplicación se iniciará en el puerto 8080

## 🔑 Configuración de API Key de Mindee

### Método 1: Variable de Entorno (Recomendado para Producción)

**Windows (PowerShell):**
```powershell
$env:MINDEE_API_KEY="tu_api_key_aqui"
mvn spring-boot:run
```

**Windows (CMD):**
```cmd
set MINDEE_API_KEY=tu_api_key_aqui
mvn spring-boot:run
```

**Linux/Mac:**
```bash
export MINDEE_API_KEY="tu_api_key_aqui"
mvn spring-boot:run
```

### Método 2: Archivo application.properties

Editar `src/main/resources/application.properties`:
```properties
mindee.api.key=tu_api_key_aqui
```

**⚠️ IMPORTANTE:** No subir este archivo a Git con tu API key real.

### Método 3: Usar la API Key de Prueba (Incluida)

El proyecto incluye una API key de prueba por defecto. Puedes ejecutar directamente:
```bash
mvn spring-boot:run
```

## 🧪 Verificar que la Aplicación Funciona

### 1. Verificar que el servidor está corriendo

Deberías ver en la consola:
```
Started InvoiceExtractionApplication in X.XXX seconds
```

### 2. Acceder a la Consola H2 (Base de Datos)

- URL: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:invoicedb`
- Username: `sa`
- Password: (dejar vacío)

### 3. Probar los Endpoints REST

**Health Check (si está implementado):**
```bash
curl http://localhost:8080/actuator/health
```

**Probar endpoint de procesamiento:**
```bash
curl -X POST http://localhost:8080/api/invoices/process \
  -F "file=@ruta/a/tu/factura.pdf"
```

## 📁 Estructura de Directorios Creados

Al ejecutar la aplicación, se crearán automáticamente:

```
./output/
├── xml/        # Archivos XML generados
└── uploads/    # Archivos temporales de upload
```

## 🔧 Configuración Personalizada

### Cambiar el Puerto del Servidor

Editar `application.properties`:
```properties
server.port=9090
```

O ejecutar con parámetro:
```bash
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=9090
```

### Cambiar Directorio de Salida XML

```bash
mvn spring-boot:run -Dspring-boot.run.arguments=--file.storage.output-dir=/ruta/personalizada
```

### Cambiar Tamaño Máximo de Archivo

Editar `application.properties`:
```properties
spring.servlet.multipart.max-file-size=20MB
spring.servlet.multipart.max-request-size=20MB
invoice.upload.max-file-size=20MB
```

## 🧪 Ejecutar Tests

### Todos los tests:
```bash
mvn test
```

### Solo tests unitarios:
```bash
mvn test -Dtest=*Test
```

### Solo tests de propiedades:
```bash
mvn test -Dtest=*PropertyTest
```

### Test específico:
```bash
mvn test -Dtest=FileStorageServiceTest
```

### Con reporte de cobertura:
```bash
mvn clean test jacoco:report
```
El reporte estará en: `target/site/jacoco/index.html`

## 🐛 Solución de Problemas Comunes

### Error: "Port 8080 already in use"
**Solución:** Cambiar el puerto o detener la aplicación que usa el puerto 8080
```bash
mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

### Error: "MINDEE_API_KEY not found"
**Solución:** Configurar la API key (ver sección de configuración arriba)

### Error: "Failed to load ApplicationContext"
**Solución:** Verificar que todas las dependencias se descargaron correctamente
```bash
mvn clean install -U
```

### Error: "Cannot create directory ./output/xml"
**Solución:** Verificar permisos de escritura en el directorio del proyecto

### Error de compilación con Java
**Solución:** Verificar que estás usando Java 17+
```bash
java -version
# Debe mostrar version 17 o superior
```

## 📊 Logs y Debugging

### Ver logs detallados:
```bash
mvn spring-boot:run -Dspring-boot.run.arguments=--logging.level.com.invoice.extraction=DEBUG
```

### Logs se guardan en:
- Consola (stdout)
- Configurar archivo de log en `application.properties`:
```properties
logging.file.name=logs/application.log
```

## 🌐 Endpoints Disponibles

Una vez la aplicación esté corriendo:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/invoices/process` | POST | Procesar factura (upload) |
| `/api/invoices/save` | POST | Guardar datos extraídos |
| `/api/invoices/load` | GET | Cargar datos desde XML |
| `/h2-console` | GET | Consola de base de datos H2 |

## 📝 Notas Importantes

1. **Base de Datos H2:** Los datos se pierden al reiniciar (configurado como `mem:invoicedb`)
2. **Archivos XML:** Se guardan en `./output/xml` y persisten entre reinicios
3. **API Key:** La key de prueba incluida tiene límite de 250 páginas/mes
4. **Timeout:** El procesamiento tiene timeout de 30 segundos por documento
5. **Tamaño Máximo:** Archivos hasta 10MB por defecto

## 🎯 Próximos Pasos

1. **Frontend:** Actualmente solo está el backend. El frontend (HTML/JS) está pendiente de implementación
2. **Producción:** Usar perfiles de Spring (`h2` por defecto). Para SQL Server: `--spring.profiles.active=sqlserver` y variables `SQLSERVER_*` (ver `src/main/resources/application-sqlserver.properties`)
3. **Tests:** Ejecutar `mvn test` para verificar que todo funciona correctamente

## 📞 Soporte

Si encuentras problemas:
1. Verificar los logs en la consola
2. Revisar que todos los requisitos previos están instalados
3. Verificar que la API key de Mindee es válida
4. Consultar la documentación de Mindee: https://developers.mindee.com/

---

**Estado del Proyecto:** Backend funcional ✅ | Frontend pendiente ⏳
