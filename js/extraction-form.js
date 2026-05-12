/**
 * ExtractionForm Component
 * 
 * Manages the extraction form with editable fields for invoice data.
 * Provides validation, field population, and data retrieval functionality.
 * 
 * Requirements: 4.1-4.10, 5.4
 */
class ExtractionForm {
    constructor() {
        this.form = null;
        this.invoiceForm = null;
        this.fields = {};
        this.invoiceFields = {};
        this.currentStep = 1;
        this.validationSummary = null;
        this.saveButton = null;
        this.saveInvoiceButton = null;
        this.clearButton = null;
        this.fieldChangeCallbacks = [];
        this.proveedorConfirmado = false; // true when provider is saved or already exists in DB
        
        // ... patterns remain the same ...
        this.requiredFields = ['docId', 'legalBusinessName'];
        this.maxLengths = {
            docId: 50,
            legalBusinessName: 200,
            commercialName: 200,
            address: 200,
            city: 100,
            postalCode: 50,
            observations: 1000
        };
        // Postal code patterns by country
        this.postalCodePatterns = {
            'ES': /^\d{5}$/, 'España': /^\d{5}$/,
            'US': /^\d{5}(-\d{4})?$/, 'Estados Unidos': /^\d{5}(-\d{4})?$/,
            'FR': /^\d{5}$/, 'Francia': /^\d{5}$/,
            'DE': /^\d{5}$/, 'Alemania': /^\d{5}$/,
            'IT': /^\d{5}$/, 'Italia': /^\d{5}$/,
            'PT': /^\d{4}-\d{3}$/, 'Portugal': /^\d{4}-\d{3}$/,
            'GB': /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
            'Reino Unido': /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
            'MX': /^\d{5}$/, 'México': /^\d{5}$/,
            'AR': /^[A-Z]?\d{4}[A-Z]{0,3}$/i, 'Argentina': /^[A-Z]?\d{4}[A-Z]{0,3}$/i,
            'CL': /^\d{7}$/, 'Chile': /^\d{7}$/,
            'CO': /^\d{6}$/, 'Colombia': /^\d{6}$/
        };
        this.validCountries = ['ES', 'España', 'FR', 'Francia', 'DE', 'Alemania', 'IT', 'Italia', 'PT', 'Portugal', 'GB', 'Reino Unido', 'US', 'Estados Unidos', 'MX', 'México', 'AR', 'Argentina', 'CL', 'Chile', 'CO', 'Colombia'];
        this.provinciasList = [];
        this.lines = [];
        this.vencimientos = [];
        
        console.log('ExtractionForm initialized with multi-step support');
    }
    
    initialize() {
        // Step 1 Form
        this.form = document.getElementById('extractionForm');
        this.fields = {
            tipoDoc: document.getElementById('tipoDoc'),
            docId: document.getElementById('docId'),
            tipoProveedor: document.getElementById('tipoProveedor'),
            legalBusinessName: document.getElementById('legalBusinessName'),
            commercialName: document.getElementById('commercialName'),
            address: document.getElementById('address'),
            city: document.getElementById('city'),
            postalCode: document.getElementById('postalCode'),
            provinciaId: document.getElementById('provinciaId'),
            observations: document.getElementById('observations')
        };

        // Step 2 Form
        this.invoiceForm = document.getElementById('invoiceForm');
        this.invoiceFields = {
            idSociedad: document.getElementById('idSociedad'),
            numInterno: document.getElementById('numInterno'),
            proveedorNombre: document.getElementById('proveedorNombre'),
            numFactura: document.getElementById('numFactura'),
            tipoFactura: document.getElementById('tipoFactura'),
            fechaEmision: document.getElementById('fechaEmision'),
            fechaEntrada: document.getElementById('fechaEntrada'),
            fechaVencimiento: document.getElementById('fechaVencimiento'),
            concepto: document.getElementById('concepto')
        };
        
        this.validationSummary = document.getElementById('validationSummary');
        this.saveButton = document.getElementById('btnSaveData');
        this.saveInvoiceButton = document.getElementById('btnSaveInvoice');
        this.clearButton = document.getElementById('btnClearForm');
        
        // Line Table References
        this.linesTableBody = document.getElementById('linesTableBody');
        this.vencTableBody = document.getElementById('vencTableBody');
        this.btnAddLine = document.getElementById('btnAddLine');
        this.btnAddVencimiento = document.getElementById('btnAddVencimiento');
        this.tabItems = document.querySelectorAll('.tab-item');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Summary References
        this.summary = {
            base: document.getElementById('sumBase'),
            iva: document.getElementById('sumIva'),
            total: document.getElementById('sumTotal')
        };
        
        if (this.btnAddLine) {
            this.btnAddLine.addEventListener('click', () => this.addLine());
        }

        if (this.btnAddVencimiento) {
            this.btnAddVencimiento.addEventListener('click', () => this.addVencimiento());
        }

        // Tab switching logic
        this.tabItems.forEach(item => {
            item.addEventListener('click', () => {
                const tabName = item.dataset.tab;
                
                // Update active tab header
                this.tabItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Update active content
                this.tabContents.forEach(content => {
                    if (content.id === `tab-${tabName}`) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });
        
        // Stepper buttons
        this.btnStep1 = document.getElementById('btnStep1');
        this.btnStep2 = document.getElementById('btnStep2');
        
        if (this.btnStep1) this.btnStep1.addEventListener('click', () => this.setStep(1));
        if (this.btnStep2) this.btnStep2.addEventListener('click', () => this.setStep(2));

        this.setupFieldListeners();
        
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clear());
        }
        
        this.clear();
        this.loadProvinces();
        this.loadSociedades();
    }
    
    addLine(data = {}) {
        const newLine = {
            id: Date.now() + Math.random(),
            numOrden: this.lines.length + 1,
            descripcion: data.description || data.concepto || '',
            cantidad: data.quantity || 1,
            precio: data.unitPrice || data.precio || 0,
            iva: data.taxRate || 21,
            idUnidadMedida: 7, // Default: UD (Unidad)
            importe: data.totalAmount || 0
        };
        
        // Calculate importe if not provided
        if (!newLine.importe) {
            newLine.importe = newLine.cantidad * newLine.precio;
        }

        this.lines.push(newLine);
        this.renderLines();
        this.updateTotals();

        // Sync with header description if header is empty or it's the first line
        if (this.invoiceFields.concepto && (!this.invoiceFields.concepto.value || this.lines.length === 1)) {
            this.invoiceFields.concepto.value = newLine.descripcion;
        }
    }

    removeLine(id) {
        this.lines = this.lines.filter(l => l.id !== id);
        // Re-calculate order numbers
        this.lines.forEach((l, index) => l.numOrden = index + 1);
        this.renderLines();
        this.updateTotals();
    }

    updateLine(id, field, value) {
        const line = this.lines.find(l => l.id === id);
        if (!line) return;

        if (field === 'cantidad' || field === 'precio' || field === 'iva') {
            line[field] = parseFloat(value) || 0;
            line.importe = line.cantidad * line.precio;
        } else if (field === 'idUnidadMedida') {
            line[field] = parseInt(value) || 7;
        } else {
            line[field] = value;
            // If updating the first line's description, sync with header
            if (field === 'descripcion' && this.lines[0].id === id && this.invoiceFields.concepto) {
                this.invoiceFields.concepto.value = value;
            }
        }

        this.renderLines();
        this.updateTotals();
    }

    renderLines() {
        if (!this.linesTableBody) {
            console.error('linesTableBody not found!');
            return;
        }
        
        console.log(`Rendering ${this.lines.length} lines`);
        this.linesTableBody.innerHTML = '';
        
        this.lines.forEach(line => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:var(--text-muted)">${line.numOrden}</td>
                <td><input type="text" value="${line.descripcion}" data-id="${line.id}" data-field="descripcion"></td>
                <td>
                    <select data-id="${line.id}" data-field="idUnidadMedida" class="form-control" style="padding: 2px 4px; font-size: 11px; height: 24px; background: transparent">
                        <option value="7" ${line.idUnidadMedida === 7 ? 'selected' : ''}>UD</option>
                        <option value="1" ${line.idUnidadMedida === 1 ? 'selected' : ''}>m</option>
                        <option value="2" ${line.idUnidadMedida === 2 ? 'selected' : ''}>kg</option>
                        <option value="3" ${line.idUnidadMedida === 3 ? 'selected' : ''}>cm</option>
                        <option value="4" ${line.idUnidadMedida === 4 ? 'selected' : ''}>ml</option>
                        <option value="8" ${line.idUnidadMedida === 8 ? 'selected' : ''}>h</option>
                        <option value="9" ${line.idUnidadMedida === 9 ? 'selected' : ''}>gr</option>
                        <option value="10" ${line.idUnidadMedida === 10 ? 'selected' : ''}>mes</option>
                        <option value="16" ${line.idUnidadMedida === 16 ? 'selected' : ''}>M</option>
                    </select>
                </td>
                <td><input type="number" value="${line.cantidad}" data-id="${line.id}" data-field="cantidad" step="0.01"></td>
                <td><input type="number" value="${line.precio}" data-id="${line.id}" data-field="precio" step="0.0001"></td>
                <td><input type="number" value="${line.iva}" data-id="${line.id}" data-field="iva"></td>
                <td style="font-weight:600">${line.importe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</td>
                <td>
                    <div class="btn-remove-line" data-id="${line.id}">
                        <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 3l10 10M3 13L13 3" />
                        </svg>
                    </div>
                </td>
            `;
            
            // Add listeners to inputs and selects
            tr.querySelectorAll('input, select').forEach(input => {
                input.addEventListener('change', (e) => {
                    this.updateLine(line.id, e.target.dataset.field, e.target.value);
                });
            });

            // Add listener to remove button
            tr.querySelector('.btn-remove-line').addEventListener('click', () => {
                this.removeLine(line.id);
            });

            this.linesTableBody.appendChild(tr);
        });
    }

    updateTotals() {
        let base = 0;
        let totalIva = 0;

        this.lines.forEach(line => {
            base += line.importe;
            totalIva += line.importe * (line.iva / 100);
        });

        const total = base + totalIva;

        if (this.summary.base) this.summary.base.textContent = base.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        if (this.summary.iva) this.summary.iva.textContent = totalIva.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
        if (this.summary.total) this.summary.total.textContent = total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }

    /**
     * Adds a new installment to the vencimientos list
     * @param {Object} data - Initial data for the installment
     */
    addVencimiento(data = {}) {
        const newVenc = {
            id: Date.now() + Math.random(),
            numOrden: this.vencimientos.length + 1,
            fecha: data.fecha || '',
            importe: data.importe || 0,
            pagado: data.pagado || 0,
            fechaPago: data.fechaPago || '',
            tesoreria: data.tesoreria || 'Banco',
            formaPago: data.formaPago || 'Transferencia Bancaria'
        };
        
        this.vencimientos.push(newVenc);
        this.renderVencimientos();
    }

    /**
     * Renders the installments table
     */
    renderVencimientos() {
        if (!this.vencTableBody) return;
        
        this.vencTableBody.innerHTML = '';
        
        this.vencimientos.forEach(venc => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:var(--text-muted)">${venc.numOrden}</td>
                <td><input type="date" value="${venc.fecha}" data-id="${venc.id}" data-field="fecha"></td>
                <td><input type="number" value="${venc.importe}" data-id="${venc.id}" data-field="importe" step="0.01"></td>
                <td><input type="number" value="${venc.pagado}" data-id="${venc.id}" data-field="pagado" step="0.01"></td>
                <td><input type="date" value="${venc.fechaPago}" data-id="${venc.id}" data-field="fechaPago"></td>
                <td>
                    <select data-id="${venc.id}" data-field="tesoreria" class="form-control" style="padding: 2px 4px; font-size: 11px; height: 24px; background: transparent">
                        <option value="Prueba Inteco" ${venc.tesoreria === 'Prueba Inteco' ? 'selected' : ''}>Prueba Inteco</option>
                        <option value="Prueba Inteco 2" ${venc.tesoreria === 'Prueba Inteco 2' ? 'selected' : ''}>Prueba Inteco 2</option>
                        <option value="Caja" ${venc.tesoreria === 'Caja' ? 'selected' : ''}>Caja</option>
                        <option value="Banco" ${venc.tesoreria === 'Banco' ? 'selected' : ''}>Banco</option>
                    </select>
                </td>
                <td>
                    <select data-id="${venc.id}" data-field="formaPago" class="form-control" style="padding: 2px 4px; font-size: 11px; height: 24px; background: transparent">
                        <option value="Transferencia Bancaria" ${venc.formaPago === 'Transferencia Bancaria' ? 'selected' : ''}>Transferencia Bancaria</option>
                        <option value="Cheque" ${venc.formaPago === 'Cheque' ? 'selected' : ''}>Cheque</option>
                        <option value="Contado" ${venc.formaPago === 'Contado' ? 'selected' : ''}>Contado</option>
                        <option value="E.C. ADEUDO EN CUENTA" ${venc.formaPago === 'E.C. ADEUDO EN CUENTA' ? 'selected' : ''}>E.C. ADEUDO EN CUENTA</option>
                        <option value="Pagaré" ${venc.formaPago === 'Pagaré' ? 'selected' : ''}>Pagaré</option>
                        <option value="TRANSFERENCIA BANCARIA C/C BANKINTER" ${venc.formaPago === 'TRANSFERENCIA BANCARIA C/C BANKINTER' ? 'selected' : ''}>BANCARIA BANKINTER</option>
                        <option value="TRANSFERENCIA BANCARIA C/C SANTANDER" ${venc.formaPago === 'TRANSFERENCIA BANCARIA C/C SANTANDER' ? 'selected' : ''}>BANCARIA SANTANDER</option>
                        <option value="VISA" ${venc.formaPago === 'VISA' ? 'selected' : ''}>VISA</option>
                    </select>
                </td>
                <td>
                    <div class="btn-remove-line" data-id="${venc.id}" title="Eliminar vencimiento">
                        <svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 3l10 10M3 13L13 3" />
                        </svg>
                    </div>
                </td>
            `;
            
            // Add listeners to inputs and selects
            tr.querySelectorAll('input, select').forEach(input => {
                input.addEventListener('change', (e) => {
                    this.updateVencimiento(venc.id, e.target.dataset.field, e.target.value);
                });
            });
            
            tr.querySelector('.btn-remove-line').addEventListener('click', () => {
                this.removeVencimiento(venc.id);
            });
            
            this.vencTableBody.appendChild(tr);
        });
    }

    updateVencimiento(id, field, value) {
        const venc = this.vencimientos.find(v => v.id === id);
        if (!venc) return;
        
        if (field === 'importe' || field === 'pagado') {
            venc[field] = parseFloat(value) || 0;
        } else {
            venc[field] = value;
        }
    }

    removeVencimiento(id) {
        this.vencimientos = this.vencimientos.filter(v => v.id !== id);
        // Re-order
        this.vencimientos.forEach((v, idx) => v.numOrden = idx + 1);
        this.renderVencimientos();
    }
    
    setStep(step) {
        // Block navigation to Step 2 if the provider is not confirmed in the DB
        if (step === 2 && !this.proveedorConfirmado) {
            // Show a toast via the controller if available, else alert
            if (window.extractionController) {
                window.extractionController.showToast(
                    '⚠️ Debes dar de alta o confirmar el proveedor antes de registrar la factura',
                    'warning'
                );
            } else {
                alert('Debes dar de alta el proveedor antes de continuar.');
            }
            return;
        }

        this.currentStep = step;
        
        // Update buttons UI
        if (this.btnStep1) this.btnStep1.classList.toggle('active', step === 1);
        if (this.btnStep2) this.btnStep2.classList.toggle('active', step === 2);
        
        // Update content UI
        const step1Content = document.getElementById('step1Content');
        const step2Content = document.getElementById('step2Content');
        
        if (step1Content) step1Content.classList.toggle('active', step === 1);
        if (step2Content) step2Content.classList.toggle('active', step === 2);
        
        // If moving to step 2, prefill provider name
        if (step === 2 && this.fields.legalBusinessName && this.invoiceFields.proveedorNombre) {
            this.invoiceFields.proveedorNombre.value = this.fields.legalBusinessName.value;
            this.updateNextInternalNumber();
        }

        console.log(`Switched to step ${step}`);
    }

    /**
     * Marks the provider as confirmed (saved or already existing in DB).
     * Must be called before navigating to Step 2 is allowed.
     * @param {boolean} confirmed
     */
    setProveedorConfirmado(confirmed) {
        this.proveedorConfirmado = confirmed;
        // Update Step 2 button appearance to signal availability
        if (this.btnStep2) {
            this.btnStep2.style.opacity = confirmed ? '1' : '0.45';
            this.btnStep2.title = confirmed ? '' : 'Primero debes dar de alta el proveedor';
        }
    }

    async loadSociedades() {
        try {
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (!api || !api.listSociedades) return;
            
            const sociedades = await api.listSociedades();
            const select = this.invoiceFields.idSociedad;
            if (!select) return;
            
            select.innerHTML = '<option value="">Seleccione sociedad...</option>';
            sociedades.forEach(soc => {
                const option = document.createElement('option');
                option.value = soc.id;
                option.textContent = soc.nombre;
                select.appendChild(option);
            });

            // Sync with parent window selection if possible
            this.autocompleteSociedad();
        } catch (e) {
            console.error('Error loading sociedades', e);
        }
    }

    async loadProvinces() {
        try {
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (!api) return;
            
            const provincias = await api.getProvincias();
            const select = this.fields.provinciaId;
            if (!select) return;
            
            // clear existing options except the first one
            select.innerHTML = '<option value="">Seleccione una provincia...</option>';
            
            this.provinciasList = provincias;
            
            provincias.forEach(prov => {
                const option = document.createElement('option');
                option.value = prov.id;
                option.textContent = prov.nombre;
                select.appendChild(option);
            });
        } catch (e) {
            console.error('Error loading provincias', e);
        }
    }
    
    /**
     * Sets up event listeners for all form fields
     * Triggers validation and callbacks on field changes
     */
    setupFieldListeners() {
        // Step 1 Listeners
        Object.entries(this.fields).forEach(([fieldName, fieldElement]) => {
            if (!fieldElement) return;
            
            fieldElement.addEventListener('input', (e) => {
                const value = e.target.value;
                this.fieldChangeCallbacks.forEach(callback => callback(fieldName, value));
                this.validateField(fieldName, value);
                this.updateSaveButtonState();
                if (fieldName === 'postalCode') this.autocompleteProvinceFromPostalCode(value);
            });
            
            fieldElement.addEventListener('blur', (e) => {
                this.validateField(fieldName, e.target.value);
            });
        });

        // Step 2 Listeners
        Object.entries(this.invoiceFields).forEach(([fieldName, fieldElement]) => {
            if (!fieldElement) return;
            
            fieldElement.addEventListener('input', (e) => {
                // Sync Fecha Entrada with Fecha Emision if changed
                if (fieldName === 'fechaEmision' && this.invoiceFields.fechaEntrada) {
                    this.invoiceFields.fechaEntrada.value = e.target.value;
                }
                
                // Update internal number if society or imputation date changes
                if (fieldName === 'idSociedad' || fieldName === 'fechaEntrada') {
                    this.updateNextInternalNumber();
                }

                this.updateSaveButtonState();
            });
            
            fieldElement.addEventListener('change', (e) => {
                this.updateSaveButtonState();
            });
        });
    }
    
    autocompleteSociedad() {
        try {
            // Check if we are in an iframe and can access parent window
            const parentSocSelect = window.parent && window.parent.document && window.parent.document.getElementById('soc');
            if (parentSocSelect && parentSocSelect.value && this.invoiceFields.idSociedad) {
                this.invoiceFields.idSociedad.value = parentSocSelect.value;
                console.log(`Sociedad autocompletada desde el dashboard: ${parentSocSelect.value}`);
            }
        } catch (e) {
            console.warn('No se pudo acceder a la sociedad del padre (cross-origin o no existe)', e);
        }
    }

    /**
     * Populates the form with extracted data
     * @param {Object} data - Invoice data object
     */
    populateFields(data) {
        console.log('populateFields called with data:', data);
        if (!data) {
            console.warn('No data provided to populate fields');
            return;
        }
        
        // 1. Populate Step 1: Provider Fields
        Object.entries(this.fields).forEach(([fieldName, fieldElement]) => {
            if (!fieldElement) return;
            
            const value = data[fieldName];
            if (value !== undefined && value !== null) {
                fieldElement.value = value;
                this.validateField(fieldName, value);
            }
        });

        // 1.1 Special logic for Tipo Doc and AI detection
        if (data.docId && this.fields.tipoDoc) {
            const docId = data.docId.trim().toUpperCase();
            // Guess based on pattern if not explicitly sent as documentType
            let guessedType = '58'; // Otros
            
            if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7,8}[0-9A-Z]?$/i.test(docId)) guessedType = '29'; // CIF
            else if (/^\d{8}[A-Z]$/i.test(docId)) guessedType = '28'; // DNI
            else if (/^[XYZ]\d{7}[A-Z]$/i.test(docId)) guessedType = '31'; // NIE

            // If mindee explicitly sent documentType, use it (mapped in controller/service)
            if (data.documentType === 'CIF') guessedType = '29';
            else if (data.documentType === 'DNI') guessedType = '28';
            else if (data.documentType === 'NIE') guessedType = '31';
            else if (data.documentType === 'Otros') guessedType = '58';

            this.fields.tipoDoc.value = guessedType;
        }

        // 1.2 Guess Tipo Proveedor based on name keywords
        if (data.legalBusinessName && this.fields.tipoProveedor) {
            const name = data.legalBusinessName.toLowerCase();
            if (name.includes('logistica') || name.includes('transporte') || name.includes('envio')) {
                this.fields.tipoProveedor.value = '323'; // Logística
            } else if (name.includes('material') || name.includes('suministro') || name.includes('construccion')) {
                this.fields.tipoProveedor.value = '345'; // Materiales
            } else if (name.includes('regalo') || name.includes('publicidad') || name.includes('merchandising')) {
                this.fields.tipoProveedor.value = '358'; // Regalos
            }
        }
        
        // 2. Populate Step 2: Invoice Fields
        if (this.invoiceFields) {
            // Map data fields to invoice form fields
            const invoiceMapping = {
                numFactura: data.invoiceNumber || '',
                fechaEmision: this.formatDateForInput(data.date),
                fechaEntrada: this.formatDateForInput(data.date), // Default to emission date
                fechaVencimiento: this.formatDateForInput(data.dueDate),
                concepto: data.description || data.concepto || ''
            };

            Object.entries(invoiceMapping).forEach(([fieldName, value]) => {
                const fieldElement = this.invoiceFields[fieldName];
                if (fieldElement && value) {
                    fieldElement.value = value;
                }
            });

            // Also ensure provider name is updated if we have it
            if (this.invoiceFields.proveedorNombre && data.legalBusinessName) {
                this.invoiceFields.proveedorNombre.value = data.legalBusinessName;
            }

            // Always try to sync sociedad
            this.autocompleteSociedad();
        }

        // 3. Populate Line Items
        this.vencimientos = []; // Clear existing
        if (data.dueDate && (data.totalAmount || data.total)) {
            this.addVencimiento({
                fecha: this.formatDateForInput(data.dueDate),
                importe: data.totalAmount || data.total,
                pagado: 0
            });
        }

        if (data.lineItems && Array.isArray(data.lineItems)) {
            this.lines = []; // Clear existing
            data.lineItems.forEach(item => {
                this.addLine(item);
            });
            console.log(`Extracted ${data.lineItems.length} line items`);
        } else if (this.lines.length === 0) {
            // Add at least one empty line if none extracted
            this.addLine();
        }
        
        // Trigger province autocomplete if postal code is present
        if (data.postalCode) {
            this.autocompleteProvinceFromPostalCode(data.postalCode);
        }
        
        // Update save button state
        this.updateSaveButtonState();
        
        console.log('Form populated with data (Steps 1 & 2)');
    }

    /**
     * Helper to format dates (YYYY-MM-DD) for HTML date inputs
     */
    formatDateForInput(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    }
    
    /**
     * Gets the current form data
     * @returns {Object} Form data object
     */
    getFormData() {
        const data = {};
        
        Object.entries(this.fields).forEach(([fieldName, fieldElement]) => {
            if (!fieldElement) return;
            
            const value = fieldElement.value.trim();
            data[fieldName] = value || null;
        });
        
        return data;
    }
    
    /**
     * Validates all form data
     * @returns {Object} Validation result with errors and warnings
     */
    validate() {
        const data = this.getFormData();
        const errors = [];
        const warnings = [];
        
        // Validate required fields
        this.requiredFields.forEach(fieldName => {
            const value = data[fieldName];
            if (!value || value.trim() === '') {
                warnings.push({
                    field: fieldName,
                    message: `El campo ${this.getFieldLabel(fieldName)} es requerido`,
                    type: 'warning'
                });
            }
        });
        
        // Validate max lengths
        Object.entries(this.maxLengths).forEach(([fieldName, maxLength]) => {
            const value = data[fieldName];
            if (value && value.length > maxLength) {
                errors.push({
                    field: fieldName,
                    message: `El campo ${this.getFieldLabel(fieldName)} excede la longitud máxima de ${maxLength} caracteres`,
                    type: 'error'
                });
            }
        });
        
        // Validate postal code format
        if (data.postalCode && data.country) {
            const isValid = this.validatePostalCodeFormat(data.postalCode, data.country);
            if (!isValid) {
                warnings.push({
                    field: 'postalCode',
                    message: `El código postal no coincide con el formato esperado para ${data.country}`,
                    type: 'warning'
                });
            }
        }
        
        // Validate country
        if (data.country) {
            const isValidCountry = this.validCountries.some(
                country => country.toLowerCase() === data.country.toLowerCase()
            );
            if (!isValidCountry) {
                warnings.push({
                    field: 'country',
                    message: 'País no reconocido en la lista de países válidos',
                    type: 'warning'
                });
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }
    
    /**
     * Validates a single field
     * @param {string} fieldName - Name of the field to validate
     * @param {string} value - Value to validate
     */
    validateField(fieldName, value) {
        const fieldElement = this.fields[fieldName];
        if (!fieldElement) return;
        
        const validationContainer = fieldElement.parentElement.querySelector('.field-validation');
        if (!validationContainer) return;
        
        // Clear previous validation state
        fieldElement.classList.remove('is-invalid', 'is-warning', 'is-valid');
        validationContainer.classList.remove('error', 'warning', 'success');
        validationContainer.textContent = '';
        
        // Check required fields
        if (this.requiredFields.includes(fieldName) && (!value || value.trim() === '')) {
            fieldElement.classList.add('is-warning');
            validationContainer.classList.add('warning');
            validationContainer.textContent = `${this.getFieldLabel(fieldName)} es requerido`;
            return;
        }
        
        // Check max length
        const maxLength = this.maxLengths[fieldName];
        if (maxLength && value && value.length > maxLength) {
            fieldElement.classList.add('is-invalid');
            validationContainer.classList.add('error');
            validationContainer.textContent = `Excede ${maxLength} caracteres (actual: ${value.length})`;
            return;
        }
        
        // Validate postal code format
        if (fieldName === 'postalCode' && value) {
            const country = this.fields.country?.value;
            if (country) {
                const isValid = this.validatePostalCodeFormat(value, country);
                if (!isValid) {
                    fieldElement.classList.add('is-warning');
                    validationContainer.classList.add('warning');
                    validationContainer.textContent = `Formato no válido para ${country}`;
                    return;
                }
            }
        }
        
        // Validate country
        if (fieldName === 'country' && value) {
            const isValidCountry = this.validCountries.some(
                country => country.toLowerCase() === value.toLowerCase()
            );
            if (!isValidCountry) {
                fieldElement.classList.add('is-warning');
                validationContainer.classList.add('warning');
                validationContainer.textContent = 'País no reconocido';
                return;
            }
        }
        
        // Field is valid
        if (value && value.trim() !== '') {
            fieldElement.classList.add('is-valid');
            validationContainer.classList.add('success');
        }
    }
    
    /**
     * Validates postal code format for a specific country
     * @param {string} postalCode - Postal code to validate
     * @param {string} country - Country name or code
     * @returns {boolean} True if valid
     */
    validatePostalCodeFormat(postalCode, country) {
        if (!postalCode || !country) return true;
        
        const pattern = this.postalCodePatterns[country];
        if (!pattern) {
            // No pattern defined for this country, consider valid
            return true;
        }
        
        return pattern.test(postalCode.trim());
    }
    
    /**
     * Shows validation feedback in the validation summary
     * @param {Object} validationResult - Validation result object
     */
    showValidationFeedback(validationResult) {
        if (!this.validationSummary) return;
        
        const errorsContainer = document.getElementById('validationErrors');
        const warningsContainer = document.getElementById('validationWarnings');
        
        // Clear previous content
        if (errorsContainer) errorsContainer.innerHTML = '';
        if (warningsContainer) warningsContainer.innerHTML = '';
        
        // Show/hide validation summary
        const hasIssues = validationResult.errors.length > 0 || validationResult.warnings.length > 0;
        this.validationSummary.style.display = hasIssues ? 'block' : 'none';
        
        // Display errors
        if (validationResult.errors.length > 0 && errorsContainer) {
            const errorsList = document.createElement('ul');
            validationResult.errors.forEach(error => {
                const li = document.createElement('li');
                li.textContent = `${this.getFieldLabel(error.field)}: ${error.message}`;
                errorsList.appendChild(li);
            });
            
            const heading = document.createElement('h4');
            heading.textContent = '❌ Errores';
            errorsContainer.appendChild(heading);
            errorsContainer.appendChild(errorsList);
        }
        
        // Display warnings
        if (validationResult.warnings.length > 0 && warningsContainer) {
            const warningsList = document.createElement('ul');
            validationResult.warnings.forEach(warning => {
                const li = document.createElement('li');
                li.textContent = `${this.getFieldLabel(warning.field)}: ${warning.message}`;
                warningsList.appendChild(li);
            });
            
            const heading = document.createElement('h4');
            heading.textContent = '⚠️ Advertencias';
            warningsContainer.appendChild(heading);
            warningsContainer.appendChild(warningsList);
        }
        
        // Update field-level validation indicators
        validationResult.errors.forEach(error => {
            const fieldElement = this.fields[error.field];
            if (fieldElement) {
                fieldElement.classList.remove('is-valid', 'is-warning');
                fieldElement.classList.add('is-invalid');
                
                const validationContainer = fieldElement.parentElement.querySelector('.field-validation');
                if (validationContainer) {
                    validationContainer.classList.remove('success', 'warning');
                    validationContainer.classList.add('error');
                    validationContainer.textContent = error.message;
                }
            }
        });
        
        validationResult.warnings.forEach(warning => {
            const fieldElement = this.fields[warning.field];
            if (fieldElement && !fieldElement.classList.contains('is-invalid')) {
                fieldElement.classList.remove('is-valid');
                fieldElement.classList.add('is-warning');
                
                const validationContainer = fieldElement.parentElement.querySelector('.field-validation');
                if (validationContainer && !validationContainer.classList.contains('error')) {
                    validationContainer.classList.remove('success');
                    validationContainer.classList.add('warning');
                    validationContainer.textContent = warning.message;
                }
            }
        });
    }
    
    /**
     * Autocompletes the province field based on the postal code prefix
     * @param {string} postalCode - The postal code to use for lookup
     */
    async autocompleteProvinceFromPostalCode(postalCode) {
        if (!postalCode || postalCode.length < 2) return;
        
        // 1. Autocomplete Province (local logic with preloaded list)
        const prefix = postalCode.substring(0, 2);
        const matchingProv = this.provinciasList.find(p => 
            p.codigo === prefix || 
            p.codigo === parseInt(prefix) || 
            (prefix.startsWith('0') && p.codigo === parseInt(prefix.substring(1)))
        );
        
        if (matchingProv && this.fields.provinciaId) {
            this.fields.provinciaId.value = matchingProv.id;
            this.validateField('provinciaId', matchingProv.id);
        }

        // 2. Autocomplete Population/City (Database lookup)
        if (postalCode.length >= 5) {
            try {
                const api = window.electronAPI || (window.parent && window.parent.electronAPI);
                if (api && api.getPoblacionByCP) {
                    const poblacion = await api.getPoblacionByCP(postalCode);
                    if (poblacion && this.fields.city) {
                        this.fields.city.value = poblacion;
                        this.validateField('city', poblacion);
                        console.log(`Población autocompletada: ${poblacion} para CP ${postalCode}`);
                    }
                }
            } catch (e) {
                console.error('Error autocompleting poblacion:', e);
            }
        }
    }
    
    /**
     * Clears all form fields
     */
    clear() {
        // Clear all field values
        Object.values(this.fields).forEach(fieldElement => {
            if (fieldElement) {
                fieldElement.value = '';
                fieldElement.classList.remove('is-invalid', 'is-warning', 'is-valid');
                
                // Clear validation messages
                const validationContainer = fieldElement.parentElement.querySelector('.field-validation');
                if (validationContainer) {
                    validationContainer.classList.remove('error', 'warning', 'success');
                    validationContainer.textContent = '';
                }
            }
        });
        
        // Hide validation summary
        if (this.validationSummary) {
            this.validationSummary.style.display = 'none';
        }
        
        // Clear arrays
        this.lines = [];
        this.vencimientos = [];
        this.renderLines();
        this.renderVencimientos();
        this.updateTotals();
        
        console.log('Form cleared');
    }
    
    /**
     * Registers a callback for field changes
     * @param {Function} callback - Callback function (fieldName, value) => void
     */
    onFieldChange(callback) {
        if (typeof callback === 'function') {
            this.fieldChangeCallbacks.push(callback);
        }
    }
    
    getInvoiceFormData() {
        const data = {};
        Object.entries(this.invoiceFields).forEach(([fieldName, fieldElement]) => {
            if (fieldElement) {
                data[fieldName] = fieldElement.value;
            }
        });
        data.lines = this.lines;
        return data;
    }

    async updateNextInternalNumber() {
        const sociedadId = this.invoiceFields.idSociedad ? this.invoiceFields.idSociedad.value : null;
        const fecha = this.invoiceFields.fechaEntrada ? this.invoiceFields.fechaEntrada.value : null;
        
        if (!sociedadId) {
            if (this.invoiceFields.numInterno) this.invoiceFields.numInterno.value = '';
            return;
        }

        try {
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (api && api.getNextNumFactura) {
                const nextNum = await api.getNextNumFactura({ sociedadId: parseInt(sociedadId), fecha });
                if (this.invoiceFields.numInterno) {
                    this.invoiceFields.numInterno.value = nextNum;
                }
            }
        } catch (e) {
            console.error('Error fetching next internal number:', e);
        }
    }

    /**
     * Updates the save button enabled/disabled state based on validation
     */
    updateSaveButtonState() {
        // Step 1 Button
        if (this.saveButton) {
            const validationResult = this.validate();
            this.saveButton.disabled = !validationResult.valid;
        }

        // Step 2 Button (Invoice)
        if (this.saveInvoiceButton) {
            const data = this.getInvoiceFormData();
            const isValid = data.idSociedad && data.numFactura && data.fechaEmision && this.lines.length > 0;
            this.saveInvoiceButton.disabled = !isValid;
        }
    }
    
    /**
     * Gets a human-readable label for a field name
     * @param {string} fieldName - Field name
     * @returns {string} Field label
     */
    getFieldLabel(fieldName) {
        const labels = {
            docId: 'CIF / NIF',
            legalBusinessName: 'Razón Social',
            commercialName: 'Nombre Comercial',
            address: 'Dirección',
            city: 'Población',
            postalCode: 'Código Postal',
            provinciaId: 'Provincia',
            observations: 'Observaciones',
            idSociedad: 'Sociedad',
            numFactura: 'Nº Factura',
            fechaEmision: 'Fecha Emisión',
            fechaVencimiento: 'Fecha Vencimiento',
            proveedorNombre: 'Nombre Proveedor'
        };
        
        return labels[fieldName] || fieldName;
    }

    /**
     * Gets the data for the invoice (Step 2)
     */
    getInvoiceFormData() {
        const data = {};
        Object.entries(this.invoiceFields).forEach(([fieldName, fieldElement]) => {
            if (!fieldElement) return;
            data[fieldName] = fieldElement.value;
        });
        
        // Include lines and vencimientos
        data.lines = this.lines;
        data.vencimientos = this.vencimientos;
        
        return data;
    }
}

// Initialize ExtractionForm when DOM is ready
let extractionForm;

document.addEventListener('DOMContentLoaded', () => {
    extractionForm = new ExtractionForm();
    extractionForm.initialize();
    
    // Make it globally accessible
    window.extractionForm = extractionForm;
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtractionForm;
}
