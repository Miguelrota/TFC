const { Client, product, PathInput } = require("mindee");
const fs = require('fs');
const path = require('path');

// Helper to find the .env file path
function getEnvPath() {
    // If we are in the main process, we can use app
    try {
        const { app } = require('electron');
        if (app && app.isPackaged) {
            return path.join(process.resourcesPath, '.env');
        }
    } catch (e) {
        // Fallback for cases where electron app is not available
    }
    return path.join(process.cwd(), '.env');
}

require('dotenv').config({ path: getEnvPath() });

const apiKey = process.env.MINDEE_API_KEY;
const modelId = process.env.MINDEE_MODEL_ID;

// Initialize client only if apiKey exists to avoid SDK errors
let mindeeClient = null;
if (apiKey) {
    try {
        mindeeClient = new Client({ apiKey });
    } catch (e) {
        console.error('Failed to initialize Mindee client:', e);
    }
}

/**
 * Extracts data from an invoice using Mindee V2 API (DocTI / Extraction)
 * This is the modern way to support V2 platform tokens.
 * @param {string} filePath - Path to the invoice file (PDF or image)
 * @returns {Promise<Object>} - Mapped invoice data
 */
async function extractData(filePath) {
    try {
        console.log(`Starting Mindee V2 (DocTI) analysis for: ${filePath}`);
        
        if (!mindeeClient) {
            throw new Error('La API Key de Mindee no está configurada o es inválida. Revisa el archivo .env');
        }

        if (!modelId) {
            throw new Error('MINDEE_MODEL_ID no está configurado en el archivo .env');
        }

        // Load the file using PathInput (SDK v5+)
        const inputSource = new PathInput({ inputPath: filePath });

        // Parse the document using the modern V2 client with Extraction product
        // We use the provided modelId from the dashboard
        const apiResponse = await mindeeClient.enqueueAndGetResult(
            product.Extraction,
            inputSource,
            { modelId: modelId }
        );

        const fields = apiResponse.inference.result.fields;
        console.log('Mindee V2 raw fields keys:', Array.from(fields.keys()));

        /**
         * Helper to get a field value safely and cleanly.
         * For DocTI, we prioritize .content (raw text) over .value (typed object)
         * to avoid SDK-specific string formatting like ":field: value".
         */
        const getVal = (name) => {
            const field = fields.get(name);
            if (!field) return null;
            
            let target = null;
            if (Array.isArray(field)) {
                target = field.length > 0 ? field[0] : null;
            } else {
                target = field;
            }

            if (!target) return null;

            // Prioritize raw content to avoid SDK's formatted toString()
            let result = target.content !== undefined ? target.content : 
                        (target.value !== undefined ? target.value : target);

            if (result !== null && typeof result === 'object') {
                // If it's still an object, try to find a string property
                result = result.content || result.value || result.toString();
            }

            if (result === null || result === undefined) return null;
            
            // Convert to string and trim
            let strResult = String(result).trim();
            
            // Remove SDK-style tags anywhere in the string (DocTI formatting noise)
            // We only remove tags with 3 or more characters to avoid breaking 
            // invoice numbers that use colons for single letters/digits (e.g., "1:A:26")
            strResult = strResult.replace(/:[^:\s]{3,}:/g, '').trim();
            
            // Also clean any leftover tag at the very beginning
            strResult = strResult.replace(/^:[^:\s]+:?\s*/, '').trim();
            
            return (strResult === '[object Object]') ? null : strResult;
        };

        // Debug: Log all keys and their values (truncated) to help identify custom fields
        console.log('--- Mindee DocTI Field Mapping ---');
        for (const [key, value] of fields.entries()) {
            console.log(`Key: ${key} -> Value: ${value?.value || value?.toString()}`);
        }
        console.log('---------------------------------');

        // Map Mindee V2 Extraction fields to our Application DTO
        // Note: Field names in DocTI "invoices" model usually follow standard naming
        const mappedData = {
            invoiceNumber: getVal('invoice_number') || getVal('number'),
            date: getVal('date'),
            dueDate: getVal('due_date') || getVal('expiry_date'),
            totalAmount: parseFloat(getVal('total_amount') || getVal('total') || '0'),
            totalTax: parseFloat(getVal('total_tax') || getVal('tax') || '0'),
            
            // Supplier info
            legalBusinessName: getVal('supplier_name') || getVal('vendor_name') || getVal('razon_social') || 'Proveedor Desconocido',
            commercialName: getVal('supplier_name') || getVal('vendor_name') || getVal('nombre_comercial'),
            
            // Try to find only the street part for address if possible
            address: getVal('supplier_address') || getVal('vendor_address') || getVal('direccion') || getVal('calle'),
            city: getVal('supplier_city') || getVal('vendor_city') || getVal('poblacion') || getVal('ciudad') || getVal('localidad'),
            postalCode: getVal('supplier_postal_code') || getVal('vendor_postal_code') || getVal('cp') || getVal('codigo_postal') || getVal('zip_code'),
            country: getVal('supplier_country') || getVal('vendor_country') || getVal('pais') || getVal('country_code'),
            
            // CIF / Tax ID mapping - trying multiple common names in Spanish and English
            taxId: getVal('supplier_tax_id') || getVal('vendor_tax_id') || getVal('tax_id') || 
                   getVal('vat_number') || getVal('cif') || getVal('nif') || getVal('dni') || 
                   getVal('cif_emisor') || getVal('nif_emisor') || getVal('cif_proveedor') ||
                   getVal('supplier_registration_number') || getVal('vendor_registration_number') ||
                   getVal('tax_number') || getVal('supplier_tax_number'),
            
            // Doc ID / Reference mapping
            docId: getVal('document_id') || getVal('reference_number') || getVal('referencia') || getVal('doc_id') || getVal('referencia_factura'),
            
            // Other data
            currency: getVal('currency'),
            documentType: getVal('document_type') || getVal('tipo_documento') || 'Factura'
        };

        // Line Items Extraction
        mappedData.lineItems = [];
        
        // Technical details for tracing
        mappedData.mindeeId = apiResponse.id;

        // Extract Line Items if present
        const lineItemsField = fields.get('line_items') || fields.get('items') || fields.get('invoice_lines');
        
        if (lineItemsField) {
            // Mindee SDK ListField has .values array
            const itemsArray = lineItemsField.values || lineItemsField.items || (Array.isArray(lineItemsField) ? lineItemsField : [lineItemsField]);
            
            console.log(`Found ${itemsArray.length} line items to process`);

            mappedData.lineItems = itemsArray.map((item, idx) => {
                // The item itself contains the fields in a custom model or standard invoice
                const subFields = item.fields || item.value || item;
                
                // Debug logging for the first line
                if (idx === 0) {
                    try {
                        const debugInfo = {
                            keys: Object.keys(subFields),
                            sample: {}
                        };
                        // Try to get a string representation of each subfield
                        Object.keys(subFields).forEach(k => {
                            const f = subFields[k];
                            debugInfo.sample[k] = f ? (f.content || f.value || String(f)) : 'null';
                        });
                        
                        const { app } = require('electron');
                        const baseDir = (app && app.isPackaged) ? app.getPath('userData') : process.cwd();
                        fs.writeFileSync(path.join(baseDir, 'mindee_line_debug.json'), JSON.stringify(debugInfo, null, 2));
                    } catch (e) { console.error('Debug log failed', e); }
                }

                const getSubVal = (prop) => {
                    const findIn = (obj) => {
                        if (!obj) return null;
                        
                        let valField = null;

                        // 1. If it's a Map
                        if (typeof obj.get === 'function') {
                            valField = obj.get(prop);
                            if (!valField) {
                                // Fuzzy match in Map keys
                                for (const key of obj.keys()) {
                                    if (key.toLowerCase().includes(prop.toLowerCase())) {
                                        valField = obj.get(key);
                                        break;
                                    }
                                }
                            }
                        } 
                        // 2. If it's a plain object
                        else {
                            valField = obj[prop];
                            if (!valField) {
                                const foundKey = Object.keys(obj).find(k => 
                                    k.toLowerCase().includes(prop.toLowerCase())
                                );
                                if (foundKey) valField = obj[foundKey];
                            }
                        }

                        if (valField) {
                            return (valField.content !== undefined ? valField.content : (valField.value !== undefined ? valField.value : valField));
                        }
                        return null;
                    };

                    // Try in subFields directly, then in subFields.fields, then in subFields.value
                    return findIn(subFields) || findIn(subFields.fields) || (subFields.value ? findIn(subFields.value) : null);
                };

                const parseNum = (val) => {
                    if (val === null || val === undefined) return 0;
                    if (typeof val === 'number') return val;
                    const clean = String(val).replace(',', '.').replace(/[^-0.9.]/g, '');
                    return parseFloat(clean) || 0;
                };

                const lineData = {
                    description: getSubVal('descrip') || getSubVal('concepto') || getSubVal('product') || getSubVal('cod') || 'Artículo ' + (idx + 1),
                    quantity: parseNum(getSubVal('cant') || getSubVal('qty') || '1'),
                    unitPrice: parseNum(getSubVal('prec') || getSubVal('price') || getSubVal('unit') || '0'),
                    taxRate: parseNum(getSubVal('iva') || getSubVal('tax') || getSubVal('porcent') || '21'),
                    totalAmount: parseNum(getSubVal('total') || getSubVal('amount') || getSubVal('import') || '0')
                };

                // Apply fallback rule: Price = Amount / Quantity if Price is missing
                if (lineData.unitPrice === 0 && lineData.totalAmount !== 0) {
                    const qty = lineData.quantity || 1;
                    lineData.unitPrice = lineData.totalAmount / qty;
                    console.log(`Derived unitPrice for line ${idx}: ${lineData.unitPrice} (${lineData.totalAmount} / ${qty})`);
                }

                return lineData;
            });
        }

        // --- Post-processing: CIF Cleaning ---
        // Ensure CIF doesn't contain labels like "C.I.F." and remove hyphens/spaces
        const cleanCIF = (val) => {
            if (!val) return null;
            // Remove common labels and non-alphanumeric chars (keep letters and numbers)
            let cleaned = val.replace(/C\.?I\.?F\.?:?\s*/i, '')
                           .replace(/[^A-Z0-9]/gi, '')
                           .toUpperCase()
                           .trim();
            return cleaned || null;
        };

        if (mappedData.taxId) {
            mappedData.taxId = cleanCIF(mappedData.taxId);
        }

        // --- Post-processing: CIF Search Fallback ---
        // If taxId is still empty OR it matches the known customer CIF, search all fields for alternatives
        const CUSTOMER_CIF = 'B36856540';
        
        if (!mappedData.taxId || mappedData.taxId === CUSTOMER_CIF) {
            console.log(`taxId is ${mappedData.taxId || 'empty'}, searching all fields for alternative CIF patterns...`);
            
            // More robust regex for Spanish CIF/NIF/NIE (handles optional hyphens/spaces internally via cleaning)
            // Pattern: Letter + 8 chars OR 8 digits + Letter
            const cifRegex = /([ABCDEFGHJKLMNPQRSUVW][\s-]?\d{7,8}[\s-]?[0-9A-Z]|\d{8}[\s-]?[ABCDEFGHJKLMNPQRSUVW])/gi;
            
            let potentialCifs = [];
            
            for (const [key, field] of fields.entries()) {
                const val = String(field.content || field.value || field);
                const matches = val.match(cifRegex);
                
                if (matches) {
                    matches.forEach(m => {
                        const cleaned = cleanCIF(m);
                        if (cleaned && !potentialCifs.includes(cleaned)) {
                            potentialCifs.push(cleaned);
                            console.log(`Found potential CIF in field '${key}': ${cleaned} (raw: ${m})`);
                        }
                    });
                }
            }
            
            if (potentialCifs.length > 0) {
                // If we found multiple, prefer one that is NOT the customer CIF
                const betterCifs = potentialCifs.filter(c => c !== CUSTOMER_CIF);
                if (betterCifs.length > 0) {
                    mappedData.taxId = betterCifs[0];
                    console.log(`Selected better CIF: ${mappedData.taxId}`);
                } else if (!mappedData.taxId) {
                    // Only use customer CIF if we have absolutely nothing else and taxId was empty
                    mappedData.taxId = potentialCifs[0];
                    console.log(`No alternatives found, using: ${mappedData.taxId}`);
                }
            }
        }

        // --- Post-processing: Address Splitting & Cleaning ---
        // 1. If address is identical to country or city, it's likely a mis-mapping
        if (mappedData.address && (mappedData.address === mappedData.country || mappedData.address === mappedData.city)) {
            mappedData.address = null;
        }

        // 2. If address has everything and city/postalCode are empty, try to split
        if (mappedData.address && mappedData.address.length > 5 && (!mappedData.city || !mappedData.postalCode)) {
            console.log('Attempting to split address block...');
            const addressStr = mappedData.address;
            
            const cpMatch = addressStr.match(/(\d{5})/);
            if (cpMatch) {
                const cp = cpMatch[1];
                if (!mappedData.postalCode) mappedData.postalCode = cp;
                
                const parts = addressStr.split(cp);
                if (parts.length > 1) {
                    let cityPart = parts[1].trim();
                    cityPart = cityPart.replace(/^[,-\s]+/, '');
                    if (!mappedData.city) mappedData.city = cityPart;
                }
                
                let streetPart = parts[0].trim();
                streetPart = streetPart.replace(/[,-\s]+$/, '');
                mappedData.address = streetPart;
            }
        }

        // 3. Auto-complete/Format Country
        if (!mappedData.country) {
            const isSpanishCP = mappedData.postalCode && /^\d{5}$/.test(mappedData.postalCode);
            const isSpanishCIF = mappedData.taxId && /[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-Z]/i.test(mappedData.taxId);
            if (isSpanishCP || isSpanishCIF) {
                mappedData.country = 'España';
            }
        } else if (mappedData.country && (mappedData.country.toUpperCase() === 'ES' || mappedData.country.toUpperCase() === 'SPAIN')) {
            mappedData.country = 'España';
        }

        // 4. Clean up City if it contains part of the address
        if (mappedData.city) {
            const addressKeywords = ['Cmno', 'Calle', 'Avda', 'C/', 'C.', 'Avenida', 'Paseo', 'Plaza'];
            let cleanCity = mappedData.city;
            
            if (mappedData.address) {
                const addressWords = mappedData.address.split(/[\s,.-]+/).filter(w => w.length > 2);
                addressWords.forEach(word => {
                    const regex = new RegExp('\\b' + word + '\\b', 'gi');
                    cleanCity = cleanCity.replace(regex, '');
                });
            }
            
            // 1. Remove Mindee SDK tags (DocTI formatting noise like :street_number:, :city:, etc.)
            cleanCity = cleanCity.replace(/:[^:\s]{3,}:/g, '').trim();
            
            // 2. Remove numbers (likely street numbers leaking into city)
            cleanCity = cleanCity.replace(/\d+/g, '');
            
            // 3. Remove address keywords
            addressKeywords.forEach(word => {
                const regex = new RegExp('\\b' + word + '\\b', 'gi');
                cleanCity = cleanCity.replace(regex, '');
            });
            
            cleanCity = cleanCity.replace(/[,.-]+/g, ' ').replace(/\s+/g, ' ').trim();
            const words = cleanCity.split(' ');
            if (words.length > 1 && words[0].toLowerCase() === words[words.length-1].toLowerCase()) {
                cleanCity = words[0];
            } else if (words.length > 2) {
                cleanCity = Array.from(new Set(words)).join(' ');
            }
            mappedData.city = cleanCity;
        }

        // --- Post-processing: Document Type Detection based on Tax ID ---
        // The user wants to see "DNI", "NIF", "NIE", or "Otros" instead of "Factura"
        if (mappedData.taxId) {
            const id = mappedData.taxId;
            
            // Spanish Tax ID Formats:
            // NIF/DNI (Individuals): 8 digits + 1 control letter
            const dniRegex = /^\d{8}[A-Z]$/i;
            // NIE (Foreigners): 1 letter (X, Y, Z) + 7 digits + 1 control letter
            const nieRegex = /^[XYZ]\d{7}[A-Z]$/i;
            // CIF/NIF (Companies): 1 letter (A, B, C, D, E, F, G, H, J, K, L, M, N, P, Q, R, S, U, V, W) + 8 chars
            // Note: In the system we use 7 digits + 1 check char (digit or letter)
            const nifCompanyRegex = /^[ABCDEFGHJKLMNPQRSUVW]\d{7,8}[0-9A-Z]?$/i;

            if (dniRegex.test(id)) {
                mappedData.documentType = 'DNI';
            } else if (nieRegex.test(id)) {
                mappedData.documentType = 'NIE';
            } else if (nifCompanyRegex.test(id)) {
                mappedData.documentType = 'CIF';
            } else {
                mappedData.documentType = 'Otros';
            }
            
            // Also put the tax ID number in the 'Doc' field as requested
            mappedData.docId = id;
            
            console.log(`Document type determined by Tax ID (${id}): ${mappedData.documentType}`);
        } else {
            // Default if no tax ID is found
            mappedData.documentType = 'Otros';
        }

        console.log('Successfully mapped and post-processed Mindee V2 data:', mappedData);
        return mappedData;

    } catch (error) {
        console.error('Critical error in Mindee Service (V2):', error);
        throw new Error(`Mindee V2 Processing Failed: ${error.message}`);
    }
}

module.exports = {
    extractData
};
