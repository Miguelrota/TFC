const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function generateXML(invoiceData) {
    const builder = new xml2js.Builder({
        rootName: 'Factura',
        xmldec: { 'version': '1.0', 'encoding': 'UTF-8' }
    });

    const obj = {
        Metadata: {
            Tipo: invoiceData.documentType,
            Version: '1.0'
        },
        DatosGenerales: {
            NumeroFactura: invoiceData.invoiceNumber,
            DocId: invoiceData.docId,
            FechaEmision: invoiceData.date,
            FechaVencimiento: invoiceData.dueDate,
            Moneda: invoiceData.currency
        },
        Emisor: {
            Nombre: invoiceData.legalBusinessName,
            NombreComercial: invoiceData.commercialName,
            CIF: invoiceData.taxId,
            Direccion: invoiceData.address,
            Ciudad: invoiceData.city,
            CodigoPostal: invoiceData.postalCode,
            Pais: invoiceData.country
        },
        Importes: {
            BaseImponible: invoiceData.totalNet,
            IVA: invoiceData.totalTax,
            Total: invoiceData.totalAmount
        }
    };

    const xml = builder.buildObject(obj);
    
    let outputDir = process.env.XML_OUTPUT_DIR || './output/xml';
    
    // If relative path, make it relative to userData for packaged apps
    if (!path.isAbsolute(outputDir)) {
        try {
            const { app } = require('electron');
            const baseDir = app ? app.getPath('userData') : process.cwd();
            outputDir = path.join(baseDir, outputDir);
        } catch (e) {
            outputDir = path.resolve(outputDir);
        }
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Sanitize invoice number for filename (Windows doesn't allow : / \ * ? " < > |)
    const sanitizedNumber = (invoiceData.invoiceNumber || 'unknown')
        .replace(/[<>:"\/\\|?*]/g, '_')
        .trim();

    const fileName = `factura_${sanitizedNumber || Date.now()}.xml`;
    const filePath = path.join(outputDir, fileName);
    
    fs.writeFileSync(filePath, xml);
    
    return filePath;
}

async function parseXML(xmlPath) {
    try {
        const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xmlContent);
        
        const factura = result.Factura;
        
        // Map back to DTO
        return {
            documentType: factura.Metadata.Tipo,
            invoiceNumber: factura.DatosGenerales.NumeroFactura,
            docId: factura.DatosGenerales.DocId,
            date: factura.DatosGenerales.FechaEmision,
            dueDate: factura.DatosGenerales.FechaVencimiento,
            currency: factura.DatosGenerales.Moneda,
            legalBusinessName: factura.Emisor.Nombre,
            commercialName: factura.Emisor.NombreComercial,
            taxId: factura.Emisor.CIF,
            address: factura.Emisor.Direccion,
            city: factura.Emisor.Ciudad,
            postalCode: factura.Emisor.CodigoPostal,
            country: factura.Emisor.Pais,
            totalNet: factura.Importes.BaseImponible,
            totalTax: factura.Importes.IVA,
            totalAmount: factura.Importes.Total
        };
    } catch (err) {
        console.error('Error parsing XML:', err);
        throw err;
    }
}

module.exports = {
    generateXML,
    parseXML
};
