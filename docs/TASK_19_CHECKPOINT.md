# Task 19 Checkpoint: Verificar Integración Frontend-Backend

## Objetivo
Verificar que la integración completa entre frontend y backend funciona correctamente antes de continuar con las tareas de testing.

---

## Checklist de Verificación

### 1. Flujo Completo: Cargar → Procesar → Editar → Guardar

#### 1.1 Cargar Factura
- [ ] Abrir la aplicación en `http://localhost:8080`
- [ ] Hacer clic en "Alta Facturas IA"
- [ ] Verificar que se abre el modal de extracción
- [ ] Hacer clic en "Seleccionar Archivo" o arrastrar un archivo
- [ ] Probar con PDF válido
- [ ] Probar con imagen JPEG válida
- [ ] Probar con imagen PNG válida
- [ ] Verificar que el documento se visualiza correctamente
- [ ] Verificar que el botón "Procesar con IA" se habilita

#### 1.2 Procesar con IA
- [ ] Hacer clic en "Procesar con IA"
- [ ] Verificar que aparece el spinner de procesamiento
- [ ] Verificar que los botones se deshabilitan durante el procesamiento
- [ ] Esperar a que termine el procesamiento
- [ ] Verificar que aparece el toast de éxito: "✓ Factura procesada exitosamente"
- [ ] Verificar que los campos del formulario se pueblan con datos extraídos
- [ ] Verificar que el botón "Guardar" se habilita

#### 1.3 Editar Campos
- [ ] Editar el campo "Número de Factura"
- [ ] Verificar que la validación en tiempo real funciona
- [ ] Ingresar un código postal inválido
- [ ] Verificar que aparece el warning amarillo
- [ ] Corregir el código postal
- [ ] Verificar que el warning desaparece
- [ ] Dejar un campo requerido vacío
- [ ] Verificar que aparece el warning
- [ ] Exceder la longitud máxima de un campo
- [ ] Verificar que aparece el error rojo
- [ ] Verificar que el botón "Guardar" se deshabilita con errores

#### 1.4 Guardar Datos
- [ ] Corregir todos los errores
- [ ] Hacer clic en "Guardar"
- [ ] Verificar que aparece el mensaje "Guardando..."
- [ ] Esperar a que termine el guardado
- [ ] Verificar que aparece el mensaje de éxito con la ruta del XML
- [ ] Verificar que aparece el toast: "✓ Datos guardados correctamente"
- [ ] Verificar que el archivo XML se creó en el directorio de salida

---

### 2. Mensajes de Error

#### 2.1 Error de Archivo Inválido
- [ ] Intentar cargar un archivo no soportado (ej: .docx, .txt)
- [ ] Verificar que aparece mensaje de error
- [ ] Verificar que el botón "Procesar con IA" permanece deshabilitado

#### 2.2 Error de Archivo Vacío
- [ ] Intentar procesar sin cargar archivo
- [ ] Verificar que aparece mensaje: "No hay documento cargado para procesar"

#### 2.3 Error de Procesamiento
- [ ] Simular error de backend (detener el servidor)
- [ ] Intentar procesar una factura
- [ ] Verificar que aparece mensaje de error de red
- [ ] Verificar que el spinner desaparece
- [ ] Verificar que los botones se rehabilitan

#### 2.4 Error de Guardado
- [ ] Simular error de backend (detener el servidor)
- [ ] Intentar guardar datos
- [ ] Verificar que aparece mensaje de error
- [ ] Verificar que el status de guardado muestra "✗ Error al guardar"

#### 2.5 Error de Validación
- [ ] Ingresar datos inválidos en múltiples campos
- [ ] Intentar guardar
- [ ] Verificar que aparece el toast: "Por favor corrija los errores antes de guardar"
- [ ] Verificar que el resumen de validación muestra todos los errores

---

### 3. Validación en Tiempo Real

#### 3.1 Validación de Campos Requeridos
- [ ] Dejar vacío "Tipo de Documento"
- [ ] Hacer blur (salir del campo)
- [ ] Verificar que aparece warning amarillo
- [ ] Verificar mensaje: "Tipo de Documento es requerido"
- [ ] Ingresar valor
- [ ] Verificar que el warning desaparece y aparece borde verde

#### 3.2 Validación de Longitud Máxima
- [ ] Ingresar más de 50 caracteres en "Número de Factura"
- [ ] Verificar que aparece error rojo
- [ ] Verificar mensaje: "Excede 50 caracteres (actual: X)"
- [ ] Reducir a menos de 50 caracteres
- [ ] Verificar que el error desaparece

#### 3.3 Validación de Código Postal
- [ ] Seleccionar país "España"
- [ ] Ingresar código postal "ABC123"
- [ ] Verificar warning: "Formato no válido para España"
- [ ] Ingresar código postal válido "28001"
- [ ] Verificar que el warning desaparece
- [ ] Cambiar país a "Estados Unidos"
- [ ] Ingresar "12345"
- [ ] Verificar que es válido
- [ ] Ingresar "12345-6789"
- [ ] Verificar que es válido

#### 3.4 Validación de País
- [ ] Ingresar país no reconocido "Atlantis"
- [ ] Verificar warning: "País no reconocido"
- [ ] Ingresar país válido "España"
- [ ] Verificar que el warning desaparece

#### 3.5 Estado del Botón Guardar
- [ ] Con errores rojos → Botón deshabilitado
- [ ] Con warnings amarillos → Botón habilitado
- [ ] Sin errores ni warnings → Botón habilitado
- [ ] Formulario vacío → Botón deshabilitado (por campos requeridos)

---

### 4. Funcionalidad de Botones

#### 4.1 Botón "Procesar con IA"
- [ ] Deshabilitado al inicio
- [ ] Habilitado después de cargar documento
- [ ] Deshabilitado durante procesamiento
- [ ] Habilitado después de procesamiento exitoso
- [ ] Habilitado después de error de procesamiento

#### 4.2 Botón "Guardar"
- [ ] Deshabilitado al inicio
- [ ] Habilitado después de procesamiento exitoso
- [ ] Deshabilitado durante guardado
- [ ] Habilitado después de guardado exitoso
- [ ] Deshabilitado con errores de validación
- [ ] Habilitado con warnings de validación

#### 4.3 Botón "Limpiar"
- [ ] Limpia todos los campos del formulario
- [ ] Limpia el visor de documentos
- [ ] Limpia mensajes de validación
- [ ] Oculta el resumen de validación
- [ ] Deshabilita el botón "Guardar"

#### 4.4 Botón "Cerrar" (×)
- [ ] Cierra el modal de extracción
- [ ] Pregunta confirmación si hay datos sin guardar (opcional)

---

### 5. Integración con Backend

#### 5.1 Endpoint POST /api/invoices/process
- [ ] Verificar que se envía FormData con el archivo
- [ ] Verificar que el Content-Type es multipart/form-data
- [ ] Verificar que la respuesta es InvoiceDataDTO en JSON
- [ ] Verificar que los datos se mapean correctamente al formulario

#### 5.2 Endpoint POST /api/invoices/save
- [ ] Verificar que se envía JSON con los datos del formulario
- [ ] Verificar que se incluye el parámetro originalFileName
- [ ] Verificar que la respuesta es SaveResultDTO
- [ ] Verificar que se muestra la ruta del XML generado

#### 5.3 Manejo de Errores HTTP
- [ ] 400 Bad Request → Mensaje de error descriptivo
- [ ] 500 Internal Server Error → Mensaje de error genérico
- [ ] Network Error → Mensaje de error de conexión
- [ ] Timeout → Mensaje de timeout

---

### 6. Experiencia de Usuario

#### 6.1 Feedback Visual
- [ ] Spinners durante operaciones largas
- [ ] Toast notifications para eventos importantes
- [ ] Mensajes de status persistentes
- [ ] Indicadores de validación en campos
- [ ] Resumen de validación visible

#### 6.2 Mensajes Claros
- [ ] Mensajes de éxito son positivos y claros
- [ ] Mensajes de error son descriptivos y accionables
- [ ] Mensajes de warning son informativos
- [ ] Mensajes en español correcto

#### 6.3 Responsividad
- [ ] La interfaz responde rápidamente a las acciones
- [ ] No hay bloqueos de UI durante operaciones
- [ ] Los botones se deshabilitan apropiadamente
- [ ] Los spinners aparecen inmediatamente

---

## Comandos de Verificación

### Iniciar la Aplicación
```bash
# Windows
run.bat

# Linux/Mac
./run.sh
```

### Verificar Logs del Backend
```bash
# Buscar errores en la consola
# Verificar que no hay excepciones no manejadas
# Verificar que los endpoints responden correctamente
```

### Verificar Archivos XML Generados
```bash
# Windows
dir output\xml

# Linux/Mac
ls -la output/xml
```

---

## Criterios de Éxito

Para considerar el checkpoint como exitoso, TODOS los siguientes criterios deben cumplirse:

✅ **Flujo Completo Funciona**
- El usuario puede cargar, procesar, editar y guardar una factura sin errores

✅ **Validación Funciona**
- La validación en tiempo real detecta errores y warnings correctamente
- Los mensajes de validación son claros y precisos
- El botón "Guardar" se habilita/deshabilita correctamente

✅ **Manejo de Errores Funciona**
- Todos los tipos de errores se manejan apropiadamente
- Los mensajes de error son descriptivos y accionables
- La aplicación se recupera de errores sin necesidad de recargar

✅ **Integración Backend Funciona**
- Todos los endpoints responden correctamente
- Los datos se envían y reciben en el formato correcto
- Los archivos XML se generan y guardan correctamente

✅ **Experiencia de Usuario es Buena**
- La interfaz es intuitiva y fácil de usar
- El feedback visual es claro y oportuno
- No hay comportamientos inesperados o confusos

---

## Problemas Conocidos

### Problemas a Resolver
- [ ] Ninguno identificado aún

### Mejoras Futuras (No Bloqueantes)
- [ ] Agregar progress bar para uploads grandes
- [ ] Implementar confirmación antes de limpiar formulario con datos
- [ ] Agregar funcionalidad de "Cargar desde XML" en la UI
- [ ] Implementar retry automático en caso de error de red

---

## Resultado del Checkpoint

**Fecha**: _____________________

**Resultado**: [ ] ✅ APROBADO  [ ] ❌ RECHAZADO

**Problemas Encontrados**:
- 
- 
- 

**Acciones Correctivas**:
- 
- 
- 

**Notas Adicionales**:


---

## Siguiente Paso

Una vez completado este checkpoint exitosamente, proceder con:
- **Task 20**: Implementar tests de integración (opcional)
- **Task 21**: Implementar tests end-to-end (opcional)
- **Task 22**: Configurar herramientas de calidad y CI/CD
- **Task 23**: Documentación y refinamiento final
- **Task 24**: Checkpoint final - Verificación completa del sistema
