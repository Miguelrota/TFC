const { contextBridge, ipcRenderer } = require('electron');

const apiBridge = {
    // Invoice processing
    processInvoice: (filePath) => ipcRenderer.invoke('process-invoice', filePath),
    saveInvoice: (invoiceData, originalFileName) => ipcRenderer.invoke('save-invoice', invoiceData, originalFileName),
    
    // Database queries (ported from FacturasProveedorController)
    listSociedades: () => ipcRenderer.invoke('list-sociedades'),
    listFacturas: (sociedadId, limit) => ipcRenderer.invoke('list-facturas', { sociedadId, limit }),
    getUpcomingExpirations: (sociedadId) => ipcRenderer.invoke('get-upcoming-expirations', { sociedadId }),
    getInvoiceDetails: (invoiceId) => ipcRenderer.invoke('get-invoice-details', { invoiceId }),
    toggleInvoicePaid: (invoiceId, isPaid) => ipcRenderer.invoke('toggle-invoice-paid', { invoiceId, isPaid }),
    addInvoicePayment: (data) => ipcRenderer.invoke('add-invoice-payment', data),
    deleteInvoicePayment: (vencimientoId) => ipcRenderer.invoke('delete-invoice-payment', { vencimientoId }),
    
    // File operations
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    loadInvoice: (xmlPath) => ipcRenderer.invoke('load-invoice', xmlPath),
    
    // Proveedores
    getProvincias: () => ipcRenderer.invoke('get-provincias'),
    checkProveedor: (documento) => ipcRenderer.invoke('check-proveedor', documento),
    saveProveedor: (proveedorData) => ipcRenderer.invoke('save-proveedor', proveedorData),
    saveInvoiceDB: (invoiceData) => ipcRenderer.invoke('save-invoice-db', invoiceData),
    getPoblacionByCP: (cp) => ipcRenderer.invoke('get-poblacion-by-cp', cp),
    checkInvoiceExists: (data) => ipcRenderer.invoke('check-invoice-exists', data),
    getNextNumFactura: (data) => ipcRenderer.invoke('get-next-num-factura', data),

    // Common IPC
    send: (channel, data) => {
        const validChannels = ['login-close', 'window-move', 'login-success', 'open-conexion', 'close-conexion'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    on: (channel, func) => {
        const validChannels = ['updater:available'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    invoke: (channel, data) => {
        const validChannels = [
            'auth:login', 
            'auth:checkWindows', 
            'db:testConnection', 
            'db:saveConfig', 
            'db:getConfig',
            'config:setFondo',
            'config:getFondo',
            'dialog:openFondo',
            'auth:getSession'
        ];
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, data);
        }
    },
    // Para Drag & Drop
    getPathForFile: (file) => {
        const { webUtils } = require('electron');
        return webUtils.getPathForFile(file);
    }
};

// Exponemos ambos nombres para mantener compatibilidad con el código existente y el nuevo sistema de login
contextBridge.exposeInMainWorld('api', apiBridge);
contextBridge.exposeInMainWorld('electronAPI', apiBridge);
