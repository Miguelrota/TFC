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

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'w2019-sql',
    database: process.env.DB_NAME || 'GestionFormacion',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' ? false : true,
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};

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
                SUM(ISNULL(v.Imp_Pagado, 0)) AS totalPagado,
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
                SELECT ISNULL(MAX(NumFactura), 0) + 1 AS nextNum 
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
            WHERE v.Fecha >= CAST(GETDATE() AS DATE) 
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
                SUM(ISNULL(v.Imp_Pagado, 0)) AS totalPagado,
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
        return { success: true };
    } catch (err) {
        console.error('SQL error toggling invoice paid status', err);
        throw err;
    }
}

async function addInvoicePayment(invoiceId, data) {
    try {
        let pool = await mssql.connect(config);
        
        // 1. Get Next NumVencimiento
        const nextNumResult = await pool.request()
            .input('id', mssql.Int, invoiceId)
            .query('SELECT ISNULL(MAX(NumVencimiento), 0) + 1 AS nextNum FROM dbo.FacturasProveedores_Vencimientos WHERE idFacturaProveedor = @id');
        const nextNum = nextNumResult.recordset[0].nextNum;

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

        const request = pool.request();
        request.input('idFacturaProveedor', mssql.Int, invoiceId);
        request.input('Fecha', mssql.SmallDateTime, data.fecha || new Date());
        request.input('Importe', mssql.Money, Math.abs(parseFloat(data.importe)) || 0);
        request.input('Pagado', mssql.TinyInt, 1);
        request.input('Imp_Pagado', mssql.Money, Math.abs(parseFloat(data.importe)) || 0);
        request.input('Pagar', mssql.TinyInt, 0);
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
            SELECT ISNULL(MAX(NumFactura), 0) + 1 AS nextNum 
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

module.exports = {
    listSociedades,
    listFacturas,
    getProvincias,
    checkProveedorExists,
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
    getNextNumFactura
};
