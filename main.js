const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mindeeService = require('./services/mindee-service');
const sqlService = require('./services/sql-service');
const xmlService = require('./services/xml-service');
const { 
  authenticateUser, 
  checkWindowsUser, 
  testConnectionWith, 
  saveConfig, 
  readConfig, 
  saveFondo, 
  getFondo 
} = require('./database/db');

// Load environment variables correctly for packaged apps
function getEnvPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, '.env');
    }
    return path.join(__dirname, '.env');
}

require('dotenv').config({ path: getEnvPath() });

let mainWindow = null;
let loginWindow = null;
let conexionWindow = null;
let currentSession = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: true
        },
        title: "Facturas GForma",
        show: false
    });

    mainWindow.loadFile('index.html');
    mainWindow.maximize();
    mainWindow.setMenu(null);
    
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createLoginWindow() {
    loginWindow = new BrowserWindow({
        width: 460,
        height: 650,
        frame: false,
        transparent: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    loginWindow.loadFile('views/inteco-login.html');

    loginWindow.on('closed', () => {
        loginWindow = null;
    });
}

function createConexionWindow() {
    if (conexionWindow) {
        conexionWindow.focus();
        return;
    }

    conexionWindow = new BrowserWindow({
        width: 500,
        height: 700,
        frame: false,
        transparent: true,
        resizable: false,
        parent: loginWindow || mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    conexionWindow.loadFile('views/inteco-conexion.html');

    conexionWindow.on('closed', () => {
        conexionWindow = null;
    });
}

app.whenReady().then(() => {
    createLoginWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            if (!currentSession) createLoginWindow();
            else createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers for Auth and Config ---

ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        win.setPosition(x + deltaX, y + deltaY);
    }
});

ipcMain.on('login-close', () => {
    app.quit();
});

ipcMain.on('login-success', () => {
    if (loginWindow) loginWindow.close();
    createWindow();
});

ipcMain.on('open-conexion', () => {
    createConexionWindow();
});

ipcMain.on('close-conexion', () => {
    if (conexionWindow) conexionWindow.close();
});

ipcMain.handle('auth:login', async (_event, { user, password }) => {
    try {
        const info = await authenticateUser({ user, password });
        currentSession = info;
        return { ok: true, data: info };
    } catch (err) {
        let msg;
        if (err.message === 'NO_CONFIG') {
            msg = 'No hay configuración de conexión. Configura el servidor primero.';
        } else if (err.message === 'NO_PERMISO') {
            msg = 'Usuario o contraseña incorrectos.';
        } else if (err.message.includes('network') || err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
            msg = 'No se pudo conectar al servidor. Revisa la configuración de conexión.';
        } else {
            msg = 'Error al iniciar sesión: ' + err.message;
        }
        return { ok: false, error: msg };
    }
});

ipcMain.handle('auth:getSession', async () => {
    if (!currentSession) return { ok: false, data: null };
    return {
        ok: true,
        data: {
            id: currentSession.Id || currentSession.IdIdentidad || null,
            nombre: currentSession.Nombre || currentSession.NombreCompleto || '',
        }
    };
});

ipcMain.handle('auth:checkWindows', async () => {
    try {
        const data = await checkWindowsUser();
        currentSession = data;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('db:testConnection', async (_event, params) => {
    try {
        const info = await testConnectionWith(params);
        return { ok: true, data: info };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('db:saveConfig', async (_event, config) => {
    try {
        saveConfig(config);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('db:getConfig', async () => {
    try {
        const config = readConfig();
        return {
            ok: true, data: {
                server: config.server,
                database: config.database,
                conexiones: config.conexiones
            }
        };
    } catch {
        return { ok: false, data: null };
    }
});

ipcMain.handle('config:setFondo', async (_e, { fondo }) => {
    try {
        saveFondo(fondo);
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('config:getFondo', async () => {
    try {
        const fondo = getFondo();
        return { fondo };
    } catch {
        return { fondo: null };
    }
});

ipcMain.handle('dialog:openFondo', async () => {
    const defaultPath = path.join(app.getAppPath(), 'dist', 'Fondos');
    const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: fs.existsSync(defaultPath) ? defaultPath : undefined,
        properties: ['openFile'],
        filters: [{ name: 'Imágenes', extensions: ['jpg', 'png', 'jpeg'] }]
    });
    if (canceled) return null;
    return { filePath: filePaths[0] };
});

// --- Original IPC Handlers ---

ipcMain.handle('open-file-dialog', async () => {
    const defaultPath = path.join(os.homedir(), 'Downloads');
    const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: fs.existsSync(defaultPath) ? defaultPath : undefined,
        properties: ['openFile'],
        filters: [
            { name: 'Facturas', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'tiff'] }
        ]
    });
    if (canceled) return null;
    return filePaths[0];
});

ipcMain.handle('process-invoice', async (event, filePath) => {
    try {
        return await mindeeService.extractData(filePath);
    } catch (err) {
        throw new Error(`Error al procesar la factura: ${err.message}`);
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        return fs.readFileSync(filePath);
    } catch (err) {
        throw new Error(`Error al leer el archivo: ${err.message}`);
    }
});

ipcMain.handle('save-invoice', async (event, { invoiceData, originalFileName }) => {
    try {
        const xmlPath = await xmlService.generateXML(invoiceData);
        return {
            success: true,
            message: "Factura guardada exitosamente y XML generado",
            xmlFilePath: xmlPath
        };
    } catch (err) {
        throw new Error(`Error al guardar la factura: ${err.message}`);
    }
});

ipcMain.handle('load-invoice', async (event, xmlPath) => {
    try {
        return await xmlService.parseXML(xmlPath);
    } catch (err) {
        throw new Error(`Error al cargar la factura desde XML: ${err.message}`);
    }
});

ipcMain.handle('list-sociedades', async () => {
    try {
        return await sqlService.listSociedades();
    } catch (err) {
        throw new Error(`Error al listar sociedades: ${err.message}`);
    }
});

ipcMain.handle('get-upcoming-expirations', async (_e, { sociedadId }) => {
    return await sqlService.getUpcomingExpirations(sociedadId);
});

ipcMain.handle('list-facturas', async (event, { sociedadId, limit }) => {
    try {
        return await sqlService.listFacturas(sociedadId, limit);
    } catch (err) {
        throw new Error(`Error al listar facturas: ${err.message}`);
    }
});

ipcMain.handle('get-provincias', async () => {
    try {
        return await sqlService.getProvincias();
    } catch (err) {
        throw new Error(`Error al obtener provincias: ${err.message}`);
    }
});

ipcMain.handle('check-proveedor', async (event, documento) => {
    try {
        return await sqlService.checkProveedorExists(documento);
    } catch (err) {
        throw new Error(`Error al comprobar proveedor: ${err.message}`);
    }
});

ipcMain.handle('save-proveedor', async (event, proveedorData) => {
    try {
        return await sqlService.saveProveedor(proveedorData);
    } catch (err) {
        throw new Error(`Error al guardar proveedor: ${err.message}`);
    }
});

ipcMain.handle('save-invoice-db', async (event, invoiceData) => {
    try {
        return await sqlService.saveInvoiceDB(invoiceData);
    } catch (err) {
        throw new Error(`Error al guardar factura en BD: ${err.message}`);
    }
});

ipcMain.handle('check-invoice-exists', async (event, { idSociedad, idProveedor, numFactura, proveedorNombre }) => {
    try {
        return await sqlService.checkInvoiceExists(idSociedad, idProveedor, numFactura, proveedorNombre);
    } catch (err) {
        throw new Error(`Error al comprobar existencia de factura: ${err.message}`);
    }
});

ipcMain.handle('get-poblacion-by-cp', async (event, cp) => {
    try {
        return await sqlService.getPoblacionByCP(cp);
    } catch (err) {
        console.error('Error fetching poblacion:', err);
        return null;
    }
});

ipcMain.handle('get-invoice-details', async (_e, { invoiceId }) => {
    try {
        return await sqlService.getInvoiceDetails(invoiceId);
    } catch (err) {
        throw new Error(`Error al obtener detalles de la factura: ${err.message}`);
    }
});

ipcMain.handle('toggle-invoice-paid', async (_e, { invoiceId, isPaid }) => {
    try {
        return await sqlService.toggleInvoicePaid(invoiceId, isPaid);
    } catch (err) {
        throw new Error(`Error al actualizar estado de pago: ${err.message}`);
    }
});

ipcMain.handle('add-invoice-payment', async (_e, { invoiceId, paymentData }) => {
    try {
        return await sqlService.addInvoicePayment(invoiceId, paymentData);
    } catch (err) {
        throw new Error(`Error al añadir pago: ${err.message}`);
    }
});

ipcMain.handle('delete-invoice-payment', async (_e, { vencimientoId }) => {
    try {
        return await sqlService.deleteInvoicePayment(vencimientoId);
    } catch (err) {
        throw new Error(`Error al eliminar pago: ${err.message}`);
    }
});

ipcMain.handle('get-next-num-factura', async (_e, { sociedadId, fecha }) => {
    try {
        return await sqlService.getNextNumFactura(sociedadId, fecha);
    } catch (err) {
        throw new Error(`Error al obtener siguiente número de factura: ${err.message}`);
    }
});