# MEMORIA DEL PROYECTO: Facturas GForma

**PORTADA**
- **Título:** Sistema de Extracción Automática de Facturas con IA (Facturas GForma)
- **Autor/a:** [Tu Nombre/Apellido]
- **Ciclo/curso:** 2º DAM (Curso 2025/26)
- **Empresa:** Inteco Ingeniería Avanzada SL
- **Tecnologías principales:** Node.js, Electron, Mindee API, Microsoft SQL Server, Jest

---

## RESUMEN (Abstract)

"Facturas GForma" es una aplicación de escritorio multiplataforma desarrollada con **Electron y Node.js** para automatizar el registro y procesamiento de facturas de proveedores. Está dirigida a departamentos de administración de empresas formativas y resuelve el problema del ingreso manual de datos, propenso a errores y tiempo-intensivo, mediante IA.

**Funcionalidades clave:**
1. Autenticación y control de acceso multiusuario con **sistema de roles** (Administrador / Contable).
2. Extracción automática de datos de facturas (importes, IVA, CIF, líneas de concepto) via **Mindee API**.
3. Verificación, edición y persistencia transaccional segura en **SQL Server**.
4. Generación de vencimientos y gestión de pagos.
5. Exportación a **XML** estándar y **CSV** desde el dashboard.
6. **Consultas estadísticas avanzadas**: ranking de proveedores y evolución mensual de gasto.
7. Suite de **9 pruebas unitarias automatizadas** con Jest.

---

## 1. Motivación e introducción

### 1.1 Motivación
La gestión administrativa de facturas de proveedores es un proceso repetitivo y crítico en cualquier empresa. El personal debe leer cada factura, localizar al proveedor y registrar manualmente conceptos, bases imponibles y cuotas de IVA. Esto genera cuellos de botella y errores humanos. Este proyecto nace para automatizar ese flujo mediante IA.

### 1.2 Objetivos propuestos
- **General:** Desarrollar un sistema de escritorio completo para la gestión automatizada de facturas.
- **Específicos:**
  1. Integrar la API de OCR/IA Mindee con alta precisión de extracción.
  2. Implementar una base de datos relacional robusta en SQL Server con transacciones.
  3. Incorporar un sistema de roles (Administrador y Contable) con autorización diferenciada.
  4. Generar consultas SQL complejas con rankings, agrupaciones y estadísticas.
  5. Cubrir la lógica de negocio con 9 pruebas unitarias automáticas con Jest.

---

## 2. Metodología, recursos y planificación

### 2.1 Metodología
Se siguió una metodología ágil iterativa e incremental con los siguientes sprints principales:
- **Sprint 1:** Arquitectura Electron, sistema de login y configuración de conexión SQL.
- **Sprint 2:** Integración Mindee, parseo de facturas y persistencia transaccional.
- **Sprint 3:** Dashboard, estadísticas, sistema de roles y suite de pruebas.

### 2.2 Recursos
- **Hardware:** PC Windows con SQL Server local para desarrollo y pruebas.
- **Software:** Visual Studio Code, SQL Server Management Studio, Node.js, Git, GitHub.
- **APIs externas:** Mindee API (Invoice OCR / DocTI).

---

## 3. Tecnologías y herramientas

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 18+ | Entorno de ejecución backend |
| Electron | 41.x | Framework de escritorio (Main + Renderer) |
| SQL Server (mssql) | 12.x | Persistencia de datos relacional |
| Mindee SDK | 5.x | Extracción IA de facturas |
| xml2js | 0.6.x | Generación y parseo de XML |
| dotenv | 17.x | Gestión segura de variables de entorno |
| Jest | 30.x | Framework de pruebas unitarias |
| Chart.js | 4.x | Visualización de estadísticas en el dashboard |

---

## 4. Análisis

### 4.1 Requisitos funcionales
- **RF-01:** El sistema debe autenticar usuarios y verificar su identidad contra la BD o Windows.
- **RF-02:** El sistema debe asignar roles (Administrador / Contable) y limitar acciones según el rol.
- **RF-03:** El sistema debe procesar PDFs/imágenes y devolver campos extraídos por IA.
- **RF-04:** El sistema debe persistir facturas, líneas y vencimientos en una transacción atómica.
- **RF-05:** El sistema debe generar estadísticas: ranking de proveedores y evolución mensual.
- **RF-06:** El sistema debe exportar datos a XML estándar y CSV desde el dashboard.

### 4.2 Requisitos no funcionales
- **RNF-01:** Las credenciales y claves API deben manejarse mediante variables de entorno (`.env`).
- **RNF-02:** La interfaz debe responder sin bloqueos usando operaciones asíncronas.
- **RNF-03:** El sistema debe tolerar fallos de red sin romper la sesión del usuario.

### 4.3 Modelo de datos (Entidad-Relación)

```
[Sociedades] 1 ─── N [FacturasProveedores]
                           │
                    N ────────── 1 [gf_Proveedores]
                           │
              ┌────────────┤
              │            │
              ▼            ▼
[FP_Lineas]          [FP_Vencimientos]
```

**Tablas principales:**
- **Sociedades:** Empresa que registra las facturas.
- **gf_Proveedores:** Emisores de facturas (nombre, CIF, dirección).
- **FacturasProveedores:** Cabecera (totales, fechas, tipo). Clave FK a Sociedad y Proveedor.
- **FacturasProveedores_Lineas:** Detalle de conceptos (precio, cantidad, %IVA por línea).
- **FacturasProveedores_Vencimientos:** Pagos y cuotas por factura.

---

## 5. Diseño

### 5.1 Arquitectura de la aplicación

La aplicación sigue la arquitectura **Main Process / Renderer Process** de Electron, con comunicación segura mediante **IPC (Inter-Process Communication)**:

```
┌─────────────────────────────────────────┐
│           RENDERER PROCESS              │
│  (HTML + CSS + JS — interfaz gráfica)   │
│                                         │
│  index.html ──── js/main.js (roles)     │
│  js/facturas-proveedor.js (listado)     │
│  js/dashboard.js (estadísticas)         │
└──────────────────┬──────────────────────┘
                   │ IPC / contextBridge (preload.js)
┌──────────────────▼──────────────────────┐
│           MAIN PROCESS (Node.js)        │
│                                         │
│  main.js ──── IPC Handlers              │
│  services/mindee-service.js (IA)        │
│  services/sql-service.js (BD)           │
│  services/xml-service.js (Export)       │
│  database/db.js (Autenticación + Pool)  │
└──────────────────┬──────────────────────┘
                   │
       ┌───────────▼──────────┐
       │   SQL Server (mssql)  │
       │   Mindee API (Cloud)  │
       └───────────────────────┘
```

### 5.2 Sistema de roles implementado

Se implementó un sistema de **autorización basado en roles** sobre el campo `IdTipoIdentidad` de la sesión:

| Rol | Permisos |
|---|---|
| **Administrador** | Acceso total: eliminar facturas, cambiar configuración BD, ver todos los datos |
| **Contable** | Alta de facturas vía IA, consulta y filtrado del listado, ver dashboard |

La autorización se aplica en tiempo de ejecución en `js/main.js` (método `applyRolePermissions()`): los botones de acciones destructivas se ocultan en el DOM para usuarios con rol *Contable*.

### 5.3 Decisiones de diseño importantes

1. **IPC con Context Bridge:** Se usa `contextIsolation: true` + `preload.js` como puente de seguridad, evitando exponer Node.js directamente al Renderer.
2. **Transacciones SQL:** En `saveInvoiceDB()`, el insert de cabecera, líneas y vencimientos se ejecuta dentro de `mssql.Transaction` con rollback automático en caso de error.
3. **Pool de conexiones Singleton:** `database/db.js` implementa un pool singleton con reconexión automática.
4. **Deduplicación de procesamiento:** En `main.js`, el `Map pendingInvoices` evita procesar el mismo PDF dos veces de forma concurrente.

---

## 6. Implementación

### 6.1 Estructura del proyecto

```
Facturas GForma/
├── database/
│   ├── db.js          # Pool singleton, autenticación, roles, gestión Config.xml
│   ├── schema.sql     # Definición de tablas
│   └── seed.sql       # Datos de prueba reproducibles
├── services/
│   ├── mindee-service.js    # Integración IA: extracción de campos + post-procesado
│   ├── sql-service.js       # Persistencia, consultas avanzadas, estadísticas
│   └── xml-service.js       # Exportación / importación de XML
├── js/
│   ├── main.js              # MainInterface + sistema de roles (applyRolePermissions)
│   ├── facturas-proveedor.js # Listado de facturas, filtros, paginación
│   └── dashboard.js         # Gráficos y estadísticas con Chart.js
├── tests/
│   └── invoice-logic.test.js # 9 pruebas unitarias (Jest)
├── views/               # HTML de vistas (login, conexión, extracción)
├── main.js              # Punto de entrada Electron + todos los IPC Handlers
├── preload.js           # Context Bridge (puente seguro Main ↔ Renderer)
└── .env.example         # Plantilla segura de variables de entorno
```

### 6.2 Consultas SQL avanzadas (no triviales)

Se han implementado dos consultas estadísticas complejas en `services/sql-service.js`:

**`getRankingProveedores()`** — usa `RANK() OVER`, `GROUP BY`, `SUM`, `COUNT`, `AVG` sobre múltiples tablas:
```sql
SELECT TOP 10
    p.RazonSocial AS proveedor,
    COUNT(fp.idFacturaProveedor) AS numFacturas,
    SUM(fp.Total_con_IVA) AS totalFacturado,
    RANK() OVER (ORDER BY SUM(fp.Total_con_IVA) DESC) AS posicion
FROM dbo.FacturasProveedores fp
INNER JOIN dbo.gf_Proveedores p ON p.IdProveedor = fp.idProveedor
GROUP BY p.RazonSocial, p.Documento
ORDER BY totalFacturado DESC
```

**`getEstadisticasMensuales()`** — usa `DATEPART`, `DATENAME`, `GROUP BY` temporal y múltiples agregaciones:
```sql
SELECT DATEPART(MONTH, fp.FechaEntrada) AS mes,
       COUNT(*) AS numFacturas, SUM(fp.Total_con_IVA) AS totalFacturado,
       AVG(fp.Total_con_IVA) AS mediaFactura,
       MAX(fp.Total_con_IVA) AS maxFactura
FROM dbo.FacturasProveedores fp
GROUP BY DATEPART(YEAR,...), DATEPART(MONTH,...), DATENAME(MONTH,...)
ORDER BY anio, mes
```

### 6.3 Dificultades encontradas y soluciones

- **Problema:** La carga asíncrona de PDFs bloqueaba el hilo de la UI.
  **Solución:** Todas las llamadas IPC usan `async/await` y se ejecutan en el Main Process.
- **Problema:** Mindee devolvía el CIF del emisor mezclado con el del receptor.
  **Solución:** Post-procesado en `mindee-service.js` con regex y lista de CIFs excluidos.
- **Problema:** Múltiples clics en "Procesar" lanzaban llamadas duplicadas a la API.
  **Solución:** `Map<filePath, Promise>` en `main.js` deduplica peticiones concurrentes.

---

## 7. Multiusuario concurrente

La aplicación soporta múltiples usuarios de forma real:

- **Autenticación centralizada:** Se autentica contra el procedimiento almacenado `SeguridadUnificada_Identidad_Select` en SQL Server, o mediante el usuario Windows activo (`checkWindowsUser()`).
- **Roles diferenciados:** El campo `IdTipoIdentidad` de la sesión determina si el usuario es *Administrador* o *Contable*, restringiendo dinámicamente los permisos en la UI.
- **Pool de conexiones compartido:** `mssql` gestiona un pool de hasta 10 conexiones simultáneas, permitiendo que múltiples usuarios trabajen en paralelo sin bloqueos.
- **Transacciones atómicas:** Cada guardado de factura es una transacción SQL independiente; si un usuario falla, no afecta a otros.
- **Tolerancia a fallos de red:** El error `ECONNREFUSED` se intercepta y muestra un mensaje amigable sin cerrar la sesión.

---

## 8. Despliegue e instalación

### 8.1 Requisitos previos
- Node.js v18 o superior
- Microsoft SQL Server con la base de datos `GestionFormacion`
- Cuenta en Mindee con API Key y Model ID

### 8.2 Instalación
```bash
git clone <repositorio>
npm install
cp .env.example .env   # Editar con credenciales reales
npm start
```

### 8.3 Datos de ejemplo
Ejecutar `database/seed.sql` en SQL Server Management Studio para poblar sociedades y proveedores de prueba.

### 8.4 Compilar instalador
```bash
npm run dist   # Genera FacturasGForma_Setup_1.0.0.exe en /dist
```

---

## 9. Pruebas

### 9.1 Pruebas unitarias automatizadas (Jest)

Se han implementado **9 pruebas unitarias** en `tests/invoice-logic.test.js` usando el framework **Jest 30**. Se ejecutan con `npm test` y no requieren conexión a base de datos ni API.

```
PASS tests/invoice-logic.test.js
  Cálculos de IVA y totales
    ✓ TC-01: Calcula correctamente base, IVA y total con tipo 21% (14ms)
    ✓ TC-02: Mezcla de líneas con IVA 21%, 10% y exento (0%)
    ✓ TC-03: Línea con importe 0 no altera el total
  Detección tipo de documento fiscal (NIF/CIF/DNI)
    ✓ TC-04: Identifica correctamente un CIF de empresa española
    ✓ TC-05: Identifica DNI, NIE y devuelve "Otros" para formatos desconocidos
  Limpieza de CIF (post-procesado Mindee)
    ✓ TC-06: Elimina etiquetas y caracteres no alfanuméricos del CIF
  Validación de datos de factura antes de guardar
    ✓ TC-07: Detecta todos los errores en una factura incompleta
    ✓ TC-07b: Una factura completa y válida no genera errores
  Mapeo de porcentaje IVA a ID en la base de datos
    ✓ TC-08: Asigna los IDs de IVA correctos según el porcentaje

Tests: 9 passed, 9 total — Time: 1.023s
```

### 9.2 Tabla de casos de prueba funcionales (manuales)

| ID | Acción | Resultado Esperado |
|---|---|---|
| FT-01 | Login con credenciales válidas como Administrador | Acceso total; botón "Eliminar Factura" visible |
| FT-02 | Login con credenciales de Contable | Botón "Eliminar Factura" oculto; badge de rol visible |
| FT-03 | Login con contraseña errónea | Mensaje: "Usuario o contraseña incorrectos" |
| FT-04 | Cargar PDF de factura válido | Campos rellenados automáticamente por Mindee IA |
| FT-05 | Guardar factura con datos completos | Factura insertada en BD; generación de XML |
| FT-06 | Abrir Dashboard con datos | Ranking de proveedores y gráfico mensual visibles |
| FT-07 | Ejecutar `npm test` | 9/9 pruebas en verde en 1 segundo |
| FT-08 | Servidor BD apagado durante uso | Error controlado `ECONNREFUSED` sin cierre forzado |

---

## 10. Resultados, conclusiones y vías futuras

### 10.1 Objetivos alcanzados
- Flujo completo de extracción IA → edición → guardado transaccional en BD.
- Sistema de roles Administrador/Contable funcional y verificable en ejecución.
- Consultas SQL con `RANK()`, agrupaciones temporales y estadísticas avanzadas.
- 9 pruebas unitarias automatizadas que ejecutan en 1 segundo sin dependencias externas.
- Documentación coherente con el código real del repositorio.

### 10.2 Conclusiones
El proyecto demuestra cómo un backend Node.js embebido en Electron puede ser tan robusto y testeable como cualquier backend REST convencional. Se ha aprendido a estructurar código asíncrono complejo, a diseñar APIs IPC seguras con el patrón Context Bridge, y a integrar servicios cloud de IA en aplicaciones de escritorio.

### 10.3 Vías futuras
- Añadir autenticación OAuth para integración con el ERP corporativo.
- Implementar notificaciones push de vencimientos próximos.
- Sincronización en tiempo real entre usuarios vía WebSockets.
- Módulo de reporting avanzado con exportación a Excel.
