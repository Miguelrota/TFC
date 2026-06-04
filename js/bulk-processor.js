/**
 * BulkProcessor Component
 * 
 * Manages a queue of invoice files for background extraction.
 * Handles drag & drop, file selection, and status tracking.
 */
class BulkProcessor {
    constructor() {
        this.queue = [];
        this.currentIndex = -1;
        this.isProcessing = false;
        
        // DOM Elements
        this.queuePanel = document.getElementById('queuePanel');
        this.queueList = document.getElementById('queueList');
        this.queueCount = document.getElementById('queueCount');
        this.btnClearQueue = document.getElementById('btnClearQueue');
        this.btnHideQueue = document.getElementById('btnHideQueue');
        this.btnShowQueue = document.getElementById('btnShowQueue');
        this.dropOverlay = document.getElementById('dropOverlay');
        this.resizer = document.getElementById('resizerQueue');
        
        // Callbacks
        this.onFileSelected = null;
        this.onProcessingStarted = null;
        this.onProcessingFinished = null;
    }

    initialize() {
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.setupResizer();
        
        // Hide panel initially if empty
        this.updatePanelVisibility();
        
        console.log('BulkProcessor initialized');
    }

    setupEventListeners() {
        if (this.btnClearQueue) {
            this.btnClearQueue.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearQueue();
            });
        }

        if (this.btnHideQueue) {
            this.btnHideQueue.addEventListener('click', () => {
                this.togglePanel(false);
            });
        }

        if (this.btnShowQueue) {
            this.btnShowQueue.addEventListener('click', () => {
                this.togglePanel(true);
            });
        }

        // Listen for files from parent window
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'bulk-files-dropped') {
                console.log('Bulk files received from parent:', event.data.files);
                this.addFilesToQueue(event.data.files);
            }
        });
    }

    setupResizer() {
        if (!this.resizer || !this.queuePanel) return;

        let isResizing = false;
        this.resizer.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth > 150 && newWidth < 500) {
                this.queuePanel.style.width = `${newWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        });
    }

    setupDragAndDrop() {
        const body = document.body;

        body.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dropOverlay.classList.add('active');
        });

        body.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only hide if we actually left the window
            if (e.relatedTarget === null) {
                this.dropOverlay.classList.remove('active');
            }
        });

        body.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dropOverlay.classList.remove('active');

            const files = Array.from(e.dataTransfer.files);
            const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
            
            if (pdfs.length > 0) {
                this.addFilesToQueue(pdfs);
            }
        });
    }

    async addFilesToQueue(files) {
        const api = window.electronAPI || (window.parent && window.parent.electronAPI);
        const newItems = files.map(file => ({
            file: file,
            path: (api && api.getPathForFile && file instanceof File) ? api.getPathForFile(file) : (file.path || ''), 
            name: file.name,
            status: 'pending', // pending, processing, ready, error
            result: null,
            error: null
        }));

        const startIndex = this.queue.length;
        this.queue.push(...newItems);
        this.renderQueue();
        this.updatePanelVisibility();

        // If nothing is playing and we added files, select the first new one
        if (this.currentIndex === -1) {
            this.selectItem(0);
        }

        // Start background processing
        this.processNextInQueue();
    }

    async processNextInQueue() {
        if (this.isProcessing) return;

        const nextToProcess = this.queue.find(item => item.status === 'pending');
        if (!nextToProcess) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        nextToProcess.status = 'processing';
        this.updateItemUI(nextToProcess);

        try {
            const api = window.electronAPI || (window.parent && window.parent.electronAPI);
            if (!api) throw new Error('API de Electron no detectada');

            // Notify start if it's the current one
            if (this.queue.indexOf(nextToProcess) === this.currentIndex) {
                if (this.onProcessingStarted) this.onProcessingStarted(nextToProcess);
            }

            console.log(`Bulk processing: ${nextToProcess.name}`);
            const result = await api.processInvoice(nextToProcess.path);
            
            nextToProcess.result = result;
            nextToProcess.status = 'ready';
            
            // Notify finish if it's the current one
            if (this.queue.indexOf(nextToProcess) === this.currentIndex) {
                if (this.onProcessingFinished) this.onProcessingFinished(nextToProcess);
            }

        } catch (error) {
            console.error(`Error in bulk processing ${nextToProcess.name}:`, error);
            nextToProcess.status = 'error';
            nextToProcess.error = error.message;
        } finally {
            this.updateItemUI(nextToProcess);
            this.isProcessing = false;
            // Recursively process next with a 1-second delay to be polite to the API
            setTimeout(() => this.processNextInQueue(), 1000);
        }
    }

    selectItem(index) {
        if (index < 0 || index >= this.queue.length) return;
        
        this.currentIndex = index;
        const item = this.queue[index];
        
        // Update UI active state
        const elements = this.queueList.querySelectorAll('.queue-item');
        elements.forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        // Trigger callback
        if (this.onFileSelected) {
            this.onFileSelected(item);
        }
    }

    renderQueue() {
        this.queueList.innerHTML = '';
        this.queue.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = `queue-item ${index === this.currentIndex ? 'active' : ''}`;
            
            let statusText = this.getStatusText(item.status);
            if (item.status === 'error' && item.error) {
                statusText = `Error: ${item.error.substring(0, 30)}${item.error.length > 30 ? '...' : ''}`;
            }

            el.innerHTML = `
                <div class="queue-item-name" title="${item.name}">${item.name}</div>
                <div class="queue-item-status status-${item.status}" title="${item.error || ''}">
                    <span class="status-dot"></span>
                    <span>${statusText}</span>
                </div>
            `;
            el.addEventListener('click', () => this.selectItem(index));
            this.queueList.appendChild(el);
        });
        this.queueCount.textContent = this.queue.length;
    }

    updateItemUI(item) {
        const index = this.queue.indexOf(item);
        if (index === -1) return;
        
        const el = this.queueList.children[index];
        if (!el) return;

        const statusEl = el.querySelector('.queue-item-status');
        statusEl.className = `queue-item-status status-${item.status}`;
        
        let statusText = this.getStatusText(item.status);
        if (item.status === 'error' && item.error) {
            statusText = `Error: ${item.error.substring(0, 30)}${item.error.length > 30 ? '...' : ''}`;
        }
        
        statusEl.querySelector('span:last-child').textContent = statusText;
        statusEl.title = item.error || '';
    }

    getStatusText(status) {
        switch (status) {
            case 'pending': return 'Pendiente';
            case 'processing': return 'Analizando...';
            case 'ready': return 'Listo';
            case 'error': return 'Error';
            default: return status;
        }
    }

    updatePanelVisibility() {
        if (this.queue.length > 0) {
            this.queuePanel.style.display = 'flex';
            this.resizer.style.display = 'block';
        } else {
            this.queuePanel.style.display = 'none';
            this.resizer.style.display = 'none';
        }
    }

    removeItem(index) {
        if (index < 0 || index >= this.queue.length) return;
        
        this.queue.splice(index, 1);
        
        this.renderQueue();
        this.updatePanelVisibility();
        
        if (this.queue.length > 0) {
            // Select the same index (which is now the next item) or the last one
            const nextIndex = Math.min(index, this.queue.length - 1);
            this.selectItem(nextIndex);
        } else {
            this.currentIndex = -1;
            if (this.onFileSelected) {
                this.onFileSelected(null);
            }
        }
    }

    clearQueue() {
        this.queue = [];
        this.currentIndex = -1;
        this.renderQueue();
        this.updatePanelVisibility();
        
        if (this.onFileSelected) {
            this.onFileSelected(null);
        }
    }

    togglePanel(visible) {
        if (visible) {
            this.queuePanel.classList.remove('collapsed');
            this.btnShowQueue.classList.remove('visible');
            this.resizer.style.display = 'block';
        } else {
            this.queuePanel.classList.add('collapsed');
            this.btnShowQueue.classList.add('visible');
            this.resizer.style.display = 'none';
        }
    }
}

// Initialize when scripts are loaded
window.bulkProcessor = new BulkProcessor();
window.bulkProcessor.initialize();
