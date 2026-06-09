const mssql = require('mssql');
const path = require('path');

// Helper to find the .env file path
function getEnvPath() {
    try {
        const { app } = require('electron');
        if (app && app.isPackaged) {
            return path.join(process.resourcesPath, '.env');
        }
    } catch (e) {}
    return path.join(process.cwd(), '.env');
}

require('dotenv').config({ path: getEnvPath() });

let readAppConfig = null;
try {
    ({ readConfig: readAppConfig } = require('../database/db'));
} catch (_) {
    readAppConfig = null;
}

function parseServerAndPort(rawServer, fallbackServer = 'localhost') {
    let server = String(rawServer || fallbackServer).trim();
    let port = parseInt(process.env.DB_PORT || '1433', 10) || 1433;

    if (server.includes(',')) {
        const [serverName, portText] = server.split(',');
        server = String(serverName || fallbackServer).trim() || fallbackServer;
        const parsedPort = parseInt(String(portText || '').trim(), 10);
        if (!Number.isNaN(parsedPort)) {
            port = parsedPort;
        }
    }

    return { server, port };
}

function resolveConnectionConfig() {
    let runtimeConfig = null;
    try {
        runtimeConfig = typeof readAppConfig === 'function' ? readAppConfig() : null;
    } catch (_) {
        runtimeConfig = null;
    }

    const rawServer = runtimeConfig?.server || process.env.DB_SERVER || 'w2019-sql';
    const database = runtimeConfig?.database || process.env.DB_NAME || 'GestionFormacion';
    const { server, port } = parseServerAndPort(rawServer);
    const trustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE === 'true';

    return {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server,
        database,
        port,
        options: {
            encrypt: !trustServerCertificate,
            trustServerCertificate
        }
    };
}

const config = new Proxy({}, {
    get(_target, prop) {
        const resolved = resolveConnectionConfig();
        return resolved[prop];
    },
    set() {
        return true;
    },
    ownKeys() {
        return ['user', 'password', 'server', 'database', 'port', 'options'];
    },
    getOwnPropertyDescriptor(_target, prop) {
        if (['user', 'password', 'server', 'database', 'port', 'options'].includes(prop)) {
            return {
                enumerable: true,
                configurable: true
            };
        }
        return undefined;
    }
});

const FIXED_ROLE_BY_USER = {
    admin: 'Administrador',
    mrodriguez: 'Administrador',
    mdbarca: 'Contable'
};

let auditContext = {
    user: 'Sistema',
    role: 'Sistema',
    source: 'app'
};

let adminInfrastructurePromise = null;

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeRole(value) {
    return String(value || '').trim() === 'Administrador' ? 'Administrador' : 'Contable';
}

async function ensureAdminInfrastructure() {
    if (!adminInfrastructurePromise) {
        adminInfrastructurePromise = (async () => {
            const pool = await mssql.connect(config);
            const checks = await pool.request().query(`
                SELECT
                    CASE WHEN OBJECT_ID('dbo.Seguridad_RolesUsuarios', 'U') IS NULL THEN 0 ELSE 1 END AS hasRoles,
                    CASE WHEN OBJECT_ID('dbo.Auditoria_Acciones', 'U') IS NULL THEN 0 ELSE 1 END AS hasAudit
            `);
            const meta = checks.recordset[0] || {};

            if (!meta.hasRoles) {
                await pool.request().query(`
                    CREATE TABLE dbo.Seguridad_RolesUsuarios (
                        IdRolUsuario INT IDENTITY(1,1) PRIMARY KEY,
                        Usuario NVARCHAR(200) NOT NULL UNIQUE,
                        Rol NVARCHAR(50) NOT NULL,
                        Activo BIT NOT NULL DEFAULT 1,
                        FechaActualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
                    )
                `);
            }

            if (!meta.hasAudit) {
                await pool.request().query(`
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
                `);
            }
        })().catch((err) => {
            adminInfrastructurePromise = null;
            throw err;
        });
    }

    return adminInfrastructurePromise;
}

async function getUserRole(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) return 'Contable';

    try {
        await ensureAdminInfrastructure();
        const pool = await mssql.connect(config);
        const result = await pool.request()
            .input('Usuario', mssql.NVarChar(200), normalized)
            .query(`
                SELECT TOP 1 Rol
                FROM dbo.Seguridad_RolesUsuarios
                WHERE LOWER(LTRIM(RTRIM(Usuario))) = LOWER(LTRIM(RTRIM(@Usuario)))
                  AND ISNULL(Activo, 1) = 1
                ORDER BY IdRolUsuario DESC
            `);

        if (result.recordset.length > 0) {
            return normalizeRole(result.recordset[0].Rol);
        }
    } catch (err) {
        console.warn('[SQL] No se pudo resolver el rol desde la tabla de seguridad:', err.message);
    }

    return normalizeRole(FIXED_ROLE_BY_USER[normalized] || 'Contable');
}

async function writeAuditLog({
    action,
    entity = null,
    detail = null,
    result = 'OK',
    user = null,
    role = null
}) {
    try {
        await ensureAdminInfrastructure();
        const pool = await mssql.connect(config);
        const actor = normalizeUsername(user || auditContext.user || 'sistema') || 'sistema';
        const actorRole = normalizeRole(role || auditContext.role || FIXED_ROLE_BY_USER[actor] || 'Contable');
        await pool.request()
            .input('Usuario', mssql.NVarChar(200), actor)
            .input('Rol', mssql.NVarChar(50), actorRole)
            .input('Accion', mssql.NVarChar(100), String(action || 'ACTION').trim())
            .input('Entidad', mssql.NVarChar(100), entity || null)
            .input('Detalle', mssql.NVarChar(4000), detail || null)
            .input('Resultado', mssql.NVarChar(20), result || 'OK')
            .query(`
                INSERT INTO dbo.Auditoria_Acciones (Usuario, Rol, Accion, Entidad, Detalle, Resultado)
                VALUES (@Usuario, @Rol, @Accion, @Entidad, @Detalle, @Resultado)
            `);
    } catch (err) {
        console.warn('[SQL] No se pudo escribir la auditoria:', err.message);
    }
}

function setAuditContext(context = {}) {
    auditContext = {
        user: context.user || context.usuario || context.loginUser || auditContext.user || 'Sistema',
        role: context.role || context.rol || auditContext.role || 'Contable',
        source: context.source || auditContext.source || 'app'
    };
}

async function listSociedades() {
    try {
        let pool = await mssql.connect(config);
        let result = await pool.request().query('SELECT idSociedad AS id, RazonSocial AS nombre FROM dbo.Sociedades ORDER BY RazonSocial');
        return result.recordset;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}

async function listFacturas(sociedadId, limit = 2000) {
    try {
        let safeLimit = offsetLimit(limit);
        let pool = await mssql.connect(config);
        
        let request = pool.request();
        let whereClause = '';
        if (sociedadId) {
            request.input('sociedadId', mssql.Int, sociedadId);
            whereClause = 'WHERE fp.idSociedad = @sociedadId';
        }

        const query = `
            SELECT TOP ${safeLimit}
              fp.idFacturaProveedor AS id,
              COALESCE(CAST(fp.NumFactura AS bigint), CAST(fp.idFacturaProveedor AS bigint)) AS num,
              CONVERT(date, fp.FechaEntrada) AS fechaImputacion,
              CONCAT(DATEPART(QUARTER, fp.FechaEntrada), 'TR') AS trim,
              fp.NumFactuProv AS numFacturaProveedor,
              CONVERT(date, fp.Fecha) AS fechaFacturaProveedor,
              p.RazonSocial AS proveedor,
              COALESCE(NULLIF(fp.Concepto, ''), NULLIF(fp.Observaciones, ''), '') AS descripcion,
              CAST(fp.BaseImponible AS decimal(18,2)) AS baseImponible,
              CAST(fp.IVA AS decimal(18,2)) AS iva,
              CAST(fp.Total_con_IVA AS decimal(18,2)) AS total,
              ft.Nombre AS tipo,
              CASE
                WHEN ISNULL(vs.totalPagado, 0) >= (fp.Total_con_IVA - 0.01) AND ISNULL(vs.cnt, 0) > 0 THEN 'pagado'
                WHEN vs.fechaVencimiento < CAST(GETDATE() AS DATE) THEN 'vencida'
                ELSE 'pendiente'
              END AS estado,
              vs.fechaVencimiento AS fechaVencimiento
            FROM dbo.FacturasProveedores fp
            LEFT JOIN dbo.gf_Proveedores p
              ON p.IdProveedor = fp.idProveedor
            LEFT JOIN dbo.Facturas_Tipos ft
              ON ft.IdFacturaTipo = fp.idFacturaTipo
            OUTER APPLY (
              SELECT
                COUNT(*) AS cnt,
                MAX(ISNULL(v.Imp_Pagado, 0)) AS totalPagado,
                MAX(v.Fecha) AS fechaVencimiento
              FROM dbo.FacturasProveedores_Vencimientos v
              WHERE v.idFacturaProveedor = fp.idFacturaProveedor
            ) vs
            ${whereClause}
            ORDER BY fp.FechaEntrada DESC, fp.idFacturaProveedor DESC
        `;

        let result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}

async function getFacturasChangeStamp(sociedadId = null) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        let facturaWhere = '';
        let vencWhere = '';

        if (sociedadId) {
            request.input('sociedadId', mssql.Int, parseInt(sociedadId));
            facturaWhere = 'WHERE fp.idSociedad = @sociedadId';
            vencWhere = 'WHERE fp.idSociedad = @sociedadId';
        }

        const result = await request.query(`
            SELECT
                (SELECT COUNT_BIG(*) FROM dbo.FacturasProveedores fp ${facturaWhere}) AS facturasCount,
                (SELECT ISNULL(MAX(fp.idFacturaProveedor), 0) FROM dbo.FacturasProveedores fp ${facturaWhere}) AS maxFacturaId,
                (
                    SELECT ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(
                        fp.idFacturaProveedor,
                        fp.idSociedad,
                        fp.idProveedor,
                        fp.NumFactura,
                        fp.NumFactuProv,
                        fp.Fecha,
                        fp.FechaEntrada,
                        fp.BaseImponible,
                        fp.IVA,
                        fp.Total_con_IVA,
                        fp.Validado,
                        fp.idFacturaTipo,
                        fp.Concepto,
                        CONVERT(VARCHAR(4000), fp.Observaciones)
                    )), 0)
                    FROM dbo.FacturasProveedores fp
                    ${facturaWhere}
                ) AS facturasChecksum,
                (
                    SELECT COUNT_BIG(*)
                    FROM dbo.FacturasProveedores_Vencimientos v
                    INNER JOIN dbo.FacturasProveedores fp ON fp.idFacturaProveedor = v.idFacturaProveedor
                    ${vencWhere}
                ) AS vencimientosCount,
                (
                    SELECT ISNULL(MAX(v.idFacturaProveedorVencimiento), 0)
                    FROM dbo.FacturasProveedores_Vencimientos v
                    INNER JOIN dbo.FacturasProveedores fp ON fp.idFacturaProveedor = v.idFacturaProveedor
                    ${vencWhere}
                ) AS maxVencimientoId,
                (
                    SELECT ISNULL(CHECKSUM_AGG(BINARY_CHECKSUM(
                        v.idFacturaProveedorVencimiento,
                        v.idFacturaProveedor,
                        v.Fecha,
                        v.Importe,
                        v.Pagado,
                        v.Imp_Pagado,
                        v.Pagar,
                        v.NumVencimiento,
                        v.FechaPago,
                        v.IdFormaPago,
                        v.idTesoreria
                    )), 0)
                    FROM dbo.FacturasProveedores_Vencimientos v
                    INNER JOIN dbo.FacturasProveedores fp ON fp.idFacturaProveedor = v.idFacturaProveedor
                    ${vencWhere}
                ) AS vencimientosChecksum
        `);

        const row = result.recordset[0] || {};
        return {
            sociedadId: sociedadId ? parseInt(sociedadId) : null,
            facturasCount: String(row.facturasCount || '0'),
            maxFacturaId: Number(row.maxFacturaId || 0),
            facturasChecksum: Number(row.facturasChecksum || 0),
            vencimientosCount: String(row.vencimientosCount || '0'),
            maxVencimientoId: Number(row.maxVencimientoId || 0),
            vencimientosChecksum: Number(row.vencimientosChecksum || 0)
        };
    } catch (err) {
        console.error('SQL error getting facturas change stamp', err);
        throw err;
    }
}

function offsetLimit(limit) {
    return Math.max(1, Math.min(limit || 2000, 5000));
}

async function getProvincias() {
    try {
        let pool = await mssql.connect(config);
        let result = await pool.request().query('SELECT IdProvincia AS id, Nombre AS nombre, Codigo AS codigo FROM dbo.Provincias ORDER BY Nombre');
        return result.recordset;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}

async function checkProveedorExists(documento) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        
        request.input('Documento', mssql.VarChar(50), documento || '');
        
        // Use direct query instead of SP which is not returning results as expected
        const query = 'SELECT IdProveedor FROM dbo.gf_Proveedores WHERE Documento = @Documento';
        let result = await request.query(query);
        
        return result.recordset;
    } catch (err) {
        console.error('SQL error checking proveedor', err);
        throw err;
    }
}

async function getProveedorByName(nombre) {
    try {
        let pool = await mssql.connect(config);
        let result = await pool.request()
            .input('Nombre', mssql.VarChar, nombre)
            .query('SELECT TOP 1 IdProveedor FROM dbo.gf_Proveedores WHERE RazonSocial = @Nombre OR NombreComercial = @Nombre');
        
        return result.recordset.length > 0 ? result.recordset[0].IdProveedor : null;
    } catch (err) {
        console.error('SQL error getting proveedor by name', err);
        throw err;
    }
}

async function getPoblacionByCP(codigoPostal) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        request.input('Codigo', mssql.VarChar(50), codigoPostal);
        
        const query = `
            SELECT TOP 1 l.Nombre as poblacion
            FROM dbo.Localidades l
            INNER JOIN dbo.CodigosPostales cp ON l.IdLocalidad = cp.IdLocalidad
            WHERE cp.Codigo = @Codigo
            ORDER BY l.IdLocalidad
        `;
        
        let result = await request.query(query);
        return result.recordset.length > 0 ? result.recordset[0].poblacion : null;
    } catch (err) {
        console.error('SQL error getting poblacion', err);
        return null;
    }
}

async function getUsersWithRoles() {
    try {
        await ensureAdminInfrastructure();
        const pool = await mssql.connect(config);
        const result = await pool.request().query(`
            SELECT
                u.IdIdentidad AS id,
                u.Usuario AS usuario,
                u.NombreCompleto AS nombreCompleto,
                u.Activo AS activo,
                COALESCE(
                    r.Rol,
                    CASE
                        WHEN LOWER(LTRIM(RTRIM(u.Usuario))) = 'mrodriguez' THEN 'Administrador'
                        WHEN LOWER(LTRIM(RTRIM(u.Usuario))) = 'mdbarca' THEN 'Contable'
                        ELSE 'Contable'
                    END
                ) AS rol,
                CASE WHEN r.Usuario IS NULL THEN 0 ELSE 1 END AS tieneOverride
            FROM dbo.Seguridad_Usuarios u
            LEFT JOIN dbo.Seguridad_RolesUsuarios r
                ON LOWER(LTRIM(RTRIM(r.Usuario))) = LOWER(LTRIM(RTRIM(u.Usuario)))
            ORDER BY u.NombreCompleto, u.Usuario
        `);
        return result.recordset;
    } catch (err) {
        console.error('SQL error getting security users', err);
        throw err;
    }
}

async function saveSecurityUser(data) {
    const usuario = normalizeUsername(data.usuario);
    if (!usuario) {
        throw new Error('USUARIO_REQUERIDO');
    }

    const rol = normalizeRole(data.rol);
    const nombreCompleto = String(data.nombreCompleto || '').trim();
    const activo = data.activo === false || data.activo === 0 ? 0 : 1;
    const password = data.password === undefined || data.password === null ? '' : String(data.password);

    try {
        await ensureAdminInfrastructure();
        const pool = await mssql.connect(config);
        const transaction = new mssql.Transaction(pool);
        await transaction.begin();

        try {
            const existingResult = await transaction.request()
                .input('Usuario', mssql.NVarChar(200), usuario)
                .query(`
                    SELECT TOP 1 IdIdentidad, Contrasena
                    FROM dbo.Seguridad_Usuarios
                    WHERE LOWER(LTRIM(RTRIM(Usuario))) = LOWER(LTRIM(RTRIM(@Usuario)))
                `);

            const existing = existingResult.recordset[0] || null;
            const request = transaction.request();
            request.input('Usuario', mssql.NVarChar(200), usuario);
            request.input('NombreCompleto', mssql.NVarChar(200), nombreCompleto || usuario);
            request.input('Activo', mssql.Bit, activo);
            request.input('Rol', mssql.NVarChar(50), rol);

            if (existing) {
                request.input('IdIdentidad', mssql.Int, existing.IdIdentidad);
                request.input('Contrasena', mssql.NVarChar(200), password || null);
                await request.query(`
                    UPDATE dbo.Seguridad_Usuarios
                    SET NombreCompleto = @NombreCompleto,
                        Activo = @Activo,
                        Contrasena = CASE WHEN @Contrasena IS NULL OR LTRIM(RTRIM(@Contrasena)) = '' THEN Contrasena ELSE @Contrasena END
                    WHERE IdIdentidad = @IdIdentidad
                `);
            } else {
                if (!password) {
                    throw new Error('PASSWORD_REQUERIDA');
                }
                request.input('Contrasena', mssql.NVarChar(200), password);
                await request.query(`
                    INSERT INTO dbo.Seguridad_Usuarios (Usuario, Contrasena, NombreCompleto, Activo)
                    VALUES (@Usuario, @Contrasena, @NombreCompleto, @Activo)
                `);
            }

            await transaction.request()
                .input('Usuario', mssql.NVarChar(200), usuario)
                .input('Rol', mssql.NVarChar(50), rol)
                .input('Activo', mssql.Bit, activo)
                .query(`
                    MERGE dbo.Seguridad_RolesUsuarios AS target
                    USING (SELECT @Usuario AS Usuario) AS source
                        ON LOWER(LTRIM(RTRIM(target.Usuario))) = LOWER(LTRIM(RTRIM(source.Usuario)))
                    WHEN MATCHED THEN
                        UPDATE SET
                            Rol = @Rol,
                            Activo = @Activo,
                            FechaActualizacion = SYSDATETIME()
                    WHEN NOT MATCHED THEN
                        INSERT (Usuario, Rol, Activo, FechaActualizacion)
                        VALUES (@Usuario, @Rol, @Activo, SYSDATETIME());
                `);

            await transaction.commit();

            await writeAuditLog({
                action: existing ? 'USUARIO_ACTUALIZADO' : 'USUARIO_CREADO',
                entity: 'Seguridad_Usuarios',
                detail: `Usuario ${usuario} guardado con rol ${rol} y estado ${activo ? 'activo' : 'inactivo'}.`
            });

            return {
                success: true,
                user: {
                    usuario,
                    nombreCompleto: nombreCompleto || usuario,
                    rol,
                    activo: !!activo,
                    creado: !existing
                }
            };
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    } catch (err) {
        console.error('SQL error saving security user', err);
        throw err;
    }
}

async function getAuditLog(limit = 100) {
    try {
        await ensureAdminInfrastructure();
        const pool = await mssql.connect(config);
        const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 500));
        const result = await pool.request()
            .input('limit', mssql.Int, safeLimit)
            .query(`
                SELECT TOP (@limit)
                    IdAuditoria AS id,
                    FechaHora AS fechaHora,
                    Usuario AS usuario,
                    Rol AS rol,
                    Accion AS accion,
                    Entidad AS entidad,
                    Detalle AS detalle,
                    Resultado AS resultado
                FROM dbo.Auditoria_Acciones
                ORDER BY FechaHora DESC, IdAuditoria DESC
            `);
        return result.recordset;
    } catch (err) {
        console.error('SQL error getting audit log', err);
        throw err;
    }
}

async function saveProveedor(data) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        
        // Map the fields. IdProveedor = 0 for insert.
        request.input('IdProveedor', mssql.Int, 0); 
        request.input('IdTipoDocumento', mssql.Int, parseInt(data.tipoDoc) || 1); // From dropdown
        request.input('Documento', mssql.VarChar(50), data.docId || '');
        request.input('IdTipo', mssql.Int, data.tipoProveedor ? parseInt(data.tipoProveedor) : null); // From dropdown
        request.input('RazonSocial', mssql.VarChar(200), data.legalBusinessName || '');
        request.input('NombreComercial', mssql.VarChar(200), data.commercialName || null);
        request.input('PersonaContacto', mssql.VarChar(100), data.contactPerson || null);
        request.input('Responsable', mssql.VarChar(100), null);
        request.input('Direccion', mssql.VarChar(200), data.address || null);
        request.input('IdPais', mssql.Int, 73); // Default Spain
        request.input('CodigoPostal', mssql.VarChar(50), data.postalCode || null);
        
        let idProvincia = data.provinciaId ? parseInt(data.provinciaId) : null;
        request.input('IdProvincia', mssql.Int, idProvincia);
        
        request.input('Poblacion', mssql.VarChar(100), data.city || null);
        request.input('Observaciones', mssql.VarChar(mssql.MAX), data.observations || null);
        request.input('IdIdentidad', mssql.Int, null);

        let result = await request.execute('up_gf_Proveedores_Insert');
        await writeAuditLog({
            action: 'PROVEEDOR_GUARDADO',
            entity: 'gf_Proveedores',
            detail: `Proveedor "${data.legalBusinessName || data.commercialName || data.docId || 'sin nombre'}" guardado o actualizado.`
        });
        return { success: true, result: result.recordset };
    } catch (err) {
        console.error('SQL error saving proveedor', err);
        throw err;
    }
}

async function saveInvoiceDB(data) {
    let pool = await mssql.connect(config);
    const transaction = new mssql.Transaction(pool);
    
    try {
        await transaction.begin();
        
        // 1. Get Provider ID if not provided (should be already there or we find it by name)
        // For now, we'll try to find the provider by name as a fallback
        let idProveedor = null;
        const provResult = await transaction.request()
            .input('Nombre', mssql.VarChar, data.proveedorNombre)
            .query('SELECT TOP 1 IdProveedor FROM dbo.gf_Proveedores WHERE RazonSocial = @Nombre OR NombreComercial = @Nombre');
        
        if (provResult.recordset.length > 0) {
            idProveedor = provResult.recordset[0].IdProveedor;
        }

        // 1.1 Get Next Internal Invoice Number (NumFactura)
        const year = data.fechaEntrada ? new Date(data.fechaEntrada).getFullYear() : new Date().getFullYear();
        const nextNumResult = await transaction.request()
            .input('idSociedad', mssql.Int, parseInt(data.idSociedad))
            .input('year', mssql.Int, year)
            .query(`
                SELECT ISNULL(MAX(CAST(NumFactura AS INT)), 0) + 1 AS nextNum 
                FROM dbo.FacturasProveedores 
                WHERE idSociedad = @idSociedad 
                  AND YEAR(FechaEntrada) = @year
            `);
        
        const nextNumFactura = nextNumResult.recordset[0].nextNum;

        // 2. Insert Invoice Header
        const headerRequest = transaction.request();
        headerRequest.input('idSociedad', mssql.Int, parseInt(data.idSociedad));
        headerRequest.input('idProveedor', mssql.Int, idProveedor);
        headerRequest.input('NumFactuProv', mssql.VarChar(50), data.numFactura);
        headerRequest.input('NumFactura', mssql.Int, nextNumFactura);
        headerRequest.input('Fecha', mssql.SmallDateTime, data.fechaEmision);
        headerRequest.input('Concepto', mssql.VarChar(300), data.concepto || '');
        
        // Calculate totals from lines for the header
        const baseImponible = data.lines.reduce((sum, l) => sum + (parseFloat(l.importe) || 0), 0);
        const cuotaIva = data.lines.reduce((sum, l) => sum + ((parseFloat(l.importe) || 0) * (parseFloat(l.iva) || 0) / 100), 0);
        
        headerRequest.input('BaseImponible', mssql.Money, baseImponible);
        headerRequest.input('IVA', mssql.Money, cuotaIva);
        headerRequest.input('Total_con_IVA', mssql.Money, baseImponible + cuotaIva);
        headerRequest.input('FechaEntrada', mssql.SmallDateTime, data.fechaEntrada || new Date());
        headerRequest.input('Validado', mssql.TinyInt, 0);
        headerRequest.input('idFacturaTipo', mssql.Int, parseInt(data.tipoFactura) || 4); // 4=Normal, 5=Otro tipo

        const headerResult = await headerRequest.query(`
            INSERT INTO dbo.FacturasProveedores 
            (idSociedad, idProveedor, NumFactuProv, NumFactura, Fecha, Concepto, BaseImponible, IVA, Total_con_IVA, FechaEntrada, Validado, idFacturaTipo)
            OUTPUT INSERTED.idFacturaProveedor
            VALUES 
            (@idSociedad, @idProveedor, @NumFactuProv, @NumFactura, @Fecha, @Concepto, @BaseImponible, @IVA, @Total_con_IVA, @FechaEntrada, @Validado, @idFacturaTipo)
        `);

        const idFacturaProveedor = headerResult.recordset[0].idFacturaProveedor;

        // 3. Insert Lines
        for (const line of data.lines) {
            const lineRequest = transaction.request();
            lineRequest.input('idFacturaProveedor', mssql.Int, idFacturaProveedor);
            lineRequest.input('NumOrden', mssql.Int, line.numOrden);
            lineRequest.input('Concepto', mssql.VarChar(1000), line.descripcion);
            lineRequest.input('Cantidad', mssql.Float, parseFloat(line.cantidad) || 0);
            lineRequest.input('Precio', mssql.Money, parseFloat(line.precio) || 0);
            lineRequest.input('Porc_IVA', mssql.Float, parseFloat(line.iva) || 0);

            // New fields requested by user (Mapped from provided IVA table image)
            const ivaPercentage = parseFloat(line.iva);
            let ivaId = 8; // Default to 21% (ID 8)
            if (ivaPercentage >= 21) ivaId = 8;
            else if (ivaPercentage >= 10) ivaId = 8; // Defaulting to 8 if 10% not found in image, adjust if needed
            else if (ivaPercentage >= 4) ivaId = 3;  // 4% (ID 3)
            else if (ivaPercentage <= 0) ivaId = 2;  // Exento (ID 2)
            lineRequest.input('IDIVA', mssql.Int, ivaId);
            lineRequest.input('idretencion', mssql.Int, null); // Default no retention (NULL)
            lineRequest.input('idproveedorIva', mssql.Int, idProveedor);
            lineRequest.input('idunidadmedida', mssql.Int, line.idUnidadMedida || 7); // Default UD (ID 7)

            await lineRequest.query(`
                INSERT INTO dbo.FacturasProveedores_Lineas
                (idFacturaProveedor, NumOrden, Concepto, Cantidad, Precio, Porc_IVA, IDIVA, idretencion, idproveedorIva, idunidadmedida)
                VALUES
                (@idFacturaProveedor, @NumOrden, @Concepto, @Cantidad, @Precio, @Porc_IVA, @IDIVA, @idretencion, @idproveedorIva, @idunidadmedida)
            `);
        }
        
        // 4. Insert Vencimientos (Installments)
        if (data.vencimientos && data.vencimientos.length > 0) {
            for (const venc of data.vencimientos) {
                const vencRequest = transaction.request();
                vencRequest.input('idFacturaProveedor', mssql.Int, idFacturaProveedor);
                vencRequest.input('Fecha', mssql.SmallDateTime, venc.fecha || data.fechaEmision);
                vencRequest.input('Importe', mssql.Money, parseFloat(venc.importe) || 0);
                vencRequest.input('Pagado', mssql.TinyInt, parseFloat(venc.pagado) >= parseFloat(venc.importe) ? 1 : 0);
                vencRequest.input('Imp_Pagado', mssql.Money, parseFloat(venc.pagado) || 0);
                vencRequest.input('Pagar', mssql.TinyInt, parseFloat(venc.pagado) >= parseFloat(venc.importe) ? 0 : 1);
                vencRequest.input('NumVencimiento', mssql.Int, venc.numOrden || 1);
                vencRequest.input('FechaPago', mssql.SmallDateTime, venc.fechaPago || null);
                
                // Forma Pago Mapping (Exact IDs from DB image)
                const formaPagoMap = {
                    'Transferencia Bancaria': 19,
                    'Cheque': 10,
                    'Contado': 7,
                    'E.C. ADEUDO EN CUENTA': 14,
                    'Pagaré': 8,
                    'TRANSFERENCIA BANCARIA C/C BANKINTER': 15,
                    'TRANSFERENCIA BANCARIA C/C SANTANDER': 11,
                    'VISA': 13
                };
                vencRequest.input('IdFormaPago', mssql.Int, formaPagoMap[venc.formaPago] || 19);

                // Tesoreria Mapping (Exact IDs from DB image)
                const tesoreriaMap = {
                    'Prueba Inteco': 2,
                    'Prueba Inteco 2': 3,
                    'Caja': 4,
                    'Banco': 6
                };
                vencRequest.input('idTesoreria', mssql.Int, tesoreriaMap[venc.tesoreria] || 6);

                await vencRequest.query(`
                    INSERT INTO dbo.FacturasProveedores_Vencimientos
                    (idFacturaProveedor, Fecha, Importe, Pagado, Imp_Pagado, Pagar, NumVencimiento, FechaPago, IdFormaPago, idTesoreria)
                    VALUES
                    (@idFacturaProveedor, @Fecha, @Importe, @Pagado, @Imp_Pagado, @Pagar, @NumVencimiento, @FechaPago, @IdFormaPago, @idTesoreria)
                `);
            }
        } else if (data.fechaVencimiento) {
            const vencRequest = transaction.request();
            vencRequest.input('idFacturaProveedor', mssql.Int, idFacturaProveedor);
            vencRequest.input('Fecha', mssql.SmallDateTime, data.fechaVencimiento);
            vencRequest.input('Importe', mssql.Money, baseImponible + cuotaIva);
            vencRequest.input('Pagado', mssql.TinyInt, 0);
            vencRequest.input('Imp_Pagado', mssql.Money, 0);
            vencRequest.input('Pagar', mssql.TinyInt, 1);
            vencRequest.input('NumVencimiento', mssql.Int, 1);

            await vencRequest.query(`
                INSERT INTO dbo.FacturasProveedores_Vencimientos
                (idFacturaProveedor, Fecha, Importe, Pagado, Imp_Pagado, Pagar, NumVencimiento)
                VALUES
                (@idFacturaProveedor, @Fecha, @Importe, @Pagado, @Imp_Pagado, @Pagar, @NumVencimiento)
            `);
        }

        await transaction.commit();
        await writeAuditLog({
            action: 'FACTURA_GUARDADA',
            entity: 'FacturasProveedores',
            detail: `Factura "${data.numFactura || ''}" guardada para la sociedad ${data.idSociedad || ''}.`
        });
        return { success: true, id: idFacturaProveedor };

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('SQL Transaction Error', err);
        throw err;
    }
}

async function checkInvoiceExists(idSociedad, idProveedor, numFactura, proveedorNombre = null) {
    try {
        let pool = await mssql.connect(config);
        
        let targetIdProveedor = idProveedor;
        if (!targetIdProveedor && proveedorNombre) {
            targetIdProveedor = await getProveedorByName(proveedorNombre);
        }
        
        if (!targetIdProveedor) return false;

        let request = pool.request();
        request.input('idSociedad', mssql.Int, idSociedad);
        request.input('idProveedor', mssql.Int, targetIdProveedor);
        request.input('NumFactuProv', mssql.VarChar(50), numFactura);
        
        const query = `
            SELECT idFacturaProveedor 
            FROM dbo.FacturasProveedores 
            WHERE idSociedad = @idSociedad 
              AND idProveedor = @idProveedor 
              AND NumFactuProv = @NumFactuProv
        `;
        
        let result = await request.query(query);
        return result.recordset.length > 0;
    } catch (err) {
        console.error('SQL error checking invoice existence', err);
        throw err;
    }
}

async function getUpcomingExpirations(sociedadId) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        let whereClause = '';
        if (sociedadId) {
            request.input('sociedadId', mssql.Int, sociedadId);
            whereClause = 'AND fp.idSociedad = @sociedadId';
        }

        const query = `
            SELECT 
                v.idFacturaProveedor,
                CONVERT(date, v.Fecha) AS fechaVencimiento,
                CAST(v.Importe AS decimal(18,2)) AS importe,
                fp.NumFactuProv AS numFactura,
                p.RazonSocial AS proveedor
            FROM dbo.FacturasProveedores_Vencimientos v
            INNER JOIN dbo.FacturasProveedores fp ON v.idFacturaProveedor = fp.idFacturaProveedor
            INNER JOIN dbo.gf_Proveedores p ON fp.idProveedor = p.IdProveedor
            WHERE v.NumVencimiento = (
                SELECT MAX(v2.NumVencimiento) 
                FROM dbo.FacturasProveedores_Vencimientos v2 
                WHERE v2.idFacturaProveedor = v.idFacturaProveedor
            )
            AND v.Fecha >= CAST(GETDATE() AS DATE) 
            AND v.Fecha <= DATEADD(day, 7, CAST(GETDATE() AS DATE))
            AND (ISNULL(v.Pagado, 0) = 0 OR ISNULL(v.Imp_Pagado, 0) < v.Importe)
            AND ISNULL(v.Pagar, 1) = 1
            ${whereClause}
            ORDER BY v.Fecha ASC
        `;

        let result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error('SQL error getting upcoming expirations', err);
        throw err;
    }
}

async function getInvoiceDetails(invoiceId) {
    try {
        let pool = await mssql.connect(config);
        
        // 1. Get Header
        let headerRequest = pool.request();
        headerRequest.input('id', mssql.Int, invoiceId);
        const headerQuery = `
            SELECT 
              fp.idFacturaProveedor AS id,
              fp.NumFactura AS num,
              fp.NumFactuProv AS numFacturaProveedor,
              fp.Fecha AS fecha,
              fp.FechaEntrada AS fechaEntrada,
              p.RazonSocial AS proveedor,
              p.Documento AS proveedorDoc,
              fp.Concepto AS concepto,
              fp.Observaciones AS observaciones,
              fp.BaseImponible AS baseImponible,
              fp.IVA AS iva,
              fp.Total_con_IVA AS total,
              ft.Nombre AS tipo,
              fp.Validado AS validado,
              s.RazonSocial AS sociedad,
              vs.fechaVencimiento AS fechaVencimiento,
              CASE
                WHEN ISNULL(vs.totalPagado, 0) >= (fp.Total_con_IVA - 0.01) AND ISNULL(vs.cnt, 0) > 0 THEN 'pagado'
                WHEN vs.fechaVencimiento < CAST(GETDATE() AS DATE) THEN 'vencida'
                ELSE 'pendiente'
              END AS estado
            FROM dbo.FacturasProveedores fp
            LEFT JOIN dbo.gf_Proveedores p ON p.IdProveedor = fp.idProveedor
            LEFT JOIN dbo.Facturas_Tipos ft ON ft.IdFacturaTipo = fp.idFacturaTipo
            LEFT JOIN dbo.Sociedades s ON s.idSociedad = fp.idSociedad
            OUTER APPLY (
              SELECT
                COUNT(*) AS cnt,
                MAX(ISNULL(v.Imp_Pagado, 0)) AS totalPagado,
                MAX(v.Fecha) AS fechaVencimiento
              FROM dbo.FacturasProveedores_Vencimientos v
              WHERE v.idFacturaProveedor = fp.idFacturaProveedor
            ) vs
            WHERE fp.idFacturaProveedor = @id
        `;
        let headerResult = await headerRequest.query(headerQuery);
        if (headerResult.recordset.length === 0) return null;
        const header = headerResult.recordset[0];

        // 2. Get Lines
        let linesRequest = pool.request();
        linesRequest.input('id', mssql.Int, invoiceId);
        const linesQuery = `
            SELECT 
              idFacturaProveedorLinea AS id,
              NumOrden AS numOrden,
              Concepto AS concepto,
              Cantidad AS cantidad,
              Precio AS precio,
              Porc_IVA AS porcIva,
              (Cantidad * Precio) AS base,
              (Cantidad * Precio * Porc_IVA / 100) AS cuotaIva,
              (Cantidad * Precio * (1 + Porc_IVA / 100)) AS total
            FROM dbo.FacturasProveedores_Lineas
            WHERE idFacturaProveedor = @id
            ORDER BY NumOrden
        `;
        let linesResult = await linesRequest.query(linesQuery);

        // 3. Get Vencimientos
        let vencRequest = pool.request();
        vencRequest.input('id', mssql.Int, invoiceId);
        const vencQuery = `
            SELECT 
              idFacturaProveedorVencimiento AS id,
              Fecha AS fecha,
              Importe AS importe,
              Pagado AS pagado,
              Imp_Pagado AS importePagado,
              FechaPago AS fechaPago,
              IdFormaPago AS idFormaPago,
              idTesoreria AS idTesoreria,
              NumVencimiento AS numVencimiento
            FROM dbo.FacturasProveedores_Vencimientos
            WHERE idFacturaProveedor = @id
            ORDER BY NumVencimiento, Fecha
        `;
        let vencResult = await vencRequest.query(vencQuery);

        return {
            header,
            lines: linesResult.recordset,
            vencimientos: vencResult.recordset
        };
    } catch (err) {
        console.error('SQL error getting invoice details', err);
        throw err;
    }
}

async function toggleInvoicePaid(invoiceId, isPaid) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        request.input('id', mssql.Int, invoiceId);
        request.input('isPaid', mssql.TinyInt, isPaid ? 1 : 0);
        
        // Update all vencimientos that are marked to be paid (when paying) 
        // or all that were paid (when unpaying)
        const query = isPaid 
            ? `UPDATE dbo.FacturasProveedores_Vencimientos 
               SET Pagado = 1, Pagar = 0, Imp_Pagado = Importe, FechaPago = GETDATE() 
               WHERE idFacturaProveedor = @id AND ISNULL(Pagar, 1) = 1`
            : `UPDATE dbo.FacturasProveedores_Vencimientos 
               SET Pagado = 0, Pagar = 1, Imp_Pagado = 0, FechaPago = NULL 
               WHERE idFacturaProveedor = @id AND ISNULL(Pagado, 0) = 1`;
        
        await request.query(query);
        await writeAuditLog({
            action: isPaid ? 'FACTURA_MARCAR_PAGADA' : 'FACTURA_MARCAR_PENDIENTE',
            entity: 'FacturasProveedores_Vencimientos',
            detail: `Factura ${invoiceId} marcada como ${isPaid ? 'pagada' : 'pendiente'}.`
        });
        return { success: true };
    } catch (err) {
        console.error('SQL error toggling invoice paid status', err);
        throw err;
    }
}

async function addInvoicePayment(invoiceId, data) {
    try {
        let pool = await mssql.connect(config);
        
        // 1. Get Invoice Total, Previous Max Paid, and Next NumVencimiento
        const infoResult = await pool.request()
            .input('id', mssql.Int, invoiceId)
            .query(`
                SELECT 
                    (SELECT ISNULL(MAX(NumVencimiento), 0) + 1 FROM dbo.FacturasProveedores_Vencimientos WHERE idFacturaProveedor = @id) AS nextNum,
                    (SELECT Total_con_IVA FROM dbo.FacturasProveedores WHERE idFacturaProveedor = @id) AS totalInvoice,
                    (SELECT ISNULL(MAX(Imp_Pagado), 0) FROM dbo.FacturasProveedores_Vencimientos WHERE idFacturaProveedor = @id) AS currentTotalPaid
            `);
        
        const nextNum = infoResult.recordset[0].nextNum;
        const totalInvoice = infoResult.recordset[0].totalInvoice || 0;
        const previousTotalPaid = infoResult.recordset[0].currentTotalPaid || 0;

        // 2. Mapping
        const formaPagoMap = {
            'Transferencia Bancaria': 19,
            'Cheque': 10,
            'Contado': 7,
            'E.C. ADEUDO EN CUENTA': 14,
            'Pagaré': 8,
            'TRANSFERENCIA BANCARIA C/C BANKINTER': 15,
            'TRANSFERENCIA BANCARIA C/C SANTANDER': 11,
            'VISA': 13
        };
        const tesoreriaMap = {
            'Prueba Inteco': 2,
            'Prueba Inteco 2': 3,
            'Caja': 4,
            'Banco': 6
        };

        const currentPaymentAmount = Math.abs(parseFloat(data.importe)) || 0;
        const newCumulativeTotal = previousTotalPaid + currentPaymentAmount;
        const isFullyPaid = newCumulativeTotal >= (totalInvoice - 0.01);

        const request = pool.request();
        request.input('idFacturaProveedor', mssql.Int, invoiceId);
        request.input('Fecha', mssql.SmallDateTime, data.fecha || new Date());
        request.input('Importe', mssql.Money, totalInvoice);
        request.input('Pagado', mssql.TinyInt, isFullyPaid ? 1 : 0);
        request.input('Imp_Pagado', mssql.Money, newCumulativeTotal);
        request.input('Pagar', mssql.TinyInt, isFullyPaid ? 0 : 1);
        request.input('NumVencimiento', mssql.Int, nextNum);
        request.input('FechaPago', mssql.SmallDateTime, data.fechaPago || new Date());
        request.input('IdFormaPago', mssql.Int, formaPagoMap[data.formaPago] || 19);
        request.input('idTesoreria', mssql.Int, tesoreriaMap[data.tesoreria] || 6);

        await request.query(`
            INSERT INTO dbo.FacturasProveedores_Vencimientos
            (idFacturaProveedor, Fecha, Importe, Pagado, Imp_Pagado, Pagar, NumVencimiento, FechaPago, IdFormaPago, idTesoreria)
            VALUES
            (@idFacturaProveedor, @Fecha, @Importe, @Pagado, @Imp_Pagado, @Pagar, @NumVencimiento, @FechaPago, @IdFormaPago, @idTesoreria)
        `);

        await writeAuditLog({
            action: 'PAGO_FACTURA_AÑADIDO',
            entity: 'FacturasProveedores_Vencimientos',
            detail: `Se añadió un pago a la factura ${invoiceId} por ${currentPaymentAmount.toFixed(2)}.`
        });

        return { success: true };
    } catch (err) {
        console.error('SQL error adding invoice payment', err);
        throw err;
    }
}

async function deleteInvoicePayment(vencimientoId) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        request.input('id', mssql.Int, vencimientoId);
        await request.query('DELETE FROM dbo.FacturasProveedores_Vencimientos WHERE idFacturaProveedorVencimiento = @id');
        await writeAuditLog({
            action: 'PAGO_FACTURA_ELIMINADO',
            entity: 'FacturasProveedores_Vencimientos',
            detail: `Se eliminó el vencimiento/pago ${vencimientoId}.`
        });
        return { success: true };
    } catch (err) {
        console.error('SQL error deleting invoice payment', err);
        throw err;
    }
}

async function getNextNumFactura(idSociedad, fecha) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        const year = fecha ? new Date(fecha).getFullYear() : new Date().getFullYear();
        
        request.input('idSociedad', mssql.Int, idSociedad);
        request.input('year', mssql.Int, year);
        
        const query = `
            SELECT ISNULL(MAX(CAST(NumFactura AS INT)), 0) + 1 AS nextNum 
            FROM dbo.FacturasProveedores 
            WHERE idSociedad = @idSociedad 
              AND YEAR(FechaEntrada) = @year
        `;
        
        let result = await request.query(query);
        return result.recordset[0].nextNum;
    } catch (err) {
        console.error('SQL error getting next NumFactura', err);
        throw err;
    }
}

async function deleteInvoice(invoiceId) {
    let pool = await mssql.connect(config);
    const transaction = new mssql.Transaction(pool);
    try {
        await transaction.begin();
        const request = transaction.request();
        request.input('id', mssql.Int, invoiceId);
        
        // 1. Delete child-of-children (Transacciones linked to Vencimientos)
        await request.query(`
            DELETE FROM dbo.Transacciones 
            WHERE idFacturaProveedorVencimiento IN (
                SELECT idFacturaProveedorVencimiento 
                FROM dbo.FacturasProveedores_Vencimientos 
                WHERE idFacturaProveedor = @id
            )
        `);
        
        // 2. Delete direct children linked to Vencimientos (if any, like Remesas)
        await request.query(`
            DELETE FROM dbo.Remesas_Domiciliaciones 
            WHERE IdRemesaDomiciliacion IN (
                SELECT IdRemesaDomiciliacion 
                FROM dbo.Transacciones 
                WHERE idFacturaProveedorVencimiento IN (
                    SELECT idFacturaProveedorVencimiento 
                    FROM dbo.FacturasProveedores_Vencimientos 
                    WHERE idFacturaProveedor = @id
                )
            )
        `);
        
        // 3. Delete direct children of FacturasProveedores
        await request.query('DELETE FROM dbo.FacturasProveedores_Vencimientos WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.FacturasProveedores_Lineas WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.Anticipos WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.gf_CursosDocentes WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.FacturasClientes_FacturasProveedores WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.gf_FacturasCostesAsociados WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.gf_FacturasCostesDirectos WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.gf_FacturasOtrosCostesSubvencionables WHERE idFacturaProveedor = @id');
        await request.query('DELETE FROM dbo.gf_JustificacionFacturasCostes WHERE idFacturaProveedor = @id');
        
        // 4. Delete the Header
        await request.query('DELETE FROM dbo.FacturasProveedores WHERE idFacturaProveedor = @id');
        
        await transaction.commit();
        await writeAuditLog({
            action: 'FACTURA_ELIMINADA',
            entity: 'FacturasProveedores',
            detail: `Se eliminó la factura ${invoiceId}.`
        });
        return { success: true };
    } catch (err) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rbErr) {
                console.error('Error during rollback:', rbErr);
            }
        }
        console.error('SQL error deleting invoice', err);
        throw err;
    }
}

/**
 * Devuelve un ranking de los proveedores con mayor volumen de facturación.
 * Consulta no trivial: usa GROUP BY, SUM, COUNT y ORDER BY sobre múltiples tablas.
 * @param {number} sociedadId - Filtra por sociedad (opcional)
 * @param {number} topN - Número de proveedores a devolver (default 10)
 */
async function getRankingProveedores(sociedadId = null, topN = 10) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        let safeTop = Math.max(1, Math.min(parseInt(topN) || 10, 100));
        let whereClause = '';
        if (sociedadId) {
            request.input('sociedadId', mssql.Int, sociedadId);
            whereClause = 'WHERE fp.idSociedad = @sociedadId';
        }
        const query = `
            SELECT TOP ${safeTop}
                p.RazonSocial AS proveedor,
                p.Documento AS cif,
                COUNT(fp.idFacturaProveedor) AS numFacturas,
                CAST(SUM(fp.BaseImponible) AS decimal(18,2)) AS totalBaseImponible,
                CAST(SUM(fp.IVA) AS decimal(18,2)) AS totalIVA,
                CAST(SUM(fp.Total_con_IVA) AS decimal(18,2)) AS totalFacturado,
                CAST(AVG(fp.Total_con_IVA) AS decimal(18,2)) AS mediaFactura,
                RANK() OVER (ORDER BY SUM(fp.Total_con_IVA) DESC) AS posicion
            FROM dbo.FacturasProveedores fp
            INNER JOIN dbo.gf_Proveedores p ON p.IdProveedor = fp.idProveedor
            ${whereClause}
            GROUP BY p.RazonSocial, p.Documento
            ORDER BY totalFacturado DESC
        `;
        let result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error('SQL error getting ranking proveedores', err);
        throw err;
    }
}

/**
 * Devuelve estadísticas de facturación agrupadas por mes y año.
 * Consulta no trivial: usa DATEPART, GROUP BY con funciones de fecha, y múltiples agregaciones.
 * @param {number} sociedadId - Filtra por sociedad (opcional)
 * @param {number} anio - Año a filtrar (opcional, por defecto el actual)
 */
async function getEstadisticasMensuales(sociedadId = null, anio = null) {
    try {
        let pool = await mssql.connect(config);
        let request = pool.request();
        const targetYear = parseInt(anio) || new Date().getFullYear();
        request.input('anio', mssql.Int, targetYear);
        let whereClause = 'WHERE YEAR(fp.FechaEntrada) = @anio';
        if (sociedadId) {
            request.input('sociedadId', mssql.Int, sociedadId);
            whereClause += ' AND fp.idSociedad = @sociedadId';
        }
        const query = `
            SELECT
                DATEPART(YEAR, fp.FechaEntrada) AS anio,
                DATEPART(MONTH, fp.FechaEntrada) AS mes,
                DATENAME(MONTH, fp.FechaEntrada) AS nombreMes,
                COUNT(fp.idFacturaProveedor) AS numFacturas,
                COUNT(DISTINCT fp.idProveedor) AS numProveedores,
                CAST(SUM(fp.BaseImponible) AS decimal(18,2)) AS totalBaseImponible,
                CAST(SUM(fp.IVA) AS decimal(18,2)) AS totalIVA,
                CAST(SUM(fp.Total_con_IVA) AS decimal(18,2)) AS totalFacturado,
                CAST(AVG(fp.Total_con_IVA) AS decimal(18,2)) AS mediaFactura,
                CAST(MAX(fp.Total_con_IVA) AS decimal(18,2)) AS maxFactura,
                CAST(MIN(fp.Total_con_IVA) AS decimal(18,2)) AS minFactura
            FROM dbo.FacturasProveedores fp
            ${whereClause}
            GROUP BY
                DATEPART(YEAR, fp.FechaEntrada),
                DATEPART(MONTH, fp.FechaEntrada),
                DATENAME(MONTH, fp.FechaEntrada)
            ORDER BY anio, mes
        `;
        let result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error('SQL error getting estadisticas mensuales', err);
        throw err;
    }
}

module.exports = {
    listSociedades,
    listFacturas,
    getFacturasChangeStamp,
    getProvincias,
    checkProveedorExists,
    setAuditContext,
    getUserRole,
    writeAuditLog,
    getUsersWithRoles,
    saveSecurityUser,
    getAuditLog,
    saveProveedor,
    getPoblacionByCP,
    saveInvoiceDB,
    checkInvoiceExists,
    getProveedorByName,
    getUpcomingExpirations,
    getInvoiceDetails,
    toggleInvoicePaid,
    addInvoicePayment,
    deleteInvoicePayment,
    getNextNumFactura,
    deleteInvoice,
    getRankingProveedores,
    getEstadisticasMensuales
};
