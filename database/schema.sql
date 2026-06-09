-- ============================================================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS E INICIALIZACIÓN
-- Proyecto: Facturas GForma
-- Compatible con: Microsoft SQL Server (2016 o superior)
-- ============================================================================

USE [master];
GO

-- 1. CREACIÓN DE LA BASE DE DATOS (si no existe)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'GestionFormacion')
BEGIN
    CREATE DATABASE [GestionFormacion];
    PRINT 'Base de datos [GestionFormacion] creada.';
END
ELSE
BEGIN
    PRINT 'La base de datos [GestionFormacion] ya existe.';
END
GO

-- ============================================================================
-- 2. CREACIÓN DE LOGINS DE SERVIDOR (Si no existen)
-- Requerido por la aplicación Electron en database/db.js
-- ============================================================================

-- Login para operaciones habituales (SERVICE_USER)
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = N'us_AccesoTotal')
BEGIN
    CREATE LOGIN [us_AccesoTotal] WITH PASSWORD = N'us_Ilimitado', DEFAULT_DATABASE = [GestionFormacion], CHECK_EXPIRATION = OFF, CHECK_POLICY = OFF;
    PRINT 'Login de servidor [us_AccesoTotal] creado.';
END
ELSE
BEGIN
    PRINT 'El login de servidor [us_AccesoTotal] ya existe.';
END
GO

-- Login para tests de conexión (TEST_USER)
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = N'us_limitado_tareasYpresencia')
BEGIN
    CREATE LOGIN [us_limitado_tareasYpresencia] WITH PASSWORD = N'uslimitado', DEFAULT_DATABASE = [GestionFormacion], CHECK_EXPIRATION = OFF, CHECK_POLICY = OFF;
    PRINT 'Login de servidor [us_limitado_tareasYpresencia] creado.';
END
ELSE
BEGIN
    PRINT 'El login de servidor [us_limitado_tareasYpresencia] ya existe.';
END
GO


USE [GestionFormacion];
GO

-- Habilitar integridad referencial y desactivar recuentos innecesarios
SET NOCOUNT ON;
GO

-- ============================================================================
-- 3. CREACIÓN DE USUARIOS DE BASE DE DATOS Y PERMISOS
-- ============================================================================

-- Mapear y conceder permisos a 'us_AccesoTotal' (Propietario / Acceso total)
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'us_AccesoTotal')
BEGIN
    CREATE USER [us_AccesoTotal] FOR LOGIN [us_AccesoTotal];
    ALTER ROLE [db_owner] ADD MEMBER [us_AccesoTotal];
    PRINT 'Usuario de base de datos [us_AccesoTotal] creado y asignado como db_owner.';
END
ELSE
BEGIN
    PRINT 'El usuario de base de datos [us_AccesoTotal] ya existe.';
END
GO

-- Mapear y conceder permisos a 'us_limitado_tareasYpresencia' (Lectura, escritura y ejecución)
IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = N'us_limitado_tareasYpresencia')
BEGIN
    CREATE USER [us_limitado_tareasYpresencia] FOR LOGIN [us_limitado_tareasYpresencia];
    ALTER ROLE [db_datareader] ADD MEMBER [us_limitado_tareasYpresencia];
    ALTER ROLE [db_datawriter] ADD MEMBER [us_limitado_tareasYpresencia];
    GRANT EXECUTE TO [us_limitado_tareasYpresencia];
    PRINT 'Usuario de base de datos [us_limitado_tareasYpresencia] creado con permisos de lectura, escritura y ejecución.';
END
ELSE
BEGIN
    PRINT 'El usuario de base de datos [us_limitado_tareasYpresencia] ya existe.';
END
GO


-- ============================================================================
-- 4. ELIMINACIÓN DE TABLAS Y PROCEDIMIENTOS PREVIOS (Para recrear limpiamente)
-- ============================================================================

-- Procedimientos Almacenados
IF OBJECT_ID('dbo.SeguridadUnificada_Identidad_Select', 'P') IS NOT NULL
    DROP PROCEDURE dbo.SeguridadUnificada_Identidad_Select;
IF OBJECT_ID('dbo.up_gf_Proveedores_Insert', 'P') IS NOT NULL
    DROP PROCEDURE dbo.up_gf_Proveedores_Insert;
GO

-- Tablas hijas de FacturasProveedores y dependencias de borrado
IF OBJECT_ID('dbo.Transacciones', 'U') IS NOT NULL
    DROP TABLE dbo.Transacciones;
IF OBJECT_ID('dbo.Remesas_Domiciliaciones', 'U') IS NOT NULL
    DROP TABLE dbo.Remesas_Domiciliaciones;
IF OBJECT_ID('dbo.Anticipos', 'U') IS NOT NULL
    DROP TABLE dbo.Anticipos;
IF OBJECT_ID('dbo.gf_CursosDocentes', 'U') IS NOT NULL
    DROP TABLE dbo.gf_CursosDocentes;
IF OBJECT_ID('dbo.FacturasClientes_FacturasProveedores', 'U') IS NOT NULL
    DROP TABLE dbo.FacturasClientes_FacturasProveedores;
IF OBJECT_ID('dbo.gf_FacturasCostesAsociados', 'U') IS NOT NULL
    DROP TABLE dbo.gf_FacturasCostesAsociados;
IF OBJECT_ID('dbo.gf_FacturasCostesDirectos', 'U') IS NOT NULL
    DROP TABLE dbo.gf_FacturasCostesDirectos;
IF OBJECT_ID('dbo.gf_FacturasOtrosCostesSubvencionables', 'U') IS NOT NULL
    DROP TABLE dbo.gf_FacturasOtrosCostesSubvencionables;
IF OBJECT_ID('dbo.gf_JustificacionFacturasCostes', 'U') IS NOT NULL
    DROP TABLE dbo.gf_JustificacionFacturasCostes;
IF OBJECT_ID('dbo.FacturasProveedores_Lineas', 'U') IS NOT NULL
    DROP TABLE dbo.FacturasProveedores_Lineas;
IF OBJECT_ID('dbo.FacturasProveedores_Vencimientos', 'U') IS NOT NULL
    DROP TABLE dbo.FacturasProveedores_Vencimientos;
GO

-- Tablas principales de facturación
IF OBJECT_ID('dbo.FacturasProveedores', 'U') IS NOT NULL
    DROP TABLE dbo.FacturasProveedores;
IF OBJECT_ID('dbo.gf_Proveedores', 'U') IS NOT NULL
    DROP TABLE dbo.gf_Proveedores;
IF OBJECT_ID('dbo.Sociedades', 'U') IS NOT NULL
    DROP TABLE dbo.Sociedades;
IF OBJECT_ID('dbo.Facturas_Tipos', 'U') IS NOT NULL
    DROP TABLE dbo.Facturas_Tipos;
GO

-- Tablas de localización
IF OBJECT_ID('dbo.CodigosPostales', 'U') IS NOT NULL
    DROP TABLE dbo.CodigosPostales;
IF OBJECT_ID('dbo.Localidades', 'U') IS NOT NULL
    DROP TABLE dbo.Localidades;
IF OBJECT_ID('dbo.Provincias', 'U') IS NOT NULL
    DROP TABLE dbo.Provincias;
GO

-- Tablas de Mindee e Inteligencia Artificial
IF OBJECT_ID('dbo.MindeeAPIKey', 'U') IS NOT NULL
    DROP TABLE dbo.MindeeAPIKey;
IF OBJECT_ID('dbo.MindeeModelID', 'U') IS NOT NULL
    DROP TABLE dbo.MindeeModelID;
IF OBJECT_ID('dbo.MindeeCuentas', 'U') IS NOT NULL
    DROP TABLE dbo.MindeeCuentas;
GO

-- Tablas de Seguridad
IF OBJECT_ID('dbo.Seguridad_Usuarios', 'U') IS NOT NULL
    DROP TABLE dbo.Seguridad_Usuarios;
IF OBJECT_ID('dbo.Seguridad_RolesUsuarios', 'U') IS NOT NULL
    DROP TABLE dbo.Seguridad_RolesUsuarios;
IF OBJECT_ID('dbo.Auditoria_Acciones', 'U') IS NOT NULL
    DROP TABLE dbo.Auditoria_Acciones;
GO


-- ============================================================================
-- 5. CREACIÓN DE TABLAS
-- ============================================================================

-- TABLA: Seguridad_Usuarios (Para autenticación del sistema)
CREATE TABLE dbo.Seguridad_Usuarios (
    IdIdentidad INT IDENTITY(1,1) PRIMARY KEY,
    Usuario NVARCHAR(200) NOT NULL UNIQUE,
    Contrasena NVARCHAR(200) NOT NULL, -- En producción debe almacenarse como Hash
    NombreCompleto NVARCHAR(200) NOT NULL,
    Activo BIT NOT NULL DEFAULT 1
);
PRINT 'Tabla [dbo.Seguridad_Usuarios] creada.';

-- TABLA: Seguridad_RolesUsuarios (Rol fijo por usuario)
CREATE TABLE dbo.Seguridad_RolesUsuarios (
    IdRolUsuario INT IDENTITY(1,1) PRIMARY KEY,
    Usuario NVARCHAR(200) NOT NULL UNIQUE,
    Rol NVARCHAR(50) NOT NULL,
    Activo BIT NOT NULL DEFAULT 1,
    FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
PRINT 'Tabla [dbo.Seguridad_RolesUsuarios] creada.';

-- TABLA: Auditoria_Acciones (Registro de actividad del sistema)
CREATE TABLE dbo.Auditoria_Acciones (
    IdAuditoria INT IDENTITY(1,1) PRIMARY KEY,
    FechaHora DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    Usuario NVARCHAR(200) NOT NULL,
    Rol NVARCHAR(50) NOT NULL,
    Accion NVARCHAR(100) NOT NULL,
    Entidad NVARCHAR(100) NULL,
    Detalle NVARCHAR(4000) NULL,
    Resultado NVARCHAR(20) NOT NULL DEFAULT 'OK'
);
CREATE INDEX IX_Auditoria_Acciones_FechaHora
    ON dbo.Auditoria_Acciones (FechaHora DESC);
PRINT 'Tabla [dbo.Auditoria_Acciones] creada.';

-- TABLA: Sociedades (Empresas del grupo receptoras de facturas)
CREATE TABLE dbo.Sociedades (
    idSociedad INT IDENTITY(1,1) PRIMARY KEY,
    RazonSocial VARCHAR(200) NOT NULL
);
PRINT 'Tabla [dbo.Sociedades] creada.';

-- TABLA: Provincias (Provincias de España)
CREATE TABLE dbo.Provincias (
    IdProvincia INT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL,
    Codigo VARCHAR(10) NULL
);
PRINT 'Tabla [dbo.Provincias] creada.';

-- TABLA: Localidades (Municipios / Ciudades)
CREATE TABLE dbo.Localidades (
    IdLocalidad INT PRIMARY KEY,
    Nombre VARCHAR(150) NOT NULL
);
PRINT 'Tabla [dbo.Localidades] creada.';

-- TABLA: CodigosPostales (Códigos postales asociados a localidades)
CREATE TABLE dbo.CodigosPostales (
    IdLocalidad INT NOT NULL,
    Codigo VARCHAR(10) NOT NULL,
    CONSTRAINT PK_CodigosPostales PRIMARY KEY (IdLocalidad, Codigo),
    CONSTRAINT FK_CodigosPostales_Localidades FOREIGN KEY (IdLocalidad) REFERENCES dbo.Localidades(IdLocalidad) ON DELETE CASCADE
);
PRINT 'Tabla [dbo.CodigosPostales] creada.';

-- TABLA: gf_Proveedores (Datos fiscales y comerciales de proveedores)
CREATE TABLE dbo.gf_Proveedores (
    IdProveedor INT IDENTITY(1,1) PRIMARY KEY,
    IdTipoDocumento INT NULL DEFAULT 1, -- 1=NIF/CIF, 2=DNI, etc.
    Documento VARCHAR(50) NULL UNIQUE, -- CIF o NIF del proveedor
    IdTipo INT NULL,                   -- Tipo de proveedor
    RazonSocial VARCHAR(200) NOT NULL, -- Nombre legal
    NombreComercial VARCHAR(200) NULL,
    PersonaContacto VARCHAR(100) NULL,
    Responsable VARCHAR(100) NULL,
    Direccion VARCHAR(200) NULL,
    IdPais INT NULL DEFAULT 73,        -- 73 = España por defecto
    CodigoPostal VARCHAR(50) NULL,
    IdProvincia INT NULL,
    Poblacion VARCHAR(100) NULL,
    Observaciones VARCHAR(MAX) NULL,
    IdIdentidad INT NULL,
    CONSTRAINT FK_gf_Proveedores_Provincias FOREIGN KEY (IdProvincia) REFERENCES dbo.Provincias(IdProvincia)
);
CREATE INDEX IX_gf_Proveedores_Documento ON dbo.gf_Proveedores(Documento);
PRINT 'Tabla [dbo.gf_Proveedores] creada.';

-- TABLA: Facturas_Tipos (Tipo de facturas)
CREATE TABLE dbo.Facturas_Tipos (
    IdFacturaTipo INT PRIMARY KEY,
    Nombre VARCHAR(100) NOT NULL
);
PRINT 'Tabla [dbo.Facturas_Tipos] creada.';

-- TABLA: FacturasProveedores (Cabecera de Facturas Recibidas)
CREATE TABLE dbo.FacturasProveedores (
    idFacturaProveedor INT IDENTITY(1,1) PRIMARY KEY,
    idSociedad INT NOT NULL,
    idProveedor INT NULL,
    NumFactuProv VARCHAR(50) NOT NULL, -- Número de factura del proveedor
    NumFactura INT NULL,              -- Número correlativo interno de la empresa
    Fecha SMALLDATETIME NOT NULL,      -- Fecha de emisión
    Concepto VARCHAR(300) NULL,
    Observaciones VARCHAR(MAX) NULL,
    BaseImponible MONEY NULL DEFAULT 0,
    IVA MONEY NULL DEFAULT 0,
    Total_con_IVA MONEY NULL DEFAULT 0,
    FechaEntrada SMALLDATETIME DEFAULT GETDATE(), -- Fecha de imputación/registro
    Validado TINYINT DEFAULT 0,       -- 0 = Borrador, 1 = Validado/Contabilizado
    idFacturaTipo INT NULL,
    CONSTRAINT FK_FacturasProveedores_Sociedades FOREIGN KEY (idSociedad) REFERENCES dbo.Sociedades(idSociedad) ON DELETE CASCADE,
    CONSTRAINT FK_FacturasProveedores_Proveedores FOREIGN KEY (idProveedor) REFERENCES dbo.gf_Proveedores(IdProveedor) ON DELETE SET NULL,
    CONSTRAINT FK_FacturasProveedores_Tipos FOREIGN KEY (idFacturaTipo) REFERENCES dbo.Facturas_Tipos(IdFacturaTipo)
);
PRINT 'Tabla [dbo.FacturasProveedores] creada.';

-- TABLA: FacturasProveedores_Lineas (Detalle de las líneas de la factura)
CREATE TABLE dbo.FacturasProveedores_Lineas (
    idFacturaProveedorLinea INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL,
    NumOrden INT NOT NULL,              -- Número de línea (1, 2, 3...)
    Concepto VARCHAR(1000) NULL,
    Cantidad FLOAT NOT NULL DEFAULT 1,
    Precio MONEY NOT NULL DEFAULT 0,
    Porc_IVA FLOAT NOT NULL DEFAULT 0,
    IDIVA INT NULL,                     -- Referencia del IVA
    idretencion INT NULL,
    idproveedorIva INT NULL,
    idunidadmedida INT NULL DEFAULT 7,  -- 7 = UD (Unidades) por defecto
    CONSTRAINT FK_FacturasProveedores_Lineas_Cabecera FOREIGN KEY (idFacturaProveedor) REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
PRINT 'Tabla [dbo.FacturasProveedores_Lineas] creada.';

-- TABLA: FacturasProveedores_Vencimientos (Plazos de pago de la factura)
CREATE TABLE dbo.FacturasProveedores_Vencimientos (
    idFacturaProveedorVencimiento INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL,
    Fecha SMALLDATETIME NOT NULL,        -- Fecha de vencimiento
    Importe MONEY NOT NULL,             -- Importe del vencimiento
    Pagado TINYINT DEFAULT 0,           -- 1 = Pagado, 0 = Pendiente
    Imp_Pagado MONEY DEFAULT 0,         -- Cantidad pagada acumulada
    Pagar TINYINT DEFAULT 1,            -- 1 = Pendiente de pago, 0 = No pagar / pagado
    NumVencimiento INT NOT NULL DEFAULT 1,
    FechaPago SMALLDATETIME NULL,
    IdFormaPago INT NULL,               -- ID forma de pago
    idTesoreria INT NULL,               -- Banco / Caja
    CONSTRAINT FK_FacturasProveedores_Vencimientos_Cabecera FOREIGN KEY (idFacturaProveedor) REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
PRINT 'Tabla [dbo.FacturasProveedores_Vencimientos] creada.';

-- TABLA: Remesas_Domiciliaciones (Remesas bancarias)
CREATE TABLE dbo.Remesas_Domiciliaciones (
    IdRemesaDomiciliacion INT IDENTITY(1,1) PRIMARY KEY,
    Fecha SMALLDATETIME NULL DEFAULT GETDATE(),
    Concepto VARCHAR(200) NULL
);
PRINT 'Tabla [dbo.Remesas_Domiciliaciones] creada.';

-- TABLA: Transacciones (Transacciones de pago liquidadas)
CREATE TABLE dbo.Transacciones (
    idTransaccion INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedorVencimiento INT NOT NULL,
    IdRemesaDomiciliacion INT NULL,
    Importe MONEY NULL,
    Fecha SMALLDATETIME NULL,
    CONSTRAINT FK_Transacciones_Vencimientos FOREIGN KEY (idFacturaProveedorVencimiento) REFERENCES dbo.FacturasProveedores_Vencimientos(idFacturaProveedorVencimiento) ON DELETE CASCADE,
    CONSTRAINT FK_Transacciones_Remesas FOREIGN KEY (IdRemesaDomiciliacion) REFERENCES dbo.Remesas_Domiciliaciones(IdRemesaDomiciliacion) ON DELETE SET NULL
);
PRINT 'Tabla [dbo.Transacciones] creada.';

-- TABLAS DE RELACIONES EXTRA (Requeridas por el proceso de borrado del sistema)
CREATE TABLE dbo.Anticipos (
    idAnticipo INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE,
    Importe MONEY NULL,
    Fecha SMALLDATETIME NULL
);
CREATE TABLE dbo.gf_CursosDocentes (
    idCursoDocente INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
CREATE TABLE dbo.FacturasClientes_FacturasProveedores (
    idRelacion INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE,
    idFacturaCliente INT NULL
);
CREATE TABLE dbo.gf_FacturasCostesAsociados (
    idCosteAsociado INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
CREATE TABLE dbo.gf_FacturasCostesDirectos (
    idCosteDirecto INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
CREATE TABLE dbo.gf_FacturasOtrosCostesSubvencionables (
    idOtrosCostes INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
CREATE TABLE dbo.gf_JustificacionFacturasCostes (
    idJustificacion INT IDENTITY(1,1) PRIMARY KEY,
    idFacturaProveedor INT NOT NULL FOREIGN KEY REFERENCES dbo.FacturasProveedores(idFacturaProveedor) ON DELETE CASCADE
);
PRINT 'Tablas de relaciones extra (Anticipos, Costes, Docencia, etc.) creadas.';

-- TABLA: MindeeCuentas (Cuentas de la API de Mindee)
CREATE TABLE dbo.MindeeCuentas (
    IdCuenta INT IDENTITY(1,1) PRIMARY KEY,
    NombreCuenta VARCHAR(200) NOT NULL,
    CorreoCuenta VARCHAR(200) NULL
);
PRINT 'Tabla [dbo.MindeeCuentas] creada.';

-- TABLA: MindeeModelID (Modelos personalizados entrenados en Mindee)
CREATE TABLE dbo.MindeeModelID (
    IdModelID INT IDENTITY(1,1) PRIMARY KEY,
    ModelID VARCHAR(200) NOT NULL,
    NombreModelID VARCHAR(200) NOT NULL,
    IdCuenta INT NOT NULL,
    CONSTRAINT FK_MindeeModelID_Cuentas FOREIGN KEY (IdCuenta) REFERENCES dbo.MindeeCuentas(IdCuenta) ON DELETE CASCADE
);
PRINT 'Tabla [dbo.MindeeModelID] creada.';

-- TABLA: MindeeAPIKey (Credenciales de acceso para Mindee)
CREATE TABLE dbo.MindeeAPIKey (
    IdApiKey INT IDENTITY(1,1) PRIMARY KEY,
    ApiKey VARCHAR(200) NOT NULL,
    IdCuenta INT NOT NULL,
    CONSTRAINT FK_MindeeAPIKey_Cuentas FOREIGN KEY (IdCuenta) REFERENCES dbo.MindeeCuentas(IdCuenta) ON DELETE CASCADE
);
PRINT 'Tabla [dbo.MindeeAPIKey] creada.';


-- ============================================================================
-- 6. CREACIÓN DE PROCEDIMIENTOS ALMACENADOS
-- ============================================================================
GO

-- PROCEDIMIENTO: SeguridadUnificada_Identidad_Select (Autenticación del Sistema)
CREATE PROCEDURE dbo.SeguridadUnificada_Identidad_Select
    @Usuario NVARCHAR(200),
    @IdAplicacionConPermiso INT,
    @Contrasena NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Contrasena IS NULL
    BEGIN
        -- Simulación de Login Integrado de Windows (Comprueba si el usuario local está registrado y activo)
        SELECT 
            IdIdentidad,
            Usuario,
            NombreCompleto AS Nombre,
            Activo
        FROM dbo.Seguridad_Usuarios
        WHERE Usuario = @Usuario AND Activo = 1;
    END
    ELSE
    BEGIN
        -- Inicio de sesión clásico con Usuario y Contraseña
        SELECT 
            IdIdentidad,
            Usuario,
            NombreCompleto AS Nombre,
            Activo
        FROM dbo.Seguridad_Usuarios
        WHERE Usuario = @Usuario 
          AND Contrasena = @Contrasena -- Compara en texto plano como requiere el proyecto actual
          AND Activo = 1;
    END
END;
GO
PRINT 'Procedimiento [dbo.SeguridadUnificada_Identidad_Select] creado.';
GO

-- PROCEDIMIENTO: up_gf_Proveedores_Insert (Guardado o Actualización de Proveedor)
CREATE PROCEDURE dbo.up_gf_Proveedores_Insert
    @IdProveedor INT output,
    @IdTipoDocumento INT = 1,
    @Documento VARCHAR(50) = '',
    @IdTipo INT = NULL,
    @RazonSocial VARCHAR(200) = '',
    @NombreComercial VARCHAR(200) = NULL,
    @PersonaContacto VARCHAR(100) = NULL,
    @Responsable VARCHAR(100) = NULL,
    @Direccion VARCHAR(200) = NULL,
    @IdPais INT = 73,
    @CodigoPostal VARCHAR(50) = NULL,
    @IdProvincia INT = NULL,
    @Poblacion VARCHAR(100) = NULL,
    @Observaciones VARCHAR(MAX) = NULL,
    @IdIdentidad INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @IdProveedor = 0 OR @IdProveedor IS NULL
    BEGIN
        -- Inserción de un nuevo proveedor
        INSERT INTO dbo.gf_Proveedores (
            IdTipoDocumento, Documento, IdTipo, RazonSocial, NombreComercial,
            PersonaContacto, Responsable, Direccion, IdPais, CodigoPostal,
            IdProvincia, Poblacion, Observaciones, IdIdentidad
        )
        VALUES (
            @IdTipoDocumento, @Documento, @IdTipo, @RazonSocial, @NombreComercial,
            @PersonaContacto, @Responsable, @Direccion, @IdPais, @CodigoPostal,
            @IdProvincia, @Poblacion, @Observaciones, @IdIdentidad
        );

        SET @IdProveedor = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        -- Actualización del proveedor existente
        UPDATE dbo.gf_Proveedores
        SET IdTipoDocumento = @IdTipoDocumento,
            Documento = @Documento,
            IdTipo = @IdTipo,
            RazonSocial = @RazonSocial,
            NombreComercial = @NombreComercial,
            PersonaContacto = @PersonaContacto,
            Responsable = @Responsable,
            Direccion = @Direccion,
            IdPais = @IdPais,
            CodigoPostal = @CodigoPostal,
            IdProvincia = @IdProvincia,
            Poblacion = @Poblacion,
            Observaciones = @Observaciones,
            IdIdentidad = @IdIdentidad
        WHERE IdProveedor = @IdProveedor;
    END

    -- Retornar el IdProveedor insertado/modificado como ResultSet
    SELECT @IdProveedor AS IdProveedor;
END;
GO
PRINT 'Procedimiento [dbo.up_gf_Proveedores_Insert] creado.';
GO


-- ============================================================================
-- 7. INSERCIÓN DE DATOS DE SEMILLA (DATOS POR DEFECTO)
-- ============================================================================

-- Tipos de Factura
INSERT INTO dbo.Facturas_Tipos (IdFacturaTipo, Nombre) 
VALUES 
(4, 'Normal'),
(5, 'Otro tipo');
PRINT 'Datos semilla de [Facturas_Tipos] insertados.';

-- Sociedades de Prueba
INSERT INTO dbo.Sociedades (RazonSocial) 
VALUES 
('INTECO INGENIERIA AVANZADA SL'),
('GF GESTION Y FORMACION SL');
PRINT 'Datos semilla de [Sociedades] insertados.';

-- Provincias de España (Imprescindible para el desplegable de provincias)
INSERT INTO dbo.Provincias (IdProvincia, Nombre, Codigo) VALUES
(1, 'Álava', 'VI'),
(2, 'Albacete', 'AB'),
(3, 'Alicante', 'A'),
(4, 'Almería', 'AL'),
(5, 'Ávila', 'AV'),
(6, 'Badajoz', 'BA'),
(7, 'Islas Baleares', 'PM'),
(8, 'Barcelona', 'B'),
(9, 'Burgos', 'BU'),
(10, 'Cáceres', 'CC'),
(11, 'Cádiz', 'CA'),
(12, 'Castellón', 'CS'),
(13, 'Ciudad Real', 'CR'),
(14, 'Córdoba', 'CO'),
(15, 'A Coruña', 'C'),
(16, 'Cuenca', 'CU'),
(17, 'Girona', 'GI'),
(18, 'Granada', 'GR'),
(19, 'Guadalajara', 'GU'),
(20, 'Guipúzcoa', 'SS'),
(21, 'Huelva', 'H'),
(22, 'Huesca', 'HU'),
(23, 'Jaén', 'J'),
(24, 'León', 'LE'),
(25, 'Lleida', 'L'),
(26, 'La Rioja', 'LO'),
(27, 'Lugo', 'LU'),
(28, 'Madrid', 'M'),
(29, 'Málaga', 'MA'),
(30, 'Murcia', 'MU'),
(31, 'Navarra', 'NA'),
(32, 'Ourense', 'OR'),
(33, 'Asturias', 'O'),
(34, 'Palencia', 'P'),
(35, 'Las Palmas', 'GC'),
(36, 'Pontevedra', 'PO'),
(37, 'Salamanca', 'SA'),
(38, 'Santa Cruz de Tenerife', 'TF'),
(39, 'Cantabria', 'S'),
(40, 'Segovia', 'SG'),
(41, 'Sevilla', 'SE'),
(42, 'Soria', 'SO'),
(43, 'Tarragona', 'T'),
(44, 'Teruel', 'TE'),
(45, 'Toledo', 'TO'),
(46, 'Valencia', 'V'),
(47, 'Valladolid', 'VA'),
(48, 'Vizcaya', 'BI'),
(49, 'Zamora', 'ZA'),
(50, 'Zaragoza', 'Z'),
(51, 'Ceuta', 'CE'),
(52, 'Melilla', 'ML');
PRINT 'Datos semilla de [Provincias] (52 provincias) insertados.';

-- Cuenta y Modelo por defecto para Mindee
INSERT INTO dbo.MindeeCuentas (NombreCuenta, CorreoCuenta)
VALUES ('Cuenta Principal GForma', 'administrador@gforma.com');

DECLARE @CuentaId INT = SCOPE_IDENTITY();

INSERT INTO dbo.MindeeModelID (ModelID, NombreModelID, IdCuenta)
VALUES ('ae3c8c39-37b9-4bb6-8afe-b8374b7064cb', 'Modelo Facturas GForma (DocTI)', @CuentaId);

INSERT INTO dbo.MindeeAPIKey (ApiKey, IdCuenta)
VALUES ('md_oQ3ZLIJC9XOd1mkFraeSR4ue9L3Lbb_PSu2ZKbEEg9g', @CuentaId);
PRINT 'Datos semilla de Configuración Mindee insertados.';

-- Usuarios de Seguridad para acceso al sistema
INSERT INTO dbo.Seguridad_Usuarios (Usuario, Contrasena, NombreCompleto, Activo)
VALUES 
('admin', 'admin', 'Administrador GForma', 1),
('us_limitado_tareasYpresencia', 'uslimitado', 'Usuario Limitado Tareas', 1);
PRINT 'Datos semilla de [Seguridad_Usuarios] insertados.';

IF NOT EXISTS (SELECT 1 FROM dbo.Seguridad_Usuarios WHERE Usuario = 'mrodriguez')
BEGIN
    INSERT INTO dbo.Seguridad_Usuarios (Usuario, Contrasena, NombreCompleto, Activo)
    VALUES ('mrodriguez', 'mrodriguez', 'Miguel Rodriguez Taboas', 1);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Seguridad_Usuarios WHERE Usuario = 'mdbarca')
BEGIN
    INSERT INTO dbo.Seguridad_Usuarios (Usuario, Contrasena, NombreCompleto, Activo)
    VALUES ('mdbarca', 'mdbarca', 'Usuario Principal Windows (mdbarca)', 1);
END
PRINT 'Datos semilla de [mrodriguez/mdbarca] insertados.';

-- Roles fijos por usuario
MERGE dbo.Seguridad_RolesUsuarios AS target
USING (VALUES
    ('admin', 'Administrador'),
    ('mrodriguez', 'Administrador'),
    ('mdbarca', 'Contable')
) AS source (Usuario, Rol)
ON LOWER(LTRIM(RTRIM(target.Usuario))) = LOWER(LTRIM(RTRIM(source.Usuario)))
WHEN MATCHED THEN
    UPDATE SET Rol = source.Rol, Activo = 1, FechaActualizacion = SYSDATETIME()
WHEN NOT MATCHED THEN
    INSERT (Usuario, Rol, Activo, FechaActualizacion)
    VALUES (source.Usuario, source.Rol, 1, SYSDATETIME());
PRINT 'Datos semilla de [Seguridad_RolesUsuarios] insertados.';

GO

PRINT '============================================================================';
PRINT 'INICIALIZACIÓN DE BASE DE DATOS FINALIZADA CON ÉXITO';
PRINT '============================================================================';
GO
