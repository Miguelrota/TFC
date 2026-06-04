/**
 * ExtractionController Component
 * 
 * Orchestrates the invoice extraction workflow by coordinating between
 * InvoiceViewer and ExtractionForm components. Handles REST API communication
 * with the backend for processing, saving, and loading invoice data.
 * 
 * Requirements: 2.1, 2.2, 3.1-3.11, 6.1-6.11, 9.1, 9.2
 */
class ExtractionController {
    constructor() {
        // Component references
        this.viewer = null;
        this.form = null;
        
        // UI element references
        this.btnProcessIA = null;
        this.btnSaveData = null;
        this.btnClearForm = null;
        this.processingStatus = null;
        this.saveStatus = null;
        this.toast = null;
        this.bulk = null;
        
        // State
        this.currentFileName = null;
        this.isProcessing = false;
        this.isSaving = false;
        
        // API base URL
        this.apiBaseUrl = '/api/invoices';
    }
    
    /**
     * Initializes the controller and sets up event listeners
     */
    initialize() {
        // Get component instances
        this.viewer = window.invoiceViewer;
        this.form = window.extractionForm;
        
        if (!this.viewer) {
            console.error('InvoiceViewer not found. Make sure invoice-viewer.js is loaded first.');
            return;
        }
        
        if (!this.form) {
            console.error('ExtractionForm not found. Make sure extraction-form.js is loaded first.');
            return;
        }
        
        // Get UI element references
        this.btnProcessIA = document.getElementById('btnProcessIA');
        this.btnSaveData = document.getElementById('btnSaveData');
        this.btnSaveInvoice = document.getElementById('btnSaveInvoice');
        this.btnClearForm = document.getElementById('btnClearForm');
        this.processingStatus = document.getElementById('processingStatus');
        this.saveStatus = document.getElementById('saveStatus');
        this.toast = document.getElementById('toast');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up integration between components
        this.setupComponentIntegration();
        
        // Initialize Bulk Processor integration
        this.setupBulkIntegration();
        
        console.log('ExtractionController initialized');
    }
    
    /**
     * Sets up integration between viewer and form
     */
    setupComponentIntegration() {
        if (this.viewer) {
            // Clear form when a new document is loaded
            this.viewer.onDocumentLoaded = () => {
                console.log('New document loaded, clearing form fields and starting extraction...');
                if (this.form) {
                    this.form.clear();
                }
                
                // Reset controller state for the new document
                this.currentFileName = this.viewer.currentFileName;
                this.showSaveStatus('', false);

                // Reset provider confirmation for the new document
                if (this.form) this.form.setProveedorConfirmado(false);

                // Reset save button (should be disabled until processed or data entered)
                if (this.btnSaveData) this.btnSaveData.disabled = true;

                // Start extraction automatically
                this.processInvoice();
            };
        }
    }

    /**
     * Sets up integration with BulkProcessor
     */
    setupBulkIntegration() {
        this.bulk = window.bulkProcessor;
        if (!this.bulk) return;

        this.bulk.onFileSelected = (item) => {
            if (!item) {
                this.clearAll();
                return;
            }

            console.log('Queue item selected:', item.name);
            
            // Load PDF in viewer
            if (this.viewer) {
                this.viewer.loadDocument(item.path);
            }

            // If it already has a result, populate it
            if (item.status === 'ready' && item.result) {
                this.form.populateFields(item.result);
                this.checkProviderExistence(item.result);
            } else if (item.status === 'error') {
                this.showToast(`Error previo en este archivo: ${item.error}`, 'error');
            } else if (item.status === 'processing') {
                this.showProcessingStatus(true);
            }
        };

        this.bulk.onProcessingFinished = (item) => {
            // If the finished item is the one we are currently looking at
            if (this.bulk.currentIndex !== -1 && this.bulk.queue[this.bulk.currentIndex] === item) {
                this.showProcessingStatus(false);
                if (item.status === 'ready' && item.result) {
                    this.form.populateFields(item.result);
                    this.checkProviderExistence(item.result);
                    this.showToast('✓ Extracción completada', 'success');
                } else if (item.status === 'error') {
                    this.showToast(`Error: ${item.error}`, 'error');
                }
            }
        };

        this.bulk.onProcessingStarted = (item) => {
            if (this.bulk.currentIndex !== -1 && this.bulk.queue[this.bulk.currentIndex] === item) {
                this.showProcessingStatus(true);
            }
        };
    }
    
    /**
     * Sets up event listeners for buttons
     */
    setupEventListeners() {
        // Process button
        if (this.btnProcessIA) {
            this.btnProcessIA.addEventListener('click', () => {
                this.processInvoice();
            });
        }
        
        // Save button (Step 1)
        if (this.btnSaveData) {
            this.btnSaveData.addEventListener('click', () => {
                this.saveExtractedData();
            });
        }

        // Save Invoice button (Step 2)
        if (this.btnSaveInvoice) {
            this.btnSaveInvoice.addEventListener('click', () => {
                this.saveInvoice();
            });
        }
        
        // Clear button (already handled by ExtractionForm, but we can add additional logic)
        if (this.btnClearForm) {
            this.btnClearForm.addEventListener('click', () => {
                this.clearAll();
            });
        }
    }
    
    /**
     * Processes the invoice document using AI
     * Calls process-invoice IPC
     */
    async processInvoice() {
        if (this.isProcessing) {
            console.warn('Processing already in progress');
            return;
        }

        // Check if this file is already in the bulk queue and handled there
        if (this.bulk && this.bulk.currentIndex !== -1) {
            const item = this.bulk.queue[this.bulk.currentIndex];
            if (item.status === 'ready' && item.result) {
                console.log('Using cached result from bulk processor for:', item.name);
                this.form.populateFields(item.result);
                this.checkProviderExistence(item.result);
                return;
            }
            if (item.status === 'processing') {
                console.log('File is already being processed by bulk processor:', item.name);
                this.showProcessingStatus(true);
                return;
            }
        }
        
        try {
            // Get document data from viewer
            const documentData = await this.viewer.getDocumentData();
            if (!documentData || !documentData.path) {
                this.showToast('No hay documento cargado para procesar', 'error');
                return;
            }
            
            // Store filename for later use
            this.currentFileName = this.viewer.currentFileName;
            
            // Show processing status
            this.showProcessingStatus(true);
            this.isProcessing = true;
            
            // Disable buttons during processing
            if (this.btnProcessIA) this.btnProcessIA.disabled = true;
            if (this.btnSaveData) this.btnSaveData.disabled = true;
            
            // Get the API (with iframe support)
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (!api) {
                throw new Error('API de Electron no detectada');
            }

            // Call backend API via Electron IPC
            const invoiceData = await api.processInvoice(documentData.path);
            
            // Populate form with extracted data
            this.form.populateFields(invoiceData);
            
            // Show success message
            // Show success message
            this.showToast('✓ Proveedor extraído', 'success');
            
            // Check if provider exists
            if (invoiceData.docId) {
                await this.checkProviderExistence(invoiceData);
            }
            
            // Enable save button
            if (this.btnSaveData) this.btnSaveData.disabled = false;
            
            console.log('Proveedor processed successfully:', invoiceData);
            
        } catch (error) {
            console.error('Error processing invoice:', error);
            this.showToast(`Error al procesar: ${error.message}`, 'error');
            
        } finally {
            // Hide processing status
            this.showProcessingStatus(false);
            this.isProcessing = false;
            
            // Re-enable process button
            if (this.btnProcessIA) this.btnProcessIA.disabled = false;
        }
    }

    /**
     * Checks if a provider exists in the DB and updates the form state
     */
    async checkProviderExistence(invoiceData) {
        if (!invoiceData || !invoiceData.docId) return;

        try {
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            const normalizedDocId = this.normalizeDocId(invoiceData.docId);
            const existing = await api.checkProveedor(normalizedDocId);
            
            if (existing && existing.length > 0) {
                const msg = `El proveedor con CIF ${invoiceData.docId} ya existe.`;
                this.showToast(`✅ ${msg}`, 'success');

                this.form.setProveedorConfirmado(true);

                if (this.form.fields.docId) {
                    this.form.fields.docId.classList.add('is-warning');
                    const val = this.form.fields.docId.parentElement.querySelector('.field-validation');
                    if (val) {
                        val.textContent = 'Proveedor ya existente';
                        val.classList.add('warning');
                    }
                }
            } else {
                this.form.setProveedorConfirmado(false);
            }
        } catch (e) {
            console.error('Error checking existence:', e);
        }
    }
    
    /**
     * Saves the extracted data to the backend
     * Calls save-invoice IPC
     */
    async saveExtractedData() {
        if (this.isSaving) {
            console.warn('Save already in progress');
            return;
        }
        
        try {
            // Get form data
            const formData = this.form.getFormData();
            
            // Validate form data
            const validationResult = this.form.validate();
            
            // Show validation feedback
            this.form.showValidationFeedback(validationResult);
            
            // Check if there are blocking errors
            if (!validationResult.valid) {
                this.showToast('Por favor corrija los errores antes de guardar', 'error');
                return;
            }
            
            // Show saving status
            this.showSaveStatus('Guardando...', false);
            this.isSaving = true;
            
            // Disable buttons during save
            if (this.btnSaveData) this.btnSaveData.disabled = true;
            if (this.btnProcessIA) this.btnProcessIA.disabled = true;
            
            // Get the API (with iframe support)
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (!api) {
                throw new Error('API de Electron no detectada');
            }

            // Check existence before saving
            if (formData.docId) {
                const normalizedDocId = this.normalizeDocId(formData.docId);
                const existing = await api.checkProveedor(normalizedDocId);
                if (existing && existing.length > 0) {
                    const msg = 'Proveedor existente';
                    this.showSaveStatus(`⚠️ ${msg}`, false);
                    
                    // Highlight the field and show error in summary
                    if (this.form.fields.docId) {
                        this.form.fields.docId.classList.remove('is-valid', 'is-warning');
                        this.form.fields.docId.classList.add('is-invalid');
                    }
                    
                    // Re-enable buttons and stop saving
                    this.isSaving = false;
                    if (this.btnSaveData) this.btnSaveData.disabled = false;
                    if (this.btnProcessIA) this.btnProcessIA.disabled = false;
                    return; // STOP: Do not save in DB
                }
            }

            // Call backend API via Electron IPC
            const saveResult = await api.saveProveedor(formData);
            
            // Check if save was successful
            if (saveResult.success) {
                this.showSaveStatus(`✓ Guardado exitosamente`, true);
                console.log('Proveedor saved successfully:', saveResult);

                // Provider now confirmed → allow Step 2
                this.form.setProveedorConfirmado(true);

                // Transition to Step 2 after a small delay
                setTimeout(() => {
                    this.form.setStep(2);
                    this.showSaveStatus('', true); // Clear status
                }, 1500);
            } else {
                // Save failed with validation errors
                this.showSaveStatus('✗ Error al guardar', false);
                this.showToast('Error de validación al guardar', 'error');
                
                // Show validation errors if present
                if (saveResult.validationErrors && saveResult.validationErrors.length > 0) {
                    console.error('Validation errors:', saveResult.validationErrors);
                }
            }
            
        } catch (error) {
            console.error('Error saving invoice data:', error);
            this.showSaveStatus('✗ Error al guardar', false);
            this.showToast(`Error al guardar: ${error.message}`, 'error');
            
        } finally {
            this.isSaving = false;
            
            // Re-enable buttons
            if (this.btnSaveData) this.btnSaveData.disabled = false;
            if (this.btnProcessIA) this.btnProcessIA.disabled = false;
        }
    }
    
    /**
     * Loads invoice data from an XML file
     * Calls load-invoice IPC
     * @param {string} xmlPath - Path to the XML file
     */
    async loadFromXML(xmlPath) {
        if (!xmlPath) {
            this.showToast('Ruta de archivo XML no especificada', 'error');
            return;
        }
        
        try {
            // Show loading status
            this.showProcessingStatus(true);
            
            // Get the API (with iframe support)
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (!api) {
                throw new Error('API de Electron no detectada');
            }

            // Call backend API via Electron IPC (We need to add this handler in main.js)
            const invoiceData = await api.loadInvoice(xmlPath);
            
            // Populate form with loaded data
            this.form.populateFields(invoiceData);
            
            // Show success message
            this.showToast('✓ Datos cargados desde XML', 'success');
            
            // Enable save button
            if (this.btnSaveData) this.btnSaveData.disabled = false;
            
            console.log('Invoice data loaded from XML:', invoiceData);
            
        } catch (error) {
            console.error('Error loading from XML:', error);
            this.showToast(`Error al cargar XML: ${error.message}`, 'error');
            
        } finally {
            // Hide loading status
            this.showProcessingStatus(false);
        }
    }
    
    /**
     * Clears all data (viewer and form)
     */
    clearAll() {
        // Clear viewer
        if (this.viewer) {
            this.viewer.clear();
        }
        
        // Clear form
        if (this.form) {
            this.form.clear();
        }
        
        // Reset controller state
        this.currentFileName = null;
        this.isProcessing = false;
        
        // Hide status messages
        this.showProcessingStatus(false);
        this.showSaveStatus('', false);
        
        console.log('All data cleared (Viewer, Form, Controller)');
    }
    
    /**
     * Shows or hides the processing status indicator
     * @param {boolean} show - Whether to show the status
     */
    showProcessingStatus(show) {
        if (!this.processingStatus) return;
        
        if (show) {
            this.processingStatus.style.display = 'flex';
        } else {
            this.processingStatus.style.display = 'none';
        }
    }
    
    /**
     * Shows the save status message
     * @param {string} message - Status message to display
     * @param {boolean} success - Whether the operation was successful
     */
    showSaveStatus(message, success) {
        if (!this.saveStatus) return;
        
        if (!message) {
            this.saveStatus.style.display = 'none';
            return;
        }
        
        this.saveStatus.textContent = message;
        this.saveStatus.className = 'save-status';
        
        if (success) {
            this.saveStatus.classList.add('success');
        } else {
            this.saveStatus.classList.add('error');
        }
        
        this.saveStatus.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (this.saveStatus) {
                this.saveStatus.style.display = 'none';
            }
        }, 5000);
    }
    
    /**
     * Shows a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast ('success', 'error', 'info', 'warning')
     */
    showToast(message, type = 'info') {
        if (!this.toast) return;
        
        // Set message
        this.toast.textContent = message;
        
        // Set type class
        this.toast.className = 'toast';
        this.toast.classList.add(`toast-${type}`);
        
        // Show toast
        this.toast.style.display = 'block';
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            if (this.toast) {
                this.toast.style.display = 'none';
            }
        }, 4000);
    }
    
    /**
     * Normalizes a Document ID (CIF/NIF) by removing spaces, dots and hyphens
     * @param {string} docId - The document ID to normalize
     * @returns {string} Normalized document ID
     */
    normalizeDocId(docId) {
        if (!docId) return '';
        return docId.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim();
    }
    
    /**
     * Handles error responses from the API
     */
    async handleErrorResponse(response, defaultMessage) {
        let errorMessage = defaultMessage;
        
        try {
            // Try to parse error response as JSON
            const errorData = await response.json();
            
            if (errorData.message) {
                errorMessage = errorData.message;
            } else if (errorData.error) {
                errorMessage = errorData.error;
            }
            
            // Log detailed error information
            console.error('API Error:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
            });
            
        } catch (parseError) {
            // If response is not JSON, use status text
            errorMessage = `${defaultMessage}: ${response.statusText}`;
            console.error('Error parsing error response:', parseError);
        }
        
        // Show error to user
        this.showToast(errorMessage, 'error');
        
        // Hide processing/saving status
        this.showProcessingStatus(false);
        this.showSaveStatus('', false);
    }

    /**
     * Saves the invoice (Step 2) to the database
     */
    async saveInvoice() {
        if (this.isSaving) return;

        try {
            const invoiceData = this.form.getInvoiceFormData();
            
            // Validate basic required fields for DB
            if (!invoiceData.numFactura || !invoiceData.idSociedad) {
                this.showToast('⚠️ Falta número de factura o sociedad', 'warning');
                return;
            }

            if (!invoiceData.lines || invoiceData.lines.length === 0) {
                this.showToast('⚠️ La factura debe tener al menos una línea', 'warning');
                return;
            }

            // Check for duplicate invoice
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            const exists = await api.checkInvoiceExists({
                idSociedad: parseInt(invoiceData.idSociedad),
                numFactura: invoiceData.numFactura,
                proveedorNombre: invoiceData.proveedorNombre
            });

            if (exists) {
                this.showToast('❌ Ya existe una factura con este número para este proveedor', 'error');
                this.showSaveStatus('❌ Factura duplicada', false);
                return;
            }

            this.showSaveStatus('Guardando factura...', false);
            this.isSaving = true;
            if (this.btnSaveInvoice) this.btnSaveInvoice.disabled = true;

            const result = await api.saveInvoiceDB(invoiceData);

            if (result.success) {
                // Disable save button after success
                if (this.btnSaveInvoice) this.btnSaveInvoice.disabled = true;

                // Notify parent window to refresh the invoice list
                try {
                    window.parent.postMessage('invoice-saved', '*');
                } catch (e) {
                    console.warn('Could not notify parent window:', e);
                }

                // Handle bulk queue: remove finished item and move to next
                if (this.bulk && this.bulk.currentIndex !== -1) {
                    this.showToast('✓ Factura guardada. Pasando a la siguiente...', 'success');
                    setTimeout(() => {
                        this.bulk.removeItem(this.bulk.currentIndex);
                    }, 1000);
                } else {
                    // Not using bulk processor or it's empty, just clear manually
                    this.showToast('✓ Factura guardada', 'success');
                    setTimeout(() => {
                        this.clearAll();
                    }, 1000);
                }
            } else {
                throw new Error(result.message || 'Error desconocido al guardar');
            }

        } catch (error) {
            console.error('Error saving invoice to DB:', error);
            this.showToast(`Error: ${error.message}`, 'error');
            this.showSaveStatus(`❌ Error`, false);
            if (this.btnSaveInvoice) this.btnSaveInvoice.disabled = false;
        } finally {
            this.isSaving = false;
        }
    }
}

// Initialize ExtractionController when DOM is ready
let extractionController;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit to ensure other components are initialized
    setTimeout(() => {
        extractionController = new ExtractionController();
        extractionController.initialize();
        
        // Make it globally accessible for debugging
        window.extractionController = extractionController;
    }, 100);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtractionController;
}
