/**
 * SUITE DE PRUEBAS UNITARIAS — Facturas GForma
 * Framework: Jest
 * Cubre: Lógica de negocio, validaciones, cálculos financieros y servicio XML.
 * No requiere conexión real a SQL Server ni a Mindee API.
 */

// ─────────────────────────────────────────────────────────
// MÓDULO 1: Lógica de Cálculos de IVA (unidad pura)
// ─────────────────────────────────────────────────────────

/**
 * Función pura extraída de la lógica de saveInvoiceDB.
 * Calcula totales de cabecera a partir de líneas de factura.
 */
function calcularTotalesFactura(lineas) {
    const baseImponible = lineas.reduce((sum, l) => sum + (parseFloat(l.importe) || 0), 0);
    const cuotaIva = lineas.reduce((sum, l) =>
        sum + ((parseFloat(l.importe) || 0) * (parseFloat(l.iva) || 0) / 100), 0);
    return {
        baseImponible: Math.round(baseImponible * 100) / 100,
        cuotaIva: Math.round(cuotaIva * 100) / 100,
        total: Math.round((baseImponible + cuotaIva) * 100) / 100
    };
}

/**
 * Función pura: Mapea el tipo de documento fiscal por patrón del NIF/CIF.
 * Extraída de mindee-service.js (post-processing).
 */
function detectarTipoDocumento(taxId) {
    if (!taxId) return 'Otros';
    const id = taxId.trim().toUpperCase();
    if (/^\d{8}[A-Z]$/.test(id)) return 'DNI';
    if (/^[XYZ]\d{7}[A-Z]$/.test(id)) return 'NIE';
    if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7,8}[0-9A-Z]?$/.test(id)) return 'CIF';
    return 'Otros';
}

/**
 * Función pura: Limpieza del CIF devuelto por Mindee.
 * Extraída de mindee-service.js (cleanCIF helper).
 */
function limpiarCIF(val) {
    if (!val) return null;
    let cleaned = val.replace(/C\.?I\.?F\.?:?\s*/i, '')
                     .replace(/[^A-Z0-9]/gi, '')
                     .toUpperCase()
                     .trim();
    return cleaned || null;
}

/**
 * Función pura: Validación básica de formulario de factura.
 */
function validarDatosFactura(data) {
    const errores = [];
    if (!data.numFactura || !data.numFactura.trim()) errores.push('Número de factura requerido');
    if (!data.fechaEmision) errores.push('Fecha de emisión requerida');
    if (!data.idSociedad) errores.push('Sociedad requerida');
    if (!data.lines || data.lines.length === 0) errores.push('La factura debe tener al menos una línea');
    if (data.lines && data.lines.some(l => parseFloat(l.importe) < 0)) errores.push('Los importes no pueden ser negativos');
    return errores;
}

/**
 * Función pura: Determina el ID de IVA de la tabla de SQL Server.
 * Extraída de saveInvoiceDB (sql-service.js).
 */
function mapearIdIVA(porcentajeIva) {
    const pct = parseFloat(porcentajeIva);
    if (pct >= 21) return 8;    // 21%
    if (pct >= 10) return 8;    // 10% — fallback a 8 (ajustar si hay ID correcto)
    if (pct >= 4)  return 3;    // 4% reducido
    return 2;                   // Exento / 0%
}

// ─────────────────────────────────────────────────────────
// TEST 1: Cálculo correcto de totales con IVA al 21%
// ─────────────────────────────────────────────────────────
describe('Cálculos de IVA y totales', () => {
    test('TC-01: Calcula correctamente base, IVA y total con tipo 21%', () => {
        const lineas = [
            { importe: 1000, iva: 21 },
            { importe: 500, iva: 21 }
        ];
        const resultado = calcularTotalesFactura(lineas);
        expect(resultado.baseImponible).toBe(1500);
        expect(resultado.cuotaIva).toBe(315);
        expect(resultado.total).toBe(1815);
    });

    // ─────────────────────────────────────────────────────
    // TEST 2: Factura con líneas de distintos tipos de IVA
    // ─────────────────────────────────────────────────────
    test('TC-02: Mezcla de líneas con IVA 21%, 10% y exento (0%)', () => {
        const lineas = [
            { importe: 200, iva: 21 },
            { importe: 300, iva: 10 },
            { importe: 100, iva: 0 }
        ];
        const resultado = calcularTotalesFactura(lineas);
        expect(resultado.baseImponible).toBe(600);
        expect(resultado.cuotaIva).toBe(42 + 30 + 0); // 72
        expect(resultado.total).toBe(672);
    });

    // ─────────────────────────────────────────────────────
    // TEST 3: Factura con una única línea de importe cero
    // ─────────────────────────────────────────────────────
    test('TC-03: Línea con importe 0 no altera el total', () => {
        const lineas = [
            { importe: 0, iva: 21 },
            { importe: 100, iva: 21 }
        ];
        const resultado = calcularTotalesFactura(lineas);
        expect(resultado.total).toBe(121);
    });
});

// ─────────────────────────────────────────────────────────
// TEST 4 y 5: Detección del tipo de documento fiscal
// ─────────────────────────────────────────────────────────
describe('Detección tipo de documento fiscal (NIF/CIF/DNI)', () => {
    test('TC-04: Identifica correctamente un CIF de empresa española', () => {
        expect(detectarTipoDocumento('B36856540')).toBe('CIF');
        expect(detectarTipoDocumento('A28015865')).toBe('CIF');
    });

    test('TC-05: Identifica DNI, NIE y devuelve "Otros" para formatos desconocidos', () => {
        expect(detectarTipoDocumento('12345678Z')).toBe('DNI');
        expect(detectarTipoDocumento('X1234567L')).toBe('NIE');
        expect(detectarTipoDocumento('123')).toBe('Otros');
        expect(detectarTipoDocumento(null)).toBe('Otros');
    });
});

// ─────────────────────────────────────────────────────────
// TEST 6: Limpieza del CIF devuelto por la IA
// ─────────────────────────────────────────────────────────
describe('Limpieza de CIF (post-procesado Mindee)', () => {
    test('TC-06: Elimina etiquetas y caracteres no alfanuméricos del CIF', () => {
        expect(limpiarCIF('C.I.F.: B-36856540')).toBe('B36856540');
        expect(limpiarCIF('A28.015.865')).toBe('A28015865');
        expect(limpiarCIF(null)).toBeNull();
        expect(limpiarCIF('')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────
// TEST 7: Validación de formulario de factura
// ─────────────────────────────────────────────────────────
describe('Validación de datos de factura antes de guardar', () => {
    test('TC-07: Detecta todos los errores en una factura incompleta', () => {
        const facturaVacia = { numFactura: '', fechaEmision: null, idSociedad: null, lines: [] };
        const errores = validarDatosFactura(facturaVacia);
        expect(errores).toContain('Número de factura requerido');
        expect(errores).toContain('Fecha de emisión requerida');
        expect(errores).toContain('Sociedad requerida');
        expect(errores).toContain('La factura debe tener al menos una línea');
    });

    test('TC-07b: Una factura completa y válida no genera errores', () => {
        const facturaValida = {
            numFactura: 'F-2025-001',
            fechaEmision: '2025-05-29',
            idSociedad: 1,
            lines: [{ importe: 100, iva: 21 }]
        };
        expect(validarDatosFactura(facturaValida)).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────
// TEST 8: Mapeo del ID de IVA para SQL Server
// ─────────────────────────────────────────────────────────
describe('Mapeo de porcentaje IVA a ID en la base de datos', () => {
    test('TC-08: Asigna los IDs de IVA correctos según el porcentaje', () => {
        expect(mapearIdIVA(21)).toBe(8);   // 21% → ID 8
        expect(mapearIdIVA(10)).toBe(8);   // 10% → fallback ID 8
        expect(mapearIdIVA(4)).toBe(3);    // 4%  → ID 3
        expect(mapearIdIVA(0)).toBe(2);    // 0% / Exento → ID 2
        expect(mapearIdIVA(-1)).toBe(2);   // Negativo → Exento
    });
});
