# Implementation Plan: AI Invoice Extraction System

## Overview

Este plan de implementación desglosa el sistema de extracción de facturas con IA en tareas incrementales y ejecutables. El sistema utiliza Java 17 + Spring Boot 3.x como backend, Mindee Invoice API para extracción de datos, y una interfaz web HTML/CSS/JavaScript con PDF.js para el frontend.

La implementación sigue un enfoque incremental donde cada tarea construye sobre las anteriores, con checkpoints regulares para validar el progreso. Las tareas de testing están marcadas como opcionales (*) para permitir un desarrollo más rápido del MVP.

## Tasks

- [x] 1. Configurar estructura del proyecto Spring Boot
  - Crear proyecto Maven con Spring Boot 3.x y Java 17
  - Configurar dependencias: Spring Web, Spring Data JPA, H2/PostgreSQL, Lombok, Mindee SDK, JAXB
  - Crear estructura de paquetes: `controller`, `service`, `repository`, `model`, `dto`, `exception`, `config`
  - Configurar `application.properties` con propiedades de Mindee, base de datos y almacenamiento de archivos
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 2. Implementar modelos de datos y DTOs
  - [x] 2.1 Crear DTOs para transferencia de datos
    - Crear `InvoiceDataDTO` con validaciones Jakarta Bean Validation
    - Crear `ValidationResult`, `FieldValidationError`, `FieldValidationWarning`
    - Crear `ProcessingStateDTO`, `SaveResultDTO`
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1-4.8_
  
  - [x] 2.2 Crear entidades JPA para persistencia
    - Crear entidad `InvoiceMetadata` con anotaciones JPA
    - Crear enum `ProcessingStatus`
    - Configurar generación automática de `documentId` y `extractionDate`
    - _Requirements: 10.1, 10.2, 10.4_
  
  - [x] 2.3 Crear clases JAXB para generación XML
    - Crear `InvoiceXML` con anotaciones JAXB
    - Crear clases anidadas: `Metadata`, `Supplier`, `Address`
    - Configurar marshalling con formato UTF-8
    - _Requirements: 6.1-6.11_

- [x] 3. Implementar capa de almacenamiento y persistencia
  - [x] 3.1 Crear repositorio JPA para metadatos
    - Crear `InvoiceMetadataRepository` extendiendo `JpaRepository`
    - Implementar queries personalizadas: `findByDocumentId`, `findByInvoiceNumber`, `findAllByOrderByExtractionDateDesc`
    - _Requirements: 10.4, 10.5_
  
  - [x] 3.2 Implementar servicio de almacenamiento de archivos
    - Crear `FileStorageService` con métodos `saveFile`, `readFile`, `fileExists`, `listFiles`
    - Implementar inicialización de directorio de almacenamiento
    - Implementar validación de seguridad de rutas (path traversal prevention)
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 3.3 Escribir tests unitarios para FileStorageService
    - Test de guardado de archivos
    - Test de manejo de colisiones de nombres
    - Test de validación de seguridad de rutas
    - _Requirements: 10.3_

- [x] 4. Implementar integración con Mindee Invoice API
  - [x] 4.1 Crear servicio de Mindee Invoice API
    - Crear `MindeeInvoiceService` con inicialización de `MindeeClient`
    - Implementar método `extractData()` usando modelo `prebuilt-invoice`
    - Implementar mapeo de campos de Mindee a `InvoiceDataDTO`
    - Implementar extracción de scores de confianza
    - Configurar threshold de confianza (default: 0.7)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 7.1, 7.2, 7.3_
  
  - [x]* 4.2 Escribir test de propiedad para extracción de campos con baja confianza
    - **Property 14: Low Confidence Field Handling**
    - **Validates: Requirements 7.3**
    - Verificar que campos con confianza baja quedan vacíos en el formulario
  
  - [x] 4.3 Implementar manejo de timeout y errores de Mindee
    - Configurar timeout de 30 segundos
    - Implementar manejo de excepciones de Mindee SDK
    - Implementar logging de errores
    - _Requirements: 3.11, 9.1, 9.3_
  
  - [x]* 4.4 Escribir test de propiedad para manejo de errores de procesamiento
    - **Property 15: AI Processing Error Display**
    - **Validates: Requirements 9.1**
    - Verificar que errores de procesamiento muestran mensaje con razón del fallo

- [x] 5. Checkpoint - Verificar integración con Mindee
  - Ejecutar tests de integración con Mindee Invoice API (si hay credenciales disponibles)
  - Verificar que la extracción funciona con facturas de ejemplo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar servicio de validación de datos
  - [x] 6.1 Crear ValidationService con reglas de negocio
    - Implementar validación de campos requeridos
    - Implementar validación de longitudes máximas
    - Implementar validación de código postal por país (España, USA, Francia, Alemania, UK)
    - Implementar validación de país contra lista ISO 3166-1
    - Generar `ValidationResult` con errores y warnings
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x]* 6.2 Escribir test de propiedad para validación de código postal
    - **Property 6: Postal Code Validation**
    - **Validates: Requirements 5.1**
    - Verificar que códigos postales se validan correctamente según país
  
  - [x]* 6.3 Escribir test de propiedad para validación de país
    - **Property 7: Country List Validation**
    - **Validates: Requirements 5.2**
    - Verificar que países se validan contra lista ISO predefinida
  
  - [x]* 6.4 Escribir test de propiedad para campos requeridos vacíos
    - **Property 8: Required Field Validation**
    - **Validates: Requirements 5.3**
    - Verificar que campos requeridos vacíos generan warning
  
  - [x]* 6.5 Escribir tests unitarios para ValidationService
    - Test de validación de código postal español (28001)
    - Test de validación de código postal USA con extensión (12345-6789)
    - Test de detección de campos requeridos vacíos
    - Test de detección de campos que exceden longitud máxima
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Implementar generación de XML
  - [x] 7.1 Crear XMLGeneratorService con JAXB
    - Implementar método `generateXML()` con marshalling JAXB
    - Implementar mapeo de `InvoiceDataDTO` a `InvoiceXML`
    - Configurar encoding UTF-8 y formato con indentación
    - Implementar método `generateFileName()` con timestamp y sanitización
    - Implementar método `saveXML()` con manejo de colisiones
    - Implementar método `validateXML()` con unmarshalling
    - _Requirements: 6.1-6.11, 10.2, 10.3_
  
  - [x]* 7.2 Escribir test de propiedad para completitud de XML
    - **Property 11: XML Generation Completeness**
    - **Validates: Requirements 6.1-6.9**
    - Verificar que XML generado contiene todos los campos del formulario
  
  - [x]* 7.3 Escribir test de propiedad para encoding UTF-8
    - **Property 12: XML UTF-8 Encoding**
    - **Validates: Requirements 6.10**
    - Verificar que XML usa encoding UTF-8 declarado en header
  
  - [x]* 7.4 Escribir test de propiedad para validación de esquema XML
    - **Property 13: XML Schema Validation**
    - **Validates: Requirements 6.11**
    - Verificar que XML generado es bien formado y válido contra esquema
  
  - [x]* 7.5 Escribir test de propiedad para round-trip XML
    - **Property 24: XML-to-Form Round-Trip**
    - **Validates: Requirements 10.5**
    - Verificar que datos guardados en XML y recargados son idénticos
  
  - [x]* 7.6 Escribir test de propiedad para manejo de colisiones de nombres
    - **Property 22: Filename Collision Handling**
    - **Validates: Requirements 10.3**
    - Verificar que archivos con mismo nombre reciben identificador único
  
  - [ ]* 7.7 Escribir tests unitarios para XMLGeneratorService
    - Test de generación de XML con todos los campos
    - Test de generación de XML con campos opcionales vacíos
    - Test de escape de caracteres especiales en XML (&, <, >)
    - Test de validación de XML generado contra esquema
    - _Requirements: 6.1-6.11_

- [x] 8. Implementar servicio de orquestación de extracción
  - [x] 8.1 Crear InvoiceExtractionService
    - Implementar método `processInvoice()` que orquesta: validación de archivo → Mindee → mapeo → retorno de datos
    - Implementar método `saveExtractedData()` que orquesta: validación → generación XML → guardado → persistencia de metadatos
    - Implementar método `loadFromXML()` para cargar datos desde XML existente
    - Implementar retry logic con Spring Retry (3 intentos, backoff exponencial)
    - _Requirements: 3.1-3.11, 6.1-6.11, 9.5, 10.5_
  
  - [ ]* 8.2 Escribir test de propiedad para persistencia de modificaciones
    - **Property 5: Field Modification Persistence**
    - **Validates: Requirements 4.9, 4.10**
    - Verificar que modificaciones de usuario se preservan al generar output
  
  - [ ]* 8.3 Escribir test de propiedad para retry después de error
    - **Property 19: Retry After Error**
    - **Validates: Requirements 9.5**
    - Verificar que usuario puede reintentar procesamiento sin re-upload

- [x] 9. Checkpoint - Verificar servicios de backend
  - Ejecutar todos los tests unitarios y de propiedades
  - Verificar que la generación de XML funciona correctamente
  - Verificar que la validación detecta errores correctamente
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implementar controladores REST
  - [x] 10.1 Crear InvoiceController con endpoints REST
    - Implementar `POST /api/invoices/process` para procesar factura (multipart file upload)
    - Implementar `POST /api/invoices/save` para guardar datos extraídos y generar XML
    - Implementar `GET /api/invoices/load` para cargar datos desde XML
    - Implementar `GET /api/invoices/status/{jobId}` para obtener estado de procesamiento
    - Configurar validación de request bodies con `@Valid`
    - _Requirements: 2.1, 2.2, 3.1-3.11, 4.1-4.10, 6.1-6.11_
  
  - [x] 10.2 Implementar GlobalExceptionHandler
    - Crear `@ControllerAdvice` para manejo centralizado de excepciones
    - Implementar handlers para: `InvoiceProcessingException`, `MethodArgumentNotValidException`, `UnsupportedFileTypeException`, `TimeoutException`, `XMLGenerationException`
    - Crear `ErrorResponse` DTO con código, mensaje y acción recomendada
    - Implementar logging de errores
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 10.3 Escribir test de propiedad para manejo de errores de generación XML
    - **Property 16: XML Generation Error Handling**
    - **Validates: Requirements 9.2**
    - Verificar que errores de generación XML muestran mensaje y retienen datos del formulario
  
  - [ ]* 10.4 Escribir test de propiedad para logging de errores
    - **Property 17: Error Logging**
    - **Validates: Requirements 9.3**
    - Verificar que errores se registran con timestamp, tipo y contexto

- [x] 11. Implementar validación de archivos y tipos soportados
  - [x] 11.1 Crear FileValidationService
    - Implementar validación de tipo de archivo (PDF, JPEG, PNG, TIFF)
    - Implementar validación de tamaño máximo (10MB)
    - Implementar detección de archivos corruptos
    - Crear excepciones personalizadas: `UnsupportedFileTypeException`, `FileSizeExceededException`
    - _Requirements: 2.1, 2.2, 2.4, 9.4_
  
  - [ ]* 11.2 Escribir test de propiedad para aceptación de tipos válidos
    - **Property 1: File Type Acceptance**
    - **Validates: Requirements 2.1, 2.2**
    - Verificar que archivos con formatos soportados son aceptados
  
  - [ ]* 11.3 Escribir test de propiedad para rechazo de tipos inválidos
    - **Property 2: Invalid File Type Rejection**
    - **Validates: Requirements 2.4**
    - Verificar que archivos con formatos no soportados muestran mensaje de error
  
  - [ ]* 11.4 Escribir test de propiedad para manejo de archivos corruptos
    - **Property 18: Corrupted File Handling**
    - **Validates: Requirements 9.4**
    - Verificar que archivos corruptos notifican al usuario y permiten cargar otro
  
  - [ ]* 11.5 Escribir tests unitarios para FileValidationService
    - Test de aceptación de PDF válido
    - Test de aceptación de imagen JPEG válida
    - Test de rechazo de formato inválido (DOCX)
    - Test de rechazo de archivo mayor a 10MB
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 12. Implementar configuración y propiedades de aplicación
  - [x] 12.1 Configurar application.properties
    - Configurar propiedades de servidor (puerto 8080)
    - Configurar propiedades de Mindee Invoice API (endpoint, key, confidence threshold, timeout)
    - Configurar propiedades de almacenamiento de archivos (directorio output, tamaño máximo, formatos soportados)
    - Configurar propiedades de base de datos H2 para desarrollo
    - Configurar propiedades de JPA (DDL auto, show SQL)
    - _Requirements: 8.4, 8.5_
  
  - [x] 12.2 Crear clases de configuración Spring
    - Crear `RetryConfig` con `@EnableRetry` y configuración de retry template
    - Crear `CorsConfig` para permitir requests desde frontend
    - Crear `MultipartConfig` para configurar upload de archivos
    - _Requirements: 8.1, 8.2_

- [x] 13. Checkpoint - Verificar backend completo
  - Ejecutar todos los tests unitarios, de propiedades e integración
  - Verificar que todos los endpoints REST responden correctamente
  - Verificar que el manejo de errores funciona en todos los casos
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implementar frontend - Estructura HTML y estilos
  - [x] 14.1 Crear estructura HTML principal
    - Crear `index.html` con botón "Alta Facturas IA"
    - Crear `extraction-view.html` con layout dual-panel (viewer + form)
    - Crear estructura del formulario de extracción con todos los campos
    - Agregar elementos para mensajes de error y validación
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1-4.8_
  
  - [x] 14.2 Crear estilos CSS
    - Crear estilos para layout dual-panel responsivo
    - Crear estilos para formulario de extracción
    - Crear estilos para indicadores de validación (errores, warnings)
    - Crear estilos para mensajes de error y éxito
    - Crear estilos para estados de carga (spinners, progress indicators)
    - _Requirements: 5.4_

- [x] 15. Implementar frontend - Visualizador de documentos
  - [x] 15.1 Crear InvoiceViewer component con PDF.js
    - Implementar método `loadDocument()` para cargar y renderizar PDFs
    - Implementar renderizado de imágenes con Canvas API
    - Implementar método `getDocumentData()` para obtener datos del documento
    - Implementar método `clear()` para limpiar el visor
    - Implementar manejo de errores de carga
    - _Requirements: 2.3, 2.5_
  
  - [ ]* 15.2 Escribir test de propiedad para habilitación de procesamiento
    - **Property 3: Document Loading Enables Processing**
    - **Validates: Requirements 2.3, 2.5**
    - Verificar que documento cargado exitosamente habilita procesamiento de IA

- [x] 16. Implementar frontend - Formulario de extracción
  - [x] 16.1 Crear ExtractionForm component
    - Implementar método `initialize()` para inicializar campos vacíos
    - Implementar método `populateFields()` para poblar con datos extraídos
    - Implementar método `getFormData()` para obtener datos actuales
    - Implementar método `validate()` para validar datos del formulario
    - Implementar método `showValidationFeedback()` para mostrar indicadores visuales
    - Implementar método `clear()` para limpiar formulario
    - Implementar listeners para cambios en campos
    - _Requirements: 4.1-4.10, 5.4_
  
  - [ ]* 16.2 Escribir test de propiedad para población de formulario
    - **Property 4: Extraction Result Population**
    - **Validates: Requirements 3.10**
    - Verificar que datos extraídos por IA pueblan todos los campos correspondientes
  
  - [ ]* 16.3 Escribir test de propiedad para highlighting de validación
    - **Property 9: Validation Failure Highlighting**
    - **Validates: Requirements 5.4**
    - Verificar que campos con errores de validación se resaltan visualmente
  
  - [ ]* 16.4 Escribir test de propiedad para guardado con warnings
    - **Property 10: Save Allowed with Warnings**
    - **Validates: Requirements 5.5**
    - Verificar que sistema permite guardar datos con warnings (pero no con errores)

- [x] 17. Implementar frontend - Controlador de extracción
  - [x] 17.1 Crear ExtractionController (JavaScript)
    - Implementar método `processInvoice()` que llama a `POST /api/invoices/process`
    - Implementar método `saveExtractedData()` que llama a `POST /api/invoices/save`
    - Implementar método `loadFromXML()` que llama a `GET /api/invoices/load`
    - Implementar manejo de estados de procesamiento (loading, processing, completed, error)
    - Implementar manejo de errores HTTP y display de mensajes
    - Implementar upload de archivos con FormData
    - _Requirements: 2.1, 2.2, 3.1-3.11, 6.1-6.11, 9.1, 9.2_
  
  - [x] 17.2 Implementar MainInterface component
    - Implementar método `initialize()` para inicializar interfaz principal
    - Implementar método `openExtractionView()` para abrir vista de extracción
    - Implementar método `closeExtractionView()` para cerrar vista
    - Conectar botón "Alta Facturas IA" con apertura de vista
    - _Requirements: 1.1, 1.2_

- [x] 18. Implementar integración frontend-backend
  - [x] 18.1 Conectar upload de archivos con backend
    - Implementar upload con Fetch API y FormData
    - Implementar progress indicators durante upload
    - Implementar manejo de respuestas de procesamiento
    - _Requirements: 2.1, 2.2, 2.3, 3.1-3.11_
  
  - [x] 18.2 Conectar formulario con endpoints de guardado
    - Implementar serialización de datos del formulario a JSON
    - Implementar llamada a endpoint de guardado
    - Implementar display de mensajes de éxito/error
    - Implementar display de ruta del archivo XML generado
    - _Requirements: 6.1-6.11, 10.1, 10.2_
  
  - [x] 18.3 Implementar validación en tiempo real
    - Implementar validación de campos al perder foco (blur event)
    - Implementar display de mensajes de validación inline
    - Implementar highlighting de campos con errores
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 18.4 Escribir test de propiedad para asociación documento-XML
    - **Property 23: Document-XML Association**
    - **Validates: Requirements 10.4**
    - Verificar que sistema mantiene asociación persistente entre documento y XML
  
  - [ ]* 18.5 Escribir test de propiedad para ubicación de almacenamiento XML
    - **Property 20: XML File Storage Location**
    - **Validates: Requirements 10.1**
    - Verificar que archivos XML se guardan en directorio designado
  
  - [ ]* 18.6 Escribir test de propiedad para convención de nombres XML
    - **Property 21: XML File Naming Convention**
    - **Validates: Requirements 10.2**
    - Verificar que nombres de archivo XML incluyen número de factura y timestamp

- [x] 19. Checkpoint - Verificar integración frontend-backend
  - Probar flujo completo: cargar factura → procesar → editar → guardar
  - Verificar que todos los mensajes de error se muestran correctamente
  - Verificar que la validación funciona en tiempo real
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Implementar tests de integración
  - [ ]* 20.1 Escribir tests de integración con Mindee Invoice API
    - Test de extracción con factura real (requiere credenciales)
    - Test de manejo de múltiples formatos de factura
    - Test de respeto a timeout configurado
    - _Requirements: 3.1-3.11, 7.1, 7.2_
  
  - [ ]* 20.2 Escribir tests de integración con base de datos
    - Test de guardado y recuperación de metadatos con Testcontainers
    - Test de búsqueda por número de factura
    - Test de listado de extracciones ordenadas por fecha
    - _Requirements: 10.1, 10.4, 10.5_
  
  - [ ]* 20.3 Escribir tests de integración con file system
    - Test de guardado de XML en file system
    - Test de manejo de colisiones de nombres de archivo
    - Test de listado de archivos XML
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 21. Implementar tests end-to-end
  - [ ]* 21.1 Escribir test E2E para flujo completo exitoso
    - Test de flujo: abrir interfaz → cargar factura → procesar → editar → guardar
    - Verificar que todos los pasos funcionan correctamente
    - Verificar que mensaje de éxito se muestra
    - _Requirements: 1.1-1.4, 2.1-2.5, 3.1-3.11, 4.1-4.10, 6.1-6.11_
  
  - [ ]* 21.2 Escribir test E2E para flujo con error y recuperación
    - Test de flujo: cargar factura corrupta → ver error → reintentar con factura válida
    - Verificar que usuario puede recuperarse de errores
    - _Requirements: 9.1, 9.4, 9.5_
  
  - [ ]* 21.3 Escribir test E2E para flujo con validación
    - Test de flujo: cargar factura → procesar → ingresar código postal inválido → ver warning → corregir → guardar
    - Verificar que validación funciona en tiempo real
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 22. Configurar herramientas de calidad y CI/CD
  - [ ] 22.1 Configurar JaCoCo para cobertura de código
    - Agregar plugin JaCoCo a pom.xml
    - Configurar generación de reportes de cobertura
    - Establecer meta de cobertura >80%
    - _Requirements: 8.1_
  
  - [ ] 22.2 Configurar pipeline de CI/CD
    - Crear workflow de GitHub Actions o similar
    - Configurar ejecución de tests unitarios en cada commit
    - Configurar ejecución de tests de integración en cada PR
    - Configurar generación de reportes de cobertura
    - _Requirements: 8.1_

- [ ] 23. Documentación y refinamiento final
  - [ ] 23.1 Crear documentación de API REST
    - Documentar todos los endpoints con ejemplos de request/response
    - Documentar códigos de error y mensajes
    - Documentar configuración de Mindee Invoice API
    - _Requirements: 8.4, 8.5_
  
  - [ ] 23.2 Crear guía de configuración y deployment
    - Documentar configuración de variables de entorno
    - Documentar proceso de deployment
    - Documentar configuración de base de datos PostgreSQL para producción
    - _Requirements: 8.4, 8.5_
  
  - [ ] 23.3 Refinar mensajes de error y UX
    - Revisar todos los mensajes de error para claridad
    - Asegurar que todos los mensajes son accionables
    - Verificar que la interfaz es intuitiva
    - _Requirements: 9.1, 9.2, 9.4_

- [ ] 24. Checkpoint final - Verificación completa del sistema
  - Ejecutar todos los tests (unitarios, propiedades, integración, E2E)
  - Verificar cobertura de código >80%
  - Probar flujo completo manualmente con facturas reales
  - Verificar que todos los requisitos están implementados
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- **Tareas marcadas con `*` son opcionales** y pueden omitirse para un MVP más rápido. Sin embargo, se recomienda implementarlas para garantizar la calidad del sistema.
- **Cada tarea referencia requisitos específicos** para mantener trazabilidad entre implementación y especificaciones.
- **Los checkpoints permiten validación incremental** del progreso y detección temprana de problemas.
- **Property tests validan propiedades universales** que deben mantenerse en todas las ejecuciones del sistema.
- **Unit tests validan casos específicos** y ejemplos concretos de comportamiento esperado.
- **Integration tests validan interacción** con servicios externos (Azure, base de datos, file system).
- **E2E tests validan flujos completos** de usuario desde la interfaz hasta la persistencia.

## Testing Framework Configuration

Para ejecutar los tests de propiedades, agregar la siguiente dependencia a `pom.xml`:

```xml
<dependency>
  <groupId>net.jqwik</groupId>
  <artifactId>jqwik</artifactId>
  <version>1.8.2</version>
  <scope>test</scope>
</dependency>
```

Para ejecutar tests de integración con Testcontainers:

```xml
<dependency>
  <groupId>org.testcontainers</groupId>
  <artifactId>postgresql</artifactId>
  <scope>test</scope>
</dependency>
```

## Estimated Timeline

- **Phase 1 (Tasks 1-5)**: Backend Core Infrastructure - 1 semana
- **Phase 2 (Tasks 6-9)**: Validation and XML Generation - 1 semana
- **Phase 3 (Tasks 10-13)**: REST API and Error Handling - 1 semana
- **Phase 4 (Tasks 14-19)**: Frontend Implementation - 1.5 semanas
- **Phase 5 (Tasks 20-24)**: Testing and Polish - 1.5 semanas

**Total estimado**: 6 semanas para implementación completa con todos los tests.

**MVP (sin tests opcionales)**: 3-4 semanas para funcionalidad core.
