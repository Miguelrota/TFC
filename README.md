# AI Invoice Extraction System

Sistema de extracción automática de datos de facturas mediante inteligencia artificial usando Azure Form Recognizer.

## Tecnologías

- **Backend**: Java 17 + Spring Boot 3.x
- **IA**: Azure Form Recognizer (modelo prebuilt-invoice)
- **Frontend**: HTML/CSS/JavaScript con PDF.js
- **Base de datos**: H2 (desarrollo) / SQL Server o PostgreSQL (producción)
- **Build**: Maven

## Requisitos

- Java 17 o superior
- Maven 3.6+
- Cuenta de Azure con Form Recognizer configurado

## Configuración

1. Crear recurso de Azure Form Recognizer en Azure Portal
2. Obtener endpoint y API key
3. Configurar variables de entorno:

```bash
export AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
export AZURE_KEY=your-api-key-here
```

## Ejecución

```bash
# Compilar
mvn clean install

# Ejecutar
mvn spring-boot:run
```

La aplicación estará disponible en `http://localhost:8080`

## Estructura del Proyecto

```
src/main/java/com/invoice/extraction/
├── config/          # Configuración de Spring
├── controller/      # REST Controllers
├── dto/             # Data Transfer Objects
├── exception/       # Excepciones personalizadas
├── model/           # Entidades JPA
├── repository/      # Repositorios JPA
└── service/         # Lógica de negocio
```

## API Endpoints

- `POST /api/invoices/process` - Procesar factura
- `POST /api/invoices/save` - Guardar datos extraídos
- `GET /api/invoices/load` - Cargar datos desde XML

## Testing

```bash
# Ejecutar tests
mvn test

# Generar reporte de cobertura
mvn jacoco:report
```

## Licencia

MIT
