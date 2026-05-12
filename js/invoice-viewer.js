/**
 * InvoiceViewer Component
 * Handles document visualization (PDF and images) in the left panel
 */
class InvoiceViewer {
    constructor() {
        this.canvas = document.getElementById('documentCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.placeholder = document.querySelector('.viewer-placeholder');
        this.viewerContent = document.getElementById('viewerContent');
        this.processButton = document.getElementById('btnProcessIA');
        
        // Document state
        this.currentFilePath = null;
        this.currentFileName = null;
        this.currentDocument = null; // For PDF documents
        this.currentImage = null; // For image documents
        this.documentType = null; // 'pdf' or 'image'
        this.currentPage = 1;
        this.totalPages = 1;
        
        // Initialize PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Callback for when a document is loaded
        this.onDocumentLoaded = null;

        // Zoom state
        this.currentZoom = 1.53;
        this.zoomLevelDisplay = document.getElementById('zoomLevel');
        this.btnZoomIn = document.getElementById('btnZoomIn');
        this.btnZoomOut = document.getElementById('btnZoomOut');
        this.btnZoomReset = document.getElementById('btnZoomReset');

        // Pagination state
        this.pageControls = document.getElementById('pageControls');
        this.pageInfoDisplay = document.getElementById('pageInfo');
        this.btnPrevPage = document.getElementById('btnPrevPage');
        this.btnNextPage = document.getElementById('btnNextPage');

        this.initZoomEvents();
        this.initPaginationEvents();
        this.initDragAndDrop();
    }

    /**
     * Initialize drag and drop event listeners
     */
    initDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Highlight drop zone when item is dragged over
        ['dragenter', 'dragover'].forEach(eventName => {
            document.addEventListener(eventName, () => {
                this.viewerContent.style.backgroundColor = 'var(--accent-bg)';
                this.viewerContent.style.border = '2px dashed var(--accent)';
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, () => {
                this.viewerContent.style.backgroundColor = '';
                this.viewerContent.style.border = '';
            }, false);
        });

        // Handle dropped files
        document.addEventListener('drop', async (e) => {
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const api = window.api || window.electronAPI;
                const filePath = api.getPathForFile ? api.getPathForFile(files[0]) : files[0].path;
                
                if (filePath) {
                    const isSupported = /\.(pdf|jpg|jpeg|png|tiff|tif)$/i.test(filePath);
                    if (isSupported) {
                        try {
                            await this.loadDocument(filePath);
                            console.log('Documento cargado vía Drag & Drop:', filePath);
                        } catch (error) {
                            console.error('Error al cargar documento droppeado:', error);
                        }
                    } else {
                        alert('Formato de archivo no soportado. Use PDF, JPEG, PNG o TIFF.');
                    }
                }
            }
        }, false);
    }

    /**
     * Initialize zoom event listeners
     */
    initZoomEvents() {
        if (this.btnZoomIn) {
            this.btnZoomIn.addEventListener('click', () => this.changeZoom(0.1));
        }
        if (this.btnZoomOut) {
            this.btnZoomOut.addEventListener('click', () => this.changeZoom(-0.1));
        }
        if (this.btnZoomReset) {
            this.btnZoomReset.addEventListener('click', () => this.resetZoom());
        }
    }

    /**
     * Initialize pagination event listeners
     */
    initPaginationEvents() {
        if (this.btnPrevPage) {
            this.btnPrevPage.addEventListener('click', () => this.changePage(-1));
        }
        if (this.btnNextPage) {
            this.btnNextPage.addEventListener('click', () => this.changePage(1));
        }
    }

    /**
     * Change zoom level and re-render
     * @param {number} delta - Amount to change zoom by
     */
    async changeZoom(delta) {
        const newZoom = Math.min(Math.max(this.currentZoom + delta, 0.1), 5.0);
        if (newZoom !== this.currentZoom) {
            this.currentZoom = newZoom;
            this.updateZoomDisplay();
            await this.reRender();
        }
    }

    /**
     * Reset zoom to default (fit to screen)
     */
    async resetZoom() {
        // For 'reset', we re-calculate the fit scale
        await this.loadDocument(this.currentFilePath, true);
    }

    /**
     * Update the zoom level percentage in the UI
     */
    updateZoomDisplay() {
        if (this.zoomLevelDisplay) {
            this.zoomLevelDisplay.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
    }

    /**
     * Re-render current document with current zoom level
     */
    async reRender() {
        if (!this.currentFilePath) return;

        if (this.documentType === 'pdf') {
            await this.renderPDFPage(this.currentZoom);
        } else if (this.documentType === 'image') {
            await this.renderImage(this.currentZoom);
        }
    }

    /**
     * Change current page and re-render
     * @param {number} delta - Amount to change page by
     */
    async changePage(delta) {
        const newPage = Math.min(Math.max(this.currentPage + delta, 1), this.totalPages);
        if (newPage !== this.currentPage) {
            this.currentPage = newPage;
            this.updatePageDisplay();
            await this.reRender();
        }
    }

    /**
     * Update the page information display
     */
    updatePageDisplay() {
        if (this.pageInfoDisplay) {
            this.pageInfoDisplay.textContent = `${this.currentPage} / ${this.totalPages}`;
        }
        if (this.btnPrevPage) this.btnPrevPage.disabled = (this.currentPage <= 1);
        if (this.btnNextPage) this.btnNextPage.disabled = (this.currentPage >= this.totalPages);
    }

    /**
     * Load and render a document (PDF or image) from a file path
     * @param {string} filePath - Path to the file
     * @returns {Promise<void>}
     */


    /**
     * Load and render a PDF document
     * @param {Uint8Array} data - PDF data
     * @returns {Promise<void>}
     */
    async loadDocument(filePath, isReset = false) {
        if (!filePath) {
            throw new Error('No se proporcionó ninguna ruta de archivo');
        }

        const fileName = filePath.toLowerCase();
        const isPDF = fileName.endsWith('.pdf');
        const isImage = fileName.match(/\.(jpg|jpeg|png|tiff|tif)$/);

        if (!isPDF && !isImage) {
            throw new Error('Formato de archivo no soportado. Use PDF, JPEG, PNG o TIFF.');
        }

        try {
            // Read file content if not just resetting zoom
            let fileData;
            if (!isReset) {
                fileData = await window.electronAPI.readFile(filePath);
                this.currentFilePath = filePath;
                this.currentFileName = filePath.split(/[\\/]/).pop();
            }
            
            // Load based on type
                if (isPDF) {
                if (!isReset) {
                    const loadingTask = pdfjsLib.getDocument({ data: fileData });
                    this.currentDocument = await loadingTask.promise;
                    this.documentType = 'pdf';
                    this.totalPages = this.currentDocument.numPages;
                    this.currentPage = 1;
                }
                
                // For initial load or reset, use 153% as default or calculate "fit" scale if requested
                if (!isReset || isReset === true) {
                    // If it's the very first load and we have a target zoom, use it.
                    // Otherwise, we could calculate fit, but the user specifically asked for 153%
                    this.currentZoom = 1.53;
                }

                // Show/hide pagination controls
                if (this.pageControls) {
                    this.pageControls.style.display = this.totalPages > 1 ? 'flex' : 'none';
                    this.updatePageDisplay();
                }
                
                await this.renderPDFPage(this.currentZoom);
                } else {
                if (!isReset) {
                    await this.loadImageObject(fileData);
                    this.documentType = 'image';
                    this.totalPages = 1;
                    this.currentPage = 1;
                }

                // For initial load or reset, use 153% as default
                if (!isReset || isReset === true) {
                    this.currentZoom = 1.53;
                }

                // Hide pagination controls for images
                if (this.pageControls) {
                    this.pageControls.style.display = 'none';
                }

                await this.renderImage(this.currentZoom);
            }

            this.updateZoomDisplay();

            // Show canvas and hide placeholder
            this.canvas.style.display = 'block';
            this.placeholder.style.display = 'none';
            
            // Enable the process button
            if (this.processButton) this.processButton.disabled = false;
            
            // Trigger callback if defined and it's a new file
            if (!isReset && typeof this.onDocumentLoaded === 'function') {
                this.onDocumentLoaded();
            }
            
        } catch (error) {
            this.handleLoadError(error);
            throw error;
        }
    }

    /**
     * Helper to load an image into an Image object
     */
    async loadImageObject(fileData) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([fileData]);
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = () => reject(new Error('Error al cargar imagen'));
            img.src = url;
        });
    }

    /**
     * Render a PDF page with given scale
     */
    async renderPDFPage(scale) {
        if (!this.currentDocument) return;
        const page = await this.currentDocument.getPage(this.currentPage);
        const viewport = page.getViewport({ scale });
        
        this.canvas.width = viewport.width;
        this.canvas.height = viewport.height;
        
        await page.render({
            canvasContext: this.ctx,
            viewport: viewport
        }).promise;
    }

    /**
     * Render image with given scale
     */
    async renderImage(scale) {
        if (!this.currentImage) return;
        
        this.canvas.width = this.currentImage.width * scale;
        this.canvas.height = this.currentImage.height * scale;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.currentImage, 0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Get document data for API upload
     * @returns {Promise<{path: string, type: string}>}
     */
    async getDocumentData() {
        if (!this.currentFilePath) {
            throw new Error('No hay documento cargado');
        }
        
        return {
            path: this.currentFilePath,
            type: this.documentType
        };
    }

    /**
     * Clear the viewer
     */
    clear() {
        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Reset state
        this.currentFilePath = null;
        this.currentFileName = null;
        this.currentDocument = null;
        this.currentImage = null;
        this.documentType = null;
        
        // Hide canvas and show placeholder
        this.canvas.style.display = 'none';
        this.placeholder.style.display = 'block';
        
        // Disable process button
        if (this.processButton) this.processButton.disabled = true;
    }

    /**
     * Handle load errors
     * @param {Error} error - The error that occurred
     */
    handleLoadError(error) {
        console.error('Error loading document:', error);
        
        // Clear any partial state
        this.clear();
        
        // Show error message to user
        this.showErrorMessage(error.message || 'Error al cargar el documento');
    }

    /**
     * Show error message in the viewer
     * @param {string} message - Error message to display
     */
    showErrorMessage(message) {
        // Create or update error display in placeholder
        const errorDiv = document.createElement('div');
        errorDiv.className = 'viewer-error';
        errorDiv.style.color = 'var(--error-color)';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.padding = '20px';
        errorDiv.innerHTML = `
            <div style=\"font-size: 3rem; margin-bottom: 15px;\">⚠️</div>
            <p style=\"font-weight: 600; margin-bottom: 10px;\">Error al cargar documento</p>
            <p style=\"font-size: 0.9rem; opacity: 0.8;\">${message}</p>
        `;
        
        // Replace placeholder content temporarily
        const originalContent = this.placeholder.innerHTML;
        this.placeholder.innerHTML = '';
        this.placeholder.appendChild(errorDiv);
        
        // Restore original placeholder after 5 seconds
        setTimeout(() => {
            this.placeholder.innerHTML = originalContent;
        }, 5000);
    }
}

// Initialize InvoiceViewer when DOM is ready
let invoiceViewer;

document.addEventListener('DOMContentLoaded', () => {
    invoiceViewer = new InvoiceViewer();
    window.invoiceViewer = invoiceViewer;
    
    const btnLoadDocument = document.getElementById('btnLoadDocument');
    
    // Click load button to trigger native file dialog
    btnLoadDocument.addEventListener('click', async () => {
        try {
            console.log('Cargar Documento: Botón pulsado');
            
            // Intentar obtener la API de la ventana actual o de la ventana padre (si es un iframe)
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            
            if (!api) {
                console.error('API de Electron no detectada');
                alert('No se pudo acceder a las funciones del sistema. Por favor, asegúrese de estar ejecutando la aplicación en Electron.');
                return;
            }

            const filePath = await api.openFileDialog();
            console.log('Ruta seleccionada:', filePath);
            
            if (filePath) {
                await invoiceViewer.loadDocument(filePath);
                console.log('Documento cargado con éxito');
            }
        } catch (error) {
            console.error('Error al abrir el explorador:', error);
            alert('Error al abrir el explorador: ' + error.message);
        }
    });

    // Listen for messages from parent window
    window.addEventListener('message', (event) => {
        if (event.data === 'open-file-dialog') {
            console.log('Message received: open-file-dialog');
            btnLoadDocument.click();
        }
    });
});
