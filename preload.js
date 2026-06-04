const { contextBridge, ipcRenderer } = require('electron');

const apiBridge = {
    // Invoice processing
    processInvoice: (filePath) => ipcRenderer.invoke('process-invoice', filePath),
    saveInvoice: (invoiceData, originalFileName) => ipcRenderer.invoke('save-invoice', invoiceData, originalFileName),
    
    // Database queries (ported from FacturasProveedorController)
    listSociedades: () => ipcRenderer.invoke('list-sociedades'),
    listFacturas: (sociedadId, limit) => ipcRenderer.invoke('list-facturas', { sociedadId, limit }),
    getFacturasChangeStamp: (sociedadId) => ipcRenderer.invoke('get-facturas-change-stamp', { sociedadId }),
    getUpcomingExpirations: (sociedadId) => ipcRenderer.invoke('get-upcoming-expirations', { sociedadId }),
    getInvoiceDetails: (invoiceId) => ipcRenderer.invoke('get-invoice-details', { invoiceId }),
    toggleInvoicePaid: (invoiceId, isPaid) => ipcRenderer.invoke('toggle-invoice-paid', { invoiceId, isPaid }),
    addInvoicePayment: (data) => ipcRenderer.invoke('add-invoice-payment', data),
    deleteInvoicePayment: (vencimientoId) => ipcRenderer.invoke('delete-invoice-payment', { vencimientoId }),
    deleteInvoice: (invoiceId) => ipcRenderer.invoke('delete-invoice', { invoiceId }),
    
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

    // Estadísticas y Ranking (consultas no triviales)
    getRankingProveedores: (data) => ipcRenderer.invoke('get-ranking-proveedores', data || {}),
    getEstadisticasMensuales: (data) => ipcRenderer.invoke('get-estadisticas-mensuales', data || {}),
    
    // Direct mappings for DB setup compatibility
    dbGetConfig: () => ipcRenderer.invoke('db:getConfig'),
    dbTestConnection: (config) => ipcRenderer.invoke('db:testConnection', config),
    dbGetAccounts: (config) => ipcRenderer.invoke('db:getAccounts', config),
    dbGetModels: (config) => ipcRenderer.invoke('db:getModels', config),
    dbGetMindeeProcesses: (config) => ipcRenderer.invoke('db:getMindeeProcesses', config),
    dbSaveConfig: (config) => ipcRenderer.invoke('db:saveConfig', config),
    dbSetOffline: () => ipcRenderer.invoke('db:setOffline'),

    // Common IPC
    send: (channel, data) => {
        const validChannels = ['login-close', 'window-move', 'login-success', 'open-conexion', 'close-conexion', 'auth:logout'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    on: (channel, func) => {
        const validChannels = ['updater:available', 'facturas:changed', 'auth:user-updated'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    off: (channel, func) => {
        const validChannels = ['updater:available', 'facturas:changed'];
        if (validChannels.includes(channel)) {
            ipcRenderer.removeListener(channel, func);
        }
    },
    onFacturasChanged: (func) => {
        const listener = (_event, payload) => func(payload);
        ipcRenderer.on('facturas:changed', listener);
        return () => ipcRenderer.removeListener('facturas:changed', listener);
    },
    invoke: (channel, data) => {
        const validChannels = [
            'auth:login', 
            'auth:checkWindows', 
            'db:testConnection', 
            'db:saveConfig', 
            'db:getConfig',
            'db:getAccounts',
            'db:getModels',
            'db:getMindeeProcesses',
            'db:setOffline',
            'config:setFondo',
            'config:getFondo',
            'dialog:openFondo',
            'auth:getSession',
            'auth:getRole',
            'admin:listUsers',
            'admin:saveUser',
            'admin:getAuditLog'
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
